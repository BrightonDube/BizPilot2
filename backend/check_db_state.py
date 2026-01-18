#!/usr/bin/env python3
"""
Database state checker for BizPilot2.
Checks subscription_tiers table structure and alembic version.
"""
import os
import sys
import logging
import contextlib
from typing import Optional, List, Tuple

try:
    import psycopg2
    from psycopg2 import OperationalError, ProgrammingError
except ImportError:
    print("Error: psycopg2 is required but not installed")
    print("Install with: pip install psycopg2-binary")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@contextlib.contextmanager
def get_db_connection(db_url: str):
    """Context manager for database connections."""
    conn = None
    try:
        conn = psycopg2.connect(db_url)
        yield conn
    finally:
        if conn:
            conn.close()


def validate_environment() -> str:
    """Validate required environment variables."""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise EnvironmentError(
            "DATABASE_URL environment variable is required. "
            "Set it to your PostgreSQL connection string."
        )
    return db_url


def check_subscription_tiers_table(cursor) -> bool:
    """Check subscription_tiers table structure."""
    try:
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'subscription_tiers'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        if columns:
            logger.info('subscription_tiers table columns:')
            for col in columns:
                logger.info(f'  {col[0]} ({col[1]}) - nullable: {col[2]}, default: {col[3]}')
            return True
        else:
            logger.warning('subscription_tiers table does not exist')
            return False
            
    except ProgrammingError as e:
        logger.error(f"Error checking subscription_tiers table: {e}")
        return False


def check_alembic_version(cursor) -> Optional[str]:
    """Check current alembic migration version."""
    try:
        cursor.execute("""
            SELECT version_num FROM alembic_version 
            ORDER BY version_num DESC LIMIT 1;
        """)
        
        version = cursor.fetchone()
        if version:
            logger.info(f'Current alembic version: {version[0]}')
            return version[0]
        else:
            logger.warning('No alembic version found')
            return None
            
    except ProgrammingError as e:
        logger.error(f"Error checking alembic version: {e}")
        return None


def main() -> int:
    """Main function."""
    try:
        # Validate environment
        db_url = validate_environment()
        logger.info("Connecting to database...")
        
        # Check database state
        with get_db_connection(db_url) as conn:
            with conn.cursor() as cur:
                table_exists = check_subscription_tiers_table(cur)
                version = check_alembic_version(cur)
                
                # Summary
                logger.info("Database state check completed")
                if not table_exists:
                    logger.warning("subscription_tiers table is missing")
                    return 1
                if not version:
                    logger.warning("alembic version is missing")
                    return 1
                    
                logger.info("Database state appears healthy")
                return 0
                
    except EnvironmentError as e:
        logger.error(f"Environment error: {e}")
        return 1
    except OperationalError as e:
        logger.error(f"Database connection failed: {e}")
        return 1
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())