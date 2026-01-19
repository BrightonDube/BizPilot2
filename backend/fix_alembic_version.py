#!/usr/bin/env python3
"""
Alembic Version Fix Script

This script updates the alembic version in the database to mark a specific migration
as applied. This is useful when the database schema is already in the correct state
but the alembic version table doesn't reflect the applied migration.

Usage:
    1. Set up environment variables (see .env.alembic.example):
       export DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require"
    
    2. Run the script:
       python fix_alembic_version.py

Environment Variables:
    DATABASE_URL, DB_URL, or POSTGRES_URL - PostgreSQL connection string

Security Note:
    Never hardcode database credentials in this script. Always use environment variables.
"""
import os
import sys
import psycopg2
from urllib.parse import urlparse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_database_url():
    """Get database URL from environment variables with fallback options."""
    # Try multiple environment variable names
    env_vars = ['DATABASE_URL', 'DB_URL', 'POSTGRES_URL']
    
    for var in env_vars:
        db_url = os.getenv(var)
        if db_url:
            logger.info(f"Using database URL from {var}")
            return db_url
    
    # If no environment variable found, exit with error
    logger.error("No database URL found in environment variables: %s", ', '.join(env_vars))
    logger.error("Please set one of these environment variables with your database connection string")
    sys.exit(1)

def update_alembic_version(target_version='ef3bb807b7d5'):
    """
    Update the alembic version in the database.
    
    Args:
        target_version (str): The target alembic version to set
        
    Returns:
        bool: True if successful, False otherwise
    """
    db_url = get_database_url()
    conn = None
    cur = None
    
    try:
        logger.info("Connecting to database...")
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Check current version
        cur.execute("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1;")
        current_version_row = cur.fetchone()
        current_version = current_version_row[0] if current_version_row else 'None'
        logger.info(f"Current alembic version: {current_version}")
        
        if current_version == target_version:
            logger.info(f"Database is already at target version {target_version}")
            return True
        
        # Update the alembic version to mark our migration as applied
        cur.execute("UPDATE alembic_version SET version_num = %s", (target_version,))
        
        logger.info(f"Updated alembic version to: {target_version}")
        
        # Verify the update
        cur.execute("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1;")
        new_version_row = cur.fetchone()
        new_version = new_version_row[0] if new_version_row else 'None'
        logger.info(f"Verified new alembic version: {new_version}")
        
        if new_version != target_version:
            raise Exception(f"Version verification failed. Expected {target_version}, got {new_version}")
        
        conn.commit()
        logger.info("Alembic version updated successfully!")
        return True
        
    except psycopg2.Error as e:
        logger.error(f"Database error: {e}")
        if conn:
            conn.rollback()
            logger.info("Transaction rolled back")
        return False
        
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        if conn:
            conn.rollback()
            logger.info("Transaction rolled back")
        return False
        
    finally:
        # Ensure proper cleanup
        if cur:
            cur.close()
        if conn:
            conn.close()
            logger.info("Database connection closed")


def main():
    """Main function to execute the alembic version update."""
    logger.info("Starting alembic version update script...")
    
    # Since the database already has is_custom_pricing column, we need to set the version
    # to the revision that should have created it, which is our migration
    target_version = 'ef3bb807b7d5'
    
    success = update_alembic_version(target_version)
    
    if success:
        logger.info("Script completed successfully!")
        sys.exit(0)
    else:
        logger.error("Script failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()