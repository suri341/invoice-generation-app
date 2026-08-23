from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PartBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    unit: str = Field(default="Piece", max_length=20)
    hsn_code: Optional[str] = Field(None, max_length=20)
    price: float = Field(..., gt=0)
    image_url: Optional[str] = Field(None, max_length=500)


class PartCreate(PartBase):
    pass


class PartUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    unit: Optional[str] = Field(None, max_length=20)
    hsn_code: Optional[str] = Field(None, max_length=20)
    price: Optional[float] = Field(None, gt=0)
    image_url: Optional[str] = Field(None, max_length=500)


class PartResponse(PartBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
