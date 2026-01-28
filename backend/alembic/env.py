"""Alembic environment configuration."""

from logging.config import fileConfig
import logging
import os
import sys
from urllib.parse import urlparse, urlunparse

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Setup logging
logger = logging.getLogger("alembic.env")

# Add the backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

# Load .env file
from dotenv import load_dotenv

# Load alembic-specific env file if it exists, otherwise load default .env
alembic_env_path = os.path.join(backend_dir, '.env.alembic')
default_env_path = os.path.join(backend_dir, '.env')

if os.path.exists(alembic_env_path):
    load_dotenv(alembic_env_path)
    logger.info(f"Loaded environment from {alembic_env_path}")
else:
    load_dotenv(default_env_path)
    logger.info(f"Loaded environment from {default_env_path}")

# Alembic runs in CI/automation contexts where SECRET_KEY may be unset.
# The application Settings validates SECRET_KEY on import, but migrations
# don't require JWT functionality. Provide a safe default to allow env.py
# to import app modules.
if not os.getenv("SECRET_KEY"):
    os.environ["SECRET_KEY"] = "0123456789abcdef"
    logger.debug("Using default SECRET_KEY for migration context")

from app.core.database import Base  # noqa: E402
# Import all models to register them with SQLAlchemy
from app.models import (  # noqa: E402, F401
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
    ProductionOrder,
    ProductionOrderItem,
    ProductionStatus,
    ProductStatus,
    ProductSupplier,
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

# this is the Alembic Config object
config = context.config


def convert_async_url_to_sync(url: str) -> str:
    """
    Convert async database URLs to sync for Alembic migrations.
    
    Alembic requires synchronous database drivers. This function converts
    asyncpg URLs to psycopg URLs while preserving all connection parameters.
    
    Args:
        url: Database URL (may contain async driver)
        
    Returns:
        Database URL with sync driver
        
    Examples:
        postgresql+asyncpg://user:pass@host/db -> postgresql+psycopg://user:pass@host/db
        asyncpg://user:pass@host/db -> postgresql+psycopg://user:pass@host/db
    """
    if not url:
        return url
    
    parsed = urlparse(url)
    
    # Check if URL uses async driver
    if parsed.scheme in ("asyncpg", "postgresql+asyncpg", "postgres+asyncpg"):
        # Verify psycopg is available
        try:
            import psycopg  # noqa: F401
        except ImportError:
            raise ImportError(
                "psycopg is required for Alembic migrations with PostgreSQL. "
                "Install it with: pip install 'psycopg[binary]'"
            )
        
        # Convert to sync driver
        new_scheme = "postgresql+psycopg"
        converted_url = urlunparse((
            new_scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            parsed.query,
            parsed.fragment
        ))
        
        logger.info(f"Converted {parsed.scheme} URL to {new_scheme} for migrations")
        return converted_url
    
    return url


# Override sqlalchemy.url with environment variable if set
database_url = os.getenv("DATABASE_URL")
if database_url:
    database_url = convert_async_url_to_sync(database_url)
    config.set_main_option("sqlalchemy.url", database_url)
    logger.debug(f"Using database URL from DATABASE_URL environment variable")

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Add your model's MetaData object here for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
