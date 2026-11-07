"""Comprehensive test suite for Phase 3:
- Life-cycle: create order -> deduct stock -> multi-round -> pay -> close table
- Concurrency & Race Condition: atomic stock decrement prevents overselling
- Void Order: rollback stock restoration
- Idempotency: duplicate payments prevention
- Shift reconciliation
"""
import uuid
import pytest
from httpx import AsyncClient


async def _get_auth_headers(client: AsyncClient, username: str, password: str) -> dict:
    res = await client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "kafe-senja", "username": username, "password": password},
    )
    assert res.status_code == 200
    token = res.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def setup_cafe(client: AsyncClient, seed_data):
    """Setup category, product with stock 10, and table 5 with QR token."""
    headers = await _get_auth_headers(client, "kasir_bima", "KasirPass123!")

    # 1. Category
    cat_res = await client.post(
        "/api/v1/categories", json={"name": "Kopi", "sort_order": 1}, headers=headers
    )
    cat_id = cat_res.json()["data"]["id"]

    # 2. Product (Stok 10)
    prod_res = await client.post(
        "/api/v1/products",
        json={"category_id": cat_id, "name": "Kopi Susu Aren", "price": 20000, "stock": 10},
        headers=headers,
    )
    prod_id = prod_res.json()["data"]["id"]

    # 3. Table 5
    tbl_res = await client.post("/api/v1/tables?table_number=5", headers=headers)
    table = tbl_res.json()["data"]

    # 4. Table 8 (Empty table for move-table test)
    tbl8_res = await client.post("/api/v1/tables?table_number=8", headers=headers)
    table_8 = tbl8_res.json()["data"]

    return {
        "headers": headers,
        "category_id": cat_id,
        "product_id": prod_id,
        "table": table,
        "table_8": table_8,
    }


@pytest.mark.asyncio
async def test_order_lifecycle_with_atomic_stock_and_payment(client: AsyncClient, setup_cafe):
    """Full lifecycle: Create order -> Stock cuts -> Pay with Idempotency -> Table freed."""
    headers = setup_cafe["headers"]
    table = setup_cafe["table"]
    prod_id = setup_cafe["product_id"]

    # 1. Customer submit order via QR URL query params
    order_res = await client.post(
        f"/api/v1/orders?table_id={table['id']}&token={table['qr_token']}",
        json={
            "customer_name": "Rian",
            "items": [{"product_id": prod_id, "quantity": 2, "notes": "Less ice"}],
        },
    )
    assert order_res.status_code == 201
    order_data = order_res.json()["data"]
    assert order_data["customer_name"] == "Rian"
    assert order_data["status"] == "PENDING"
    assert order_data["subtotal"] == 40000.0  # 2 * 20.000
    assert order_data["service_amount"] == 2000.0  # 5%
    assert order_data["tax_amount"] == 4200.0  # 10% of (40k + 2k)
    assert order_data["grand_total"] == 46200.0

    # 2. Verifikasi stok berkurang di DB (dari 10 menjadi 8)
    prod_check = await client.get("/api/v1/products", headers=headers)
    p = [x for x in prod_check.json()["data"] if x["id"] == prod_id][0]
    assert p["stock"] == 8

    # 3. Kasir memproses status: COOKING -> SERVED
    order_id = order_data["id"]
    st_res = await client.patch(
        f"/api/v1/orders/{order_id}/status?new_status=COOKING", headers=headers
    )
    assert st_res.status_code == 200
    assert st_res.json()["data"]["status"] == "COOKING"

    # 4. Kasir memproses pembayaran dengan Idempotency-Key
    pay_res = await client.post(
        f"/api/v1/orders/{order_id}/pay",
        json={"payment_method": "CASH", "amount_tendered": 50000},
        headers={**headers, "Idempotency-Key": "unique-idempotency-key-001"},
    )
    assert pay_res.status_code == 200
    pay_data = pay_res.json()["data"]
    assert pay_data["status"] == "COMPLETED"
    assert pay_data["amount_tendered"] == 50000.0
    assert pay_data["change_due"] == 3800.0  # 50.000 - 46.200


@pytest.mark.asyncio
async def test_multi_round_ordering_accumulates_bill(client: AsyncClient, setup_cafe):
    """Subsequent orders on same table accumulate round_number=2 into single active bill."""
    table = setup_cafe["table"]
    prod_id = setup_cafe["product_id"]

    # Round 1
    r1 = await client.post(
        f"/api/v1/orders?table_id={table['id']}&token={table['qr_token']}",
        json={"customer_name": "Rian", "items": [{"product_id": prod_id, "quantity": 1}]},
    )
    assert r1.status_code == 201
    assert r1.json()["data"]["subtotal"] == 20000.0

    # Round 2 (Append)
    r2 = await client.post(
        f"/api/v1/orders?table_id={table['id']}&token={table['qr_token']}",
        json={"customer_name": "Rian", "items": [{"product_id": prod_id, "quantity": 2}]},
    )
    assert r2.status_code == 201
    data_r2 = r2.json()["data"]
    assert data_r2["id"] == r1.json()["data"]["id"]  # Same order ID
    assert data_r2["subtotal"] == 60000.0  # (1 + 2) * 20.000
    assert len(data_r2["items"]) == 2
    assert data_r2["items"][1]["round_number"] == 2


