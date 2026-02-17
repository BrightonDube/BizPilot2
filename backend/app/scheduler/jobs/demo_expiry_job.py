"""Demo expiry background job.

Checks for expired demo subscriptions and updates their status.
Runs hourly to ensure timely expiry of demo accounts.
"""

import logging
from datetime import datetime, timezone

from app.core.database import SessionLocal
from app.models.subscription import BusinessSubscription

logger = logging.getLogger(__name__)


def demo_expiry_job() -> dict:
    """
    Check for expired demo subscriptions and update status to 'expired'.

    Returns:
        Dict with job execution results
    """
    start_time = datetime.now(timezone.utc)
    result = {
        "start_time": start_time.isoformat(),
        "subscriptions_expired": 0,
        "errors": [],
    }

    try:
        db = SessionLocal()
        try:
            expired_subs = (
                db.query(BusinessSubscription)
                .filter(
                    BusinessSubscription.status == "active",
                    BusinessSubscription.valid_until.isnot(None),
                    BusinessSubscription.valid_until < start_time,
                )
                .all()
            )

            for sub in expired_subs:
                sub.status = "expired"
                logger.info(
                    f"Expired demo subscription for business {sub.business_id} "
                    f"(was valid until {sub.valid_until})"
                )

            db.commit()
            result["subscriptions_expired"] = len(expired_subs)

            logger.info(
                f"Demo expiry check completed: {len(expired_subs)} subscriptions expired"
            )
        except Exception as e:
            db.rollback()
            error_msg = f"Error during demo expiry check: {str(e)}"
            logger.error(error_msg, exc_info=True)
            result["errors"].append(error_msg)
        finally:
            db.close()

    except Exception as e:
        error_msg = f"Failed to create database session: {str(e)}"
        logger.error(error_msg, exc_info=True)
        result["errors"].append(error_msg)

    result["end_time"] = datetime.now(timezone.utc).isoformat()
    return result
