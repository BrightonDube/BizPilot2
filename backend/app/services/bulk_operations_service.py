"""Bulk operations service for products, inventory, and customers."""

import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.base import utc_now
from app.models.customer import Customer
from app.models.inventory import InventoryItem
from app.models.product import Product, ProductStatus


class BulkOperationsService:
    """Service for bulk operations on products, inventory, and customers."""

    def __init__(self, db: Session):
        self.db = db

    # ── Product price updates ───────────────────────────────────────────

    def bulk_price_update(
        self,
        business_id: str,
        product_ids: list[str],
        adjustment_type: str,
        adjustment_value: float,
    ) -> int:
        """Update prices for multiple products.

        adjustment_type: "percentage" | "fixed" | "increment"
        Returns count of updated products.
        """
        products = (
            self.db.query(Product)
            .filter(
                and_(
                    Product.business_id == business_id,
                    Product.id.in_(product_ids),
                    Product.deleted_at.is_(None),
                )
            )
            .all()
        )

        count = 0
        for product in products:
            if adjustment_type == "percentage":
                factor = Decimal(str(1 + adjustment_value / 100))
                product.selling_price = (product.selling_price * factor).quantize(
                    Decimal("0.01")
                )
            elif adjustment_type == "fixed":
                product.selling_price = Decimal(str(adjustment_value))
            elif adjustment_type == "increment":
                product.selling_price = (
                    product.selling_price + Decimal(str(adjustment_value))
                ).quantize(Decimal("0.01"))
            count += 1

        self.db.commit()
        return count

    # ── Stock adjustments ───────────────────────────────────────────────

    def bulk_stock_adjust(
        self,
        business_id: str,
        adjustments: list[dict[str, Any]],
    ) -> int:
        """Adjust inventory quantities for multiple products.

        Each adjustment: {product_id, quantity_change, reason}.
        Returns count of adjusted items.
        """
        count = 0
        for adj in adjustments:
            item = (
                self.db.query(InventoryItem)
                .filter(
                    and_(
                        InventoryItem.business_id == business_id,
                        InventoryItem.product_id == adj["product_id"],
                        InventoryItem.deleted_at.is_(None),
                    )
                )
                .first()
            )
            if item:
                item.quantity_on_hand += adj["quantity_change"]
                count += 1

        self.db.commit()
        return count

    # ── Category assignment ─────────────────────────────────────────────

    def bulk_category_assign(
        self,
        business_id: str,
        product_ids: list[str],
        category_id: str,
    ) -> int:
        """Assign a category to multiple products. Returns count updated."""
        count = (
            self.db.query(Product)
            .filter(
                and_(
                    Product.business_id == business_id,
                    Product.id.in_(product_ids),
                    Product.deleted_at.is_(None),
                )
            )
            .update(
                {Product.category_id: category_id},
                synchronize_session="fetch",
            )
        )
        self.db.commit()
        return count

    # ── Activate / deactivate ───────────────────────────────────────────

    def bulk_activate_products(
        self,
        business_id: str,
        product_ids: list[str],
        active: bool,
    ) -> int:
        """Set product status to active or archived. Returns count updated."""
        new_status = ProductStatus.ACTIVE if active else ProductStatus.ARCHIVED
        count = (
            self.db.query(Product)
            .filter(
                and_(
                    Product.business_id == business_id,
                    Product.id.in_(product_ids),
                    Product.deleted_at.is_(None),
                )
            )
            .update(
                {Product.status: new_status},
                synchronize_session="fetch",
            )
        )
        self.db.commit()
        return count

    # ── Soft delete ─────────────────────────────────────────────────────

    def bulk_delete_products(
        self,
        business_id: str,
        product_ids: list[str],
    ) -> int:
        """Soft-delete multiple products. Returns count deleted."""
        now = utc_now()
        count = (
            self.db.query(Product)
            .filter(
                and_(
                    Product.business_id == business_id,
                    Product.id.in_(product_ids),
                    Product.deleted_at.is_(None),
                )
            )
            .update(
                {Product.deleted_at: now},
                synchronize_session="fetch",
            )
        )
        self.db.commit()
        return count

    # ── Product CSV export / import ─────────────────────────────────────

    def export_products_csv(self, business_id: str) -> list[dict[str, Any]]:
        """Return product data as a list of dicts for CSV export."""
        products = (
            self.db.query(Product)
            .filter(
                and_(
                    Product.business_id == business_id,
                    Product.deleted_at.is_(None),
                )
            )
            .all()
        )

        return [
            {
                "id": str(p.id),
                "name": p.name,
                "sku": p.sku or "",
                "barcode": p.barcode or "",
                "cost_price": float(p.cost_price) if p.cost_price else 0,
                "selling_price": float(p.selling_price),
                "quantity": p.quantity,
                "status": p.status.value if p.status else "",
                "category_id": str(p.category_id) if p.category_id else "",
                "description": p.description or "",
            }
            for p in products
        ]

    def import_products_csv(
        self, business_id: str, rows: list[dict[str, Any]]
    ) -> int:
        """Import products from parsed CSV rows. Returns count imported."""
        count = 0
        for row in rows:
            product = Product(
                id=uuid.uuid4(),
                business_id=business_id,
                name=row["name"],
                sku=row.get("sku"),
                barcode=row.get("barcode"),
                cost_price=Decimal(str(row["cost_price"])) if row.get("cost_price") else None,
                selling_price=Decimal(str(row["selling_price"])),
                quantity=int(row.get("quantity", 0)),
                status=ProductStatus(row["status"]) if row.get("status") else ProductStatus.DRAFT,
                category_id=row.get("category_id") or None,
                description=row.get("description"),
            )
            self.db.add(product)
            count += 1

        self.db.commit()
        return count

    # ── Customer CSV export / import ────────────────────────────────────

    def export_customers_csv(self, business_id: str) -> list[dict[str, Any]]:
        """Return customer data as a list of dicts for CSV export."""
        customers = (
            self.db.query(Customer)
            .filter(
                and_(
                    Customer.business_id == business_id,
                    Customer.deleted_at.is_(None),
                )
            )
            .all()
        )

        return [
            {
                "id": str(c.id),
                "customer_type": c.customer_type.value if c.customer_type else "",
                "first_name": c.first_name or "",
                "last_name": c.last_name or "",
                "email": c.email or "",
                "phone": c.phone or "",
                "company_name": c.company_name or "",
                "tax_number": c.tax_number or "",
                "address_line1": c.address_line1 or "",
                "address_line2": c.address_line2 or "",
                "city": c.city or "",
                "state": c.state or "",
                "postal_code": c.postal_code or "",
                "country": c.country or "",
                "notes": c.notes or "",
            }
            for c in customers
        ]

    def import_customers_csv(
        self, business_id: str, rows: list[dict[str, Any]]
    ) -> int:
        """Import customers from parsed CSV rows. Returns count imported."""
        count = 0
        for row in rows:
            customer = Customer(
                id=uuid.uuid4(),
                business_id=business_id,
                first_name=row.get("first_name"),
                last_name=row.get("last_name"),
                email=row.get("email"),
                phone=row.get("phone"),
                company_name=row.get("company_name"),
                tax_number=row.get("tax_number"),
                address_line1=row.get("address_line1"),
                address_line2=row.get("address_line2"),
                city=row.get("city"),
                state=row.get("state"),
                postal_code=row.get("postal_code"),
                country=row.get("country"),
                notes=row.get("notes"),
            )
            self.db.add(customer)
            count += 1

        self.db.commit()
        return count
