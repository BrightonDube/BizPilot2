#!/usr/bin/env python3
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

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Check current version
    cur.execute("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1;")
    current_version = cur.fetchone()
    print(f"Current alembic version: {current_version[0] if current_version else 'None'}")
    
    # Since the database already has is_custom_pricing column, we need to set the version
    # to the revision that should have created it, which is our migration
    target_version = 'ef3bb807b7d5'
    
    # Update the alembic version to mark our migration as applied
    cur.execute("UPDATE alembic_version SET version_num = %s", (target_version,))
    
    print(f"Updated alembic version to: {target_version}")
    
    # Verify the update
    cur.execute("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1;")
    new_version = cur.fetchone()
    print(f"New alembic version: {new_version[0] if new_version else 'None'}")
    
    conn.commit()
    cur.close()
    conn.close()
    
    print("Alembic version updated successfully!")
    
except Exception as e:
    print(f'Error: {e}')
    if 'conn' in locals():
        conn.rollback()