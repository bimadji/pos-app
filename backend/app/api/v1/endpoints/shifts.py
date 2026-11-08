"""Cashier shift endpoints: open shift, close shift with cash reconciliation."""
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.deps.auth import get_current_user, enforce_tenant_id, require_admin
from app.models.cashier_shift import CashierShift
from app.models.payment import Payment
from app.models.user import User
from app.schemas.shift import (
    ShiftOpenRequest,
    ShiftCloseRequest,
    ShiftResponse,
    ShiftDetailResponse,
    ShiftHistoryItem,
)
from app.schemas.catalog import Response
router = APIRouter()


@router.post("/open", response_model=Response, status_code=status.HTTP_201_CREATED)
async def open_shift(
    payload: ShiftOpenRequest,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Cashier opens a new working shift with initial cash drawer float."""
    # Pastikan kasir ini belum punya shift aktif yang menggantung
    active_stmt = select(CashierShift).where(
        CashierShift.tenant_id == tenant_id,
        CashierShift.cashier_user_id == current_user.id,
        CashierShift.closed_at.is_(None),
    )
    if (await db.execute(active_stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "SHIFT_ALREADY_OPEN",
                "message": "Anda masih memiliki shift aktif yang belum ditutup.",
            },
        )

    shift = CashierShift(
        tenant_id=tenant_id,
        cashier_user_id=current_user.id,
        starting_cash=Decimal(str(payload.starting_cash)),
    )
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    return Response(success=True, data=ShiftResponse.model_validate(shift))


@router.get("/current", response_model=Response)
async def get_current_shift(
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieve cashier's currently active shift information with live sales metrics."""
    stmt = select(CashierShift).where(
        CashierShift.tenant_id == tenant_id,
        CashierShift.cashier_user_id == current_user.id,
        CashierShift.closed_at.is_(None),
    )
    shift = (await db.execute(stmt)).scalar_one_or_none()
    if not shift:
        return Response(success=True, data=None)

    # Hitung live sales tunai dan QRIS kasir ini selama shift aktif
    cash_sales_stmt = select(
        func.coalesce(func.sum(Payment.amount_tendered - Payment.change_due), Decimal("0.00")),
        func.count(Payment.id),
    ).where(
        Payment.tenant_id == tenant_id,
        Payment.cashier_user_id == current_user.id,
        Payment.payment_method == "CASH",
        Payment.paid_at >= shift.opened_at,
    )
    cash_res = (await db.execute(cash_sales_stmt)).one()
    cash_sales = float(cash_res[0] or 0.0)
    cash_tx_count = int(cash_res[1] or 0)

    qris_sales_stmt = select(
        func.coalesce(func.sum(Payment.amount_tendered), Decimal("0.00")),
        func.count(Payment.id),
    ).where(
        Payment.tenant_id == tenant_id,
        Payment.cashier_user_id == current_user.id,
        Payment.payment_method == "QRIS",
        Payment.paid_at >= shift.opened_at,
    )
    qris_res = (await db.execute(qris_sales_stmt)).one()
    qris_sales = float(qris_res[0] or 0.0)
    qris_tx_count = int(qris_res[1] or 0)

    total_sales = cash_sales + qris_sales
    total_tx = cash_tx_count + qris_tx_count
    expected_cash = float(shift.starting_cash) + cash_sales

    detail = ShiftDetailResponse(
        id=shift.id,
        cashier_user_id=shift.cashier_user_id,
        cashier_name=current_user.full_name,
        starting_cash=float(shift.starting_cash),
        expected_cash=expected_cash,
        actual_cash=float(shift.actual_cash) if shift.actual_cash is not None else None,
        cash_difference=float(shift.cash_difference) if shift.cash_difference is not None else None,
        notes=shift.notes,
        opened_at=shift.opened_at,
        closed_at=shift.closed_at,
        cash_sales=cash_sales,
        qris_sales=qris_sales,
        total_sales=total_sales,
        total_transactions=total_tx,
    )
    return Response(success=True, data=detail)

@router.post("/close", response_model=Response)
async def close_shift(
    payload: ShiftCloseRequest,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Close shift and reconcile actual drawer cash vs system cash sales."""
    # 1. Cari shift aktif kasir ini
    stmt = select(CashierShift).where(
        CashierShift.tenant_id == tenant_id,
        CashierShift.cashier_user_id == current_user.id,
        CashierShift.closed_at.is_(None),
    )
    shift = (await db.execute(stmt)).scalar_one_or_none()

    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NO_ACTIVE_SHIFT", "message": "Tidak ada shift aktif yang dapat ditutup."},
        )

    # 2. Hitung total penjualan TUNAI selama rentang waktu shift ini
    cash_sales_stmt = select(func.coalesce(func.sum(Payment.amount_tendered - Payment.change_due), 0)).where(
        Payment.tenant_id == tenant_id,
        Payment.cashier_user_id == current_user.id,
        Payment.payment_method == "CASH",
        Payment.paid_at >= shift.opened_at,
    )
    total_cash_sales = (await db.execute(cash_sales_stmt)).scalar() or Decimal("0.00")

    # 3. Hitung ekspektasi kas dan selisih
    actual_cash_dec = Decimal(str(payload.actual_cash))
    expected_cash_dec = shift.starting_cash + Decimal(str(total_cash_sales))
    cash_difference_dec = actual_cash_dec - expected_cash_dec

    shift.actual_cash = actual_cash_dec
    shift.expected_cash = expected_cash_dec
    shift.cash_difference = cash_difference_dec
    shift.notes = payload.notes
    shift.closed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(shift)

    return Response(
        success=True,
        data=ShiftResponse.model_validate(shift),
    )


@router.get("/history", response_model=Response)
async def get_shifts_history(
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 30,
):
    """Admin audit endpoint to view historical cashier shifts and sales performance."""
    stmt = (
        select(CashierShift, User.full_name)
        .join(User, CashierShift.cashier_user_id == User.id)
        .where(CashierShift.tenant_id == tenant_id)
        .order_by(CashierShift.opened_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    items: list[ShiftHistoryItem] = []
    for shift, cashier_name in rows:
        # Agregasikan penjualan shift ini
        time_filter = [
            Payment.tenant_id == tenant_id,
            Payment.cashier_user_id == shift.cashier_user_id,
            Payment.paid_at >= shift.opened_at,
        ]
        if shift.closed_at is not None:
            time_filter.append(Payment.paid_at <= shift.closed_at)

        cash_stmt = select(
            func.coalesce(func.sum(Payment.amount_tendered - Payment.change_due), Decimal("0.00")),
            func.count(Payment.id),
        ).where(*time_filter, Payment.payment_method == "CASH")
        cash_res = (await db.execute(cash_stmt)).one()
        cash_sales = float(cash_res[0] or 0.0)
        cash_count = int(cash_res[1] or 0)

        qris_stmt = select(
            func.coalesce(func.sum(Payment.amount_tendered), Decimal("0.00")),
            func.count(Payment.id),
        ).where(*time_filter, Payment.payment_method == "QRIS")
        qris_res = (await db.execute(qris_stmt)).one()
        qris_sales = float(qris_res[0] or 0.0)
        qris_count = int(qris_res[1] or 0)

        total_sales = cash_sales + qris_sales
        total_tx = cash_count + qris_count

        items.append(
            ShiftHistoryItem(
                id=shift.id,
                cashier_user_id=shift.cashier_user_id,
                cashier_name=cashier_name or "Kasir",
                starting_cash=float(shift.starting_cash),
                expected_cash=float(shift.expected_cash) if shift.expected_cash is not None else (float(shift.starting_cash) + cash_sales),
                actual_cash=float(shift.actual_cash) if shift.actual_cash is not None else None,
                cash_difference=float(shift.cash_difference) if shift.cash_difference is not None else None,
                cash_sales=cash_sales,
                qris_sales=qris_sales,
                total_sales=total_sales,
                total_transactions=total_tx,
                notes=shift.notes,
                opened_at=shift.opened_at,
                closed_at=shift.closed_at,
                is_active=shift.closed_at is None,
            )
        )

    return Response(success=True, data=items)
