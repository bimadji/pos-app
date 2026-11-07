"""Category endpoints (staff only, tenant-scoped)."""
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.deps.auth import get_current_user, enforce_tenant_id
from app.models.category import Category
from app.models.user import User
from app.schemas.catalog import CategoryCreate, CategoryResponse, Response

router = APIRouter()


@router.get("", response_model=Response)
async def list_categories(
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    stmt = (
        select(Category)
        .where(Category.tenant_id == tenant_id)
        .order_by(Category.sort_order)
    )
    result = await db.execute(stmt)
    cats = result.scalars().all()
    return Response(data=[CategoryResponse.model_validate(c) for c in cats])


@router.post("", response_model=Response, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    cat = Category(tenant_id=tenant_id, **payload.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return Response(data=CategoryResponse.model_validate(cat))


@router.patch("/{category_id}", response_model=Response)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryCreate,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Category).where(
        Category.id == category_id, Category.tenant_id == tenant_id
    )
    result = await db.execute(stmt)
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CATEGORY_NOT_FOUND", "message": "Kategori tidak ditemukan."},
        )
    cat.name = payload.name
    cat.sort_order = payload.sort_order
    await db.commit()
    await db.refresh(cat)
    return Response(data=CategoryResponse.model_validate(cat))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Category).where(
        Category.id == category_id, Category.tenant_id == tenant_id
    )
    result = await db.execute(stmt)
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CATEGORY_NOT_FOUND", "message": "Kategori tidak ditemukan."},
        )
    try:
        await db.delete(cat)
        await db.commit()
    except Exception:
        await db.rollback()
        # FK RESTRICT from products.category_id: category still in use.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "CATEGORY_IN_USE",
                "message": "Kategori masih dipakai produk. Pindahkan produknya dulu.",
            },
        )
