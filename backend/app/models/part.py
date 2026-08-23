from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Part(Base):
    __tablename__ = "parts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)
    description = Column(Text)
    unit = Column(String(20), default="Piece")  # Piece, Kg, Meter, etc.
    hsn_code = Column(String(20))  # HSN code for GST
    price = Column(Float, nullable=False)
    image_url = Column(String(500))  # URL to part image/symbol

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Part {self.name} - {self.category}>"
