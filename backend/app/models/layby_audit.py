"""Layby audit model for tracking changes to layby orders."""

from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, JSONType


class LaybyAudit(BaseModel):
    """Audit trail for layby order changes."""

    __tablename__ = "layby_audit"

    layby_id = Column(UUID(as_uuid=True), ForeignKey("laybys.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    old_value = Column(JSONType, nullable=True)
    new_value = Column(JSONType, nullable=True)
    details = Column(Text, nullable=True)
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    terminal_id = Column(UUID(as_uuid=True), nullable=True)
    ip_address = Column(String(45), nullable=True)

    # Relationships
    layby = relationship("Layby", back_populates="audit_records")
    user = relationship("User")

    def __repr__(self) -> str:
        return f"<LaybyAudit {self.id} layby={self.layby_id} action={self.action}>"
