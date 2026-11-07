"""Payment endpoints with Idempotency-Key guard."""
import uuid
from decimal import Decimal
from typing import Annotated
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.deps.auth import get_current_user, enforce_tenant_id
from app.models.table import Table
from app.models.order import Order
from app.models.payment import Payment
from app.models.user import User
from app.schemas.payment import PaymentRequest, PaymentResponse
from app.schemas.catalog import Response

router = APIRouter()


@router.post("/{order_id}/pay", response_model=Response)
async def process_payment(
    order_id: uuid.UUID,
    payload: PaymentRequest,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
):
    """Settle order bill with cash or static QRIS, strictly protected by Idempotency-Key."""
    # 1. Validasi keberadaan Idempotency-Key
    if not idempotency_key or len(idempotency_key.strip()) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "MISSING_IDEMPOTENCY_KEY",
                "message": "Header 'Idempotency-Key' wajib disertakan untuk mencegah pembayaran ganda.",
            },
        )

    clean_key = idempotency_key.strip()

    # 2. Cek apakah key ini sudah pernah diproses sebelumnya (Idempotency check)
    existing_pay_stmt = select(Payment).where(
        Payment.tenant_id == tenant_id, Payment.idempotency_key == clean_key
    )
    existing_payment = (await db.execute(existing_pay_stmt)).scalar_one_or_none()

    if existing_payment:
        # Kembalikan respons pembayaran awal tanpa memproses kas ganda
        order_stmt = select(Order).where(Order.id == existing_payment.order_id)
        order = (await db.execute(order_stmt)).scalar_one()
        return Response(
            success=True,
            data=PaymentResponse(
                payment_id=existing_payment.id,
                order_id=existing_payment.order_id,
                status="COMPLETED",
                grand_total=float(order.grand_total),
                amount_tendered=float(existing_payment.amount_tendered),
                change_due=float(existing_payment.change_due),
                payment_method=existing_payment.payment_method,
                paid_at=existing_payment.paid_at,
            ),
        )

    # 3. Cari order aktif
    order_stmt = select(Order).where(Order.id == order_id, Order.tenant_id == tenant_id)
    order = (await db.execute(order_stmt)).scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ORDER_NOT_FOUND", "message": "Pesanan tidak ditemukan."},
        )

    if order.status in ["COMPLETED", "CANCELLED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ORDER_ALREADY_CLOSED", "message": "Pesanan sudah selesai atau dibatalkan."},
        )

    # 4. Validasi kecukupan uang tunai
    amount_tendered_dec = Decimal(str(payload.amount_tendered))
    if payload.payment_method == "CASH" and amount_tendered_dec < order.grand_total:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "INSUFFICIENT_PAYMENT",
                "message": f"Uang yang diterima ({amount_tendered_dec}) kurang dari grand total ({order.grand_total}).",
            },
        )

    change_due_dec = (
        amount_tendered_dec - order.grand_total
        if payload.payment_method == "CASH"
        else Decimal("0.00")
    )

    # 5. Catat transaksi pembayaran & selesaikan meja
    try:
        payment = Payment(
            tenant_id=tenant_id,
            order_id=order.id,
            cashier_user_id=current_user.id,
            idempotency_key=clean_key,
            payment_method=payload.payment_method,
            amount_tendered=amount_tendered_dec,
            change_due=change_due_dec,
        )
        db.add(payment)

        order.status = "COMPLETED"

        # Kosongkan meja kembali AVAILABLE
        table_stmt = select(Table).where(Table.id == order.table_id)
        table = (await db.execute(table_stmt)).scalar_one_or_none()
        if table:
            table.status = "AVAILABLE"

        await db.commit()
        await db.refresh(payment)

        from app.services.sse_service import broadcaster
        broadcaster.broadcast(
            tenant_id=tenant_id,
            event="order.completed",
            data={
                "order_id": str(order.id),
                "table_number": order.table_number_snapshot,
                "grand_total": float(order.grand_total),
                "payment_method": payment.payment_method,
            },
        )

        return Response(
            success=True,
            data=PaymentResponse(
                payment_id=payment.id,
                order_id=order.id,
                status="COMPLETED",
                grand_total=float(order.grand_total),
                amount_tendered=float(payment.amount_tendered),
                change_due=float(payment.change_due),
                payment_method=payment.payment_method,
                paid_at=payment.paid_at,
            ),
        )

    except IntegrityError:
        # Menangani race condition bila dua request tiba di milidetik yang sama
        await db.rollback()
        conflict_stmt = select(Payment).where(Payment.idempotency_key == clean_key)
        saved_payment = (await db.execute(conflict_stmt)).scalar_one()
        return Response(
            success=True,
            data=PaymentResponse(
                payment_id=saved_payment.id,
                order_id=saved_payment.order_id,
                status="COMPLETED",
                grand_total=float(order.grand_total),
                amount_tendered=float(saved_payment.amount_tendered),
                change_due=float(saved_payment.change_due),
                payment_method=saved_payment.payment_method,
                paid_at=saved_payment.paid_at,
            ),
        )
