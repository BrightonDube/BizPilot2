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
from app.models.notification import Notification, NotificationType, NotificationChannel as NotifChannel, NotificationPreference
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
from app.models.restaurant_table import (
    RestaurantTable,
    TableStatus,
    FloorPlan,
    Section,
    Reservation,
    ReservationStatus,
)
from app.models.order_status_history import OrderStatusHistory
from app.models.petty_cash import (
    PettyCashFund,
    FundStatus,
    ExpenseCategory,
    PettyCashExpense,
    ExpenseStatus,
    FundReplenishment,
    ApprovalStatus,
    ApprovalPriority,
    ExpenseApproval,
    CashDisbursement,
    DisbursementStatus,
    ExpenseReceipt,
    ReceiptStatus,
    FundReconciliation,
    ReconciliationStatus,
)
from app.models.loyalty import (
    LoyaltyProgram,
    CustomerLoyalty,
    PointsTransaction,
    LoyaltyTier,
    PointsTransactionType,
    RewardCatalogItem,
    RewardType,
    TierBenefit,
    BenefitType,
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
    StockTakeScope,
    StockTakeCounter,
    InventoryPeriod,
    InventoryPeriodStatus,
    PeriodSnapshot,
    ProductABCClassification,
    ABCClassification,
    StockCountHistory,
)
from app.models.sync_queue import (
    SyncQueueItem,
    SyncQueueStatus,
    SyncQueueAction,
    SyncMetadata,
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
    ProductReorderSettings,
    GoodsReceivedNote,
    GRNItem,
    ReorderAuditLog,
)
from app.models.general_ledger import (
    AccountType,
    JournalEntryStatus,
    ChartOfAccount,
    JournalEntry,
    JournalLine,
    FiscalPeriod,
    GLAccountMapping,
    GLAccountBalance,
    GLRecurringEntry,
    GLAuditLog,
    GLAuditAction,
    RecurringEntryFrequency,
)
from app.models.inventory_report import InventoryReportConfig
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
from app.models.custom_dashboard import (
    Dashboard, DashboardWidget, DashboardTemplate,
    DashboardShare, DashboardExportSchedule,
)
from app.models.addon import ProductModifierGroup, SelectionType
from app.models.audit_log import UserAuditLog, AuditAction
from app.models.shift import Shift, ShiftStatus, LeaveRequest, LeaveType, LeaveStatus
from app.models.location import (
    Location,
    LocationStock,
    StockTransfer,
    StockTransferItem,
    TransferStatus as LocationTransferStatus,
    LocationSetting,
    LocationPricing,
    UserLocationAccess,
    AccessLevel,
)
from app.models.tax import TaxType, TaxRate, ProductTaxRate, CategoryTaxRate
from app.models.cash_register import (
    RegisterStatus,
    CashRegister,
    RegisterSession,
    CashMovement,
)
from app.models.commission import CommissionRecord, CommissionStatus
from app.models.report_template import ReportTemplate
from app.models.data_access_log import CustomerDataAccessLog
from app.models.proforma import ProformaInvoice, ProformaItem, ProformaRevision, ProformaApproval, ProformaAudit, QuoteStatus
from app.models.gift_card import GiftCard, GiftCardStatus, GiftCardTransaction
from app.models.expense import (
    Expense,
    ExpenseTrackingCategory,
    ExpenseTrackingStatus,
)
from app.models.staff_target import (
    StaffTarget,
    TargetTemplate,
    CommissionRule,
    CommissionTier,
    StaffCommission,
    CommissionDetail,
    IncentiveProgram,
    IncentiveAchievement,
    PerformanceSnapshot,
    TargetType,
    PeriodType,
    TargetStatus,
    CommissionRuleType,
    CommissionStatus as StaffCommissionStatus,
    IncentiveType,
    AchievementStatus,
)
from app.models.combo import ComboDeal, ComboComponent, ComboComponentType
from app.models.order_item_modifier import OrderItemModifier
from app.models.modifier_availability import ModifierAvailability
from app.models.bulk_operation import (
    BulkOperation,
    BulkOperationItem,
    BulkTemplate,
    BulkOperationType,
    OperationStatus,
    ItemStatus,
)
from app.models.delivery_tracking import (
    DriverShift,
    DriverShiftStatus,
    DeliveryTracking,
    DeliveryProof,
)
from app.models.payment import (
    PaymentMethod,
    PaymentMethodType,
    PaymentTransaction,
    PaymentTransactionStatus,
)
from app.models.customer_display import (
    CustomerDisplay,
    DisplayConfig,
    DisplayType,
    DisplayStatus,
)
from app.models.tag import (
    TagCategory,
    Tag,
    ProductTag,
    SmartCollection,
    CollectionProduct,
)
from app.models.signage import (
    SignageDisplayGroup,
    SignageDisplay,
    SignageContent,
    SignagePlaylist,
    SignagePlaylistItem,
)
from app.models.partner import (
    Partner,
    PartnerConfiguration,
    WhiteLabelConfig,
    PartnerUser,
)
from app.models.pms import (
    PMSConnection,
    PMSGuestCache,
    PMSCharge,
    PMSChargeReversal,
    PMSReconciliationSession,
    PMSReconciliationItem,
    PMSAuditLog,
)
from app.models.xero import XeroConnection, XeroSyncLog
from app.models.woocommerce import WooConnection, WooSyncMap
from app.models.sage import (
    SageConnection,
    SageAccountMapping,
    SageSyncLog,
    SageSyncQueue,
)

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
    "NotifChannel",
    "NotificationPreference",
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
    "FloorPlan",
    "Section",
    "Reservation",
    "ReservationStatus",
    # Order Status History
    "OrderStatusHistory",
    # Petty Cash
    "PettyCashFund",
    "FundStatus",
    "ExpenseCategory",
    "PettyCashExpense",
    "ExpenseStatus",
    "FundReplenishment",
    "ExpenseApproval",
    "ApprovalStatus",
    "ApprovalPriority",
    "CashDisbursement",
    "DisbursementStatus",
    "ExpenseReceipt",
    "ReceiptStatus",
    "FundReconciliation",
    "ReconciliationStatus",
    # Loyalty Program
    "LoyaltyProgram",
    "CustomerLoyalty",
    "PointsTransaction",
    "LoyaltyTier",
    "PointsTransactionType",
    "RewardCatalogItem",
    "RewardType",
    "TierBenefit",
    "BenefitType",
    # Stock Take
    "StockTakeSession",
    "StockTakeStatus",
    "StockCount",
    "InventoryAdjustment",
    "StockTakeScope",
    "StockTakeCounter",
    "InventoryPeriod",
    "InventoryPeriodStatus",
    "PeriodSnapshot",
    "ProductABCClassification",
    "ABCClassification",
    "StockCountHistory",
    # Sync Queue
    "SyncQueueItem",
    "SyncQueueStatus",
    "SyncQueueAction",
    "SyncMetadata",
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
    "ProductReorderSettings",
    "GoodsReceivedNote",
    "GRNItem",
    "ReorderAuditLog",
    # General Ledger
    "AccountType",
    "JournalEntryStatus",
    "ChartOfAccount",
    "JournalEntry",
    "JournalLine",
    "FiscalPeriod",
    "GLAccountMapping",
    "GLAccountBalance",
    "GLRecurringEntry",
    "GLAuditLog",
    "GLAuditAction",
    "RecurringEntryFrequency",
    "InventoryReportConfig",
    # Custom Dashboards
    "Dashboard",
    "DashboardWidget",
    "DashboardTemplate",
    "DashboardShare",
    "DashboardExportSchedule",
    # Online Ordering
    "OnlineOrderStatus",
    "FulfillmentType",
    "OnlineStore",
    "OnlineOrder",
    "OnlineOrderItem",
    # User Audit Logs
    "UserAuditLog",
    "AuditAction",
    # Multi-Location
    "Location",
    "LocationStock",
    "StockTransfer",
    "StockTransferItem",
    "LocationTransferStatus",
    "LocationSetting",
    "LocationPricing",
    "UserLocationAccess",
    "AccessLevel",
    # Product Addons
    "ProductModifierGroup",
    "SelectionType",
    # Shift Management
    "Shift",
    "ShiftStatus",
    "LeaveRequest",
    "LeaveType",
    "LeaveStatus",
    # Tax Configuration
    "TaxType",
    "TaxRate",
    "ProductTaxRate",
    "CategoryTaxRate",
    # Gift Cards
    "GiftCard",
    "GiftCardStatus",
    "GiftCardTransaction",
    # Expense Tracking
    "Expense",
    "ExpenseTrackingCategory",
    "ExpenseTrackingStatus",
    # Cash Register
    "RegisterStatus",
    "CashRegister",
    "RegisterSession",
    "CashMovement",
    "CommissionRecord",
    "CommissionStatus",
    "ReportTemplate",
    # Privacy / Data Access
    "CustomerDataAccessLog",
    # Proforma Invoices
    "ProformaInvoice",
    "ProformaItem",
    "ProformaRevision",
    "ProformaApproval",
    "ProformaAudit",
    "QuoteStatus",
    # Staff Targets
    "StaffTarget",
    "TargetTemplate",
    "CommissionRule",
    "CommissionTier",
    "StaffCommission",
    "CommissionDetail",
    "IncentiveProgram",
    "IncentiveAchievement",
    "PerformanceSnapshot",
    "TargetType",
    "PeriodType",
    "TargetStatus",
    "StaffCommissionStatus",
    "CommissionRuleType",
    "IncentiveType",
    "RewardType",
    "AchievementStatus",
    # Combo deals
    "ComboDeal",
    "ComboComponent",
    "ComboComponentType",
    # Order item modifiers
    "OrderItemModifier",
    # Modifier availability
    "ModifierAvailability",
    # Bulk operations
    "BulkOperation",
    "BulkOperationItem",
    "BulkTemplate",
    "BulkOperationType",
    "OperationStatus",
    "ItemStatus",
    # Delivery Tracking
    "DriverShift",
    "DriverShiftStatus",
    "DeliveryTracking",
    "DeliveryProof",
    # Integrated Payments
    "PaymentMethod",
    "PaymentMethodType",
    "PaymentTransaction",
    "PaymentTransactionStatus",
    # Customer Display
    "CustomerDisplay",
    "DisplayConfig",
    "DisplayType",
    "DisplayStatus",
    # Tags & Categorization
    "TagCategory",
    "Tag",
    "ProductTag",
    "SmartCollection",
    "CollectionProduct",
    # Digital Signage
    "SignageDisplayGroup",
    "SignageDisplay",
    "SignageContent",
    "SignagePlaylist",
    "SignagePlaylistItem",
    # Partner Admin
    "Partner",
    "PartnerConfiguration",
    "WhiteLabelConfig",
    "PartnerUser",
    # PMS Integration
    "PMSConnection",
    "PMSGuestCache",
    "PMSCharge",
    "PMSChargeReversal",
    "PMSReconciliationSession",
    "PMSReconciliationItem",
    "PMSAuditLog",
    # Xero Integration
    "XeroConnection",
    "XeroSyncLog",
    # WooCommerce Integration
    "WooConnection",
    "WooSyncMap",
    # Sage Integration
    "SageConnection",
    "SageAccountMapping",
    "SageSyncLog",
    "SageSyncQueue",
]
