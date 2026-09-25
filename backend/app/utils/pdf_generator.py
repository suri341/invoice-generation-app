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
    paise = int(round((abs(amount) - rupees) * 100))
    result = f"Rupees {_number_words(rupees)}"
    if paise:
        result += f", {_number_words(paise)} Paise"
    return result + " only."


def _date(value) -> str:
    return value.strftime("%d/%m/%Y") if value else "-"


def generate_invoice_pdf(invoice: Invoice) -> str:
    """Generate a traditional Indian quotation or tax invoice PDF."""
    pdf_dir = "generated_pdfs"
    os.makedirs(pdf_dir, exist_ok=True)
    filepath = os.path.join(pdf_dir, f"{invoice.invoice_number}.pdf")

    doc = SimpleDocTemplate(
        filepath, pagesize=A4, rightMargin=0.42 * inch, leftMargin=0.42 * inch,
        topMargin=0.35 * inch, bottomMargin=0.4 * inch,
    )
    styles = getSampleStyleSheet()
    navy = colors.HexColor("#12304A")
    teal = colors.HexColor("#0B7A75")
    orange = colors.HexColor("#E58B28")
    pale = colors.HexColor("#F2F6F7")
    dark = colors.HexColor("#263746")
    is_quotation = invoice.invoice_type.value == "quotation"

    def money(value: float, negative: bool = False) -> str:
        """Format money - quotations use 'Rs. amount', tax invoices use plain 'amount'"""
        sign = "-" if negative else ""
        if is_quotation:
            return f"{sign}Rs. {abs(value):,.2f}"
        else:
            # Tax invoice - no currency symbol, just plain number with commas
            return f"{sign}{abs(value):,.2f}"

    normal = ParagraphStyle("InvoiceNormal", parent=styles["Normal"], fontSize=8.5, leading=11, textColor=dark)
    small = ParagraphStyle("InvoiceSmall", parent=normal, fontSize=7.5, leading=9)
    label = ParagraphStyle("InvoiceLabel", parent=normal, fontName="Helvetica-Bold", textColor=navy)
    title = ParagraphStyle("InvoiceTitle", parent=normal, fontSize=17, leading=20, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER)
    section = ParagraphStyle("InvoiceSection", parent=normal, fontSize=9, fontName="Helvetica-Bold", textColor=colors.white)

    def p(text, style=normal):
        return Paragraph(escape(str(text)).replace("\n", "<br/>"), style)

    # Company header matching reference invoice.pdf exactly
    company_lines = [
        p(str(settings.COMPANY_NAME).upper(), ParagraphStyle("Company", parent=normal, fontSize=18, leading=21, fontName="Helvetica-Bold", textColor=navy, alignment=TA_CENTER)),
        p(settings.COMPANY_ADDRESS, ParagraphStyle("CompanyAddress", parent=normal, alignment=TA_CENTER)),
        p(getattr(settings, 'COMPANY_CITY', ''), ParagraphStyle("CompanyCity", parent=normal, alignment=TA_CENTER)),
    ]
    if settings.GSTIN:
        company_lines.append(p(f"GSTIN : {settings.GSTIN}", ParagraphStyle("CompanyGstin", parent=normal, alignment=TA_CENTER, fontName="Helvetica-Bold")))

    elements = [
        Table([[company_lines]], colWidths=[7.45 * inch], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E8F1F3")),
            ("BOX", (0, 0), (-1, -1), 1.2, teal), ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ])),
        Spacer(1, 0.1 * inch),
        Table([[p("QUOTATION" if is_quotation else "TAX INVOICE", title)]], colWidths=[7.45 * inch], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), teal if is_quotation else navy),
            ("BOX", (0, 0), (-1, -1), 0.5, orange), ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ])),
        Spacer(1, 0.08 * inch),
    ]

    copy_text = "Quotation" if is_quotation else "Original Copy"
    number_label = "Quotation No." if is_quotation else "Invoice No."

    customer = invoice.customer
    customer_state = customer.state or "Andhra Pradesh"

    # Build Party Details matching reference invoice.pdf EXACTLY
    if not is_quotation:
        # TAX INVOICE - Full Party Details
        # Left column - use customer data as entered in customer page
        left_content = [
            p("Party Details", section),
            p(f"M/s. {customer.name}", normal),  # Customer name as entered
        ]

        # Add company name if exists
        if customer.company_name:
            left_content.append(p(customer.company_name, normal))

        # Add address if exists
        if customer.address:
            left_content.append(p(customer.address, normal))

        # Add city, state, pincode line if any exists
        city_line_parts = []
        if customer.city:
            city_line_parts.append(customer.city)
        if customer.state:
            city_line_parts.append(customer.state)
        if customer.pincode:
            city_line_parts.append(f"- {customer.pincode}")
        if city_line_parts:
            left_content.append(p(" ".join(city_line_parts) + ".", normal))

        # Add empty line if needed to reach row 4
        while len(left_content) < 4:
            left_content.append(p("", normal))

        # Add mobile, GSTIN, Nos rows
        left_content.append(p("Party Mobile No", small))
        left_content.append(p(f"GSTIN    {customer.gstin if customer.gstin else ''}", small))
        left_content.append(p(f"Nos      {customer.phone}", small))

        # Right column content
        right_content = [
            p(f"Invoice No.      : {invoice.invoice_number}", normal),
            p(f"Dated            : {_date(invoice.invoice_date)}", normal),
            p(f"Place of Supply  : {customer_state}", normal),
            p("Transport        :", normal),
            p("Vehicle No.      :", normal),
            p("Station          :", normal),
            p("E-Way Bill No.   :", normal),
        ]

        # Create the party details table with 2 columns
        party_table_data = []
        for i in range(max(len(left_content), len(right_content))):
            left = left_content[i] if i < len(left_content) else p("", normal)
            right = right_content[i] if i < len(right_content) else p("", normal)
            party_table_data.append([left, right])

        elements.append(Table(party_table_data, colWidths=[3.7 * inch, 3.75 * inch], style=TableStyle([
            ("BACKGROUND", (0, 0), (0, 0), navy), ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#B7C8CD")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])))

        # Add separate row for "Quotation No." below the party details
        quotation_no_table = Table([[p("Quotation No.", label)]], colWidths=[7.45 * inch], style=TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#B7C8CD")),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(quotation_no_table)

    else:
        # QUOTATION - Simpler format, NO GSTIN in body
        customer_display = customer.company_name if customer.company_name else customer.name

        # Build address
        address_parts = []
        if customer.address:
            address_parts.append(customer.address)
        if customer.city:
            city_part = customer.city
            if customer.pincode:
                city_part += f" - {customer.pincode}"
            address_parts.append(city_part)
        customer_address = ", ".join(address_parts) if address_parts else ""

        quotation_data = [
            [p("Party Details", section), p(f"Quotation No.    : {invoice.invoice_number}", normal)],
            [p(customer_display, normal), p(f"Dated            : {_date(invoice.invoice_date)}", normal)],
            [p(customer_address, normal), p(f"Place of Supply  : {customer_state}", normal)],
            [p(f"Party Mobile No: {customer.phone}", small), p("", normal)],
        ]

        elements.append(Table(quotation_data, colWidths=[3.7 * inch, 3.75 * inch], style=TableStyle([
            ("BACKGROUND", (0, 0), (0, 0), navy), ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#B7C8CD")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])))

    # Items table with HSN codes
    items_data = [[p("S.No", section), p("Description of Goods", section), p("HSN/SAC\nCode", section), p("Qty.", section), p("Unit", section), p("Rate", section), p("Amount", section)]]
    for index, item in enumerate(invoice.items, 1):
        hsn = item.hsn_code or ""
        description = item.part_name + (f"\n{item.description}" if item.description else "")
        items_data.append([p(str(index), normal), p(description, normal), p(hsn, normal), p(f"{item.quantity:.2f}", normal), p(item.unit, normal), p(f"{item.unit_price:,.2f}", normal), p(f"{item.amount:,.2f}", normal)])
    items_table = Table(items_data, colWidths=[0.42 * inch, 2.45 * inch, 0.78 * inch, 0.55 * inch, 0.62 * inch, 1.25 * inch, 1.38 * inch], repeatRows=1, style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), navy), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#AABCC1")), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, pale]),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("ALIGN", (1, 1), (1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.extend([items_table, Spacer(1, 0.1 * inch)])

    # Summary section matching invoice.pdf reference
    summary = []

    # First line shows subtotal (no label, just amount)
    summary.append([p("", normal), p(money(invoice.subtotal), normal)])

    # Add freight/forwarding if there's any additional charges (can use notes or custom field)
    # For now, we'll skip this as it's not in the model

    # Add taxes for Tax Invoice
    if not is_quotation:
        # Add CGST and SGST
        if invoice.cgst_amount > 0 and invoice.sgst_amount > 0:
            summary.append([p(f"Add : CGST ({settings.CGST_RATE:g}%)", normal), p(money(invoice.cgst_amount), normal)])
            summary.append([p(f"Add : SGST ({settings.SGST_RATE:g}%)", normal), p(money(invoice.sgst_amount), normal)])
        # Or IGST
        if invoice.igst_amount > 0:
            summary.append([p("Add : IGST", normal), p(money(invoice.igst_amount), normal)])

    # Grand Total
    summary.append([p("GRAND TOTAL", ParagraphStyle("GrandLabel", parent=normal, fontName="Helvetica-Bold", textColor=navy)), p(money(invoice.total_amount), ParagraphStyle("GrandValue", parent=normal, fontName="Helvetica-Bold", textColor=navy))])

    summary_table = Table(summary, colWidths=[5.65 * inch, 1.8 * inch], style=TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 1.4, colors.black),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.extend([summary_table, Spacer(1, 0.08 * inch)])

    amount_words_table = Table([
        [p("AMOUNT IN WORDS :", label)],
        [p(_amount_in_words(invoice.total_amount), normal)],
    ], colWidths=[7.45 * inch], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), pale),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#B7C8CD")),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.extend([amount_words_table, Spacer(1, 0.12 * inch)])

    # Bank Details and Terms & Conditions - ONLY FOR TAX INVOICES
    if not is_quotation:
        # Tax Invoice - Show Bank Details and Terms
        bank_details = getattr(settings, "BANK_DETAILS", "")
        if not bank_details:
            bank_details = "HOLDER NAME : KANDIKONDA KRISHNA, UNION BANK OF INDIA - 050210100108017.\nIFSC CODE - UBIN0805025, BRANCH - SAMARLAKOTA"

        default_terms = """E. & O.E
1. Goods once sold will not be taken back or exchanged.
2. Interest 18& p.a. will be charged if the payment
   is not made with in the stipulated time
3. Subject to "TOHANA" Jurisdiction only."""

        terms = default_terms

        lower = Table([
            [p("Bank Details :", label), p("Terms & Conditions", label)],
            [p(bank_details, small), p(terms, small)],
        ], colWidths=[3.7 * inch, 3.75 * inch], style=TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.8, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(lower)

        # Signature section for Tax Invoice
        signature_table = Table([
            [p("Receiver's Signature :", label), p(f"For {settings.COMPANY_NAME.upper()}", ParagraphStyle("CompSig", parent=label, alignment=TA_CENTER))],
            [p("", normal), p("", normal)],
            [p("", normal), p("Authorised Signatory", ParagraphStyle("Sig", parent=normal, alignment=TA_RIGHT))],
        ], colWidths=[3.7 * inch, 3.75 * inch], style=TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 15),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.extend([Spacer(1, 0.15 * inch), signature_table])
    else:
        # Quotation - NO Bank Details, NO Terms, simpler signature
        signature_table = Table([
            [p(f"For {settings.COMPANY_NAME.upper()}", ParagraphStyle("CompSig", parent=label, alignment=TA_RIGHT))],
            [p("", normal)],
            [p("Authorised Signatory", ParagraphStyle("Sig", parent=normal, alignment=TA_RIGHT))],
        ], colWidths=[7.45 * inch], style=TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 15),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.extend([Spacer(1, 0.25 * inch), signature_table])

    def set_metadata(canvas, document):
        canvas.setTitle(f"{copy_text} {invoice.invoice_number}")
        canvas.setAuthor(str(settings.COMPANY_NAME))
        canvas.setSubject(f"{copy_text} for {customer.name}")
        canvas.setCreator("Jagannath Enterprises Invoice System")

    doc.build(elements, onFirstPage=set_metadata, onLaterPages=set_metadata)
    return filepath
