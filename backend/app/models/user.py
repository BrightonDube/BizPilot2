"""User model for authentication and profile."""

from sqlalchemy import Column, String, Boolean, Enum as SQLEnum, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.models.base import BaseModel, JSONType


class UserStatus(str, enum.Enum):
    """User account status."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"
    SUSPENDED = "suspended"


class SubscriptionStatus(str, enum.Enum):
    """User subscription status."""

    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    TRIAL = "trial"
    NONE = "none"  # For free tier users


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

    # Admin and Subscription fields
    is_admin = Column(Boolean, default=False, nullable=False)
    is_superadmin = Column(Boolean, default=False, nullable=False)
    subscription_status = Column(
        SQLEnum(SubscriptionStatus, values_callable=lambda x: [e.value for e in x], create_constraint=False, native_enum=True, name='subscriptionstatus'),
        default=SubscriptionStatus.NONE
    )
    current_tier_id = Column(UUID(as_uuid=True), ForeignKey("subscription_tiers.id"), nullable=True)
    subscription_started_at = Column(DateTime, nullable=True)
    subscription_expires_at = Column(DateTime, nullable=True)
    trial_ends_at = Column(DateTime, nullable=True)
    paystack_customer_code = Column(String(100), nullable=True, index=True)
    paystack_subscription_code = Column(String(100), nullable=True)
    
    # Feature overrides - admin can enable/disable specific features for a user regardless of tier
    feature_overrides = Column(JSONType, nullable=True, default={})
    
    # POS login fields - PIN is only stored as a secure hash
    pin_code_hash = Column(String(255), nullable=True)  # Hashed PIN for verification
    biometric_enabled = Column(Boolean, default=False, nullable=True)
    biometric_public_key = Column(String, nullable=True)  # For WebAuthn/fingerprint

    # Relationships
    business_users = relationship("BusinessUser", back_populates="user", cascade="all, delete-orphan")
    owned_organizations = relationship("Organization", back_populates="owner")
    ai_conversations = relationship("AIConversation", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    current_tier = relationship("SubscriptionTier", back_populates="users")
    subscription_transactions = relationship("SubscriptionTransaction", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        """Return full name."""
        return f"{self.first_name} {self.last_name}"

    def __repr__(self) -> str:
        return f"<User {self.email}>"
