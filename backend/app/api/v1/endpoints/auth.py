"""Authentication endpoints for staff (cashier & admin)."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.deps.auth import get_current_user, require_admin
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    TokenResponse,
    UserResponse,
)

router = APIRouter()


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(
    payload: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Authenticate staff user (cashier or admin) and return signed JWT."""
    # 1. Cari tenant berdasarkan slug
    tenant_stmt = select(Tenant).where(Tenant.slug == payload.tenant_slug)
    tenant_res = await db.execute(tenant_stmt)
    tenant = tenant_res.scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_CREDENTIALS",
                "message": "Nama pengguna atau kata sandi tidak valid.",
            },
        )

    # 2. Cari user pada tenant tersebut
    user_stmt = select(User).where(
        User.tenant_id == tenant.id,
        User.username == payload.username,
    )
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_CREDENTIALS",
                "message": "Nama pengguna atau kata sandi tidak valid.",
            },
        )

    # 3. Verifikasi password hash (Argon2id / Bcrypt)
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_CREDENTIALS",
                "message": "Nama pengguna atau kata sandi tidak valid.",
            },
        )

    # 4. Generate JWT Access Token
    access_token = create_access_token(
        subject=str(user.id),
        tenant_id=str(tenant.id),
        role=user.role,
    )

    return LoginResponse(
        success=True,
        data=TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user),
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get profile of currently authenticated staff user."""
    return UserResponse.model_validate(current_user)


@router.get("/admin-only-check")
async def admin_only_check(
    current_admin: Annotated[User, Depends(require_admin)],
):
    """Guarded endpoint to verify RBAC admin enforcement."""
    return {
        "success": True,
        "message": f"Halo Admin {current_admin.full_name}, hak akses valid.",
    }
