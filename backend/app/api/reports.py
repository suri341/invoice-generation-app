from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from typing import Optional
import csv
import io

from app.database import get_db
from app.models.invoice import Invoice, InvoiceType

router = APIRouter()


@router.get("/monthly")
def download_monthly_report(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Download monthly report with all quotations and invoices
    Includes customer info and quotation-to-invoice hierarchy
    """

    # Build date filters
    filters = []

    if date_from and date_to:
        # Custom date range
        start_date = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
    elif month and year:
        # Specific month/year
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
    else:
        # Default: current month
        now = datetime.now()
        start_date = datetime(now.year, now.month, 1)
        if now.month == 12:
            end_date = datetime(now.year + 1, 1, 1)
        else:
            end_date = datetime(now.year, now.month + 1, 1)

    filters.append(Invoice.invoice_date >= start_date)
    filters.append(Invoice.invoice_date < end_date)

    # Query all invoices and quotations in date range
    invoices = db.query(Invoice).filter(and_(*filters)).order_by(Invoice.invoice_date.desc()).all()

    # Build quotation-to-invoice map
    quotation_map = {}
    for inv in invoices:
        if inv.invoice_type == InvoiceType.QUOTATION:
            quotation_map[inv.id] = {
                'quotation': inv,
                'invoices': []
            }

    # Map invoices to their source quotations
    for inv in invoices:
        if inv.invoice_type == InvoiceType.INVOICE and inv.source_quotation_id:
            if inv.source_quotation_id in quotation_map:
                quotation_map[inv.source_quotation_id]['invoices'].append(inv)

    # Invoices without a quotation in this range are listed on their own
    standalone_invoices = [
        inv for inv in invoices
        if inv.invoice_type == InvoiceType.INVOICE and inv.source_quotation_id not in quotation_map
    ]

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow([
        'Type', 'Document Number', 'Date', 'Customer Name', 'Company Name',
        'Phone', 'Customer Type', 'Missionary Type', 'Total Amount',
        'Tax Type', 'CGST', 'SGST', 'IGST', 'Parent Quotation'
    ])

    # Write quotations and their invoices
    for quo_id, data in quotation_map.items():
        quotation = data['quotation']
        customer = quotation.customer

        # Write quotation row
        writer.writerow([
            'QUOTATION',
            quotation.invoice_number,
            quotation.invoice_date.strftime('%Y-%m-%d'),
            customer.name,
            customer.company_name or '',
            customer.phone,
            customer.customer_type or '',
            customer.missionary_type or '',
            f"{quotation.total_amount:.2f}",
            quotation.tax_type,
            f"{quotation.cgst_amount:.2f}",
            f"{quotation.sgst_amount:.2f}",
            f"{quotation.igst_amount:.2f}",
            ''
        ])

        # Write invoices converted from this quotation
        for invoice in data['invoices']:
            inv_customer = invoice.customer
            writer.writerow([
                '  └─ INVOICE',
                invoice.invoice_number,
                invoice.invoice_date.strftime('%Y-%m-%d'),
                inv_customer.name,
                inv_customer.company_name or '',
                inv_customer.phone,
                inv_customer.customer_type or '',
                inv_customer.missionary_type or '',
                f"{invoice.total_amount:.2f}",
                invoice.tax_type,
                f"{invoice.cgst_amount:.2f}",
                f"{invoice.sgst_amount:.2f}",
                f"{invoice.igst_amount:.2f}",
                quotation.invoice_number
            ])

    # Write standalone invoices
    for invoice in standalone_invoices:
        customer = invoice.customer
        writer.writerow([
            'INVOICE',
            invoice.invoice_number,
            invoice.invoice_date.strftime('%Y-%m-%d'),
            customer.name,
            customer.company_name or '',
            customer.phone,
            customer.customer_type or '',
            customer.missionary_type or '',
            f"{invoice.total_amount:.2f}",
            invoice.tax_type,
            f"{invoice.cgst_amount:.2f}",
            f"{invoice.sgst_amount:.2f}",
            f"{invoice.igst_amount:.2f}",
            invoice.source_quotation.invoice_number if invoice.source_quotation else ''
        ])

    # Write summary
    writer.writerow([])
    writer.writerow(['SUMMARY'])
    writer.writerow(['Total Quotations', len(quotation_map)])
    total_invoices = sum(len(data['invoices']) for data in quotation_map.values()) + len(standalone_invoices)
    writer.writerow(['Total Invoices', total_invoices])
    total_amount = sum(inv.total_amount for inv in invoices if inv.invoice_type == InvoiceType.INVOICE)
    writer.writerow(['Total Amount', f"{total_amount:.2f}"])

    # Prepare response
    output.seek(0)
    filename = f"monthly_report_{start_date.strftime('%Y-%m')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
