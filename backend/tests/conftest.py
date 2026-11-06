"""Pytest configuration and fixtures for testing FastAPI backend."""
import asyncio
from decimal import Decimal
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.main import app
from app.models.tenant import Tenant
from app.models.user import User

# In-memory SQLite async engine for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

test_async_session = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a clean database session per test function with all tables created."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with test_async_session() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create an AsyncClient with database session dependency overridden."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def seed_data(db_session: AsyncSession):
    """Seed test database with 1 tenant and 2 users (admin & cashier)."""
    # 1. Create Tenant
    tenant = Tenant(
        name="Kafe Senja Kopi",
        slug="kafe-senja",
        tax_rate=Decimal("0.1000"),
        service_rate=Decimal("0.0500"),
        currency="IDR",
    )
    db_session.add(tenant)
    await db_session.flush()

    # 2. Create Admin User
    admin = User(
        tenant_id=tenant.id,
        username="admin_senja",
        password_hash=get_password_hash("AdminPass123!"),
        full_name="Pak Seno (Owner)",
        role="admin",
        is_active=True,
    )
    db_session.add(admin)

    # 3. Create Cashier User
    cashier = User(
        tenant_id=tenant.id,
        username="kasir_bima",
        password_hash=get_password_hash("KasirPass123!"),
        full_name="Bima Adji (Kasir)",
        role="cashier",
        is_active=True,
    )
    db_session.add(cashier)

    await db_session.commit()
    await db_session.refresh(tenant)
    await db_session.refresh(admin)
    await db_session.refresh(cashier)

    return {
        "tenant": tenant,
        "admin": admin,
        "cashier": cashier,
    }
