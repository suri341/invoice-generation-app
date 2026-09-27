from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus, InvoiceType
from app.models.customer import Customer
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceResponse
from app.services.invoice_service import InvoiceService
from app.utils.pdf_generator import generate_invoice_pdf
import os

router = APIRouter()


@router.get("/", response_model=List[InvoiceResponse])
def get_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[InvoiceStatus] = None,
    customer_id: Optional[int] = None,
    search: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Invoice)

    if status:
        query = query.filter(Invoice.status == status)

    if customer_id:
        query = query.filter(Invoice.customer_id == customer_id)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(Invoice.invoice_number.ilike(search_pattern))

    if date_from:
        query = query.filter(Invoice.invoice_date >= date_from)
    if date_to:
        query = query.filter(Invoice.invoice_date < date_to)

    invoices = query.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()
    return invoices


@router.post("/", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(invoice: InvoiceCreate, db: Session = Depends(get_db)):
    if invoice.invoice_type != InvoiceType.QUOTATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New documents must be created as quotations"
        )
    customer = db.query(Customer).filter(Customer.id == invoice.customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    invoice_service = InvoiceService(db)
    db_invoice = invoice_service.create_invoice(invoice)
    return db_invoice


@router.post("/{invoice_id}/convert", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def convert_quotation_to_invoice(invoice_id: int, db: Session = Depends(get_db)):
    quotation = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not quotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")
    if quotation.invoice_type != InvoiceType.QUOTATION:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only quotations can be converted")
    return InvoiceService(db).convert_quotation_to_invoice(quotation)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    return invoice


@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    invoice_update: InvoiceUpdate,
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    invoice_service = InvoiceService(db)
    updated_invoice = invoice_service.update_invoice(invoice_id, invoice_update)
    return updated_invoice


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    db.query(Invoice).filter(Invoice.source_quotation_id == invoice_id).update(
        {Invoice.source_quotation_id: None}, synchronize_session=False
    )
    db.delete(invoice)
    db.commit()
    return None


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    pdf_path = generate_invoice_pdf(invoice)

    if not os.path.exists(pdf_path):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate PDF"
        )

    return FileResponse(
        path=pdf_path,
        filename=f"{invoice.invoice_number}.pdf",
        media_type="application/pdf"
    )


@router.post("/{invoice_id}/status")
def update_invoice_status(
    invoice_id: int,
    new_status: InvoiceStatus,
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    invoice.status = new_status
    db.commit()
    db.refresh(invoice)

    return {"message": f"Invoice status updated to {new_status}", "invoice": invoice}
