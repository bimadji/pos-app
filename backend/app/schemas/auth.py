import uuid
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    tenant_slug: str = Field(..., min_length=2, max_length=50, description="Slug unik kafe, misal: kafe-senja")
    username: str = Field(..., min_length=2, max_length=50, description="Username kasir atau admin")
    password: str = Field(..., min_length=6, description="Password staf")


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    full_name: str
    role: str
    tenant_id: uuid.UUID

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class LoginResponse(BaseModel):
    success: bool = True
    data: TokenResponse
