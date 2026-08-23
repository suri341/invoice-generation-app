from sqlalchemy.orm import Session
from datetime import datetime
from app.models.invoice import Invoice, InvoiceItem
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate
from app.config import settings


class InvoiceService:
    def __init__(self, db: Session):
        self.db = db

    def generate_invoice_number(self, invoice_type: str) -> str:
        prefix = "INV" if invoice_type == "invoice" else "QUO"
        year = datetime.now().year
        month = datetime.now().month

        last_invoice = (
            self.db.query(Invoice)
            .filter(Invoice.invoice_number.startswith(f"{prefix}-{year}{month:02d}"))
            .order_by(Invoice.invoice_number.desc())
            .first()
        )

        if last_invoice:
            try:
                last_number = int(last_invoice.invoice_number.split("-")[-1])
                next_number = last_number + 1
            except ValueError:
                next_number = 1
        else:
            next_number = 1

        return f"{prefix}-{year}{month:02d}-{next_number:04d}"

    def calculate_amounts(self, items: list, discount_percentage: float = 0.0) -> dict:
        subtotal = sum(item.amount for item in items)

        discount_amount = (subtotal * discount_percentage) / 100
        subtotal_after_discount = subtotal - discount_amount

        cgst_amount = (subtotal_after_discount * settings.CGST_RATE) / 100
        sgst_amount = (subtotal_after_discount * settings.SGST_RATE) / 100
        igst_amount = 0.0

        total_amount = subtotal_after_discount + cgst_amount + sgst_amount + igst_amount

        return {
            "subtotal": round(subtotal, 2),
            "discount_amount": round(discount_amount, 2),
            "cgst_amount": round(cgst_amount, 2),
            "sgst_amount": round(sgst_amount, 2),
            "igst_amount": round(igst_amount, 2),
            "total_amount": round(total_amount, 2)
        }

    def create_invoice(self, invoice_data: InvoiceCreate) -> Invoice:
        invoice_number = self.generate_invoice_number(invoice_data.invoice_type.value)

        db_invoice = Invoice(
            invoice_number=invoice_number,
            invoice_type=invoice_data.invoice_type,
            customer_id=invoice_data.customer_id,
            invoice_date=invoice_data.invoice_date or datetime.now(),
            due_date=invoice_data.due_date,
            discount_percentage=invoice_data.discount_percentage,
            notes=invoice_data.notes,
            terms_conditions=invoice_data.terms_conditions or self.get_default_terms()
        )

        invoice_items = []
        for item_data in invoice_data.items:
            amount = item_data.quantity * item_data.unit_price
            invoice_item = InvoiceItem(
                part_id=item_data.part_id,
                part_name=item_data.part_name,
                description=item_data.description,
                quantity=item_data.quantity,
                unit=item_data.unit,
                unit_price=item_data.unit_price,
                amount=round(amount, 2)
            )
            invoice_items.append(invoice_item)

        db_invoice.items = invoice_items

        amounts = self.calculate_amounts(invoice_items, invoice_data.discount_percentage)
        db_invoice.subtotal = amounts["subtotal"]
        db_invoice.discount_amount = amounts["discount_amount"]
        db_invoice.cgst_amount = amounts["cgst_amount"]
        db_invoice.sgst_amount = amounts["sgst_amount"]
        db_invoice.igst_amount = amounts["igst_amount"]
        db_invoice.total_amount = amounts["total_amount"]

        self.db.add(db_invoice)
        self.db.commit()
        self.db.refresh(db_invoice)

        return db_invoice

    def update_invoice(self, invoice_id: int, invoice_update: InvoiceUpdate) -> Invoice:
        invoice = self.db.query(Invoice).filter(Invoice.id == invoice_id).first()

        update_data = invoice_update.model_dump(exclude_unset=True, exclude={"items"})
        for field, value in update_data.items():
            setattr(invoice, field, value)

        if invoice_update.items is not None:
            self.db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice_id).delete()

            new_items = []
            for item_data in invoice_update.items:
                amount = item_data.quantity * item_data.unit_price
                invoice_item = InvoiceItem(
                    invoice_id=invoice_id,
                    part_id=item_data.part_id,
                    part_name=item_data.part_name,
                    description=item_data.description,
                    quantity=item_data.quantity,
                    unit=item_data.unit,
                    unit_price=item_data.unit_price,
                    amount=round(amount, 2)
                )
                new_items.append(invoice_item)

            invoice.items = new_items

            amounts = self.calculate_amounts(
                new_items,
                invoice_update.discount_percentage or invoice.discount_percentage
            )
            invoice.subtotal = amounts["subtotal"]
            invoice.discount_amount = amounts["discount_amount"]
            invoice.cgst_amount = amounts["cgst_amount"]
            invoice.sgst_amount = amounts["sgst_amount"]
            invoice.igst_amount = amounts["igst_amount"]
            invoice.total_amount = amounts["total_amount"]

        self.db.commit()
        self.db.refresh(invoice)

        return invoice

    def get_default_terms(self) -> str:
        return """Terms and Conditions:
1. Payment is due within 30 days of invoice date.
2. All prices are in Indian Rupees (INR).
3. Goods once sold will not be taken back.
4. Delivery charges, if any, will be extra.
5. Subject to local jurisdiction only.
6. Payment by cheque subject to realization.

Thank you for your business!"""
