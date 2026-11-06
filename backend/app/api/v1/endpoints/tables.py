"""Table endpoints (staff only): list, create, rotate/issue QR token URL."""
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.tokens import generate_table_secret, sign_table_token
from app.deps.auth import get_current_user, enforce_tenant_id
from app.models.table import Table
from app.models.user import User
from app.schemas.catalog import Response

router = APIRouter()


@router.get("", response_model=Response)
async def list_tables(
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Table).where(Table.tenant_id == tenant_id).order_by(Table.table_number)
    result = await db.execute(stmt)
    tables = result.scalars().all()
    data = [
        {
            "id": str(t.id),
            "table_number": t.table_number,
            "status": t.status,
            # Freshly signed URL token so the admin can reprint a QR sticker anytime.
            "qr_token": sign_table_token(t.qr_token_secret, str(t.id), t.table_number),
        }
        for t in tables
    ]
    return Response(data=data)


@router.post("", response_model=Response, status_code=status.HTTP_201_CREATED)
async def create_table(
    table_number: int,
    tenant_id: Annotated[uuid.UUID, Depends(enforce_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    if table_number < 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_TABLE_NUMBER", "message": "Nomor meja minimal 1."},
        )

    dup_stmt = select(Table).where(
        Table.tenant_id == tenant_id, Table.table_number == table_number
    )
    if (await db.execute(dup_stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "TABLE_EXISTS", "message": f"Meja {table_number} sudah ada."},
        )

    table = Table(
        tenant_id=tenant_id,
        table_number=table_number,
        qr_token_secret=generate_table_secret(),
    )
    db.add(table)
    await db.commit()
    await db.refresh(table)
    return Response(
        data={
            "id": str(table.id),
            "table_number": table.table_number,
            "status": table.status,
            "qr_token": sign_table_token(
                table.qr_token_secret, str(table.id), table.table_number
            ),
        }
    )
