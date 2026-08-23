from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class InvoiceType(str, enum.Enum):
    INVOICE = "invoice"
    QUOTATION = "quotation"


class InvoiceStatus(str, enum.Enum):
    COMPLETED = "completed"


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
    invoice_type = Column(SQLEnum(InvoiceType), default=InvoiceType.INVOICE)
    status = Column(SQLEnum(InvoiceStatus), default=InvoiceStatus.COMPLETED)

    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)

    invoice_date = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(DateTime(timezone=True))

    # Amounts
    subtotal = Column(Float, default=0.0)
    cgst_amount = Column(Float, default=0.0)  # Central GST
    sgst_amount = Column(Float, default=0.0)  # State GST
    igst_amount = Column(Float, default=0.0)  # Integrated GST
    discount_percentage = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)

    notes = Column(Text)
    terms_conditions = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    customer = relationship("Customer", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Invoice {self.invoice_number} - {self.invoice_type}>"


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id"))

    part_name = Column(String(255), nullable=False)
    description = Column(Text)
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), default="Piece")
    unit_price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("Invoice", back_populates="items")

    def __repr__(self):
        return f"<InvoiceItem {self.part_name} x {self.quantity}>"
