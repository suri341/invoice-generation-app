from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from datetime import datetime
import os
from app.config import settings
from app.models.invoice import Invoice


def generate_invoice_pdf(invoice: Invoice) -> str:
    """Generate a professional PDF for the invoice"""

    pdf_dir = "generated_pdfs"
    os.makedirs(pdf_dir, exist_ok=True)

    filename = f"{invoice.invoice_number}.pdf"
    filepath = os.path.join(pdf_dir, filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    elements = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1e40af'),
        alignment=TA_CENTER,
        spaceAfter=6
    )

    company_style = ParagraphStyle(
        'CompanyStyle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#374151'),
        alignment=TA_CENTER,
        spaceAfter=3
    )

    heading_style = ParagraphStyle(
        'HeadingStyle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#1f2937'),
        spaceAfter=12
    )

    elements.append(Paragraph(settings.COMPANY_NAME.upper(), title_style))
    elements.append(Paragraph(f"Proprietor: {settings.OWNER_NAME}", company_style))
    elements.append(Paragraph(f"Phone: {settings.PHONE_NUMBER}", company_style))
    elements.append(Paragraph(settings.COMPANY_ADDRESS, company_style))
    if settings.GSTIN:
        elements.append(Paragraph(f"GSTIN: {settings.GSTIN}", company_style))
    elements.append(Spacer(1, 0.3 * inch))

    invoice_type_text = "TAX INVOICE" if invoice.invoice_type.value == "invoice" else "QUOTATION"
    invoice_type_style = ParagraphStyle(
        'InvoiceType',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#dc2626') if invoice.invoice_type.value == "invoice" else colors.HexColor('#059669'),
        alignment=TA_CENTER,
        spaceAfter=12
    )
    elements.append(Paragraph(invoice_type_text, invoice_type_style))
    elements.append(Spacer(1, 0.2 * inch))

    info_data = [
        ["Invoice Number:", invoice.invoice_number, "Invoice Date:", invoice.invoice_date.strftime("%d/%m/%Y")],
        ["Status:", invoice.status.value.upper(), "Due Date:", invoice.due_date.strftime("%d/%m/%Y") if invoice.due_date else "N/A"],
    ]

    info_table = Table(info_data, colWidths=[1.5 * inch, 2 * inch, 1.5 * inch, 2 * inch])
    info_table.setStyle(TableStyle([
        ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 10),
        ('FONT', (2, 0), (2, -1), 'Helvetica-Bold', 10),
        ('FONT', (1, 0), (1, -1), 'Helvetica', 10),
        ('FONT', (3, 0), (3, -1), 'Helvetica', 10),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#374151')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.2 * inch))

    elements.append(Paragraph("BILL TO", heading_style))

    customer = invoice.customer
    customer_info = f"""
    <b>{customer.name}</b><br/>
    {customer.company_name or ''}<br/>
    {customer.address or ''}<br/>
    {f'{customer.city}, {customer.state} - {customer.pincode}' if customer.city else ''}<br/>
    Phone: {customer.phone}<br/>
    {f'GSTIN: {customer.gstin}' if customer.gstin else ''}
    """
    elements.append(Paragraph(customer_info, styles['Normal']))
    elements.append(Spacer(1, 0.3 * inch))

    elements.append(Paragraph("ITEMS", heading_style))

    items_data = [["#", "Description", "Qty", "Unit", "Rate", "Amount"]]

    for idx, item in enumerate(invoice.items, 1):
        items_data.append([
            str(idx),
            f"{item.part_name}\n{item.description or ''}",
            f"{item.quantity:.2f}",
            item.unit,
            f"₹{item.unit_price:,.2f}",
            f"₹{item.amount:,.2f}"
        ])

    items_table = Table(
        items_data,
        colWidths=[0.4 * inch, 3.2 * inch, 0.8 * inch, 0.8 * inch, 1.2 * inch, 1.2 * inch]
    )

    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')])
    ]))

    elements.append(items_table)
    elements.append(Spacer(1, 0.3 * inch))

    summary_data = [
        ["Subtotal:", f"₹{invoice.subtotal:,.2f}"],
    ]

    if invoice.discount_percentage > 0:
        summary_data.append([f"Discount ({invoice.discount_percentage}%):", f"-₹{invoice.discount_amount:,.2f}"])

    summary_data.extend([
        [f"CGST ({settings.CGST_RATE}%):", f"₹{invoice.cgst_amount:,.2f}"],
        [f"SGST ({settings.SGST_RATE}%):", f"₹{invoice.sgst_amount:,.2f}"],
    ])

    if invoice.igst_amount > 0:
        summary_data.append([f"IGST ({settings.IGST_RATE}%):", f"₹{invoice.igst_amount:,.2f}"])

    summary_data.append(["", ""])  # Empty row
    summary_data.append(["TOTAL AMOUNT:", f"₹{invoice.total_amount:,.2f}"])

    summary_table = Table(summary_data, colWidths=[5.5 * inch, 1.5 * inch])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -3), 'Helvetica'),
        ('FONTNAME', (0, -2), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -3), 10),
        ('FONTSIZE', (0, -2), (-1, -1), 12),
        ('TEXTCOLOR', (0, 0), (-1, -3), colors.HexColor('#374151')),
        ('TEXTCOLOR', (0, -2), (-1, -1), colors.HexColor('#1e40af')),
        ('LINEABOVE', (0, -2), (-1, -2), 2, colors.HexColor('#1e40af')),
        ('TOPPADDING', (0, -2), (-1, -1), 12),
    ]))

    elements.append(summary_table)
    elements.append(Spacer(1, 0.3 * inch))

    if invoice.notes:
        elements.append(Paragraph("NOTES", heading_style))
        elements.append(Paragraph(invoice.notes, styles['Normal']))
        elements.append(Spacer(1, 0.2 * inch))

    if invoice.terms_conditions:
        elements.append(Paragraph("TERMS & CONDITIONS", heading_style))
        terms_para = Paragraph(invoice.terms_conditions.replace('\n', '<br/>'), styles['Normal'])
        elements.append(terms_para)
        elements.append(Spacer(1, 0.3 * inch))

    footer_style = ParagraphStyle(
        'FooterStyle',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#6b7280'),
        alignment=TA_CENTER
    )
    elements.append(Paragraph(f"For {settings.COMPANY_NAME}", footer_style))
    elements.append(Spacer(1, 0.5 * inch))
    elements.append(Paragraph("Authorized Signature", footer_style))

    doc.build(elements)

    return filepath
