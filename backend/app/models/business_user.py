"""BusinessUser model for user-business-role relationship."""

from sqlalchemy import Column, ForeignKey, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.models.base import BaseModel


class BusinessUserStatus(str, enum.Enum):
    """Status of user's membership in a business."""

    ACTIVE = "active"
    INVITED = "invited"
    INACTIVE = "inactive"


class BusinessUser(BaseModel):
    """BusinessUser model linking users to businesses with roles."""

    __tablename__ = "business_users"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=True)
    status = Column(
        SQLEnum(BusinessUserStatus, values_callable=lambda x: [e.value for e in x], name='businessuserstatus'),
        default=BusinessUserStatus.ACTIVE
    )
    is_primary = Column(Boolean, default=False)  # User's primary business

    # Relationships
    user = relationship("User", back_populates="business_users")
    business = relationship("Business", back_populates="business_users")
    role = relationship("Role", back_populates="business_users")

    def __repr__(self) -> str:
        return f"<BusinessUser user={self.user_id} business={self.business_id}>"
