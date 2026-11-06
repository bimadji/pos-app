"""API v1 router aggregator."""
from fastapi import APIRouter
from app.api.v1.endpoints import auth

api_v1_router = APIRouter(prefix="/api/v1")

# Include sub-routers
api_v1_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
