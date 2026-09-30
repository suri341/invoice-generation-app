import os
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.config import settings
from app.models.invoice import Invoice


ONES = ("Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine")
TEENS = ("Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen")
TENS = ("", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety")


def _number_words(number: int) -> str:
    if number < 10:
        return ONES[number]
    if number < 20:
        return TEENS[number - 10]
    if number < 100:
        return TENS[number // 10] + (f" {ONES[number % 10]}" if number % 10 else "")
    if number < 1000:
        return f"{ONES[number // 100]} Hundred" + (f" {_number_words(number % 100)}" if number % 100 else "")
    for divisor, label in ((10000000, "Crore"), (100000, "Lakh"), (1000, "Thousand")):
        if number >= divisor:
            remainder = number % divisor
            return f"{_number_words(number // divisor)} {label}" + (f" {_number_words(remainder)}" if remainder else "")
    return str(number)


def _amount_in_words(amount: float) -> str:
    rupees = int(abs(amount))
    result = f"Rupees {_number_words(rupees).lower()} only"
    return result


def _date(value) -> str:
    return value.strftime("%d-%m-%Y") if value else "-"


def generate_invoice_pdf(invoice: Invoice) -> str:
    """Generate PDF matching invoice no 1_26-27.pdf EXACTLY"""
    pdf_dir = "generated_pdfs"
    os.makedirs(pdf_dir, exist_ok=True)
    filepath = os.path.join(pdf_dir, f"{invoice.invoice_number}.pdf")

    doc = SimpleDocTemplate(
        filepath, pagesize=A4, rightMargin=0.5 * inch, leftMargin=0.5 * inch,
        topMargin=0.4 * inch, bottomMargin=0.4 * inch,
    )

    styles = getSampleStyleSheet()
    is_quotation = invoice.invoice_type.value == "quotation"

    # Styles
    normal = ParagraphStyle("Normal", parent=styles["Normal"], fontSize=9, leading=11)
    small = ParagraphStyle("Small", parent=normal, fontSize=8, leading=10)
    bold = ParagraphStyle("Bold", parent=normal, fontName="Helvetica-Bold")
    title = ParagraphStyle("Title", parent=normal, fontSize=14, fontName="Helvetica-Bold", alignment=TA_CENTER)

    def p(text, style=normal):
        escaped_text = escape(str(text)).replace("&lt;br/&gt;", "<br/>")
        return Paragraph(escaped_text.replace("\n", "<br/>"), style)

    elements = []
    customer = invoice.customer

    # ========== HEADER ==========
    header_data = [
        [p("", normal), p("TAX INVOICE" if not is_quotation else "QUOTATION", title), p("Original Copy" if not is_quotation else "Quotation", small)]
    ]

    elements.append(Table(header_data, colWidths=[2*inch, 3.5*inch, 2*inch], style=TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "CENTER"),
        ("ALIGN", (2, 0), (2, 0), "RIGHT"),
    ])))

    # Company header
    company_header = [
        [p(settings.COMPANY_NAME.upper(), ParagraphStyle("CompName", parent=bold, fontSize=16, alignment=TA_CENTER))],
        [p(settings.COMPANY_ADDRESS, ParagraphStyle("Addr", parent=normal, fontSize=9, alignment=TA_CENTER))],
        [p(getattr(settings, 'COMPANY_CITY', 'Kakinada, Andhra Pradesh - 533444'), ParagraphStyle("City", parent=normal, fontSize=9, alignment=TA_CENTER))],
        [p(f"GSTIN : {settings.GSTIN}", ParagraphStyle("GSTIN", parent=bold, fontSize=9, alignment=TA_CENTER))],
    ]

    elements.append(Table(company_header, colWidths=[7.5*inch], style=TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, colors.black),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])))

    elements.append(Spacer(1, 0.1*inch))

    # ========== PARTY DETAILS ==========
    if is_quotation:
        # QUOTATION: Plain box, no grid rows
        party_lines = []
        party_lines.append(f"{customer.name}")
        if customer.company_name:
            party_lines.append(customer.company_name)
        if customer.address:
            party_lines.append(customer.address)
        city_parts = []
        if customer.city:
            city_parts.append(customer.city)
        if customer.pincode:
            city_parts.append(f"- {customer.pincode}")
        if city_parts:
            party_lines.append(" ".join(city_parts) + ".")

        party_lines.append("")
        party_lines.append(f"Party Mobile No {customer.phone}")

        party_text = "<br/>".join(party_lines)

        # Right side
        right_lines = [
            f"Quotation No.    : {invoice.invoice_number}",
            f"Dated            : {_date(invoice.invoice_date)}",
            f"Place of Supply  : {customer.state or 'Andhra Pradesh'}",
        ]
        right_text = "<br/>".join(right_lines)

        party_table = Table([
            [p("Party Details", bold), p(right_text, normal)]
        ], colWidths=[3.75*inch, 3.75*inch], style=TableStyle([
            ("BOX", (0, 0), (-1, -1), 1, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))

        # Add party text as a plain paragraph in the left cell
        party_table_data = [
            [p(party_text, normal), p(right_text, normal)]
        ]

        party_table = Table(party_table_data, colWidths=[3.75*inch, 3.75*inch], style=TableStyle([
            ("BOX", (0, 0), (-1, -1), 1, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))

        elements.append(party_table)

    else:
        # TAX INVOICE: Match invoice no 1_26-27.pdf structure EXACTLY
        left_lines = []
        left_lines.append(f"M/s. {customer.company_name if customer.company_name else customer.name}")
        if customer.address:
            left_lines.append(customer.address)
        city_parts = []
        if customer.city:
            city_parts.append(customer.city)
        if customer.pincode:
            city_parts.append(f"- {customer.pincode}")
        if city_parts:
            left_lines.append(" ".join(city_parts) + ".")

        left_lines.append("")
        left_lines.append(f"Party Mobile No {customer.phone}")
        if customer.gstin:
            left_lines.append(f"GSTIN    {customer.gstin}")
        # Add "Nos" with a reference number (could be quotation number or similar)
        nos_ref = invoice.source_quotation.invoice_number if invoice.source_quotation else invoice.invoice_number
        left_lines.append(f"Nos      {nos_ref}")

        left_text = "<br/>".join(left_lines)

        # Right side
        right_lines = [
            f"Invoice No.      : {invoice.invoice_number}",
            f"Dated            : {_date(invoice.invoice_date)}",
            f"Place of Supply  : {customer.state or 'Andhra Pradesh'} ({customer.state or 'Telangana'})",
            f"Transport        :",
            f"Vehicle No.      :",
            f"Station          :",
            f"E-Way Bill No.   :",
        ]
        right_text = "<br/>".join(right_lines)

        party_table_data = [
            [p("Party Details", bold), p(right_text, normal)],
            [p(left_text, normal), p("", normal)],
        ]

        elements.append(Table(party_table_data, colWidths=[3.75*inch, 3.75*inch], style=TableStyle([
            ("BOX", (0, 0), (-1, -1), 1, colors.black),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])))

        # Quotation No. row
        elements.append(Table([[p("Quotation No.", normal)]], colWidths=[7.5*inch], style=TableStyle([
            ("BOX", (0, 0), (-1, -1), 1, colors.black),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])))

    elements.append(Spacer(1, 0.05*inch))

    # ========== ITEMS TABLE ==========
    items_data = [[
        p("S.No", bold),
        p("Description of Goods", bold),
        p("HSN/SAC<br/>Code", bold),
        p("Qty.", bold),
        p("Unit", bold),
        p("Rate", bold),
        p("Amount", bold)
    ]]

    for index, item in enumerate(invoice.items, 1):
        items_data.append([
            p(str(index), normal),
            p(item.part_name, normal),
            p(item.hsn_code or "", normal),
            p(f"{item.quantity:.2f}", normal),
            p(item.unit, normal),
            p(f"{item.unit_price:.2f}", normal),
            p(f"{item.amount:.2f}", normal),
        ])

    items_table = Table(items_data, colWidths=[0.4*inch, 2.8*inch, 0.8*inch, 0.5*inch, 0.5*inch, 0.9*inch, 1.1*inch], repeatRows=1, style=TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (1, 1), (1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    elements.append(items_table)
    elements.append(Spacer(1, 0.05*inch))

    # ========== SUMMARY ==========
    summary_data = []
    summary_data.append([p("", normal), p(f"{invoice.subtotal:.2f}", ParagraphStyle("Sum", parent=normal, alignment=TA_RIGHT))])

    if not is_quotation:
        # Add tax lines based on tax_type
        if invoice.tax_type == "igst" and invoice.igst_amount > 0:
            summary_data.append([p("Add :", normal), p("", normal)])
            summary_data.append([p("Add : IGST  18%", normal), p(f"{invoice.igst_amount:.2f}", ParagraphStyle("Tax", parent=normal, alignment=TA_RIGHT))])
        elif invoice.cgst_amount > 0 or invoice.sgst_amount > 0:
            summary_data.append([p("Add :", normal), p("", normal)])
            if invoice.cgst_amount > 0:
                summary_data.append([p(f"Add : CGST  9%", normal), p(f"{invoice.cgst_amount:.2f}", ParagraphStyle("Tax", parent=normal, alignment=TA_RIGHT))])
            if invoice.sgst_amount > 0:
                summary_data.append([p(f"Add : SGST  9%", normal), p(f"{invoice.sgst_amount:.2f}", ParagraphStyle("Tax", parent=normal, alignment=TA_RIGHT))])

    # Add spacing row before grand total
    summary_data.append([p("", normal), p("", normal)])
    summary_data.append([
        p("AMOUNT IN WORDS :", bold),
        p("GRAND TOTAL", ParagraphStyle("GT", parent=bold, alignment=TA_RIGHT))
    ])
    summary_data.append([
        p(_amount_in_words(invoice.total_amount), normal),
        p(f"{invoice.total_amount:.0f}", ParagraphStyle("GTV", parent=bold, fontSize=11, alignment=TA_RIGHT))
    ])

    summary_table = Table(summary_data, colWidths=[5.5*inch, 2*inch], style=TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    elements.append(summary_table)

    if not is_quotation:
        elements.append(Spacer(1, 0.1*inch))

        # ========== BANK DETAILS & TERMS ==========
        bank_text = "HOLDER NAME : KANDIKONDA KRISHNA, UNION BANK OF INDIA - 050210100108017.<br/>IFSC CODE - UBIN0805025, BRANCH - SAMARLAKOTA"

        terms_text = """E. & O.E<br/>
1. Goods once sold will not be taken back or exchanged.<br/>
2. Interest 18& p.a. will be charged if<br/>
the payment is not made with in the stipulated<br/>
time"""

        footer_data = [
            [p("Bank Details :", bold), p("Terms & Conditions", bold), p("Receiver's Signature :", bold)],
            [p(bank_text, small), p(terms_text, small), p("", normal)],
            [p("", normal), p("", normal), p("", normal)],
            [p("", normal), p("", normal), p("For JAGANNATH ENTERPRISES", bold)],
            [p("", normal), p("", normal), p("", normal)],
            [p("", normal), p("", normal), p("Authorised<br/>Signatory", ParagraphStyle("Sig", parent=normal, alignment=TA_CENTER))],
        ]

        footer_table = Table(footer_data, colWidths=[2.5*inch, 2.5*inch, 2.5*inch], style=TableStyle([
            ("BOX", (0, 0), (-1, -1), 1, colors.black),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("VALIGN", (2, 3), (2, 5), "MIDDLE"),
            ("ALIGN", (2, 3), (2, 5), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))

        elements.append(footer_table)

    def set_metadata(canvas, document):
        canvas.setTitle(f"{'Quotation' if is_quotation else 'Invoice'} {invoice.invoice_number}")
        canvas.setAuthor(settings.COMPANY_NAME)

    doc.build(elements, onFirstPage=set_metadata, onLaterPages=set_metadata)
    return filepath
