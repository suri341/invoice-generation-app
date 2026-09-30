import os

from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas as pdf_canvas

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
    rupees = int(round(abs(amount)))
    return f"Rupees {_number_words(rupees).lower()} only"


def _date(value) -> str:
    return value.strftime("%d-%m-%Y") if value else ""


def _indian_grouping(number: int) -> str:
    digits = str(abs(number))
    if len(digits) > 3:
        head, groups = digits[:-3], [digits[-3:]]
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        digits = ",".join(groups)
    return f"-{digits}" if number < 0 else digits


def _doc_number(number: str) -> str:
    # Stored as "1_26-27" (filesystem safe); printed as "1/26-27".
    return (number or "").replace("_", "/")


def _wrap_chars(text: str, font: str, size: float, max_width: float) -> list:
    lines, current = [], ""
    for char in text:
        if current and stringWidth(current + char, font, size) > max_width:
            lines.append(current)
            current = char
        else:
            current += char
    lines.append(current)
    return lines


def _wrap_words(text: str, font: str, size: float, max_width: float) -> list:
    lines, current = [], ""
    for word in (text or "").split():
        candidate = f"{current} {word}".strip()
        if not current or stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return [chunk for line in lines for chunk in _wrap_chars(line, font, size, max_width)]


def _fit_size(text: str, font: str, size: float, max_width: float) -> float:
    width = stringWidth(text, font, size)
    return size if width <= max_width else size * max_width / width


# All coordinates below are in the reference sheet's space (1274 x 1800, origin top-left),
# measured from invoice-reference.pdf and scaled onto A4 at render time.
REF_W, REF_H = 1274, 1800
LOGO_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "logo.png")

REG, BOLD, ITAL, BOLD_ITAL, TIMES = "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique", "Times-Roman"
HEAD_SIZE, PARTY_SIZE, META_SIZE, BODY_SIZE, TERMS_SIZE = 23.3, 25.4, 25.0, 23.2, 17.0

LEFT, RIGHT, TOP, BOTTOM = 62.5, 1210.5, 212.5, 1650.5
PARTY_DIVIDER = 637.5
ITEM_COLUMN_LINES = (141.5, 609.5, 725.5, 812.5, 883.5)
AMOUNT_COLUMN_LINE = 1005.5
TABLE_TOP, ITEMS_TOP, ITEMS_BOTTOM = 716.5, 774.5, 1090.5
FIRST_ROW_BASELINE, ROW_PITCH, LINE_PITCH = 816, 45, 27
DESC_X, DESC_MAX_WIDTH = 184.5, 414
HSN_X, HSN_MAX_WIDTH = 639, 82

BANK_LINES = (
    "HOLDER NAME : KANDIKONDA KRISHNA, UNION BANK OF INDIA - 050210100108017.",
    "IFSC CODE - UBIN0805025, BRANCH - SAMARLAKOTA",
)


def _paginate_items(items) -> list:
    pages, baseline = [[]], FIRST_ROW_BASELINE
    for index, item in enumerate(items, 1):
        desc_lines = _wrap_words(item.part_name, REG, BODY_SIZE, DESC_MAX_WIDTH)
        hsn_lines = _wrap_chars(item.hsn_code or "", REG, BODY_SIZE, HSN_MAX_WIDTH)
        extra_lines = max(len(desc_lines), len(hsn_lines)) - 1
        if pages[-1] and baseline + extra_lines * LINE_PITCH > ITEMS_BOTTOM - 10:
            pages.append([])
            baseline = FIRST_ROW_BASELINE
        pages[-1].append((index, item, desc_lines, hsn_lines, baseline))
        baseline += ROW_PITCH + extra_lines * LINE_PITCH
    return pages


