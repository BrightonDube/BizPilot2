"""Models for product tagging and categorization.

Provides a flexible, hierarchical tagging system with business-scoped
namespaces, categories, and a many-to-many join to products.

Why a full tagging subsystem instead of a simple tags JSONB column?
  - Cross-product queries ("all vegan products") need efficient indexes
  - Tag hierarchy (food → vegan → raw-vegan) enables drill-down filtering
  - Usage tracking and analytics require structured data
  - Smart collections and auto-apply rules need queryable tag metadata
A JSONB array on the products table would require full-table scans for
any of these operations.
"""


from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel


class TagCategory(BaseModel):
    """Grouping / namespace for tags (e.g. "Dietary", "Cuisine", "Allergens").

    Why categories?
    Without grouping, a flat list of hundreds of tags becomes unmanageable.
    Categories let the UI render organised filter panels and let admins
    set per-category colours and icons.
    """

    __tablename__ = "tag_categories"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), nullable=True, comment="Hex colour for UI badges")
    icon = Column(String(50), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("business_id", "slug", name="uq_tag_categories_business_slug"),
    )


class Tag(BaseModel):
    """Individual tag with optional hierarchy via parent_tag_id.

    hierarchy_path stores a materialised path (e.g. "/food/vegan")
    for efficient ancestor/descendant queries without recursive CTEs.
    """

    __tablename__ = "tags"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tag_categories.id"),
        nullable=True,
        index=True,
    )
    parent_tag_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tags.id"),
        nullable=True,
        comment="Self-referential for hierarchical tags",
    )
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), nullable=True)
    hierarchy_level = Column(Integer, default=0, nullable=False)
    hierarchy_path = Column(Text, nullable=True, comment="Materialized path e.g. /food/vegan")
    usage_count = Column(Integer, default=0, nullable=False)
    is_system_tag = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    auto_apply_rules = Column(JSONB, nullable=True)

    __table_args__ = (
        UniqueConstraint("business_id", "slug", name="uq_tags_business_slug"),
    )


class ProductTag(BaseModel):
    """Many-to-many association between products and tags.

    assignment_source tracks how the tag was applied (manual, import,
    auto-rule, or AI suggestion) for auditability and potential rollback.
    """

    __tablename__ = "product_tags"

    product_id = Column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tag_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    assigned_at = Column(DateTime(timezone=True), nullable=False)
    assignment_source = Column(
        String(50),
        default="manual",
        nullable=False,
        comment="manual | import | auto_rule | ai_suggestion",
    )

    __table_args__ = (
        UniqueConstraint("product_id", "tag_id", name="uq_product_tags_product_tag"),
    )


class SmartCollection(BaseModel):
    """Rule-based automatic product grouping.

    Why rules-based?
    Manual product lists become stale.  Smart collections auto-refresh
    based on criteria (tag, price range, category) so promotional
    bundles and menu sections stay current without manual maintenance.
    """

    __tablename__ = "smart_collections"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    rules = Column(JSONB, nullable=True, comment="Array of rule objects")
    rule_logic = Column(String(10), default="and", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    auto_update = Column(Boolean, default=True, nullable=False)
    product_count = Column(Integer, default=0, nullable=False)
    last_refresh_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        UniqueConstraint("business_id", "slug", name="uq_smart_collections_business_slug"),
    )


class CollectionProduct(BaseModel):
    """Product membership in a smart collection.

    manually_included/excluded flags allow overrides to the auto-rules.
    """

    __tablename__ = "collection_products"

    collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("smart_collections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id = Column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    manually_included = Column(Boolean, default=False, nullable=False)
    manually_excluded = Column(Boolean, default=False, nullable=False)
    added_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("collection_id", "product_id", name="uq_collection_products"),
    )
