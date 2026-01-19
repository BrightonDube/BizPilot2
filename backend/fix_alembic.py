#!/usr/bin/env python3
"""
Alembic version fix utility.

This script updates the alembic_version table to a specific revision.
Used for fixing database migration state issues.
"""
import os
import sys
import logging
from typing import Optional
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Target version - update this when needed
TARGET_VERSION = 'ef3bb807b7d5'


def get_database_url() -> str:
    """Get database URL from environment with validation."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        logger.error("DATABASE_URL not found in environment")
        sys.exit(1)
    return database_url


def validate_version_format(version: str) -> bool:
    """Validate that version string matches expected Alembic format."""
    if not version or len(version) != 12:
        return False
    try:
        # Check if it's a valid hex string
        int(version, 16)
        return True
    except ValueError:
        return False


def get_current_version(conn) -> Optional[str]:
    """Get current alembic version from database."""
    try:
        result = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
        row = result.fetchone()
        return row[0] if row else None
    except SQLAlchemyError as e:
        logger.warning(f"Could not retrieve current version: {e}")
        return None


def update_alembic_version(target_version: str) -> bool:
    """
    Update alembic version in database.
    
    Args:
        target_version: The target revision to set
        
    Returns:
        bool: True if successful, False otherwise
    """
    if not validate_version_format(target_version):
        logger.error(f"Invalid version format: {target_version}")
        return False
    
    database_url = get_database_url()
    
    try:
        engine = create_engine(database_url)
        with engine.connect() as conn:
            # Get current version for logging
            current_version = get_current_version(conn)
            if current_version:
                logger.info(f"Current alembic version: {current_version}")
            
            if current_version == target_version:
                logger.info(f"Version already set to {target_version}, no update needed")
                return True
            
            # Update version
            result = conn.execute(
                text("UPDATE alembic_version SET version_num = :version"),
                {"version": target_version}
            )
            
            if result.rowcount == 0:
                logger.warning("No rows updated - alembic_version table may be empty")
                # Try to insert if table is empty
                conn.execute(
                    text("INSERT INTO alembic_version (version_num) VALUES (:version)"),
                    {"version": target_version}
                )
                logger.info("Inserted new alembic version record")
            
            conn.commit()
            logger.info(f"Successfully updated alembic version to {target_version}")
            return True
            
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return False


def main():
    """Main entry point."""
    logger.info(f"Starting alembic version fix to {TARGET_VERSION}")
    
    success = update_alembic_version(TARGET_VERSION)
    
    if success:
        logger.info("Alembic version fix completed successfully")
        sys.exit(0)
    else:
        logger.error("Alembic version fix failed")
        sys.exit(1)


if __name__ == "__main__":
    main()