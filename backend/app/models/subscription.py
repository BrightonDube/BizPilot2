"""
SQLAlchemy models for subscription system.

This module defines the database models for the granular permissions and subscription system:
- TierFeature: Subscription tier definitions with feature flags
- BusinessSubscription: Links businesses to subscription tiers
- FeatureOverride: SuperAdmin custom feature configurations
- DeviceRegistry: Tracks registered devices per business
- AuditLog: Immutable log of subscription changes

Feature: granular-permissions-subscription
Task: 1.2 Create SQLAlchemy models
Requirements: 16.1, 16.2, 16.3, 16.4
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Numeric,
    Text,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import BaseModel


class TierFeature(BaseModel):
    """
    Subscription tier definitions with feature flags and limits.
    
    Defines the four subscription tiers (Demo, Pilot Core, Pilot Pro, Enterprise)
    with their feature flags, device limits, user limits, and pricing.
    
    Validates: Requirements 16.1
    - 16.1: Store tier configuration in database
    """
    
    __tablename__ = "tier_features"
    
    # Primary key - tier name (demo, pilot_core, pilot_pro, enterprise)
    tier_name = Column(String(50), primary_key=True, nullable=False)
    
    # Device and user limits (NULL represents unlimited)
    max_devices = Column(Integer, nullable=True)
    max_users = Column(Integer, nullable=True)
    
    # Feature flags
    has_payroll = Column(Boolean, nullable=False, server_default='false')
    has_ai = Column(Boolean, nullable=False, server_default='false')
    has_api_access = Column(Boolean, nullable=False, server_default='false')
    has_advanced_reporting = Column(Boolean, nullable=False, server_default='false')
    has_multi_location = Column(Boolean, nullable=False, server_default='false')
    has_loyalty_programs = Column(Boolean, nullable=False, server_default='false')
    has_recipe_management = Column(Boolean, nullable=False, server_default='false')
    has_accounting_integration = Column(Boolean, nullable=False, server_default='false')
    
    # Pricing in ZAR
    price_monthly = Column(Numeric(10, 2), nullable=False)
    
    # Soft delete support
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    subscriptions = relationship("BusinessSubscription", back_populates="tier", foreign_keys="BusinessSubscription.tier_name")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('max_devices IS NULL OR max_devices > 0', name='check_max_devices_positive'),
        CheckConstraint('max_users IS NULL OR max_users > 0', name='check_max_users_positive'),
        CheckConstraint('price_monthly >= 0', name='check_price_non_negative'),
        CheckConstraint(
            "tier_name IN ('demo', 'pilot_core', 'pilot_pro', 'enterprise')",
            name='check_valid_tier_name'
        ),
    )
    
    def __repr__(self):
        return f"<TierFeature(tier_name='{self.tier_name}', price_monthly={self.price_monthly})>"


class BusinessSubscription(BaseModel):
    """
    Links businesses to subscription tiers and tracks subscription status.
    
    Each business has exactly one subscription record (enforced by unique constraint).
    Tracks subscription status, expiry dates, and trial periods.
    
    Validates: Requirements 16.2
    - 16.2: Link businesses to subscription tiers
    """
    
    __tablename__ = "business_subscription"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Foreign key to businesses table
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False, unique=True)
    
    # Foreign key to tier_features table
    tier_name = Column(String(50), ForeignKey('tier_features.tier_name', ondelete='RESTRICT'), nullable=False)
    
    # Subscription status: active, suspended, cancelled, expired
    status = Column(String(20), nullable=False, server_default='active')
    
    # Demo expiry date (only used for demo tier)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    
    # Trial period end date (optional, for future use)
    trial_end_date = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    tier = relationship("TierFeature", back_populates="subscriptions", foreign_keys=[tier_name])
    business = relationship("Business", back_populates="subscription", foreign_keys=[business_id])
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('business_id', name='uq_business_subscription_business_id'),
        CheckConstraint(
            "status IN ('active', 'suspended', 'cancelled', 'expired')",
            name='ck_business_subscription_status'
        ),
        Index('idx_business_subscription_business_id', 'business_id'),
        Index('idx_business_subscription_status', 'status'),
        Index('idx_business_subscription_valid_until', 'valid_until'),
    )
    
    def __repr__(self):
        return f"<BusinessSubscription(business_id={self.business_id}, tier_name='{self.tier_name}', status='{self.status}')>"


class FeatureOverride(BaseModel):
    """
    SuperAdmin custom feature configurations for specific businesses.
    
    Allows SuperAdmin users to override tier defaults for specific businesses,
    enabling custom deals and special configurations. Overrides take precedence
    over tier defaults when computing effective permissions.
    
    Validates: Requirements 16.3
    - 16.3: Store feature overrides in database
    """
    
    __tablename__ = "feature_overrides"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Foreign key to businesses table
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False)
    
    # Feature name being overridden
    feature_name = Column(String(50), nullable=False)
    
    # Feature value as text (cast based on feature_name)
    # For boolean features: 'true' or 'false'
    # For integer features: numeric string like '5' or '999999'
    feature_value = Column(Text, nullable=False)
    
    # Audit trail: who created this override
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='RESTRICT'), nullable=False)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    business = relationship("Business", back_populates="feature_overrides", foreign_keys=[business_id])
    creator = relationship("User", foreign_keys=[created_by])
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('business_id', 'feature_name', name='uq_feature_overrides_business_feature'),
        CheckConstraint(
            "feature_name IN ('max_devices', 'max_users', 'max_orders_per_month', 'max_terminals', "
            "'has_payroll', 'has_ai', 'has_api_access', 'has_advanced_reporting', "
            "'has_multi_location', 'has_loyalty_programs', 'has_recipe_management', 'has_accounting_integration')",
            name='ck_feature_overrides_feature_name'
        ),
        Index('idx_feature_overrides_business_id', 'business_id'),
    )
    
    def __repr__(self):
        return f"<FeatureOverride(business_id={self.business_id}, feature_name='{self.feature_name}', value='{self.feature_value}')>"


class DeviceRegistry(BaseModel):
    """
    Tracks registered devices per business for device limit enforcement.
    
    Manages device registration and enforces device limits based on subscription tiers.
    Devices are automatically marked inactive if they haven't synced in 30+ days.
    
    Validates: Requirements 16.4
    - 16.4: Track registered devices per business
    """
    
    __tablename__ = "device_registry"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Foreign key to businesses table
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False)
    
    # Device identifier (UUID from device)
    device_id = Column(String(255), nullable=False)
    
    # Human-readable device name
    device_name = Column(String(255), nullable=False)
    
    # Foreign key to users table - which user registered this device
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='RESTRICT'), nullable=False)
    
    # Last sync timestamp for inactive device cleanup
    last_sync_time = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Active status flag (set to false when device is unlinked or hasn't synced in 30+ days)
    is_active = Column(Boolean, nullable=False, server_default='true')
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    business = relationship("Business", back_populates="devices", foreign_keys=[business_id])
    user = relationship("User", foreign_keys=[user_id])
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('business_id', 'device_id', name='uq_device_registry_business_device'),
        Index('idx_device_registry_business_id', 'business_id'),
        Index('idx_device_registry_last_sync', 'last_sync_time'),
        Index('idx_device_registry_active', 'is_active'),
    )
    
    def __repr__(self):
        return f"<DeviceRegistry(business_id={self.business_id}, device_id='{self.device_id}', is_active={self.is_active})>"


class AuditLog(BaseModel):
    """
    Immutable log of all subscription and permission changes.
    
    Records all SuperAdmin actions that modify subscription data for audit purposes.
    Includes who made the change, what changed, and when.
    
    Validates: Requirements 16.4
    - 16.4: Audit logging for admin actions
    """
    
    __tablename__ = "audit_logs"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Foreign key to businesses table (nullable for system-wide actions)
    business_id = Column(UUID(as_uuid=True), ForeignKey('businesses.id', ondelete='SET NULL'), nullable=True)
    
    # Foreign key to users table - who made the change
    admin_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='RESTRICT'), nullable=False)
    
    # Action type (e.g., subscription_created, subscription_updated, override_added)
    action = Column(String(100), nullable=False)
    
    # Changes as JSONB (before/after values)
    changes = Column(JSONB, nullable=False)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    business = relationship("Business", foreign_keys=[business_id])
    admin_user = relationship("User", foreign_keys=[admin_user_id])
    
    # Constraints
    __table_args__ = (
        Index('idx_audit_logs_business_id', 'business_id'),
        Index('idx_audit_logs_admin_user_id', 'admin_user_id'),
        Index('idx_audit_logs_created_at', 'created_at'),
    )
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, action='{self.action}', business_id={self.business_id})>"
