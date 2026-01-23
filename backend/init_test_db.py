"""Initialize test database with all tables."""

import os

# Set test database URL before importing anything else
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from app.core.database import engine, Base
# Import all models to register them with Base
from app.models import (  # noqa: F401
    AIConversation,
    AIDataSharingLevel,
    AIMessage,
    AuditLog,
    BaseModel,
    Business,
    BusinessSubscription,
    BusinessUser,
    BusinessUserStatus,
    Customer,
    CustomerType,
    DEFAULT_ROLES,
    Department,
    DeviceRegistry,
    FavoriteProduct,
    FeatureOverride,
    InventoryItem,
    InventoryTransaction,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    InvoiceType,
    JobExecutionLog,
    JobStatus,
    Layby,
    LaybyAudit,
    LaybyConfig,
    LaybyItem,
    LaybyNotification,
    LaybyNotificationStatus,
    LaybyPayment,
    LaybyPaymentStatus,
    LaybySchedule,
    LaybyStatus,
    NotificationChannel,
    NotificationPriority,
    NotificationType,
    Notification,
    Order,
    OrderItem,
    OrderStatus,
    Organization,
    POSConnection,
    POSConnectionStatus,
    POSProvider,
    POSSyncLog,
    PaymentFrequency,
    PaymentStatus,
    PaymentType,
    Permission,
    Product,
    ProductCategory,
    ProductIngredient,
    ProductStatus,
    ProductSupplier,
    ProductionOrder,
    ProductionOrderItem,
    ProductionStatus,
    Role,
    ScheduleStatus,
    Session,
    StockReservation,
    SubscriptionStatus,
    SubscriptionTier,
    SubscriptionTransaction,
    SubscriptionTransactionStatus,
    SubscriptionTransactionType,
    Supplier,
    TierFeature,
    TimeEntry,
    TimeEntryStatus,
    TimeEntryType,
    TimestampMixin,
    TransactionType,
    User,
    UserSettings,
    UserStatus,
)

def init_test_db():
    """Create all tables in the test database."""
    print("Creating all tables in test database...")
    Base.metadata.create_all(bind=engine)
    print("Test database initialized successfully!")

if __name__ == "__main__":
    init_test_db()
