"""Public customer-facing menu catalog, guarded by signed table token."""
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.deps.table_token import get_table_session
from app.models.category import Category
from app.models.product import Product
from app.models.table import Table
from app.schemas.catalog import Response

router = APIRouter()


@router.get("/menu", response_model=Response)
async def get_public_menu(
    table: Annotated[Table, Depends(get_table_session)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Grouped product catalog for the scanned table.

    Products are filtered to the table's tenant (anti-BOLA at query level)
    and only available products are shown; sold-out items are hidden entirely
    so the customer never sees a dead add-to-cart button.
    """
    cat_stmt = (
        select(Category)
        .where(Category.tenant_id == table.tenant_id)
        .order_by(Category.sort_order)
    )
    cat_res = await db.execute(cat_stmt)
    categories = cat_res.scalars().all()

    prod_stmt = (
        select(Product)
        .where(
            Product.tenant_id == table.tenant_id,
            Product.is_available == True,
        )
        .order_by(Product.name)
    )
    prod_res = await db.execute(prod_stmt)
    products = prod_res.scalars().all()

    by_category: dict[uuid.UUID, list] = {}
    for p in products:
        by_category.setdefault(p.category_id, []).append(
            {
                "id": str(p.id),
                "name": p.name,
                "description": p.description,
                "price": float(p.price),
                "stock": p.stock,
                "image_url": p.image_url,
            }
        )

    data = [
        {
            "category_id": str(c.id),
            "category_name": c.name,
            "item_type": c.item_type,
            "items": by_category.get(c.id, []),
        }
        for c in categories
    ]
    return Response(data=data)


@router.get("/session", response_model=Response)
async def get_customer_session(
    table: Annotated[Table, Depends(get_table_session)],
):
    """Public endpoint to get current validated table number for customer header."""
    return Response(
        data={
            "table_id": str(table.id),
            "table_number": table.table_number,
        }
    )
