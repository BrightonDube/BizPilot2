"""Service layer for product tagging and categorization.

Handles CRUD for tag categories, tags, and product-tag associations,
plus hierarchy maintenance and usage tracking.

Why a service layer?
Tag hierarchy (materialized paths), slug uniqueness, and usage count
updates all involve multi-step logic that shouldn't live in endpoints.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.tag import TagCategory, Tag, ProductTag


class TagService:
    """Business logic for tags and categorization."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # -----------------------------------------------------------------------
    # Tag Category CRUD
    # -----------------------------------------------------------------------

    def create_category(
        self,
        business_id: uuid.UUID,
        *,
        name: str,
        slug: str,
        description: Optional[str] = None,
        color: Optional[str] = None,
        icon: Optional[str] = None,
        sort_order: int = 0,
    ) -> TagCategory:
        """Create a tag category."""
        cat = TagCategory(
            id=uuid.uuid4(),
            business_id=business_id,
            name=name,
            slug=slug,
            description=description,
            color=color,
            icon=icon,
            sort_order=sort_order,
            is_active=True,
        )
        self.db.add(cat)
        self.db.commit()
        self.db.refresh(cat)
        return cat

    def list_categories(
        self,
        business_id: uuid.UUID,
        *,
        page: int = 1,
        per_page: int = 50,
    ) -> tuple[list[TagCategory], int]:
        """List tag categories for a business."""
        query = self.db.query(TagCategory).filter(
            TagCategory.business_id == business_id,
            TagCategory.deleted_at.is_(None),
        )
        total = query.count()
        items = (
            query.order_by(TagCategory.sort_order)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_category(self, category_id: uuid.UUID) -> Optional[TagCategory]:
        return (
            self.db.query(TagCategory)
            .filter(TagCategory.id == category_id, TagCategory.deleted_at.is_(None))
            .first()
        )

    def update_category(self, category_id: uuid.UUID, **kwargs) -> Optional[TagCategory]:
        cat = self.get_category(category_id)
        if not cat:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(cat, key):
                setattr(cat, key, value)
        self.db.commit()
        self.db.refresh(cat)
        return cat

    def delete_category(self, category_id: uuid.UUID) -> bool:
        cat = self.get_category(category_id)
        if not cat:
            return False
        cat.soft_delete()
        self.db.commit()
        return True

    # -----------------------------------------------------------------------
    # Tag CRUD
    # -----------------------------------------------------------------------

    def _compute_hierarchy(self, parent_tag_id: Optional[uuid.UUID]) -> tuple[int, str]:
        """Compute hierarchy_level and hierarchy_path from parent.

        Why materialized paths?
        Avoids recursive CTEs for ancestor/descendant queries, which are
        expensive on large tag trees.  The path string enables LIKE-based
        subtree queries.
        """
        if not parent_tag_id:
            return 0, "/"
        parent = self.db.query(Tag).filter(Tag.id == parent_tag_id).first()
        if not parent:
            return 0, "/"
        level = (parent.hierarchy_level or 0) + 1
        parent_path = parent.hierarchy_path or "/"
        path = f"{parent_path}{parent.slug}/"
        return level, path

    def create_tag(
        self,
        business_id: uuid.UUID,
        *,
        name: str,
        slug: str,
        category_id: Optional[uuid.UUID] = None,
        parent_tag_id: Optional[uuid.UUID] = None,
        description: Optional[str] = None,
        color: Optional[str] = None,
        is_system_tag: bool = False,
        auto_apply_rules: Optional[dict] = None,
    ) -> Tag:
        """Create a tag with hierarchy computation."""
        level, path = self._compute_hierarchy(parent_tag_id)

        tag = Tag(
            id=uuid.uuid4(),
            business_id=business_id,
            category_id=category_id,
            parent_tag_id=parent_tag_id,
            name=name,
            slug=slug,
            description=description,
            color=color,
            hierarchy_level=level,
            hierarchy_path=path,
            usage_count=0,
            is_system_tag=is_system_tag,
            is_active=True,
            auto_apply_rules=auto_apply_rules,
        )
        self.db.add(tag)
        self.db.commit()
        self.db.refresh(tag)
        return tag

    def list_tags(
        self,
        business_id: uuid.UUID,
        *,
        category_id: Optional[uuid.UUID] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> tuple[list[Tag], int]:
        """List tags with optional category and search filters."""
        query = self.db.query(Tag).filter(
            Tag.business_id == business_id,
            Tag.deleted_at.is_(None),
        )
        if category_id:
            query = query.filter(Tag.category_id == category_id)
        if search:
            query = query.filter(Tag.name.ilike(f"%{search}%"))

        total = query.count()
        items = (
            query.order_by(Tag.name)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_tag(self, tag_id: uuid.UUID) -> Optional[Tag]:
        return (
            self.db.query(Tag)
            .filter(Tag.id == tag_id, Tag.deleted_at.is_(None))
            .first()
        )

    def update_tag(self, tag_id: uuid.UUID, **kwargs) -> Optional[Tag]:
        tag = self.get_tag(tag_id)
        if not tag:
            return None
        # Recompute hierarchy if parent changed
        if "parent_tag_id" in kwargs and kwargs["parent_tag_id"] is not None:
            level, path = self._compute_hierarchy(kwargs["parent_tag_id"])
            tag.hierarchy_level = level
            tag.hierarchy_path = path
        for key, value in kwargs.items():
            if value is not None and hasattr(tag, key):
                setattr(tag, key, value)
        self.db.commit()
        self.db.refresh(tag)
        return tag

    def delete_tag(self, tag_id: uuid.UUID) -> bool:
        tag = self.get_tag(tag_id)
        if not tag:
            return False
        tag.soft_delete()
        self.db.commit()
        return True

    # -----------------------------------------------------------------------
    # Product Tag associations
    # -----------------------------------------------------------------------

    def assign_tag(
        self,
        product_id: uuid.UUID,
        tag_id: uuid.UUID,
        *,
        assigned_by: Optional[uuid.UUID] = None,
        source: str = "manual",
    ) -> ProductTag:
        """Assign a tag to a product and increment usage count."""
        pt = ProductTag(
            id=uuid.uuid4(),
            product_id=product_id,
            tag_id=tag_id,
            assigned_by=assigned_by,
            assigned_at=datetime.now(timezone.utc),
            assignment_source=source,
        )
        self.db.add(pt)

        # Increment usage counter on the tag
        tag = self.db.query(Tag).filter(Tag.id == tag_id).first()
        if tag:
            tag.usage_count = (tag.usage_count or 0) + 1

        self.db.commit()
        self.db.refresh(pt)
        return pt

    def remove_tag(self, product_id: uuid.UUID, tag_id: uuid.UUID) -> bool:
        """Remove a tag from a product and decrement usage count."""
        pt = (
            self.db.query(ProductTag)
            .filter(ProductTag.product_id == product_id, ProductTag.tag_id == tag_id)
            .first()
        )
        if not pt:
            return False
        self.db.delete(pt)

        tag = self.db.query(Tag).filter(Tag.id == tag_id).first()
        if tag and tag.usage_count and tag.usage_count > 0:
            tag.usage_count -= 1

        self.db.commit()
        return True

    def get_product_tags(self, product_id: uuid.UUID) -> list[ProductTag]:
        """Get all tags for a product."""
        return (
            self.db.query(ProductTag)
            .filter(ProductTag.product_id == product_id)
            .all()
        )
