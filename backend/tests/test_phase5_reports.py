"""Tests for Phase 5: reports daily metrics and streaming CSV export."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_reports_daily_and_csv_export(client: AsyncClient, seed_data):
    """Verify daily metrics and streaming CSV export endpoint."""
    # 1. Login kasir
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "kafe-senja", "username": "kasir_bima", "password": "KasirPass123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["data"]["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    # 2. Get daily metrics
    metrics_res = await client.get("/api/v1/reports/daily", headers=auth)
    assert metrics_res.status_code == 200
    data = metrics_res.json()["data"]
    assert "total_sales" in data
    assert "completed_orders" in data
    assert "cash_total" in data
    assert "qris_total" in data

    # 3. Export CSV streaming
    csv_res = await client.get("/api/v1/reports/export-csv", headers=auth)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers.get("content-type", "")
    assert "attachment; filename=" in csv_res.headers.get("content-disposition", "")
    content = csv_res.text
    assert "Order ID,Waktu Transaksi (UTC),Nomor Meja" in content
