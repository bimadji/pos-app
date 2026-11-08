"""Seed the local database with one tenant, staff users, tables, and a sample menu.

Usage (from backend/, with the venv active and PostgreSQL running):
    ../.venv/Scripts/python.exe -m scripts.seed_data
"""
import asyncio
from decimal import Decimal

from app.core.database import async_session_maker, engine
from app.core.security import get_password_hash
from app.core.tokens import generate_table_secret
from app.models import Tenant, User, Table, Category, Product

CATEGORY_TYPES = {"Kopi Signature": "DRINK", "Makanan Berat": "FOOD", "Cemilan": "SNACK"}

MENU = [
    ("Kopi Signature", [
        ("Kopi Aren Senja", "Espresso ganda, susu segar, gula aren alami.", 22000, 45),
        ("Americano Double Shot", "Dua shot espresso, air panas.", 20000, 60),
        ("Caffe Latte", "Espresso dengan susu steamed.", 24000, 40),
    ]),
    ("Makanan Berat", [
        ("Nasi Sei Sapi", "Daging asap khas Kupang, sambal matah.", 39000, 15),
        ("Chicken Rice Bowl", "Ayam goreng, nasi, saus lada hitam.", 35000, 20),
        ("Spaghetti Carbonara", "Pasta creamy dengan bacon.", 38000, 12),
    ]),
    ("Cemilan", [
        ("Butter Croissant", "Pastry mentega renyah.", 28000, 8),
        ("French Fries", "Kentang goreng dengan saus sambal.", 20000, 30),
        ("Spring Rolls", "Lumpia isi sayur, disajikan hangat.", 18000, 25),
    ]),
]


async def seed():
    async with async_session_maker() as session:
        tenant = Tenant(
            name="Kafe Senja Kopi",
            slug="kafe-senja",
            tax_rate=Decimal("0.1000"),
            service_rate=Decimal("0.0500"),
        )
        session.add(tenant)
        await session.flush()

        session.add_all([
            User(
                tenant_id=tenant.id,
                username="admin_senja",
                password_hash=get_password_hash("AdminPass123!"),
                full_name="Pak Seno (Owner)",
                role="admin",
            ),
            User(
                tenant_id=tenant.id,
                username="kasir_bima",
                password_hash=get_password_hash("KasirPass123!"),
                full_name="Bima Adji (Kasir)",
                role="cashier",
            ),
            User(
                tenant_id=tenant.id,
                username="kasir_sarah",
                password_hash=get_password_hash("SarahPass123!"),
                full_name="Sarah Puspa (Kasir Sore)",
                role="cashier",
            ),
        ])

        for number in range(1, 13):
            session.add(
                Table(
                    tenant_id=tenant.id,
                    table_number=number,
                    qr_token_secret=generate_table_secret(),
                )
            )

        for idx, (cat_name, items) in enumerate(MENU):
            cat = Category(
                tenant_id=tenant.id,
                name=cat_name,
                sort_order=idx,
                item_type=CATEGORY_TYPES.get(cat_name, "FOOD"),
            )
            session.add(cat)
            await session.flush()
            for name, desc, price, stock in items:
                session.add(
                    Product(
                        tenant_id=tenant.id,
                        category_id=cat.id,
                        name=name,
                        description=desc,
                        price=Decimal(price),
                        stock=stock,
                    )
                )

        await session.commit()
        print(f"Seeded tenant '{tenant.slug}' (id={tenant.id}) with staff, 12 tables, {sum(len(i) for _, i in MENU)} products.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
