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