def generate_invoice_pdf(invoice: Invoice) -> str:
    """Generate a tax invoice laid out point-to-point like invoice-reference.pdf."""
    pdf_dir = "generated_pdfs"
    os.makedirs(pdf_dir, exist_ok=True)
    filepath = os.path.join(pdf_dir, f"{invoice.invoice_number}.pdf")

    customer = invoice.customer
    company = settings.COMPANY_NAME.upper()
    doc_no = _doc_number(invoice.invoice_number)
    page_width, page_height = A4
    scale = page_width / REF_W

    c = pdf_canvas.Canvas(filepath, pagesize=A4)
    c.setTitle(f"Invoice {doc_no}")
    c.setAuthor(settings.COMPANY_NAME)

    def text(x, y, value, font=REG, size=BODY_SIZE, align="left"):
        c.setFont(font, size)
        value = str(value)
        if align == "right":
            c.drawRightString(x, REF_H - y, value)
        elif align == "center":
            c.drawCentredString(x, REF_H - y, value)
        else:
            c.drawString(x, REF_H - y, value)

    def hline(y, x0=LEFT, x1=RIGHT):
        c.line(x0, REF_H - y, x1, REF_H - y)

    def vline(x, y0, y1):
        c.line(x, REF_H - y0, x, REF_H - y1)

    address = ", ".join(part.strip() for part in (customer.address, customer.city) if part and part.strip())
    if customer.pincode:
        address = f"{address} - {customer.pincode}" if address else customer.pincode
    if address and not address.endswith("."):
        address += "."
    address_lines = _wrap_words(address, REG, PARTY_SIZE, 540)[:2] if address else []

    state = customer.state or ""
    place_of_supply = f"{customer.city} ({state})" if customer.city and state else (customer.city or state)
    party_name = f"M/s. {customer.company_name or customer.name}"
    quotation_no = _doc_number(invoice.source_quotation.invoice_number) if invoice.source_quotation else ""

    tax_lines = []
    if invoice.discount_amount:
        tax_lines.append((f"Less : Discount  {invoice.discount_percentage:g}%", invoice.discount_amount))
    if invoice.tax_type == "igst":
        tax_lines.append((f"Add : IGST  {settings.IGST_RATE:g}%", invoice.igst_amount))
    else:
        tax_lines.append((f"Add : CGST  {settings.CGST_RATE:g}%", invoice.cgst_amount))
        tax_lines.append((f"Add : SGST  {settings.SGST_RATE:g}%", invoice.sgst_amount))

    pages = _paginate_items(invoice.items)
    for page_number, rows in enumerate(pages, 1):
        is_last_page = page_number == len(pages)
        c.saveState()
        c.translate(0, page_height - REF_H * scale)
        c.scale(scale, scale)
        c.setLineWidth(2)

        # ---- Ruling ----
        c.rect(LEFT, REF_H - BOTTOM, RIGHT - LEFT, BOTTOM - TOP)
        for y in (430.5, 676.5, TABLE_TOP, ITEMS_TOP, ITEMS_BOTTOM, 1227.5, 1373.5, 1445.5):
            hline(y)
        vline(PARTY_DIVIDER, 430.5, 676.5)
        vline(PARTY_DIVIDER, 1445.5, BOTTOM)
        hline(1516.5, PARTY_DIVIDER, RIGHT)
        for x in ITEM_COLUMN_LINES:
            vline(x, TABLE_TOP, ITEMS_BOTTOM)
        vline(AMOUNT_COLUMN_LINE, TABLE_TOP, 1282)

        # ---- Company header ----
        if os.path.exists(LOGO_PATH):
            c.drawImage(ImageReader(LOGO_PATH), 220, REF_H - 376, width=150, height=114, mask="auto")
        text(637.5, 269, "TAX INVOICE", BOLD, 21.0, "center")
        name_size = 36.2
        name_width = stringWidth(company, BOLD, name_size)
        horiz_scale = min(100.0, 448 / name_width * 100)
        c.saveState()  # horizontal scaling (Tz) would otherwise leak into all later text
        name_obj = c.beginText()
        name_obj.setFont(BOLD, name_size)
        name_obj.setHorizScale(horiz_scale)
        name_obj.setTextOrigin(638 - name_width * horiz_scale / 200, REF_H - 314)
        name_obj.textOut(company)
        c.drawText(name_obj)
        c.restoreState()
        text(637.5, 368, settings.COMPANY_ADDRESS, REG, HEAD_SIZE, "center")
        text(637.5, 394, settings.COMPANY_CITY, REG, HEAD_SIZE, "center")
        text(637.5, 424, f"GSTIN : {settings.GSTIN}", BOLD, HEAD_SIZE, "center")
        text(1182, 263, "Original Copy", ITAL, HEAD_SIZE, "right")
        if len(pages) > 1:
            text(1182, 293, f"Page {page_number} of {len(pages)}", ITAL, 18, "right")

        # ---- Party details ----
        text(81, 465, "Party Details", BOLD_ITAL, PARTY_SIZE)
        text(81, 499, party_name, BOLD, _fit_size(party_name, BOLD, PARTY_SIZE, 545))
        for offset, line in enumerate(address_lines):
            text(81, 532 + offset * 30, line, REG, PARTY_SIZE)
        text(82, 593, "Party Mobile No", REG, PARTY_SIZE)
        text(277, 593, customer.phone or "", REG, PARTY_SIZE)
        text(83, 627, "GSTIN", REG, PARTY_SIZE)
        text(201, 627, customer.gstin or "", REG, PARTY_SIZE)
        text(82, 660, "Nos", REG, PARTY_SIZE)
        text(204, 660, doc_no, TIMES, 23.8)

        for label, value, label_y, value_y in (
            ("Invoice No.", doc_no, 459, 459),
            ("Dated", _date(invoice.invoice_date), 512, 504),
            ("Place of Supply", place_of_supply, 538, 538),
            ("Transport", "", 581, 581),
            ("Vehicle No.", "", 611, 611),
            ("Station", "", 641, 641),
            ("E-Way Bill No.", "", 671, 671),
        ):
            text(650, label_y, label, REG, META_SIZE)
            text(876, label_y, ":", REG, META_SIZE)
            if value:
                text(891, value_y, value, REG, _fit_size(value, REG, META_SIZE, 312))

        text(81, 705, "Quotation No.", REG, 23.0)
        if quotation_no:
            text(81 + stringWidth("Quotation No. ", REG, 23.0), 705, quotation_no, REG, 23.0)

        # ---- Items table ----
        text(81, 756, "S.No", BOLD)
        text(245, 756, "Description of Goods", BOLD)
        text(617, 743, "HSN/SAC", BOLD)
        text(640, 769, "Code", BOLD)
        text(750, 754, "Qty.", BOLD)
        text(828, 756, "Unit", BOLD)
        text(918, 756, "Rate", BOLD)
        text(1066, 756, "Amount", BOLD)

        for index, item, desc_lines, hsn_lines, baseline in rows:
            text(84, baseline, index)
            for offset, line in enumerate(desc_lines):
                text(DESC_X, baseline + offset * LINE_PITCH, line)
            for offset, line in enumerate(hsn_lines):
                text(HSN_X, baseline + offset * LINE_PITCH, line)
            qty = f"{item.quantity:.2f}"
            text(774, baseline, qty, REG, _fit_size(qty, REG, BODY_SIZE, 78), "center")
            text(845, baseline, item.unit or "", REG, _fit_size(item.unit or "", REG, BODY_SIZE, 62), "center")
            rate = f"{item.unit_price:.2f}"
            rate_size = _fit_size(rate, REG, BODY_SIZE, 112)
            text(min(955, 1001 - stringWidth(rate, REG, rate_size) / 2), baseline, rate, REG, rate_size, "center")
            text(1069, baseline, f"{item.amount:.2f}")

        # ---- Totals ----
        text(80, 1265, "AMOUNT IN WORDS :", BOLD)
        text(805, 1265, "GRAND TOTAL", BOLD)
        if is_last_page:
            text(1141, 1120, f"{invoice.subtotal:.2f}", BOLD, align="center")
            if len(tax_lines) == 1:
                label, value = tax_lines[0]
                text(613, 1146, "Add :", ITAL)
                text(620, 1173, label, ITAL)
                text(1126.5, 1188, f"{value:.2f}", BOLD, align="center")
            else:
                for offset, (label, value) in enumerate(tax_lines):
                    text(620, 1146 + offset * 27, label, ITAL)
                    text(1126.5, 1146 + offset * 27, f"{value:.2f}", BOLD, align="center")
            text(1128.5, 1265, _indian_grouping(int(round(invoice.total_amount))), BOLD, align="center")
            words = _amount_in_words(invoice.total_amount)
            text(81, 1311, words, REG, _fit_size(words, REG, BODY_SIZE, 1110))

        # ---- Bank details ----
        text(81, 1403, "Bank Details :", BOLD)
        text(253, 1403, BANK_LINES[0], REG, 23.4)
        text(253, 1432, BANK_LINES[1], REG, 23.4)

        # ---- Terms & signature ----
        text(99, 1485, "Terms & Conditions", BOLD, 24.2)
        hline(1488.5, 98, 99 + stringWidth("Terms & Conditions", BOLD, 24.2))
        text(99, 1525, "E. & O.E", REG, 24.0)
        text(99, 1543, "1. Goods once sold will not be taken back or exchanged.", REG, TERMS_SIZE)
        text(99, 1562, "2.", REG, TERMS_SIZE)
        text(177, 1562, "Interest 18& p.a. will be charged if", REG, TERMS_SIZE)
        text(99, 1582, "the payment is not made with in the stipulated", REG, TERMS_SIZE)
        text(99, 1602, "time", REG, TERMS_SIZE)

        text(655, 1490, "Receiver\u2019s Signature :", REG, BODY_SIZE)
        company_width = stringWidth(company, BOLD, BODY_SIZE)
        text(1183 - company_width, 1548, company, BOLD, BODY_SIZE)
        text(1183 - company_width, 1548, "For ", REG, BODY_SIZE, "right")
        text(1002, 1617, "Authorised", REG, BODY_SIZE)
        text(1002, 1644, "Signatory", REG, BODY_SIZE)

        c.restoreState()
        c.showPage()

    c.save()
    return filepath
