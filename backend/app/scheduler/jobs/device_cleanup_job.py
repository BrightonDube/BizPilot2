"""Device cleanup background job.

Marks devices as inactive if they haven't synced in 30+ days.
Runs daily to free up device slots for businesses.
"""

import logging
from datetime import datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.models.subscription import DeviceRegistry

logger = logging.getLogger(__name__)


def device_cleanup_job() -> dict:
    """
    Mark devices as inactive if last_sync_time > 30 days ago.

    Returns:
        Dict with job execution results
    """
    start_time = datetime.now(timezone.utc)
    result = {
        "start_time": start_time.isoformat(),
        "devices_deactivated": 0,
        "errors": [],
    }

    try:
        db = SessionLocal()
        try:
            cutoff_date = start_time - timedelta(days=30)

            devices = (
                db.query(DeviceRegistry)
                .filter(
                    DeviceRegistry.is_active == True,  # noqa: E712
                    DeviceRegistry.last_sync_time < cutoff_date,
                )
                .all()
            )

            for device in devices:
                device.is_active = False

            db.commit()
            result["devices_deactivated"] = len(devices)

            logger.info(
                f"Device cleanup completed: {len(devices)} devices marked inactive"
            )
        except Exception as e:
            db.rollback()
            error_msg = f"Error during device cleanup: {str(e)}"
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
