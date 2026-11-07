"""Authentication and authorization dependencies for FastAPI."""
import uuid
from typing import Annotated, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

http_bearer = HTTPBearer(auto_error=False)
http_bearer_optional = HTTPBearer(auto_error=False)


async def get_optional_token_payload(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(http_bearer_optional)
    ],
) -> Dict[str, Any] | None:
    """Optional variant: returns None when no Authorization header is present."""
    if credentials is None or not credentials.credentials:
        return None
    try:
        return decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        return None


async def get_current_token_payload(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)],
) -> Dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "code": "INVALID_CREDENTIALS",
            "message": "Token tidak valid atau telah kadaluarsa.",
        },
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials or not credentials.credentials:
        raise credentials_exception
    token = credentials.credentials
    """Decode and validate JWT access token payload."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "code": "INVALID_CREDENTIALS",
            "message": "Token tidak valid atau telah kadaluarsa.",
        },
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        tenant_id: str = payload.get("tenant_id")
        role: str = payload.get("role")
        if user_id is None or tenant_id is None or role is None:
            raise credentials_exception
        return payload
    except jwt.PyJWTError:
        raise credentials_exception


async def get_current_user(
    payload: Annotated[Dict[str, Any], Depends(get_current_token_payload)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Fetch current active User object from DB matching JWT payload."""
    user_id = uuid.UUID(payload["sub"])
    tenant_id = uuid.UUID(payload["tenant_id"])

    stmt = select(User).where(
        User.id == user_id,
        User.tenant_id == tenant_id,
        User.is_active == True,
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "USER_NOT_FOUND",
                "message": "Pengguna tidak ditemukan atau telah dinonaktifkan.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def enforce_tenant_id(
    payload: Annotated[Dict[str, Any], Depends(get_current_token_payload)],
) -> uuid.UUID:
    """Extract authenticated tenant_id from JWT payload. Never trust client-supplied tenant ID."""
    return uuid.UUID(payload["tenant_id"])


def require_role(allowed_roles: list[str]):
    """Factory dependency to enforce Role-Based Access Control (RBAC)."""
    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "INSUFFICIENT_PRIVILEGE",
                    "message": f"Akses ditolak. Memerlukan peran: {', '.join(allowed_roles)}.",
                },
            )
        return current_user
    return role_checker


# Convenient RBAC dependencies
require_admin = require_role(["admin"])
require_cashier = require_role(["admin", "cashier"])  # Admin can also act as cashier
