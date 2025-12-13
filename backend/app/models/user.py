"""User model for authentication and profile."""

from sqlalchemy import Column, String, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from app.models.base import BaseModel


class UserStatus(str, enum.Enum):
    """User account status."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"
    SUSPENDED = "suspended"


class User(BaseModel):
    """User model for authentication and profile."""

    __tablename__ = "users"

    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Nullable for OAuth users
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    is_email_verified = Column(Boolean, default=False)
    status = Column(
        SQLEnum(UserStatus, values_callable=lambda x: [e.value for e in x], create_constraint=False, native_enum=True, name='userstatus'),
        default=UserStatus.PENDING
    )

    # OAuth fields
    google_id = Column(String(255), unique=True, nullable=True, index=True)

    # Relationships
    business_users = relationship("BusinessUser", back_populates="user", cascade="all, delete-orphan")
    owned_organizations = relationship("Organization", back_populates="owner")

    @property
    def full_name(self) -> str:
        """Return full name."""
        return f"{self.first_name} {self.last_name}"

    def __repr__(self) -> str:
        return f"<User {self.email}>"
