import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_sync_db
from app.models.subscription_tier import SubscriptionTier
from sqlalchemy import text

def test_debug_tiers(db_session):
    # Truncate and seed
    db_session.execute(text("TRUNCATE TABLE subscription_tiers CASCADE"))
    
    tier = SubscriptionTier(
        name="test",
        display_name="Test",
        price_monthly_cents=100,
        price_yearly_cents=1000,
        is_active=True
    )
    db_session.add(tier)
    db_session.commit()

    # Query directly
    tiers = db_session.query(SubscriptionTier).all()
    print("DIRECT QUERY:", tiers)

    # Query via API
    client = TestClient(app)
    response = client.get("/api/v1/subscriptions/tiers")
    print("API QUERY:", response.json())
