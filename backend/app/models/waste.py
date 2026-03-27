"""Models for waste and shrinkage tracking.

Waste tracking records stock removed due to spoilage, damage, or
other non-sale losses. Each waste entry deducts from inventory via
an InventoryTransaction with type=WASTE.
"""

from sqlalchemy import Column, String, Text, Numeric, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class WasteCategory(BaseModel):
    """User-defined categories for waste (e.g. Spoilage, Theft, Damage)."""

    __tablename__ = "waste_categories"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    colour = Column(String(7), nullable=True, comment="Hex colour for UI display")


class WasteRecord(BaseModel):
    """A single waste event: quantity removed + cost recorded.

    The inventory deduction happens via InventoryTransaction (type=WASTE).
    This model stores the categorisation, cost at time of recording,
    and free-text notes for audit purposes.
    """

    __tablename__ = "waste_records"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    waste_category_id = Column(UUID(as_uuid=True), ForeignKey("waste_categories.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_cost = Column(Numeric(12, 2), nullable=True, comment="Cost at time of recording")
    total_cost = Column(Numeric(12, 2), nullable=True)
    recorded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    recorded_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    inventory_transaction_id = Column(
        UUID(as_uuid=True),
        ForeignKey("inventory_transactions.id"),
        nullable=True,
        comment="Linked deduction transaction",
    )
