from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    company_name = Column(String(255))
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(20), nullable=False)
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    pincode = Column(String(10))
    gstin = Column(String(15), unique=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    invoices = relationship("Invoice", back_populates="customer", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Customer {self.name} - {self.company_name}>"
