"""Order status history model for tracking status changes."""

from sqlalchemy import Column, String, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, utc_now


class OrderStatusHistory(BaseModel):
    """Tracks status changes for orders."""

    __tablename__ = "order_status_history"

    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    changed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reason = Column(Text, nullable=True)
    changed_at = Column(DateTime(timezone=True), default=utc_now)

    order = relationship("Order", backref="status_history")
    changed_by = relationship("User", lazy="joined")

    def __repr__(self) -> str:
        return f"<OrderStatusHistory {self.old_status} -> {self.new_status}>"
