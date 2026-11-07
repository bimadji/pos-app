"""Cashier shift endpoints: open shift, close shift with cash reconciliation."""
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.deps.auth import get_current_user, enforce_tenant_id
from app.models.cashier_shift import CashierShift
from app.models.payment import Payment
from app.models.user import User
from app.schemas.shift import ShiftOpenRequest, ShiftCloseRequest, ShiftResponse
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
    """Retrieve cashier's currently active shift information."""
    stmt = select(CashierShift).where(
        CashierShift.tenant_id == tenant_id,
        CashierShift.cashier_user_id == current_user.id,
        CashierShift.closed_at.is_(None),
    )
    shift = (await db.execute(stmt)).scalar_one_or_none()
    if not shift:
        return Response(success=True, data=None)
    return Response(success=True, data=ShiftResponse.model_validate(shift))


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
