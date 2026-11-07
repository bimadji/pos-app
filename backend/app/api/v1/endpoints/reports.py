"""Reports endpoint: daily summary metrics and streaming CSV export."""
import csv
import io
import uuid
from typing import Annotated
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.models.order_item import OrderItem

from app.core.database import get_db
from app.deps.auth import get_current_user, enforce_tenant_id
from app.models.order import Order
from app.models.payment import Payment
from app.models.user import User
from app.schemas.catalog import Response

router = APIRouter()


@router.get("/daily", response_model=Response)
async def get_daily_metrics(
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    """Retrieve high-level daily sales metrics for owner portal."""
    # Total omzet completed orders
    sales_stmt = select(
        func.coalesce(func.sum(Order.grand_total), 0),
        func.count(Order.id),
    ).where(
        Order.tenant_id == tenant_id,
        Order.status == "COMPLETED",
    )
    res = await db.execute(sales_stmt)
    total_sales, total_orders = res.fetchone() or (0, 0)

    # Cash vs QRIS split
    payment_stmt = select(
        Payment.payment_method,
        func.coalesce(func.sum(Payment.amount_tendered - Payment.change_due), 0),
    ).where(
        Payment.tenant_id == tenant_id
    ).group_by(Payment.payment_method)
    pay_res = await db.execute(payment_stmt)
    pay_splits = dict(pay_res.all())

    # Top 5 produk paling sering dipesan
    top_stmt = (
        select(
            OrderItem.product_name_snapshot,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("qty_sold"),
            func.coalesce(func.sum(OrderItem.subtotal), 0).label("revenue"),
        )
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.tenant_id == tenant_id, Order.status == "COMPLETED")
        .group_by(OrderItem.product_name_snapshot)
        .order_by(desc("qty_sold"))
        .limit(5)
    )
    top_res = await db.execute(top_stmt)
    top_products = [
        {"name": row[0], "qty_sold": int(row[1]), "revenue": float(row[2])}
        for row in top_res.all()
    ]

    # Chart penjualan 7 hari terakhir
    # Chart penjualan 7 hari terakhir (func.date() kompatibel di PostgreSQL dan SQLite)
    daily_sales_stmt = (
        select(
            func.date(Order.created_at).label("sale_date"),
            func.coalesce(func.sum(Order.grand_total), 0).label("total"),
            func.count(Order.id).label("orders_count"),
        )
        .where(Order.tenant_id == tenant_id, Order.status == "COMPLETED")
        .group_by(func.date(Order.created_at))
        .order_by(desc("sale_date"))
        .limit(7)
    )
    daily_res = await db.execute(daily_sales_stmt)
    weekly_sales = [
        {"date": str(row[0]), "total": float(row[1]), "orders_count": int(row[2])}
        for row in reversed(daily_res.all())
    ]

    return Response(
        success=True,
        data={
            "total_sales": float(total_sales),
            "completed_orders": int(total_orders),
            "cash_total": float(pay_splits.get("CASH", 0)),
            "qris_total": float(pay_splits.get("STATIC_QRIS", 0)),
            "top_products": top_products,
            "weekly_sales": weekly_sales,
        },
    )


@router.get("/export-csv")
async def export_sales_csv(
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    """Stream sales ledger CSV for spreadsheet accounting."""
    stmt = (
        select(Order)
        .where(Order.tenant_id == tenant_id)
        .order_by(Order.created_at.desc())
    )
    result = await db.execute(stmt)
    orders = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    # Header CSV
    writer.writerow([
        "Order ID",
        "Waktu Transaksi (UTC)",
        "Nomor Meja",
        "Nama Pelanggan",
        "Status",
        "Subtotal",
        "Biaya Layanan",
        "Pajak PB1",
        "Grand Total",
        "Alasan Pembatalan",
    ])

    for o in orders:
        writer.writerow([
            str(o.id),
            o.created_at.strftime("%Y-%m-%d %H:%M:%S") if o.created_at else "",
            o.table_number_snapshot,
            o.customer_name,
            o.status,
            f"{o.subtotal:.2f}",
            f"{o.service_amount:.2f}",
            f"{o.tax_amount:.2f}",
            f"{o.grand_total:.2f}",
            o.cancellation_reason or "",
        ])

    output.seek(0)
    filename = f"laporan_penjualan_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Cache-Control": "no-cache",
        },
    )
