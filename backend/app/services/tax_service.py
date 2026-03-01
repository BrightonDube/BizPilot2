"""Tax configuration service."""

from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.tax import CategoryTaxRate, ProductTaxRate, TaxRate, TaxType


class TaxService:
    """Service for tax rate operations."""

    def __init__(self, db: Session):
        self.db = db

    def create_tax_rate(
        self,
        business_id: UUID,
        name: str,
        rate: Decimal,
        tax_type: str = "vat",
        code: Optional[str] = None,
        description: Optional[str] = None,
        is_default: bool = False,
        is_inclusive: bool = True,
    ) -> TaxRate:
        """Create a new tax rate."""
        if is_default:
            self._unset_defaults(business_id)

        tax_rate = TaxRate(
            business_id=business_id,
            name=name,
            rate=rate,
            tax_type=TaxType(tax_type),
            code=code,
            description=description,
            is_default=is_default,
            is_inclusive=is_inclusive,
        )
        self.db.add(tax_rate)
        self.db.commit()
        self.db.refresh(tax_rate)
        return tax_rate

    def list_tax_rates(
        self, business_id: UUID, include_inactive: bool = False
    ) -> List[TaxRate]:
        """List all tax rates for a business."""
        query = self.db.query(TaxRate).filter(
            TaxRate.business_id == business_id,
            TaxRate.deleted_at.is_(None),
        )
        if not include_inactive:
            query = query.filter(TaxRate.is_active.is_(True))
        return query.order_by(TaxRate.name).all()

    def get_tax_rate(self, tax_rate_id: UUID, business_id: UUID) -> Optional[TaxRate]:
        """Get a single tax rate."""
        return (
            self.db.query(TaxRate)
            .filter(
                TaxRate.id == tax_rate_id,
                TaxRate.business_id == business_id,
                TaxRate.deleted_at.is_(None),
            )
            .first()
        )

    def update_tax_rate(
        self, tax_rate_id: UUID, business_id: UUID, **kwargs: Any
    ) -> Optional[TaxRate]:
        """Update a tax rate. If setting is_default=True, unset others."""
        tax_rate = self.get_tax_rate(tax_rate_id, business_id)
        if not tax_rate:
            return None

        if kwargs.get("is_default"):
            self._unset_defaults(business_id)

        for key, value in kwargs.items():
            if hasattr(tax_rate, key):
                setattr(tax_rate, key, value)

        self.db.commit()
        self.db.refresh(tax_rate)
        return tax_rate

    def delete_tax_rate(self, tax_rate_id: UUID, business_id: UUID) -> bool:
        """Soft-delete a tax rate."""
        tax_rate = self.get_tax_rate(tax_rate_id, business_id)
        if not tax_rate:
            return False
        tax_rate.soft_delete()
        self.db.commit()
        return True

    # ---- Product / Category assignments ----

    def assign_to_product(self, product_id: UUID, tax_rate_id: UUID) -> ProductTaxRate:
        """Assign a tax rate to a product."""
        existing = (
            self.db.query(ProductTaxRate)
            .filter(
                ProductTaxRate.product_id == product_id,
                ProductTaxRate.tax_rate_id == tax_rate_id,
                ProductTaxRate.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            return existing

        link = ProductTaxRate(product_id=product_id, tax_rate_id=tax_rate_id)
        self.db.add(link)
        self.db.commit()
        self.db.refresh(link)
        return link

    def remove_from_product(self, product_id: UUID, tax_rate_id: UUID) -> bool:
        """Remove a tax rate from a product."""
        link = (
            self.db.query(ProductTaxRate)
            .filter(
                ProductTaxRate.product_id == product_id,
                ProductTaxRate.tax_rate_id == tax_rate_id,
                ProductTaxRate.deleted_at.is_(None),
            )
            .first()
        )
        if not link:
            return False
        self.db.delete(link)
        self.db.commit()
        return True

    def assign_to_category(
        self, category_id: UUID, tax_rate_id: UUID
    ) -> CategoryTaxRate:
        """Assign a tax rate to a category."""
        existing = (
            self.db.query(CategoryTaxRate)
            .filter(
                CategoryTaxRate.category_id == category_id,
                CategoryTaxRate.tax_rate_id == tax_rate_id,
                CategoryTaxRate.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            return existing

        link = CategoryTaxRate(category_id=category_id, tax_rate_id=tax_rate_id)
        self.db.add(link)
        self.db.commit()
        self.db.refresh(link)
        return link

    def remove_from_category(self, category_id: UUID, tax_rate_id: UUID) -> bool:
        """Remove a tax rate from a category."""
        link = (
            self.db.query(CategoryTaxRate)
            .filter(
                CategoryTaxRate.category_id == category_id,
                CategoryTaxRate.tax_rate_id == tax_rate_id,
                CategoryTaxRate.deleted_at.is_(None),
            )
            .first()
        )
        if not link:
            return False
        self.db.delete(link)
        self.db.commit()
        return True

    def get_product_tax_rates(self, product_id: UUID) -> List[TaxRate]:
        """Get applicable tax rates for a product.

        Priority: product-specific > category-level > business default.
        """
        # 1. Product-specific rates
        product_links = (
            self.db.query(ProductTaxRate)
            .filter(
                ProductTaxRate.product_id == product_id,
                ProductTaxRate.deleted_at.is_(None),
            )
            .all()
        )
        if product_links:
            rate_ids = [link.tax_rate_id for link in product_links]
            return (
                self.db.query(TaxRate)
                .filter(
                    TaxRate.id.in_(rate_ids),
                    TaxRate.is_active.is_(True),
                    TaxRate.deleted_at.is_(None),
                )
                .all()
            )

        # 2. Category-level rates (via product's category)
        from app.models.product import Product

        product = self.db.query(Product).filter(Product.id == product_id).first()
        if product and product.category_id:
            cat_links = (
                self.db.query(CategoryTaxRate)
                .filter(
                    CategoryTaxRate.category_id == product.category_id,
                    CategoryTaxRate.deleted_at.is_(None),
                )
                .all()
            )
            if cat_links:
                rate_ids = [link.tax_rate_id for link in cat_links]
                return (
                    self.db.query(TaxRate)
                    .filter(
                        TaxRate.id.in_(rate_ids),
                        TaxRate.is_active.is_(True),
                        TaxRate.deleted_at.is_(None),
                    )
                    .all()
                )

            # Fall back to default for the product's business
            return self._get_defaults(product.business_id)

        # 3. If product exists, fall back to business default
        if product:
            return self._get_defaults(product.business_id)

        return []

    def calculate_tax(
        self,
        business_id: UUID,
        amount: Decimal,
        product_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """Calculate tax for a given amount.

        Returns dict with tax_amount, net_amount, gross_amount, rates_applied.
        """
        if product_id:
            rates = self.get_product_tax_rates(product_id)
        else:
            rates = self._get_defaults(business_id)

        total_tax = Decimal("0")
        rates_applied = []

        for r in rates:
            if r.is_inclusive:
                # Price already includes tax: tax = amount - amount / (1 + rate/100)
                tax = amount - amount / (1 + r.rate / Decimal("100"))
            else:
                tax = amount * r.rate / Decimal("100")

            tax = tax.quantize(Decimal("0.01"))
            total_tax += tax
            rates_applied.append(
                {
                    "tax_rate_id": str(r.id),
                    "name": r.name,
                    "rate": float(r.rate),
                    "tax_amount": float(tax),
                    "is_inclusive": r.is_inclusive,
                }
            )

        if rates and all(r.is_inclusive for r in rates):
            net_amount = amount - total_tax
            gross_amount = amount
        else:
            net_amount = amount
            gross_amount = amount + total_tax

        return {
            "tax_amount": float(total_tax),
            "net_amount": float(net_amount),
            "gross_amount": float(gross_amount),
            "rates_applied": rates_applied,
        }

    # ---- Helpers ----

    def _unset_defaults(self, business_id: UUID) -> None:
        """Unset is_default on all tax rates for a business."""
        self.db.query(TaxRate).filter(
            TaxRate.business_id == business_id,
            TaxRate.is_default.is_(True),
            TaxRate.deleted_at.is_(None),
        ).update({TaxRate.is_default: False})

    def _get_defaults(self, business_id: UUID) -> List[TaxRate]:
        """Get default tax rates for a business."""
        return (
            self.db.query(TaxRate)
            .filter(
                TaxRate.business_id == business_id,
                TaxRate.is_default.is_(True),
                TaxRate.is_active.is_(True),
                TaxRate.deleted_at.is_(None),
            )
            .all()
        )
