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


@pytest.mark.asyncio
async def test_shifts_metrics_and_admin_history(client: AsyncClient, seed_data):
    """Verify live shift sales metrics calculation and admin shift audit history."""
    # 1. Login admin
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "kafe-senja", "username": "admin_senja", "password": "AdminPass123!"},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["data"]["access_token"]
    admin_auth = {"Authorization": f"Bearer {admin_token}"}

    # 2. Buka shift kasir
    open_res = await client.post(
        "/api/v1/shifts/open",
        json={"starting_cash": 150000},
        headers=admin_auth,
    )
    assert open_res.status_code in [201, 409]

    # 3. Cek live shift sales via GET /current
    current_res = await client.get("/api/v1/shifts/current", headers=admin_auth)
    assert current_res.status_code == 200
    cur_data = current_res.json()["data"]
    assert cur_data is not None
    assert "cash_sales" in cur_data
    assert "qris_sales" in cur_data
    assert "total_sales" in cur_data
    assert "expected_cash" in cur_data

    # 4. Cek audit history via GET /history
    history_res = await client.get("/api/v1/shifts/history?limit=10", headers=admin_auth)
    assert history_res.status_code == 200
    shifts_list = history_res.json()["data"]
    assert isinstance(shifts_list, list)
    assert len(shifts_list) >= 1
    first_shift = shifts_list[0]
    assert "cashier_name" in first_shift
    assert "cash_sales" in first_shift
    assert "qris_sales" in first_shift
    assert "total_sales" in first_shift
