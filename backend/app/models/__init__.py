"""Database models module."""

from app.models.base import BaseModel, TimestampMixin
from app.models.user import User, UserStatus, SubscriptionStatus
from app.models.organization import Organization
from app.models.business import Business
from app.models.department import Department
from app.models.role import Role, Permission, DEFAULT_ROLES
from app.models.business_user import BusinessUser, BusinessUserStatus
from app.models.product import Product, ProductStatus, ProductCategory
from app.models.customer import Customer, CustomerType
from app.models.supplier import Supplier
from app.models.order import Order, OrderStatus, PaymentStatus, OrderItem
from app.models.invoice import Invoice, InvoiceStatus, InvoiceItem, InvoiceType
from app.models.inventory import InventoryItem, InventoryTransaction, TransactionType
from app.models.product_supplier import ProductSupplier
from app.models.product_ingredient import ProductIngredient
from app.models.production import ProductionOrder, ProductionOrderItem, ProductionStatus
from app.models.ai_conversation import AIConversation
from app.models.ai_message import AIMessage
from app.models.user_settings import UserSettings, AIDataSharingLevel
from app.models.subscription_tier import SubscriptionTier, DEFAULT_TIERS
from app.models.subscription_transaction import (
    SubscriptionTransaction,
    TransactionStatus as SubscriptionTransactionStatus,
    TransactionType as SubscriptionTransactionType,
)
from app.models.time_entry import TimeEntry, TimeEntryType, TimeEntryStatus
from app.models.pos_connection import POSConnection, POSProvider, POSConnectionStatus, POSSyncLog
from app.models.session import Session
from app.models.notification import Notification, NotificationType, NotificationPriority
from app.models.favorite_product import FavoriteProduct
from app.models.layby_config import LaybyConfig
from app.models.layby import Layby, LaybyStatus, PaymentFrequency
from app.models.layby_item import LaybyItem
from app.models.layby_schedule import LaybySchedule, ScheduleStatus
from app.models.layby_payment import LaybyPayment, PaymentType, PaymentStatus
from app.models.layby_audit import LaybyAudit
from app.models.layby_notification import LaybyNotification, NotificationChannel, NotificationStatus as LaybyNotificationStatus
from app.models.stock_reservation import StockReservation
from app.models.job_execution_log import JobExecutionLog, JobStatus

__all__ = [
    "BaseModel",
    "TimestampMixin",
    "User",
    "UserStatus",
    "SubscriptionStatus",
    "Organization",
    "Business",
    "Department",
    "Role",
    "Permission",
    "DEFAULT_ROLES",
    "BusinessUser",
    "BusinessUserStatus",
    # Product
    "Product",
    "ProductStatus",
    "ProductCategory",
    # Customer
    "Customer",
    "CustomerType",
    # Supplier
    "Supplier",
    # Product-Supplier relationship
    "ProductSupplier",
    # Order
    "Order",
    "OrderStatus",
    "PaymentStatus",
    "OrderItem",
    # Invoice
    "Invoice",
    "InvoiceStatus",
    "InvoiceItem",
    "InvoiceType",
    # Inventory
    "InventoryItem",
    "InventoryTransaction",
    "TransactionType",
    "ProductIngredient",
    # Production
    "ProductionOrder",
    "ProductionOrderItem",
    "ProductionStatus",
    "AIConversation",
    "AIMessage",
    "UserSettings",
    "AIDataSharingLevel",
    # Subscription
    "SubscriptionTier",
    "DEFAULT_TIERS",
    "SubscriptionTransaction",
    "SubscriptionTransactionStatus",
    "SubscriptionTransactionType",
    # Time Entry
    "TimeEntry",
    "TimeEntryType",
    "TimeEntryStatus",
    # POS Connection
    "POSConnection",
    "POSProvider",
    "POSConnectionStatus",
    "POSSyncLog",
    # Session
    "Session",
    # Notification
    "Notification",
    "NotificationType",
    "NotificationPriority",
    # Favorite Product
    "FavoriteProduct",
    # Layby
    "LaybyConfig",
    "Layby",
    "LaybyStatus",
    "PaymentFrequency",
    "LaybyItem",
    "LaybySchedule",
    "ScheduleStatus",
    "LaybyPayment",
    "PaymentType",
    "PaymentStatus",
    "LaybyAudit",
    "LaybyNotification",
    "NotificationChannel",
    "LaybyNotificationStatus",
    # Stock Reservation
    "StockReservation",
    # Job Execution
    "JobExecutionLog",
    "JobStatus",
]
