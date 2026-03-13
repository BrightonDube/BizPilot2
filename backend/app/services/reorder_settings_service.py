"""Product reorder settings service.

Manages per-product reorder configuration (reorder points, safety stock,
par levels, EOQ) and bulk update operations.

Why a separate service from ReorderService?
ReorderService deals with rules and automated PO generation.
This service manages the *configuration* that informs those decisions.
Separating them keeps each service focused and testable.
"""

from typing import List, Optional, Tuple
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models.reorder import ProductReorderSettings, ReorderAuditLog
from app.schemas.reorder import (
    ProductReorderSettingsCreate,
)


class ReorderSettingsService:
    """CRUD and analytics for per-product reorder configuration."""

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Get settings for a product
    # ------------------------------------------------------------------

    def get_settings(
        self,
        product_id: UUID,
        business_id: UUID,
    ) -> Optional[ProductReorderSettings]:
        """Get reorder settings for a specific product."""
        return (
            self.db.query(ProductReorderSettings)
            .filter(
                ProductReorderSettings.product_id == str(product_id),
                ProductReorderSettings.business_id == str(business_id),
                ProductReorderSettings.deleted_at.is_(None),
            )
            .first()
        )

    # ------------------------------------------------------------------
    # Create or update settings (upsert)
    # ------------------------------------------------------------------

    def upsert_settings(
        self,
        data: ProductReorderSettingsCreate,
        business_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> ProductReorderSettings:
        """Create or update reorder settings for a product.

        Why upsert instead of separate create/update?
        The unique constraint on (product_id, business_id) means there
        is at most one settings row per product.  Upsert is the natural
        operation for "set the config for this product".
        """
        existing = self.get_settings(UUID(data.product_id), business_id)

        if existing:
            existing.reorder_point = data.reorder_point
            existing.safety_stock = data.safety_stock
            existing.par_level = data.par_level
            existing.eoq = data.eoq
            existing.auto_reorder = data.auto_reorder
            if data.preferred_supplier_id:
                existing.preferred_supplier_id = data.preferred_supplier_id
            settings = existing
        else:
            settings = ProductReorderSettings(
                id=uuid4(),
                product_id=data.product_id,
                business_id=business_id,
                reorder_point=data.reorder_point,
                safety_stock=data.safety_stock,
                par_level=data.par_level,
                eoq=data.eoq,
                auto_reorder=data.auto_reorder,
                preferred_supplier_id=data.preferred_supplier_id,
            )
            self.db.add(settings)

        # Audit log
        audit = ReorderAuditLog(
            id=uuid4(),
            business_id=business_id,
            action="settings_updated" if existing else "settings_created",
            entity_type="product_reorder_settings",
            entity_id=settings.id,
            details={
                "product_id": data.product_id,
                "reorder_point": data.reorder_point,
                "safety_stock": data.safety_stock,
            },
            performed_by=user_id,
            is_automated=False,
        )
        self.db.add(audit)

        self.db.commit()
        self.db.refresh(settings)
        return settings

    # ------------------------------------------------------------------
    # Bulk update
    # ------------------------------------------------------------------

    def bulk_update(
        self,
        items: List[ProductReorderSettingsCreate],
        business_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> List[ProductReorderSettings]:
        """Create or update reorder settings for multiple products at once."""
        results = []
        for item in items:
            settings = self.upsert_settings(item, business_id, user_id)
            results.append(settings)
        return results

    # ------------------------------------------------------------------
    # List all settings for a business
    # ------------------------------------------------------------------

    def list_settings(
        self,
        business_id: UUID,
        *,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[ProductReorderSettings], int]:
        """List all product reorder settings for a business."""
        query = (
            self.db.query(ProductReorderSettings)
            .filter(
                ProductReorderSettings.business_id == str(business_id),
                ProductReorderSettings.deleted_at.is_(None),
            )
            .order_by(ProductReorderSettings.created_at.desc())
        )

        total = query.count()
        items = query.offset((page - 1) * per_page).limit(per_page).all()
        return items, total
