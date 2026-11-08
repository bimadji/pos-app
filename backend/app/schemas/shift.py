import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class ShiftOpenRequest(BaseModel):
    starting_cash: float = Field(..., ge=0)


class ShiftCloseRequest(BaseModel):
    actual_cash: float = Field(..., ge=0)
    notes: str | None = Field(default=None, max_length=255)


class ShiftResponse(BaseModel):
    id: uuid.UUID
    cashier_user_id: uuid.UUID
    starting_cash: float
    expected_cash: float | None
    actual_cash: float | None
    cash_difference: float | None
    notes: str | None
    opened_at: datetime
    closed_at: datetime | None

    model_config = {"from_attributes": True}


class ShiftDetailResponse(ShiftResponse):
    cashier_name: str | None = None
    cash_sales: float = 0.0
    qris_sales: float = 0.0
    total_sales: float = 0.0
    total_transactions: int = 0


class ShiftHistoryItem(BaseModel):
    id: uuid.UUID
    cashier_user_id: uuid.UUID
    cashier_name: str
    starting_cash: float
    expected_cash: float | None
    actual_cash: float | None
    cash_difference: float | None
    cash_sales: float = 0.0
    qris_sales: float = 0.0
    total_sales: float = 0.0
    total_transactions: int = 0
    notes: str | None = None
    opened_at: datetime
    closed_at: datetime | None = None
    is_active: bool = False
