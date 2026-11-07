"""API v1 router aggregator."""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    categories,
    products,
    tables,
    menu,
    orders,
    payments,
    shifts,
    sse,
)

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_v1_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_v1_router.include_router(products.router, prefix="/products", tags=["Products"])
api_v1_router.include_router(tables.router, prefix="/tables", tags=["Tables"])
api_v1_router.include_router(orders.router, prefix="/orders", tags=["Orders"])
api_v1_router.include_router(payments.router, prefix="/orders", tags=["Payments"])
api_v1_router.include_router(shifts.router, prefix="/shifts", tags=["Cashier Shifts"])
api_v1_router.include_router(sse.router, prefix="/orders", tags=["Realtime SSE"])
api_v1_router.include_router(menu.router, tags=["Customer Menu"])
