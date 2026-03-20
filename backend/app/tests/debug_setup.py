import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'shared'))

from sqlalchemy import text
from app.core.database import get_sync_db
from app.models.subscription_tier import SubscriptionTier
from pricing_config import SUBSCRIPTION_TIERS
import uuid

def run():
    print("Running setup_method...")
    db = next(get_sync_db())
    try:
        db.execute(text("TRUNCATE TABLE subscription_tiers CASCADE"))
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
        count = db.query(SubscriptionTier).count()
        print(f"Setup complete. Tiers in DB: {count}")
    except Exception as e:
        print(f"Setup failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run()