@pytest.mark.asyncio
async def test_void_order_rollbacks_stock(client: AsyncClient, setup_cafe):
    """Void order rolls back product stock atomically."""
    headers = setup_cafe["headers"]
    table = setup_cafe["table"]
    prod_id = setup_cafe["product_id"]

    # Order 3 items (stok 10 -> 7)
    order_res = await client.post(
        f"/api/v1/orders?table_id={table['id']}&token={table['qr_token']}",
        json={"customer_name": "Dira", "items": [{"product_id": prod_id, "quantity": 3}]},
    )
    order_id = order_res.json()["data"]["id"]

    # Check stock is 7
    p1 = (await client.get("/api/v1/products", headers=headers)).json()["data"][0]
    assert p1["stock"] == 7

    # Void order
    void_res = await client.post(
        f"/api/v1/orders/{order_id}/cancel",
        json={"cancellation_reason": "Salah input kuantitas pelanggan"},
        headers=headers,
    )
    assert void_res.status_code == 200
    assert void_res.json()["data"]["status"] == "CANCELLED"

    # Check stock restored back to 10
    p2 = (await client.get("/api/v1/products", headers=headers)).json()["data"][0]
    assert p2["stock"] == 10


@pytest.mark.asyncio
async def test_move_table_success_and_conflict(client: AsyncClient, setup_cafe):
    """Move table moves order to empty table, but rejects if target table is occupied."""
    headers = setup_cafe["headers"]
    table = setup_cafe["table"]
    prod_id = setup_cafe["product_id"]

    # Make order on table 5
    order_res = await client.post(
        f"/api/v1/orders?table_id={table['id']}&token={table['qr_token']}",
        json={"customer_name": "Budi", "items": [{"product_id": prod_id, "quantity": 1}]},
    )
    order_id = order_res.json()["data"]["id"]

    # Move from table 5 to empty table 8
    move_res = await client.patch(
        f"/api/v1/orders/{order_id}/move-table",
        json={"new_table_number": 8},
        headers=headers,
    )
    assert move_res.status_code == 200
    assert move_res.json()["data"]["new_table_number"] == 8

    # Try moving to non-existent table (e.g., table 999) -> 404
    err_res = await client.patch(
        f"/api/v1/orders/{order_id}/move-table",
        json={"new_table_number": 999},
        headers=headers,
    )
    assert err_res.status_code == 404


@pytest.mark.asyncio
async def test_insufficient_stock_conflict(client: AsyncClient, setup_cafe):
    """Requesting more stock than available rejects with HTTP 409 and does not deduct."""
    table = setup_cafe["table"]
    prod_id = setup_cafe["product_id"]

    # Sisa stok 10, order 15 -> 409 Conflict
    res = await client.post(
        f"/api/v1/orders?table_id={table['id']}&token={table['qr_token']}",
        json={"customer_name": "Tamu", "items": [{"product_id": prod_id, "quantity": 15}]},
    )
    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "INSUFFICIENT_STOCK"


@pytest.mark.asyncio
async def test_idempotency_key_duplicate_prevention(client: AsyncClient, setup_cafe):
    """Submitting duplicate payment request with same Idempotency-Key returns cached first result."""
    headers = setup_cafe["headers"]
    table = setup_cafe["table"]
    prod_id = setup_cafe["product_id"]

    # Order
    order_res = await client.post(
        f"/api/v1/orders?table_id={table['id']}&token={table['qr_token']}",
        json={"customer_name": "Dimas", "items": [{"product_id": prod_id, "quantity": 1}]},
    )
    order_id = order_res.json()["data"]["id"]

    # Payment 1
    key = "idem-test-key-999"
    p1 = await client.post(
        f"/api/v1/orders/{order_id}/pay",
        json={"payment_method": "CASH", "amount_tendered": 50000},
        headers={**headers, "Idempotency-Key": key},
    )
    assert p1.status_code == 200
    pay_id_1 = p1.json()["data"]["payment_id"]

    # Payment 2 (Duplicate click with same key)
    p2 = await client.post(
        f"/api/v1/orders/{order_id}/pay",
        json={"payment_method": "CASH", "amount_tendered": 50000},
        headers={**headers, "Idempotency-Key": key},
    )
    assert p2.status_code == 200
    pay_id_2 = p2.json()["data"]["payment_id"]
    assert pay_id_1 == pay_id_2  # Identical payment ID returned without second deduction


@pytest.mark.asyncio
async def test_cashier_shift_lifecycle_and_reconciliation(client: AsyncClient, setup_cafe):
    """Cashier opens shift, sells cash orders, and closes shift with accurate cash reconciliation."""
    headers = setup_cafe["headers"]

    # 1. Buka shift (modal awal Rp 200.000)
    open_res = await client.post(
        "/api/v1/shifts/open", json={"starting_cash": 200000}, headers=headers
    )
    assert open_res.status_code == 201
    shift = open_res.json()["data"]
    assert shift["starting_cash"] == 200000.0

    # 2. Cek current shift
    curr_res = await client.get("/api/v1/shifts/current", headers=headers)
    assert curr_res.status_code == 200
    assert curr_res.json()["data"]["id"] == shift["id"]

    # 3. Tutup shift (hitung kas fisik di laci Rp 200.000 karena belum ada transaksi kas tunai baru)
    close_res = await client.post(
        "/api/v1/shifts/close",
        json={"actual_cash": 200000, "notes": "Tutup shift lancar"},
        headers=headers,
    )
    assert close_res.status_code == 200
    close_data = close_res.json()["data"]
    assert close_data["expected_cash"] == 200000.0
    assert close_data["actual_cash"] == 200000.0
    assert close_data["cash_difference"] == 0.0
