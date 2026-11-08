"""SSE stream endpoint for realtime order updates."""
import asyncio
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.table_token import get_table_session
from app.deps.auth import get_optional_token_payload
from app.models.table import Table
from app.services.sse_service import broadcaster

router = APIRouter()

HEARTBEAT_SECONDS = 20


async def _event_stream(subscriber, first_ping: bool = True):
    """Yield SSE frames for one subscriber, with periodic heartbeats."""
    if first_ping:
        yield f"event: connected\ndata: {{}}\n\n"
    while True:
        try:
            event, payload = await asyncio.wait_for(
                subscriber.queue.get(), timeout=HEARTBEAT_SECONDS
            )
            yield f"event: {event}\ndata: {payload}\n\n"
        except asyncio.TimeoutError:
            # Heartbeat keeps proxies from closing idle connections
            yield f"event: ping\ndata: {{}}\n\n"


@router.get("/stream")
async def order_stream(
    db: Annotated[AsyncSession, Depends(get_db)],
    table_id: Annotated[uuid.UUID | None, Query()] = None,
    token: Annotated[str | None, Query()] = None,
    staff_token: Annotated[str | None, Query()] = None,
    payload: dict | None = Depends(get_optional_token_payload),
):
    """Realtime order events.

    Auth accepts either:
    - Staff JWT (Authorization: Bearer ...) -> subscribes to the staff's tenant, or
    - Table QR params (?table_id=...&token=...) -> subscribes to that table's tenant.
    """
    if table_id and token:
        table: Table = await get_table_session(
            table_id=table_id, token=token, db=db
        )
        tenant_id = table.tenant_id
    elif staff_token:
        from fastapi import HTTPException, status
        from jwt import PyJWTError
        from app.core.security import decode_access_token
        try:
            token_payload = decode_access_token(staff_token)
        except PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "INVALID_CREDENTIALS",
                    "message": "Token tidak valid atau telah kadaluarsa.",
                },
            )
        tenant_id = uuid.UUID(token_payload["tenant_id"])
    elif payload:
        tenant_id = uuid.UUID(payload["tenant_id"])
    else:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED_STREAM",
                "message": "Sertakan JWT staf atau token meja yang sah.",
            },
        )
    subscriber = broadcaster.subscribe(tenant_id)
    return StreamingResponse(
        _event_stream(subscriber),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
