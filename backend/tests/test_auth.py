"""Integration tests for staff authentication, JWT decoding, and RBAC guards."""
import pytest
from httpx import AsyncClient

from app.core.security import verify_password


@pytest.mark.asyncio
async def test_password_hashing(seed_data):
    """Verify password hashing algorithm accurately validates matching and mismatching passwords."""
    admin = seed_data["admin"]
    assert verify_password("AdminPass123!", admin.password_hash) is True
    assert verify_password("WrongPassword!", admin.password_hash) is False


@pytest.mark.asyncio
async def test_health_check_endpoint(client: AsyncClient):
    """Verify system health endpoint operates as expected."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "Kafe Dine-in Web POS" in data["project"]


@pytest.mark.asyncio
async def test_login_success_cashier(client: AsyncClient, seed_data):
    """Verify cashier can login with valid credentials and receive valid JWT token."""
    login_payload = {
        "tenant_slug": "kafe-senja",
        "username": "kasir_bima",
        "password": "KasirPass123!",
    }
    response = await client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200

    body = response.json()
    assert body["success"] is True
    token_data = body["data"]
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    assert token_data["user"]["role"] == "cashier"
    assert token_data["user"]["username"] == "kasir_bima"


@pytest.mark.asyncio
async def test_login_success_admin(client: AsyncClient, seed_data):
    """Verify admin can login with valid credentials and receive valid JWT token."""
    login_payload = {
        "tenant_slug": "kafe-senja",
        "username": "admin_senja",
        "password": "AdminPass123!",
    }
    response = await client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200

    body = response.json()
    token_data = body["data"]
    assert token_data["user"]["role"] == "admin"


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient, seed_data):
    """Verify login fails with HTTP 401 when password is wrong."""
    login_payload = {
        "tenant_slug": "kafe-senja",
        "username": "kasir_bima",
        "password": "WrongPassword999",
    }
    response = await client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    body = response.json()
    assert body["detail"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_login_invalid_tenant(client: AsyncClient, seed_data):
    """Verify login fails with HTTP 401 when tenant slug does not exist."""
    login_payload = {
        "tenant_slug": "tenant-fiktif-tidak-ada",
        "username": "kasir_bima",
        "password": "KasirPass123!",
    }
    response = await client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    body = response.json()
    assert body["detail"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_get_my_profile_with_jwt(client: AsyncClient, seed_data):
    """Verify authenticated user can fetch their own profile using Bearer token."""
    # 1. Login
    login_res = await client.post(
        "/api/v1/auth/login",
        json={
            "tenant_slug": "kafe-senja",
            "username": "kasir_bima",
            "password": "KasirPass123!",
        },
    )
    token = login_res.json()["data"]["access_token"]

    # 2. Call /auth/me with Bearer token
    headers = {"Authorization": f"Bearer {token}"}
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    user_info = me_res.json()
    assert user_info["username"] == "kasir_bima"
    assert user_info["full_name"] == "Bima Adji (Kasir)"


@pytest.mark.asyncio
async def test_rbac_admin_only_guard(client: AsyncClient, seed_data):
    """Verify RBAC: Admin succeeds, Cashier is forbidden (HTTP 403), No token is 401."""
    # 1. Login Admin
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "kafe-senja", "username": "admin_senja", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["data"]["access_token"]

    # 2. Login Cashier
    cashier_login = await client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": "kafe-senja", "username": "kasir_bima", "password": "KasirPass123!"},
    )
    cashier_token = cashier_login.json()["data"]["access_token"]

    # Test 3: Admin access should succeed (HTTP 200)
    admin_res = await client.get(
        "/api/v1/auth/admin-only-check",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_res.status_code == 200
    assert "Pak Seno" in admin_res.json()["message"]

    # Test 4: Cashier access should be forbidden (HTTP 403)
    cashier_res = await client.get(
        "/api/v1/auth/admin-only-check",
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert cashier_res.status_code == 403
    assert cashier_res.json()["detail"]["code"] == "INSUFFICIENT_PRIVILEGE"

    # Test 5: Unauthenticated access should be unauthorized (HTTP 401)
    unauth_res = await client.get("/api/v1/auth/admin-only-check")
    assert unauth_res.status_code == 401
