import uuid
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field


class OrderItemInput(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(..., gt=0, description="Kuantitas wajib > 0")
    notes: str | None = Field(default=None, max_length=255)


class OrderCreateRequest(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=100)
    items: list[OrderItemInput] = Field(..., min_length=1)


class OrderItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name_snapshot: str
    price_snapshot: float
    quantity: int
    subtotal: float
    notes: str | None
    round_number: int
    item_status: str

    model_config = {"from_attributes": True}


class OrderDetailResponse(BaseModel):
    id: uuid.UUID
    table_number_snapshot: int
    customer_name: str
    status: str
    subtotal: float
    service_amount: float
    tax_amount: float
    grand_total: float
    cancellation_reason: str | None
    created_at: datetime
    items: list[OrderItemResponse] = []

    model_config = {"from_attributes": True}


class MoveTableRequest(BaseModel):
    new_table_number: int = Field(..., ge=1)


class CancelOrderRequest(BaseModel):
    cancellation_reason: str = Field(..., min_length=3, max_length=255)
