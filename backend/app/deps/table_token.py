"""Customer session dependency: verify HMAC-signed table token from QR URL.

The customer flow has no login. The QR sticker at each table carries:
  /t/{table_id}?token={hex}
where token = HMAC-SHA256(table.qr_token_secret, "{table_id}:{table_number}").

Verification is a DB lookup by table_id (scoped to one tenant's tables)
followed by a constant-time signature check, so a forged or rotated token
is rejected with 401.
"""
import uuid
from typing import Annotated
from fastapi import Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.tokens import verify_table_token
from app.models.table import Table


async def get_table_session(
    table_id: Annotated[uuid.UUID, Query(alias="table_id")],
    token: Annotated[str, Query(min_length=32, max_length=128)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Table:
    """Resolve and verify a customer's table session from QR URL params."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "code": "INVALID_TABLE_TOKEN",
            "message": "Sesi meja tidak sah. Silakan pindai ulang QR meja resmi.",
        },
    )

    stmt = select(Table).where(Table.id == table_id)
    result = await db.execute(stmt)
    table = result.scalar_one_or_none()

    if table is None or not verify_table_token(
        table.qr_token_secret, token, str(table.id), table.table_number
    ):
        raise credentials_exc

    return table
