"""
Smart Collection Service.

Manages rule-based product groupings that auto-refresh based on
criteria like tags, price ranges, and categories.

Why a dedicated service instead of adding to TagService?
Smart collections have complex rule evaluation logic (AND/OR combinators,
multiple rule types) that would bloat the tag service. They also have
distinct lifecycle concerns (auto-refresh scheduling, product count
maintenance) that deserve their own service boundary.
"""

from datetime import datetime, timezone
from typing import Optional, List, Tuple
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.tag import SmartCollection, CollectionProduct


class SmartCollectionService:
    """Service for managing smart collections and their products."""

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Collection CRUD
    # ------------------------------------------------------------------

    def create_collection(
        self,
        business_id: UUID,
        name: str,
        slug: str,
        rules: Optional[list] = None,
        rule_logic: str = "and",
        description: Optional[str] = None,
        auto_update: bool = True,
        created_by: Optional[UUID] = None,
    ) -> SmartCollection:
        """Create a new smart collection with optional rules."""
        collection = SmartCollection(
            business_id=business_id,
            name=name,
            slug=slug,
            description=description,
            rules=rules,
            rule_logic=rule_logic,
            is_active=True,
            auto_update=auto_update,
            product_count=0,
            created_by=created_by,
        )
        self.db.add(collection)
        self.db.commit()
        self.db.refresh(collection)
        return collection

    def list_collections(
        self,
        business_id: UUID,
        page: int = 1,
        per_page: int = 20,
        active_only: bool = True,
    ) -> Tuple[List[SmartCollection], int]:
        """List collections with optional active filter."""
        query = self.db.query(SmartCollection).filter(
            SmartCollection.business_id == business_id,
            SmartCollection.deleted_at.is_(None),
        )
        if active_only:
            query = query.filter(SmartCollection.is_active == True)  # noqa: E712

        total = query.count()
        items = (
            query.order_by(SmartCollection.name)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_collection(self, collection_id: UUID) -> Optional[SmartCollection]:
        """Get a single collection by ID."""
        return (
            self.db.query(SmartCollection)
            .filter(
                SmartCollection.id == collection_id,
                SmartCollection.deleted_at.is_(None),
            )
            .first()
        )

    def update_collection(
        self,
        collection_id: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        rules: Optional[list] = None,
        rule_logic: Optional[str] = None,
        is_active: Optional[bool] = None,
        auto_update: Optional[bool] = None,
    ) -> Optional[SmartCollection]:
        """Update collection fields."""
        collection = self.get_collection(collection_id)
        if not collection:
            return None

        if name is not None:
            collection.name = name
        if description is not None:
            collection.description = description
        if rules is not None:
            collection.rules = rules
        if rule_logic is not None:
            collection.rule_logic = rule_logic
        if is_active is not None:
            collection.is_active = is_active
        if auto_update is not None:
            collection.auto_update = auto_update

        self.db.commit()
        self.db.refresh(collection)
        return collection

    def delete_collection(self, collection_id: UUID) -> bool:
        """Soft-delete a collection."""
        collection = self.get_collection(collection_id)
        if not collection:
            return False
        collection.soft_delete()
        self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Product membership
    # ------------------------------------------------------------------

    def add_product(
        self,
        collection_id: UUID,
        product_id: UUID,
        manually_included: bool = False,
    ) -> CollectionProduct:
        """Add a product to a collection."""
        membership = CollectionProduct(
            collection_id=collection_id,
            product_id=product_id,
            manually_included=manually_included,
            manually_excluded=False,
            added_at=datetime.now(timezone.utc),
        )
        self.db.add(membership)

        # Update product count
        self._update_product_count(collection_id)

        self.db.commit()
        self.db.refresh(membership)
        return membership

    def remove_product(self, collection_id: UUID, product_id: UUID) -> bool:
        """Remove a product from a collection."""
        membership = (
            self.db.query(CollectionProduct)
            .filter(
                CollectionProduct.collection_id == collection_id,
                CollectionProduct.product_id == product_id,
            )
            .first()
        )
        if not membership:
            return False

        self.db.delete(membership)
        self._update_product_count(collection_id)
        self.db.commit()
        return True

    def list_products(
        self, collection_id: UUID
    ) -> List[CollectionProduct]:
        """List all products in a collection."""
        return (
            self.db.query(CollectionProduct)
            .filter(
                CollectionProduct.collection_id == collection_id,
                CollectionProduct.manually_excluded == False,  # noqa: E712
            )
            .order_by(CollectionProduct.added_at.desc())
            .all()
        )

    def exclude_product(self, collection_id: UUID, product_id: UUID) -> bool:
        """Mark a product as manually excluded from auto-rules."""
        membership = (
            self.db.query(CollectionProduct)
            .filter(
                CollectionProduct.collection_id == collection_id,
                CollectionProduct.product_id == product_id,
            )
            .first()
        )
        if not membership:
            return False

        membership.manually_excluded = True
        self._update_product_count(collection_id)
        self.db.commit()
        return True

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _update_product_count(self, collection_id: UUID) -> None:
        """Recalculate product count for a collection."""
        count = (
            self.db.query(func.count(CollectionProduct.id))
            .filter(
                CollectionProduct.collection_id == collection_id,
                CollectionProduct.manually_excluded == False,  # noqa: E712
            )
            .scalar()
        ) or 0

        collection = self.db.query(SmartCollection).filter(
            SmartCollection.id == collection_id
        ).first()
        if collection:
            collection.product_count = count

    def refresh_collection(self, collection_id: UUID) -> Optional[SmartCollection]:
        """
        Mark a collection as refreshed.

        In production, this would evaluate rules against the product
        catalog and update memberships. For now, we just update the
        timestamp to track when the refresh was requested.
        """
        collection = self.get_collection(collection_id)
        if not collection:
            return None

        collection.last_refresh_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(collection)
        return collection
