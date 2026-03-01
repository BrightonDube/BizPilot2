"""Audit log model for user activity tracking."""

import enum
from sqlalchemy import Column, String, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class AuditAction(str, enum.Enum):
    LOGIN = "login"
    LOGOUT = "logout"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    EXPORT = "export"
    IMPORT = "import"
    VIEW = "view"
    PRINT = "print"
    VOID = "void"
    REFUND = "refund"


class UserAuditLog(BaseModel):
    """Tracks user actions for audit trail."""
    __tablename__ = "user_audit_logs"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    action = Column(
        SQLEnum(AuditAction, values_callable=lambda x: [e.value for e in x], name='auditaction'),
        nullable=False,
        index=True,
    )
    resource_type = Column(String(100), nullable=False)  # "order", "product", "customer", etc.
    resource_id = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    metadata_json = Column(Text, nullable=True)  # JSON string for extra data

    user = relationship("User", lazy="joined")
