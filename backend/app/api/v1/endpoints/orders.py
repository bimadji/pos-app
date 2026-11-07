"""Order management endpoints: create order (QR session), void, move table."""
import uuid
from typing import Annotated
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.deps.table_token import get_table_session
from app.deps.auth import get_current_user, enforce_tenant_id
from app.models.table import Table
from app.models.product import Product
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.user import User
from app.schemas.order import (
    OrderCreateRequest,
    OrderDetailResponse,
    MoveTableRequest,
    CancelOrderRequest,
)
from app.schemas.catalog import Response
from app.services.order_service import create_or_append_order

router = APIRouter()


@router.post("", response_model=Response, status_code=status.HTTP_201_CREATED)
async def submit_order(
    payload: OrderCreateRequest,
    table: Annotated[Table, Depends(get_table_session)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Customer submits an order via scanned table QR token (atomic stock + multi-round)."""
    order = await create_or_append_order(table, payload, db)

    # Load items with relationship
    stmt = (
        select(Order)
        .where(Order.id == order.id)
        .options(selectinload(Order.items))
    )
    full_order = (await db.execute(stmt)).scalar_one()

    return Response(
        success=True,
        data=OrderDetailResponse.model_validate(full_order),
    )


@router.get("/active", response_model=Response)
async def list_active_orders(
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    """Cashier/Kitchen retrieves all open dine-in orders."""
    stmt = (
        select(Order)
        .where(
            Order.tenant_id == tenant_id,
            Order.status.in_(["PENDING", "COOKING", "SERVED"]),
        )
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    )
    orders = (await db.execute(stmt)).scalars().all()
    return Response(
        success=True,
        data=[OrderDetailResponse.model_validate(o) for o in orders],
    )


@router.patch("/{order_id}/status", response_model=Response)
async def update_order_status(
    order_id: uuid.UUID,
    new_status: str,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    """Barista/Cashier updates order lifecycle status (COOKING, SERVED)."""
    if new_status not in ["COOKING", "SERVED"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_STATUS", "message": "Status hanya boleh COOKING atau SERVED."},
        )

    stmt = select(Order).where(Order.id == order_id, Order.tenant_id == tenant_id)
    order = (await db.execute(stmt)).scalar_one_or_none()

    if not order or order.status in ["COMPLETED", "CANCELLED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ORDER_NOT_EDITABLE", "message": "Pesanan tidak dapat diubah statusnya."},
        )

    order.status = new_status
    await db.commit()
    await db.refresh(order)

    from app.services.sse_service import broadcaster
    broadcaster.broadcast(
        tenant_id=tenant_id,
        event="order.status_changed",
        data={
            "order_id": str(order.id),
            "table_number": order.table_number_snapshot,
            "new_status": order.status,
        },
    )
    return Response(success=True, data={"order_id": str(order.id), "status": order.status})


@router.patch("/{order_id}/move-table", response_model=Response)
async def move_table(
    order_id: uuid.UUID,
    payload: MoveTableRequest,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    """Move active order to an empty table."""
    # 1. Cari order aktif
    order_stmt = select(Order).where(Order.id == order_id, Order.tenant_id == tenant_id)
    order = (await db.execute(order_stmt)).scalar_one_or_none()

    if not order or order.status in ["COMPLETED", "CANCELLED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ORDER_NOT_ACTIVE", "message": "Pesanan tidak aktif."},
        )

    # 2. Cari target meja dan pastikan kosong
    target_stmt = select(Table).where(
        Table.tenant_id == tenant_id, Table.table_number == payload.new_table_number
    )
    target_table = (await db.execute(target_stmt)).scalar_one_or_none()

    if not target_table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TABLE_NOT_FOUND", "message": f"Meja {payload.new_table_number} tidak ditemukan."},
        )

    # Cek apakah ada order aktif lain di meja target
    conflict_stmt = select(Order).where(
        Order.table_id == target_table.id,
        Order.status.in_(["PENDING", "COOKING", "SERVED"]),
        Order.id != order.id,
    )
    if (await db.execute(conflict_stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "TABLE_OCCUPIED", "message": f"Meja {payload.new_table_number} sedang terisi tamu lain."},
        )

    # 3. Bebaskan meja lama, duduki meja baru
    old_table_stmt = select(Table).where(Table.id == order.table_id)
    old_table = (await db.execute(old_table_stmt)).scalar_one()
    old_table.status = "AVAILABLE"

    target_table.status = "OCCUPIED"
    order.table_id = target_table.id
    order.table_number_snapshot = target_table.table_number

    await db.commit()

    from app.services.sse_service import broadcaster
    broadcaster.broadcast(
        tenant_id=tenant_id,
        event="table.status_changed",
        data={
            "order_id": str(order.id),
            "old_table_number": order.table_number_snapshot,
            "new_table_number": target_table.table_number,
        },
    )
    return Response(
        success=True,
        data={
            "order_id": str(order.id),
            "new_table_number": target_table.table_number,
            "message": f"Pesanan berhasil dipindahkan ke Meja {target_table.table_number}.",
        },
    )


@router.post("/{order_id}/cancel", response_model=Response)
async def cancel_order(
    order_id: uuid.UUID,
    payload: CancelOrderRequest,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    """Void order: change status to CANCELLED and atomically rollback all product stock."""
    # 1. Cari order aktif
    order_stmt = (
        select(Order)
        .where(Order.id == order_id, Order.tenant_id == tenant_id)
        .options(selectinload(Order.items))
    )
    order = (await db.execute(order_stmt)).scalar_one_or_none()

    if not order or order.status in ["COMPLETED", "CANCELLED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ORDER_ALREADY_CLOSED", "message": "Pesanan sudah selesai atau dibatalkan."},
        )

    # 2. Rollback stok seluruh produk di order_items
    for item in order.items:
        rollback_stmt = (
            update(Product)
            .where(Product.id == item.product_id, Product.tenant_id == tenant_id)
            .values(stock=Product.stock + item.quantity)
        )
        await db.execute(rollback_stmt)

    # 3. Tandai order batal & kosongkan meja
    order.status = "CANCELLED"
    order.cancellation_reason = payload.cancellation_reason

    table_stmt = select(Table).where(Table.id == order.table_id)
    table = (await db.execute(table_stmt)).scalar_one_or_none()
    if table:
        table.status = "AVAILABLE"

    await db.commit()

    from app.services.sse_service import broadcaster
    broadcaster.broadcast(
        tenant_id=tenant_id,
        event="order.cancelled",
        data={
            "order_id": str(order.id),
            "table_number": order.table_number_snapshot,
            "cancellation_reason": order.cancellation_reason,
        },
    )
    return Response(
        success=True,
        data={
            "order_id": str(order.id),
            "status": "CANCELLED",
            "cancellation_reason": order.cancellation_reason,
            "message": "Pesanan berhasil dibatalkan dan seluruh stok produk telah dikembalikan.",
        },
    )
