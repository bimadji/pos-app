import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class PaymentRequest(BaseModel):
    payment_method: str = Field(..., pattern="^(CASH|STATIC_QRIS)$")
    amount_tendered: float = Field(..., ge=0)


class PaymentResponse(BaseModel):
    payment_id: uuid.UUID
    order_id: uuid.UUID
    status: str
    grand_total: float
    amount_tendered: float
    change_due: float
    payment_method: str
    paid_at: datetime
