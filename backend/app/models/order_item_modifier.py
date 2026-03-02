"""Order item modifier model.

Captures the modifier selections made for each line item in an order
(Requirement 8 of the addons-modifiers spec).  Prices are snapshotted
at order time so that historical records remain accurate even if the
modifier catalogue changes later.

Why denormalise modifier_name and modifier_group_name?
An order is a financial document.  If we only stored a foreign key to
the modifier, changing the modifier's name or deleting it would corrupt
the order's display.  Snapshotting these fields preserves the exact
record of what the customer was charged.
"""

from sqlalchemy import Column, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class OrderItemModifier(BaseModel):
    """A modifier selection attached to a specific order line item.

    Attributes:
        order_item_id: The order line item this modifier was applied to.
        modifier_id: Reference to the modifier catalogue entry (nullable
            so the record survives catalogue deletions).
        modifier_name: Snapshotted name of the modifier at order time.
        modifier_group_name: Snapshotted name of the parent group.
        quantity: How many of this modifier were selected.
        unit_price: Price per unit at order time.
        total_price: quantity * unit_price, stored for fast aggregation.
        parent_modifier_id: Self-reference UUID for nested modifier
            selections (e.g. a sub-modifier under a parent modifier).
    """

    __tablename__ = "order_item_modifiers"

    order_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("order_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    modifier_id = Column(
        UUID(as_uuid=True),
        ForeignKey("modifiers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    modifier_name = Column(String(255), nullable=False)
    modifier_group_name = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(12, 2), nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)
    # Self-reference for nested modifiers.  This is a plain UUID column
    # (not a ForeignKey) to avoid circular dependency issues and because
    # we don't need cascading deletes on nested selections.
    parent_modifier_id = Column(UUID(as_uuid=True), nullable=True)

    # Relationships
    order_item = relationship("OrderItem", back_populates="item_modifiers")
    modifier = relationship("Modifier", foreign_keys=[modifier_id])

    def __repr__(self) -> str:
        return (
            f"<OrderItemModifier {self.modifier_name!r} "
            f"qty={self.quantity} total={self.total_price}>"
        )
