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
    result = f"{_number_words(rupees)} Rupees"
    if paise:
        result += f" and {_number_words(paise)} Paise"
    return result + " Only"


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
    currency = "Rs." if is_quotation else "₹"

    def money(value: float, negative: bool = False) -> str:
        sign = "-" if negative else ""
        return f"{sign}{currency} {abs(value):,.2f}" if is_quotation else f"{sign}{currency}{abs(value):,.2f}"

    normal = ParagraphStyle("InvoiceNormal", parent=styles["Normal"], fontSize=8.5, leading=11, textColor=dark)
    small = ParagraphStyle("InvoiceSmall", parent=normal, fontSize=7.5, leading=9)
    label = ParagraphStyle("InvoiceLabel", parent=normal, fontName="Helvetica-Bold", textColor=navy)
    title = ParagraphStyle("InvoiceTitle", parent=normal, fontSize=17, leading=20, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER)
    section = ParagraphStyle("InvoiceSection", parent=normal, fontSize=9, fontName="Helvetica-Bold", textColor=colors.white)

    def p(text, style=normal):
        return Paragraph(escape(str(text)).replace("\n", "<br/>"), style)

    company_lines = [
        p(str(settings.COMPANY_NAME).upper(), ParagraphStyle("Company", parent=normal, fontSize=18, leading=21, fontName="Helvetica-Bold", textColor=navy, alignment=TA_CENTER)),
        p(settings.COMPANY_ADDRESS, ParagraphStyle("CompanyAddress", parent=normal, alignment=TA_CENTER)),
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
    customer_state = customer.state or ""
    meta_data = [
        [p("Party Details", section), "", p(number_label, label), p(": " + invoice.invoice_number, normal)],
        [p(customer.name, normal), "", p("Dated", label), p(": " + _date(invoice.invoice_date), normal)],
        [p(customer.address or "", small), "", p("Place of Supply", label), p(": " + customer_state, normal)],
    ]

    if not is_quotation:
        meta_data.append([p("", small), "", p("Transport", label), p(":", normal)])
        meta_data.append([p("Party Mobile No", small), "", p("Vehicle No.", label), p(":", normal)])
        meta_data.append([p("GSTIN    " + (customer.gstin or ""), small), "", p("Station", label), p(":", normal)])
        meta_data.append([p("Nos      " + customer.phone, small), "", p("E-Way Bill No.", label), p(":", normal)])
    else:
        meta_data.append([p("Party Mobile No: " + customer.phone, small), "", p("", normal), p("", normal)])
        if customer.gstin:
            meta_data.append([p("GSTIN: " + customer.gstin, small), "", p("", normal), p("", normal)])

    if invoice.source_quotation:
        meta_data.append([p("", small), "", p("Quotation No.", label), p(": " + invoice.source_quotation.invoice_number if hasattr(invoice, 'source_quotation') and invoice.source_quotation else "", normal)])
    else:
        meta_data.append([p("", small), "", p("Quotation No.", label), p("", normal)])

    elements.append(Table(meta_data, colWidths=[3.7 * inch, 0.1 * inch, 1.8 * inch, 1.85 * inch], style=TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), navy), ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
        ("SPAN", (0, 0), (1, 0)), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#B7C8CD")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])))
    elements.append(Spacer(1, 0.12 * inch))


    items_data = [[p("S.No", section), p("Description", section), p("HSN/SAC", section), p("Qty", section), p("Unit", section), p("Rate", section), p("Amount", section)]]
    for index, item in enumerate(invoice.items, 1):
        hsn = item.hsn_code or "-"
        description = item.part_name + (f"\n{item.description}" if item.description else "")
        items_data.append([p(index, normal), p(description, normal), p(hsn, normal), p(f"{item.quantity:.2f}", normal), p(item.unit, normal), p(money(item.unit_price), normal), p(money(item.amount), normal)])
    items_table = Table(items_data, colWidths=[0.42 * inch, 2.45 * inch, 0.78 * inch, 0.55 * inch, 0.62 * inch, 1.25 * inch, 1.38 * inch], repeatRows=1, style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), navy), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#AABCC1")), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, pale]),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("ALIGN", (1, 1), (1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.extend([items_table, Spacer(1, 0.1 * inch)])

    subtotal_after_discount = invoice.subtotal - invoice.discount_amount
    summary = []

    summary.append([p("", normal), p(money(subtotal_after_discount), normal)])

    if invoice.discount_percentage > 0:
        summary.insert(0, [p(f"Less : Discount ({invoice.discount_percentage:g}%)", normal), p(money(invoice.discount_amount, True), normal)])
        summary.insert(0, [p("", normal), p(money(invoice.subtotal), normal)])

    if not is_quotation:
        if invoice.cgst_amount > 0 and invoice.sgst_amount > 0:
            summary.extend([
                [p(f"Add : CGST ({settings.CGST_RATE:g}%)", normal), p(money(invoice.cgst_amount), normal)],
                [p(f"Add : SGST ({settings.SGST_RATE:g}%)", normal), p(money(invoice.sgst_amount), normal)],
            ])
        if invoice.igst_amount > 0:
            summary.append([p(f"Add : IGST ({settings.IGST_RATE:g}%)", normal), p(money(invoice.igst_amount), normal)])

    summary.append([p("GRAND TOTAL", ParagraphStyle("GrandLabel", parent=normal, fontName="Helvetica-Bold", textColor=navy)), p(money(invoice.total_amount), ParagraphStyle("GrandValue", parent=normal, fontName="Helvetica-Bold", textColor=navy))])
    summary_table = Table(summary, colWidths=[5.65 * inch, 1.8 * inch], style=TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"), ("LINEABOVE", (0, -1), (-1, -1), 1.4, orange),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E8F1F3")), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
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

    bank_details = getattr(settings, "BANK_DETAILS", "")
    if not bank_details:
        bank_details = "Bank Details : To be provided"

    default_terms = """E. & O.E
1. Goods once sold will not be taken back or exchanged.
2. Interest @ 18% p.a. will be charged if the payment
   is not made within the stipulated time.
3. Subject to jurisdiction only."""

    terms = invoice.terms_conditions or default_terms
    notes = invoice.notes or ""

    lower = Table([
        [p("Bank Details :", label), p("Terms & Conditions", label)],
        [p(bank_details, small), p(terms, small)],
    ], colWidths=[3.7 * inch, 3.75 * inch], style=TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#B7C8CD")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(lower)

    if notes:
        elements.extend([Spacer(1, 0.08 * inch), p(f"Notes: {notes}", small)])

    signature_table = Table([
        [p("Receiver's Signature :", label), p(f"For {settings.COMPANY_NAME.upper()}", label)],
        [p("", normal), p("", normal)],
        [p("", normal), p("Authorised Signatory", ParagraphStyle("Sig", parent=label, alignment=TA_RIGHT))],
    ], colWidths=[3.7 * inch, 3.75 * inch], style=TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.extend([Spacer(1, 0.15 * inch), signature_table])

    def set_metadata(canvas, document):
        canvas.setTitle(f"{copy_text} {invoice.invoice_number}")
        canvas.setAuthor(str(settings.COMPANY_NAME))
        canvas.setSubject(f"{copy_text} for {customer.name}")
        canvas.setCreator("Jagannath Enterprises Invoice System")

    doc.build(elements, onFirstPage=set_metadata, onLaterPages=set_metadata)
    return filepath
