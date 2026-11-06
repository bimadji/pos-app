"""Product endpoints (staff only, tenant-scoped) + sold-out toggle."""
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.deps.auth import get_current_user, enforce_tenant_id
from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.schemas.catalog import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    Response,
)

router = APIRouter()


async def _get_tenant_product(
    product_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession
) -> Product:
    stmt = select(Product).where(
        Product.id == product_id, Product.tenant_id == tenant_id
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "Produk tidak ditemukan."},
        )
    return product


@router.get("", response_model=Response)
async def list_products(
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    category_id: uuid.UUID | None = None,
):
    stmt = select(Product).where(Product.tenant_id == tenant_id)
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
    result = await db.execute(stmt)
    products = result.scalars().all()
    return Response(data=[ProductResponse.model_validate(p) for p in products])


@router.post("", response_model=Response, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    # Category must belong to the same tenant (anti-BOLA on the FK).
    cat_stmt = select(Category).where(
        Category.id == payload.category_id, Category.tenant_id == tenant_id
    )
    cat_res = await db.execute(cat_stmt)
    if cat_res.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CATEGORY_NOT_FOUND", "message": "Kategori tidak ditemukan."},
        )

    product = Product(tenant_id=tenant_id, **payload.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return Response(data=ProductResponse.model_validate(product))


@router.patch("/{product_id}", response_model=Response)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    product = await _get_tenant_product(product_id, tenant_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    return Response(data=ProductResponse.model_validate(product))


@router.patch("/{product_id}/toggle", response_model=Response)
async def toggle_availability(
    product_id: uuid.UUID,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    """One-click sold-out switch: flips is_available, returns the new state."""
    product = await _get_tenant_product(product_id, tenant_id, db)
    product.is_available = not product.is_available
    await db.commit()
    await db.refresh(product)
    return Response(
        data={
            "product_id": str(product.id),
            "name": product.name,
            "is_available": product.is_available,
        }
    )


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: uuid.UUID,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    product = await _get_tenant_product(product_id, tenant_id, db)
    await db.delete(product)
    await db.commit()
