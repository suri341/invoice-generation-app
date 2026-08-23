from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.invoice import InvoiceType, InvoiceStatus


class InvoiceItemCreate(BaseModel):
    part_id: Optional[int] = None
    part_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    quantity: float = Field(..., gt=0)
    unit: str = Field(default="Piece", max_length=20)
    unit_price: float = Field(..., gt=0)


class InvoiceItemResponse(BaseModel):
    id: int
    part_id: Optional[int]
    part_name: str
    description: Optional[str]
    quantity: float
    unit: str
    unit_price: float
    amount: float
    created_at: datetime

    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    customer_id: int
    invoice_type: InvoiceType = InvoiceType.INVOICE
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    discount_percentage: float = Field(default=0.0, ge=0, le=100)
    notes: Optional[str] = None
    terms_conditions: Optional[str] = None
    items: List[InvoiceItemCreate] = Field(..., min_length=1)


class InvoiceUpdate(BaseModel):
    customer_id: Optional[int] = None
    due_date: Optional[datetime] = None
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    notes: Optional[str] = None
    terms_conditions: Optional[str] = None
    items: Optional[List[InvoiceItemCreate]] = None


class CustomerBrief(BaseModel):
    id: int
    name: str
    company_name: Optional[str]
    phone: str

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    invoice_type: InvoiceType
    status: InvoiceStatus
    customer_id: int
    customer: CustomerBrief
    invoice_date: datetime
    due_date: Optional[datetime]
    subtotal: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    discount_percentage: float
    discount_amount: float
    total_amount: float
    notes: Optional[str]
    terms_conditions: Optional[str]
    items: List[InvoiceItemResponse]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
