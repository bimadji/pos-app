"""Order transaction service: atomic stock check, multi-round calculation, void."""
import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from fastapi import HTTPException, status

from app.models.tenant import Tenant
from app.models.table import Table
from app.models.product import Product
from app.models.order import Order
from app.models.order_item import OrderItem
from app.schemas.order import OrderCreateRequest


async def create_or_append_order(
    table: Table,
    payload: OrderCreateRequest,
    db: AsyncSession,
) -> Order:
    """Create a new order or append round-2 items with atomic stock decrement."""
    tenant_stmt = select(Tenant).where(Tenant.id == table.tenant_id)
    tenant = (await db.execute(tenant_stmt)).scalar_one()

    # 1. Cari apakah ada order aktif meja ini yang belum selesai/batal
    order_stmt = select(Order).where(
        Order.table_id == table.id,
        Order.status.in_(["PENDING", "COOKING", "SERVED"]),
    )
    order = (await db.execute(order_stmt)).scalar_one_or_none()

    is_new_order = order is None
    current_round = 1

    if is_new_order:
        order = Order(
            tenant_id=table.tenant_id,
            table_id=table.id,
            table_number_snapshot=table.table_number,
            customer_name=payload.customer_name,
            status="PENDING",
            subtotal=Decimal("0.00"),
            service_amount=Decimal("0.00"),
            tax_amount=Decimal("0.00"),
            grand_total=Decimal("0.00"),
        )
        db.add(order)
        await db.flush()  # dapatkan order.id
        table.status = "OCCUPIED"
    else:
        # Hitung babak berikutnya
        round_stmt = (
            select(OrderItem.round_number)
            .where(OrderItem.order_id == order.id)
            .order_by(OrderItem.round_number.desc())
        )
        last_round = (await db.execute(round_stmt)).scalars().first() or 1
        current_round = last_round + 1

    # 2. Conditional Atomic Update: potong stok tiap item
    new_subtotal_delta = Decimal("0.00")

    for item in payload.items:
        # Kueri atomik berkondisi: WHERE stock >= qty AND is_available == True
        stock_stmt = (
            update(Product)
            .where(
                Product.id == item.product_id,
                Product.tenant_id == table.tenant_id,
                Product.is_available == True,
                Product.stock >= item.quantity,
            )
            .values(stock=Product.stock - item.quantity)
            .returning(Product.id, Product.name, Product.price)
        )
        stock_res = await db.execute(stock_stmt)
        product_row = stock_res.fetchone()

        if not product_row:
            # Gagal potong stok: batalkan seluruh transaksi dan balas 409
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "INSUFFICIENT_STOCK",
                    "message": "Stok produk tidak mencukupi atau menu saat ini habis.",
                    "product_id": str(item.product_id),
                },
            )

        prod_id, prod_name, prod_price = product_row
        item_subtotal = Decimal(str(prod_price)) * Decimal(str(item.quantity))
        new_subtotal_delta += item_subtotal

        # Snapshot order_item
        order_item = OrderItem(
            order_id=order.id,
            product_id=prod_id,
            product_name_snapshot=prod_name,
            price_snapshot=Decimal(str(prod_price)),
            quantity=item.quantity,
            subtotal=item_subtotal,
            notes=item.notes,
            round_number=current_round,
            item_status="PENDING",
        )
        db.add(order_item)

    # 3. Akumulasi Total Tagihan (Subtotal, Service, Pajak PB1, Grand Total)
    order.subtotal += new_subtotal_delta
    order.service_amount = (order.subtotal * tenant.service_rate).quantize(Decimal("0.01"))
    order.tax_amount = ((order.subtotal + order.service_amount) * tenant.tax_rate).quantize(Decimal("0.01"))
    order.grand_total = (order.subtotal + order.service_amount + order.tax_amount).quantize(Decimal("0.01"))

    await db.commit()
    await db.refresh(order)

    # 4. Broadcast realtime ke kasir & pelanggan
    from app.services.sse_service import broadcaster
    event_name = "order.created" if is_new_order else "order.round_added"
    broadcaster.broadcast(
        tenant_id=table.tenant_id,
        event=event_name,
        data={
            "order_id": str(order.id),
            "table_number": order.table_number_snapshot,
            "customer_name": order.customer_name,
            "status": order.status,
            "round_number": current_round,
            "grand_total": float(order.grand_total),
        },
    )
    return order
