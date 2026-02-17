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
from app.models.order import Order, OrderStatus, PaymentStatus, OrderItem, OrderType
from app.models.invoice import Invoice, InvoiceStatus, InvoiceItem, InvoiceType
from app.models.inventory import InventoryItem, InventoryTransaction, TransactionType
from app.models.product_supplier import ProductSupplier
from app.models.product_ingredient import ProductIngredient
from app.models.production import ProductionOrder, ProductionOrderItem, ProductionStatus
from app.models.ai_conversation import AIConversation
from app.models.ai_message import AIMessage
from app.models.user_settings import UserSettings, AIDataSharingLevel
from app.models.subscription_tier import SubscriptionTier
from app.models.subscription_feature_definition import SubscriptionFeatureDefinition
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
from app.models.layby_payment import LaybyPayment, PaymentType
from app.models.layby_payment import PaymentStatus as LaybyPaymentStatus
from app.models.layby_audit import LaybyAudit
from app.models.layby_notification import LaybyNotification, NotificationChannel, NotificationStatus as LaybyNotificationStatus
from app.models.stock_reservation import StockReservation
from app.models.job_execution_log import JobExecutionLog, JobStatus
from app.models.subscription import (
    TierFeature,
    BusinessSubscription,
    FeatureOverride,
    DeviceRegistry,
    AuditLog,
)
from app.models.customer_account import (
    CustomerAccount,
    AccountStatus,
    AccountTransaction,
    TransactionType as AccountTransactionType,
    AccountPayment,
    PaymentAllocation,
    AccountStatement,
    CollectionActivity,
    ActivityType,
    AccountWriteOff,
)
from app.models.report_subscription import (
    ReportSubscription,
    ReportType,
    DeliveryFrequency,
    DeliveryStatus,
    ReportDeliveryLog,
)
from app.models.restaurant_table import RestaurantTable, TableStatus
from app.models.order_status_history import OrderStatusHistory
from app.models.petty_cash import (
    PettyCashFund,
    FundStatus,
    ExpenseCategory,
    PettyCashExpense,
    ExpenseStatus,
    FundReplenishment,
)
from app.models.loyalty import (
    LoyaltyProgram,
    CustomerLoyalty,
    PointsTransaction,
    LoyaltyTier,
    PointsTransactionType,
)
from app.models.menu import (
    MenuItem,
    ModifierGroup,
    Modifier,
    MenuItemModifierGroup,
    Recipe,
    RecipeIngredient,
)
from app.models.stock_take import (
    StockTakeSession,
    StockTakeStatus,
    StockCount,
    InventoryAdjustment,
)
from app.models.delivery import (
    DeliveryStatus as DeliveryTrackingStatus,
    DeliveryZone,
    Driver,
    Delivery,
)
from app.models.reorder import (
    ReorderRule,
    ReorderRuleStatus,
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseOrderStatus,
)
from app.models.general_ledger import (
    AccountType,
    JournalEntryStatus,
    ChartOfAccount,
    JournalEntry,
    JournalLine,
    FiscalPeriod,
)
from app.models.crm import (
    InteractionType,
    CustomerSegment,
    CustomerSegmentMember,
    CustomerInteraction,
    CustomerMetrics,
)
from app.models.online_order import (
    OnlineOrderStatus,
    FulfillmentType,
    OnlineStore,
    OnlineOrder,
    OnlineOrderItem,
)
from app.models.custom_dashboard import Dashboard, DashboardWidget

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
    "OrderType",
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
    "SubscriptionFeatureDefinition",
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
    "LaybyPaymentStatus",
    "LaybyAudit",
    "LaybyNotification",
    "NotificationChannel",
    "LaybyNotificationStatus",
    # Stock Reservation
    "StockReservation",
    # Job Execution
    "JobExecutionLog",
    "JobStatus",
    # Subscription System
    "TierFeature",
    "BusinessSubscription",
    "FeatureOverride",
    "DeviceRegistry",
    "AuditLog",
    # Customer Accounts
    "CustomerAccount",
    "AccountStatus",
    "AccountTransaction",
    "AccountTransactionType",
    "AccountPayment",
    "PaymentAllocation",
    "AccountStatement",
    "CollectionActivity",
    "ActivityType",
    "AccountWriteOff",
    # Report Subscriptions
    "ReportSubscription",
    "ReportType",
    "DeliveryFrequency",
    "DeliveryStatus",
    "ReportDeliveryLog",
    # Restaurant Tables
    "RestaurantTable",
    "TableStatus",
    # Order Status History
    "OrderStatusHistory",
    # Petty Cash
    "PettyCashFund",
    "FundStatus",
    "ExpenseCategory",
    "PettyCashExpense",
    "ExpenseStatus",
    "FundReplenishment",
    # Loyalty Program
    "LoyaltyProgram",
    "CustomerLoyalty",
    "PointsTransaction",
    "LoyaltyTier",
    "PointsTransactionType",
    # Stock Take
    "StockTakeSession",
    "StockTakeStatus",
    "StockCount",
    "InventoryAdjustment",
    # Menu Engineering
    "MenuItem",
    "ModifierGroup",
    "Modifier",
    "MenuItemModifierGroup",
    "Recipe",
    "RecipeIngredient",
    # Delivery Management
    "DeliveryTrackingStatus",
    "DeliveryZone",
    "Driver",
    "Delivery",
    # CRM
    "InteractionType",
    "CustomerSegment",
    "CustomerSegmentMember",
    "CustomerInteraction",
    "CustomerMetrics",
    # Automated Reorder
    "ReorderRule",
    "ReorderRuleStatus",
    "PurchaseRequest",
    "PurchaseRequestItem",
    "PurchaseOrderStatus",
    # General Ledger
    "AccountType",
    "JournalEntryStatus",
    "ChartOfAccount",
    "JournalEntry",
    "JournalLine",
    "FiscalPeriod",
    # Custom Dashboards
    "Dashboard",
    "DashboardWidget",
    # Online Ordering
    "OnlineOrderStatus",
    "FulfillmentType",
    "OnlineStore",
    "OnlineOrder",
    "OnlineOrderItem",
]
