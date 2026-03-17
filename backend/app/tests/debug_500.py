import sys
import os
import uuid
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from sqlalchemy import create_engine
from app.models.base import Base
engine = create_engine("sqlite:///./test.db")
Base.metadata.create_all(engine)

from app.main import app
from app.core.database import SessionLocal, get_sync_db
from app.models.subscription_tier import SubscriptionTier
from shared.pricing_config import SUBSCRIPTION_TIERS

def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_sync_db] = override_get_db

def run():
    db = SessionLocal()
    try:
        db.query(SubscriptionTier).delete()
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
                feature_flags=tier_config.feature_flags
            )
            db.add(tier)
        db.commit()
    except Exception as e:
        print("Setup error:", e)
    finally:
        db.close()

    client = TestClient(app, raise_server_exceptions=True)
    try:
        response = client.get("/api/v1/subscriptions/tiers")
        print("STATUS:", response.status_code)
        print("BODY:", response.json())
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run()
