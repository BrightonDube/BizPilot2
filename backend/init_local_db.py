"""Initialize local SQLite database with proper schema and test data."""

import asyncio
import os
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Tuple

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Load environment variables before importing app modules
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent / ".env.local", override=True)

from passlib.context import CryptContext  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

# Import models to ensure they're registered
from app.models.base import Base  # noqa: E402
from app.models.user import User, UserStatus, SubscriptionStatus  # noqa: E402
from app.models.organization import Organization  # noqa: E402
from app.models.business import Business  # noqa: E402
from app.models.role import Role  # noqa: E402
from app.models.business_user import BusinessUser, BusinessUserStatus  # noqa: E402

# Configuration
DB_PATH = Path(__file__).parent / "test.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# Test data configuration - can be overridden via environment variables
ADMIN_EMAIL = os.getenv("INIT_ADMIN_EMAIL", "admin@bizpilot.com")
ADMIN_PASSWORD = os.getenv("INIT_ADMIN_PASSWORD", "admin123")
DEFAULT_CURRENCY = "ZAR"
DEFAULT_VAT_RATE = 15.00
ALL_PERMISSIONS = "*"
DEFAULT_COUNTRY = "South Africa"
INVOICE_PREFIX = "INV"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@dataclass
class TestDataIds:
    """Container for test data UUIDs."""
    user_id: uuid.UUID
    org_id: uuid.UUID
    business_id: uuid.UUID
    role_id: uuid.UUID
    business_user_id: uuid.UUID


def utc_now() -> datetime:
    """Get current UTC timestamp."""
    return datetime.now(timezone.utc)


def generate_test_ids() -> TestDataIds:
    """Generate all required UUIDs for test data."""
    return TestDataIds(
        user_id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        role_id=uuid.uuid4(),
        business_user_id=uuid.uuid4(),
    )


async def drop_database() -> None:
    """Delete existing database file."""
    if DB_PATH.exists():
        print(f"Deleting existing database: {DB_PATH}")
        DB_PATH.unlink()


async def create_schema(engine) -> None:
    """Create all database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✓ Database schema created")


async def create_test_entities(ids: TestDataIds) -> Tuple[User, Organization, Business, Role, BusinessUser]:
    """Create all test entities."""
    now = utc_now()
    
    user = User(
        id=ids.user_id,
        email=ADMIN_EMAIL,
        hashed_password=pwd_context.hash(ADMIN_PASSWORD),
        first_name="Admin",
        last_name="User",
        phone="+27123456789",
        is_email_verified=True,
        status=UserStatus.ACTIVE,
        is_admin=True,
        is_superadmin=True,
        subscription_status=SubscriptionStatus.ACTIVE,
        created_at=now,
        updated_at=now,
    )
    
    org = Organization(
        id=ids.org_id,
        name="Test Organization",
        slug="test-org",
        owner_id=ids.user_id,
        created_at=now,
        updated_at=now,
    )
    
    business = Business(
        id=ids.business_id,
        name="Test Business",
        slug="test-business",
        organization_id=ids.org_id,
        currency=DEFAULT_CURRENCY,
        vat_rate=DEFAULT_VAT_RATE,
        address_country=DEFAULT_COUNTRY,
        invoice_prefix=INVOICE_PREFIX,
        created_at=now,
        updated_at=now,
    )
    
    role = Role(
        id=ids.role_id,
        name="Admin",
        description="Full administrative access",
        business_id=ids.business_id,
        is_system=True,
        permissions=ALL_PERMISSIONS,
        created_at=now,
        updated_at=now,
    )
    
    business_user = BusinessUser(
        id=ids.business_user_id,
        user_id=ids.user_id,
        business_id=ids.business_id,
        role_id=ids.role_id,
        status=BusinessUserStatus.ACTIVE,
        is_primary=True,
        created_at=now,
        updated_at=now,
    )
    
    return user, org, business, role, business_user


async def seed_test_data(session: AsyncSession) -> Tuple[User, Organization, Business]:
    """Create initial test data."""
    ids = generate_test_ids()
    user, org, business, role, business_user = await create_test_entities(ids)
    
    # Bulk insert
    session.add_all([user, org, business, role, business_user])
    await session.commit()
    
    return user, org, business


def print_success_message(user: User, org: Organization, business: Business) -> None:
    """Print success message with credentials."""
    print("\n✓ Test data created:")
    print(f"  Email: {user.email}")
    print(f"  Password: {ADMIN_PASSWORD}")
    print(f"  User ID: {user.id}")
    print(f"  Organization: {org.name}")
    print(f"  Business: {business.name}")


async def init_db() -> None:
    """Initialize database with schema and test data."""
    engine = None
    
    try:
        await drop_database()
        print(f"Creating new database: {DB_PATH}")
        
        engine = create_async_engine(DATABASE_URL, echo=DEBUG)
        
        await create_schema(engine)
        
        async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        
        async with async_session() as session:
            user, org, business = await seed_test_data(session)
            print_success_message(user, org, business)
            
    except Exception as e:
        print(f"\n❌ Error initializing database: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        if engine is not None:
            await engine.dispose()


if __name__ == "__main__":
    print("Initializing local SQLite database...")
    try:
        asyncio.run(init_db())
        print("\n✓ Database initialization complete!")
    except KeyboardInterrupt:
        print("\n⚠️  Database initialization cancelled by user")
        sys.exit(1)
    except Exception:
        print("\n❌ Database initialization failed!")
        sys.exit(1)
