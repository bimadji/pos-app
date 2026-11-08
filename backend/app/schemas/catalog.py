import uuid
from typing import Literal
from pydantic import BaseModel, Field


ItemType = Literal["DRINK", "FOOD", "SNACK"]


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    sort_order: int = Field(default=0, ge=0)
    item_type: ItemType = "FOOD"


class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    sort_order: int
    item_type: str

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    category_id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    price: float = Field(..., ge=0)
    stock: int = Field(default=0, ge=0)
    image_url: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    price: float | None = Field(default=None, ge=0)
    stock: int | None = Field(default=None, ge=0)
    image_url: str | None = None


class ProductResponse(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    name: str
    description: str | None
    price: float
    stock: int
    image_url: str | None
    is_available: bool

    model_config = {"from_attributes": True}


class Response(BaseModel):
    success: bool = True
    data: object | None = None
