import os
os.environ["SECRET_KEY"] = "test-secret-test-secret-test-secret-test"
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.base import Base

# Create SQLite DB
engine = create_engine("sqlite:///./test.db")
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

from app.main import app
from app.core.database import get_sync_db
app.dependency_overrides[get_sync_db] = override_get_db

from fastapi.testclient import TestClient
import uuid
import datetime

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'shared'))
from pricing_config import SUBSCRIPTION_TIERS
from app.models.subscription_tier import SubscriptionTier

db = SessionLocal()
for tier_config in SUBSCRIPTION_TIERS:
    tier = SubscriptionTier(
        id=uuid.uuid4(),
        name=tier_config.name,
        display_name=tier_config.display_name,
        description=tier_config.description,
        price_monthly_cents=tier_config.price_monthly_cents,
        price_yearly_cents=tier_config.price_yearly_cents,
        currency=tier_config.currency,
        sort_order=tier_config.sort_order,
        is_default=tier_config.is_default,
        is_active=tier_config.is_active,
        is_custom_pricing=tier_config.is_custom_pricing,
        features=tier_config.features,
        feature_flags=tier_config.feature_flags,
        created_at=datetime.datetime.now(datetime.timezone.utc),
        updated_at=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(tier)
db.commit()

client = TestClient(app)
response = client.get("/api/v1/subscriptions/tiers")
print("STATUS:", response.status_code)
print("BODY:", response.json())
