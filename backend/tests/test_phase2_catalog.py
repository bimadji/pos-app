"""Tests for Phase 2: categories, products, sold-out toggle, tables, and public menu."""
import pytest
from httpx import AsyncClient


async def _login(client: AsyncClient, username: str, password: str) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "kafe-senja", "username": username, "password": password},
    )
    assert res.status_code == 200
    return res.json()["data"]["access_token"]


@pytest.fixture
async def auth_headers(client: AsyncClient, seed_data):
    token = await _login(client, "kasir_bima", "KasirPass123!")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def category(client: AsyncClient, auth_headers):
    res = await client.post(
        "/api/v1/categories",
        json={"name": "Kopi Signature", "sort_order": 1},
        headers=auth_headers,
    )
    assert res.status_code == 201
    return res.json()["data"]


@pytest.fixture
async def product(client: AsyncClient, auth_headers, category):
    res = await client.post(
        "/api/v1/products",
        json={
            "category_id": category["id"],
            "name": "Kopi Aren Senja",
            "price": 22000,
            "stock": 45,
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    return res.json()["data"]


@pytest.mark.asyncio
async def test_create_and_list_categories(client: AsyncClient, auth_headers):
    res = await client.post(
        "/api/v1/categories",
        json={"name": "Cemilan", "sort_order": 2},
        headers=auth_headers,
    )
    assert res.status_code == 201

    res = await client.get("/api/v1/categories", headers=auth_headers)
    assert res.status_code == 200
    names = [c["name"] for c in res.json()["data"]]
    assert "Cemilan" in names


@pytest.mark.asyncio
async def test_create_product_with_price_tampering_rejected(client: AsyncClient, auth_headers, category):
    """Backend stores what the staff sends for their own catalog, but validates price >= 0."""
    res = await client.post(
        "/api/v1/products",
        json={"category_id": category["id"], "name": "X", "price": -5000, "stock": 1},
        headers=auth_headers,
    )
    assert res.status_code == 422  # price ge=0 validation


@pytest.mark.asyncio
async def test_sold_out_toggle_roundtrip(client: AsyncClient, auth_headers, product):
    """One click flips availability and the public menu reflects it immediately."""
    assert product["is_available"] is True

    res = await client.patch(
        f"/api/v1/products/{product['id']}/toggle", headers=auth_headers
    )
    assert res.status_code == 200
    assert res.json()["data"]["is_available"] is False

    # Toggle back
    res = await client.patch(
        f"/api/v1/products/{product['id']}/toggle", headers=auth_headers
    )
    assert res.json()["data"]["is_available"] is True


@pytest.mark.asyncio
async def test_create_table_and_list_with_qr_token(client: AsyncClient, auth_headers):
    res = await client.post("/api/v1/tables?table_number=5", headers=auth_headers)
    assert res.status_code == 201
    table = res.json()["data"]
    assert table["table_number"] == 5
    assert len(table["qr_token"]) == 64  # sha256 hex digest

    res = await client.get("/api/v1/tables", headers=auth_headers)
    assert res.status_code == 200
    tables = res.json()["data"]
    assert any(t["table_number"] == 5 for t in tables)


@pytest.mark.asyncio
async def test_duplicate_table_number_conflict(client: AsyncClient, auth_headers):
    res = await client.post("/api/v1/tables?table_number=7", headers=auth_headers)
    assert res.status_code == 201
    res = await client.post("/api/v1/tables?table_number=7", headers=auth_headers)
    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "TABLE_EXISTS"


@pytest.mark.asyncio
async def test_public_menu_requires_valid_token(client: AsyncClient, auth_headers, category, product):
    """Forged token -> 401; valid signed token -> grouped catalog."""
    # Create a table to have a valid table_id + token
    res = await client.post("/api/v1/tables?table_number=3", headers=auth_headers)
    table = res.json()["data"]

    # 1. Forged token
    res = await client.get(
        f"/api/v1/menu?table_id={table['id']}&token={'a' * 64}"
    )
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "INVALID_TABLE_TOKEN"

    # 2. Valid token returns the catalog with the product in it
    res = await client.get(
        f"/api/v1/menu?table_id={table['id']}&token={table['qr_token']}"
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data[0]["category_name"] == "Kopi Signature"
    assert data[0]["items"][0]["name"] == "Kopi Aren Senja"


@pytest.mark.asyncio
async def test_sold_out_product_marked_unavailable_in_public_menu(client: AsyncClient, auth_headers, category, product):
    """Sold-out product remains visible in public catalog with is_available=False."""
    res = await client.post("/api/v1/tables?table_number=9", headers=auth_headers)
    table = res.json()["data"]

    await client.patch(f"/api/v1/products/{product['id']}/toggle", headers=auth_headers)

    res = await client.get(
        f"/api/v1/menu?table_id={table['id']}&token={table['qr_token']}"
    )
    items = res.json()["data"][0]["items"]
    toggled_item = next(i for i in items if i["id"] == product["id"])
    assert toggled_item["is_available"] is False
