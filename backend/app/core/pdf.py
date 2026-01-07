"""PDF generation helpers for invoices and reports.

Provides styled PDF generation with proper formatting, tables, and branding.
"""

from __future__ import annotations
from typing import Optional
from decimal import Decimal
from datetime import date, datetime


def escape_pdf_text(value: str) -> str:
    """Escape special characters for PDF text."""
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def format_currency(amount: Decimal | float | int | None, currency: str = "ZAR") -> str:
    """Format amount as currency string."""
    if amount is None:
        return f"{currency} 0.00"
    return f"{currency} {float(amount):,.2f}"


def format_date(d: date | datetime | None) -> str:
    """Format date for display."""
    if d is None:
        return ""
    if isinstance(d, datetime):
        d = d.date()
    return d.strftime("%d %B %Y")


class PDFBuilder:
    """Builder for creating styled PDF documents."""
    
    def __init__(self, title: str = "Document"):
        self.title = title
        self.content_lines: list[str] = []
        self.y_position = 780  # Start from top
        self.left_margin = 50
        self.right_margin = 545
        self.page_width = 595
        self.line_height = 14
        
    def _add_text(self, text: str, x: int, size: int = 10, bold: bool = False):
        """Add text at specific position."""
        font = "/F2" if bold else "/F1"
        self.content_lines.append(f"BT {font} {size} Tf {x} {self.y_position} Td ({escape_pdf_text(text)}) Tj ET")
        
    def _add_line(self, x1: int, y1: int, x2: int, y2: int, width: float = 0.5):
        """Draw a line."""
        self.content_lines.append(f"{width} w {x1} {y1} m {x2} {y2} l S")
        
    def _add_rect(self, x: int, y: int, w: int, h: int, fill: bool = False, stroke: bool = True):
        """Draw a rectangle."""
        if fill and stroke:
            self.content_lines.append(f"{x} {y} {w} {h} re B")
        elif fill:
            self.content_lines.append(f"{x} {y} {w} {h} re f")
        else:
            self.content_lines.append(f"{x} {y} {w} {h} re S")
            
    def _set_color(self, r: float, g: float, b: float, fill: bool = True):
        """Set color (0-1 range)."""
        if fill:
            self.content_lines.append(f"{r} {g} {b} rg")
        else:
            self.content_lines.append(f"{r} {g} {b} RG")
            
    def _reset_color(self):
        """Reset to black."""
        self.content_lines.append("0 0 0 rg")
        self.content_lines.append("0 0 0 RG")
        
    def add_header(self, business_name: str, subtitle: str = ""):
        """Add document header with business name."""
        # Business name - large and bold
        self._set_color(0.2, 0.4, 0.8)  # Blue color
        self._add_text(business_name, self.left_margin, 20, bold=True)
        self._reset_color()
        self.y_position -= 25
        
        if subtitle:
            self._set_color(0.4, 0.4, 0.4)
            self._add_text(subtitle, self.left_margin, 10)
            self._reset_color()
            self.y_position -= 20
            
        # Horizontal line
        self._set_color(0.2, 0.4, 0.8)
        self._add_line(self.left_margin, self.y_position, self.right_margin, self.y_position, 2)
        self._reset_color()
        self.y_position -= 20
        
    def add_invoice_title(self, invoice_number: str, status: str):
        """Add invoice title section."""
        self._add_text("INVOICE", self.right_margin - 100, 24, bold=True)
        self.y_position -= 20
        self._add_text(invoice_number, self.right_margin - 100, 12)
        self.y_position -= 15
        
        # Status badge
        status_colors = {
            "paid": (0.2, 0.7, 0.3),
            "sent": (0.2, 0.5, 0.8),
            "draft": (0.5, 0.5, 0.5),
            "overdue": (0.8, 0.2, 0.2),
            "partial": (0.9, 0.6, 0.1),
        }
        color = status_colors.get(status.lower(), (0.5, 0.5, 0.5))
        self._set_color(*color)
        self._add_text(status.upper(), self.right_margin - 100, 10, bold=True)
        self._reset_color()
        self.y_position -= 30
        
    def add_two_column_section(self, left_title: str, left_lines: list[str], 
                                right_title: str, right_lines: list[str]):
        """Add a two-column section (e.g., Bill To / Invoice Details)."""
        start_y = self.y_position
        
        # Left column
        self._set_color(0.3, 0.3, 0.3)
        self._add_text(left_title, self.left_margin, 10, bold=True)
        self._reset_color()
        self.y_position -= 15
        
        for line in left_lines:
            self._add_text(line, self.left_margin, 10)
            self.y_position -= 12
            
        left_end_y = self.y_position
        
        # Right column
        self.y_position = start_y
        self._set_color(0.3, 0.3, 0.3)
        self._add_text(right_title, 350, 10, bold=True)
        self._reset_color()
        self.y_position -= 15
        
        for line in right_lines:
            self._add_text(line, 350, 10)
            self.y_position -= 12
            
        # Use the lower of the two columns
        self.y_position = min(left_end_y, self.y_position) - 20
        
    def add_items_table(self, items: list[dict], currency: str = "ZAR"):
        """Add items table with headers."""
        # Table header background
        self._set_color(0.95, 0.95, 0.95)
        self._add_rect(self.left_margin, self.y_position - 5, self.right_margin - self.left_margin, 20, fill=True, stroke=False)
        self._reset_color()
        
        # Header text
        self._set_color(0.2, 0.2, 0.2)
        self._add_text("Description", self.left_margin + 5, 9, bold=True)
        self._add_text("Qty", 320, 9, bold=True)
        self._add_text("Unit Price", 370, 9, bold=True)
        self._add_text("Tax", 440, 9, bold=True)
        self._add_text("Total", 490, 9, bold=True)
        self._reset_color()
        
        self.y_position -= 25
        
        # Table rows
        for item in items:
            desc = str(item.get("description", ""))[:40]  # Truncate long descriptions
            qty = item.get("quantity", 0)
            unit_price = item.get("unit_price", 0)
            tax = item.get("tax_amount", 0)
            total = item.get("total", 0)
            
            self._add_text(desc, self.left_margin + 5, 9)
            self._add_text(str(qty), 320, 9)
            self._add_text(format_currency(unit_price, currency), 370, 9)
            self._add_text(format_currency(tax, currency), 440, 9)
            self._add_text(format_currency(total, currency), 490, 9)
            
            self.y_position -= 15
            
            # Row separator
            self._set_color(0.9, 0.9, 0.9)
            self._add_line(self.left_margin, self.y_position + 5, self.right_margin, self.y_position + 5, 0.5)
            self._reset_color()
            
        self.y_position -= 10
        
    def add_totals_section(self, subtotal: Decimal, tax: Decimal, discount: Decimal,
                           total: Decimal, paid: Decimal, balance: Decimal, currency: str = "ZAR"):
        """Add totals section aligned to the right."""
        x_label = 400
        x_value = 490
        
        # Subtotal
        self._add_text("Subtotal:", x_label, 10)
        self._add_text(format_currency(subtotal, currency), x_value, 10)
        self.y_position -= 15
        
        # Tax
        self._add_text("VAT (15%):", x_label, 10)
        self._add_text(format_currency(tax, currency), x_value, 10)
        self.y_position -= 15
        
        # Discount (if any)
        if discount and float(discount) > 0:
            self._set_color(0.8, 0.2, 0.2)
            self._add_text("Discount:", x_label, 10)
            self._add_text(f"-{format_currency(discount, currency)}", x_value, 10)
            self._reset_color()
            self.y_position -= 15
            
        # Total line
        self._set_color(0.2, 0.4, 0.8)
        self._add_line(x_label - 10, self.y_position + 5, self.right_margin, self.y_position + 5, 1)
        self._reset_color()
        self.y_position -= 5
        
        # Total
        self._add_text("TOTAL:", x_label, 12, bold=True)
        self._add_text(format_currency(total, currency), x_value, 12, bold=True)
        self.y_position -= 20
        
        # Amount paid
        self._set_color(0.2, 0.7, 0.3)
        self._add_text("Amount Paid:", x_label, 10)
        self._add_text(format_currency(paid, currency), x_value, 10)
        self._reset_color()
        self.y_position -= 15
        
        # Balance due
        if float(balance) > 0:
            self._set_color(0.8, 0.2, 0.2)
            self._add_text("Balance Due:", x_label, 11, bold=True)
            self._add_text(format_currency(balance, currency), x_value, 11, bold=True)
            self._reset_color()
        else:
            self._set_color(0.2, 0.7, 0.3)
            self._add_text("PAID IN FULL", x_label, 11, bold=True)
            self._reset_color()
            
        self.y_position -= 30
        
    def add_notes_section(self, notes: Optional[str], terms: Optional[str]):
        """Add notes and terms section."""
        if notes:
            self._set_color(0.3, 0.3, 0.3)
            self._add_text("Notes:", self.left_margin, 10, bold=True)
            self._reset_color()
            self.y_position -= 15
            
            # Wrap notes text
            for line in notes.split("\n")[:5]:  # Limit to 5 lines
                self._add_text(line[:80], self.left_margin, 9)
                self.y_position -= 12
            self.y_position -= 10
            
        if terms:
            self._set_color(0.3, 0.3, 0.3)
            self._add_text("Terms & Conditions:", self.left_margin, 10, bold=True)
            self._reset_color()
            self.y_position -= 15
            
            for line in terms.split("\n")[:3]:
                self._add_text(line[:80], self.left_margin, 9)
                self.y_position -= 12
                
    def add_footer(self, text: str = "Thank you for your business!"):
        """Add footer at bottom of page."""
        self.y_position = 50
        self._set_color(0.5, 0.5, 0.5)
        self._add_line(self.left_margin, self.y_position + 15, self.right_margin, self.y_position + 15, 0.5)
        self._add_text(text, self.left_margin, 9)
        self._reset_color()
        
    def build(self) -> bytes:
        """Build the final PDF bytes."""
        content_stream = "\n".join(self.content_lines).encode("utf-8")
        
        objects: list[bytes] = []
        objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
        objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
        objects.append(
            (
                f"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
                f"/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n"
            ).encode("utf-8")
        )
        objects.append(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
        objects.append(b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n")
        objects.append(
            f"6 0 obj\n<< /Length {len(content_stream)} >>\nstream\n".encode("utf-8")
            + content_stream
            + b"\nendstream\nendobj\n"
        )
        
        header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
        out = bytearray()
        out.extend(header)
        
        offsets: list[int] = [0]
        for obj in objects:
            offsets.append(len(out))
            out.extend(obj)
            
        xref_start = len(out)
        out.extend(f"xref\n0 {len(objects) + 1}\n".encode("utf-8"))
        out.extend(b"0000000000 65535 f \n")
        for off in offsets[1:]:
            out.extend(f"{off:010d} 00000 n \n".encode("utf-8"))
            
        out.extend(
            (
                "trailer\n"
                f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
                "startxref\n"
                f"{xref_start}\n"
                "%%EOF\n"
            ).encode("utf-8")
        )
        
        return bytes(out)


def build_simple_pdf(lines: list[str]) -> bytes:
    """Build a simple text-only PDF (legacy function for compatibility)."""
    font_obj_num = 4

    content_lines = ["BT", "/F1 11 Tf", "50 770 Td"]
    for line in lines:
        content_lines.append(f"({escape_pdf_text(line)}) Tj")
        content_lines.append("0 -14 Td")
    content_lines.append("ET")
    content_stream = "\n".join(content_lines).encode("utf-8")

    objects: list[bytes] = []
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    objects.append(
        (
            f"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 {font_obj_num} 0 R >> >> /Contents 5 0 R >>\nendobj\n"
        ).encode("utf-8")
    )
    objects.append(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
    objects.append(
        f"5 0 obj\n<< /Length {len(content_stream)} >>\nstream\n".encode("utf-8")
        + content_stream
        + b"\nendstream\nendobj\n"
    )

    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    out = bytearray()
    out.extend(header)

    offsets: list[int] = [0]
    for obj in objects:
        offsets.append(len(out))
        out.extend(obj)

    xref_start = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode("utf-8"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode("utf-8"))

    out.extend(
        (
            "trailer\n"
            f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            "startxref\n"
            f"{xref_start}\n"
            "%%EOF\n"
        ).encode("utf-8")
    )

    return bytes(out)


def build_invoice_pdf(
    business_name: str,
    invoice_number: str,
    status: str,
    customer_name: Optional[str],
    billing_address: Optional[str],
    issue_date: date | datetime | None,
    due_date: date | datetime | None,
    items: list[dict],
    subtotal: Decimal,
    tax_amount: Decimal,
    discount_amount: Decimal,
    total: Decimal,
    amount_paid: Decimal,
    balance_due: Decimal,
    notes: Optional[str] = None,
    terms: Optional[str] = None,
    currency: str = "ZAR",
) -> bytes:
    """Build a professionally styled invoice PDF."""
    pdf = PDFBuilder(title=f"Invoice {invoice_number}")
    
    # Header
    pdf.add_header(business_name, "Tax Invoice")
    
    # Invoice title and status
    pdf.add_invoice_title(invoice_number, status)
    
    # Bill To and Invoice Details
    bill_to_lines = []
    if customer_name:
        bill_to_lines.append(customer_name)
    if billing_address:
        for line in billing_address.split("\n")[:4]:
            bill_to_lines.append(line)
    if not bill_to_lines:
        bill_to_lines.append("Walk-in Customer")
        
    invoice_details = [
        f"Invoice Date: {format_date(issue_date)}",
        f"Due Date: {format_date(due_date)}",
    ]
    
    pdf.add_two_column_section("Bill To:", bill_to_lines, "Invoice Details:", invoice_details)
    
    # Items table
    pdf.add_items_table(items, currency)
    
    # Totals
    pdf.add_totals_section(subtotal, tax_amount, discount_amount, total, amount_paid, balance_due, currency)
    
    # Notes and terms
    pdf.add_notes_section(notes, terms)
    
    # Footer
    pdf.add_footer("Thank you for your business!")
    
    return pdf.build()


def build_report_pdf(
    title: str,
    business_name: str,
    date_range: str,
    sections: list[dict],
    currency: str = "ZAR",
) -> bytes:
    """Build a professionally styled report PDF.
    
    sections format: [{"title": "Section Title", "rows": [{"label": "...", "value": "..."}]}]
    """
    pdf = PDFBuilder(title=title)
    
    # Header
    pdf.add_header(business_name, f"{title} - {date_range}")
    
    # Report title
    pdf._add_text(title.upper(), pdf.left_margin, 18, bold=True)
    pdf.y_position -= 25
    
    pdf._set_color(0.4, 0.4, 0.4)
    pdf._add_text(f"Generated: {format_date(datetime.now())}", pdf.left_margin, 10)
    pdf._reset_color()
    pdf.y_position -= 30
    
    # Sections
    for section in sections:
        section_title = section.get("title", "")
        rows = section.get("rows", [])
        
        # Section header
        pdf._set_color(0.95, 0.95, 0.95)
        pdf._add_rect(pdf.left_margin, pdf.y_position - 5, pdf.right_margin - pdf.left_margin, 20, fill=True, stroke=False)
        pdf._reset_color()
        
        pdf._set_color(0.2, 0.2, 0.2)
        pdf._add_text(section_title, pdf.left_margin + 5, 11, bold=True)
        pdf._reset_color()
        pdf.y_position -= 25
        
        # Section rows
        for row in rows:
            label = row.get("label", "")
            value = row.get("value", "")
            
            pdf._add_text(label, pdf.left_margin + 10, 10)
            pdf._add_text(str(value), 400, 10, bold=True)
            pdf.y_position -= 15
            
        pdf.y_position -= 15
        
    # Footer
    pdf.add_footer(f"Report generated by {business_name}")
    
    return pdf.build()
