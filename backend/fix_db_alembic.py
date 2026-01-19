#!/usr/bin/env python3
"""
Fix database alembic version to match current schema state.
"""
import os
import contextlib
import psycopg2
from psycopg2 import OperationalError, ProgrammingError
from urllib.parse import urlparse

# Configuration
TARGET_ALEMBIC_VERSION = 'ef3bb807b7d5'
TARGET_TABLE = 'subscription_tiers'
TARGET_COLUMN = 'is_custom_pricing'


def get_database_url():
    """Get database URL from environment or raise error."""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL environment variable is required")
    return db_url


@contextlib.contextmanager
def get_db_connection(db_url):
    """Context manager for database connections."""
    parsed = urlparse(db_url)
    conn = None
    try:
        conn = psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port,
            database=parsed.path[1:],
            user=parsed.username,
            password=parsed.password,
            sslmode='require'
        )
        yield conn
    finally:
        if conn:
            conn.close()


def check_current_version(cursor):
    """Check current alembic version."""
    cursor.execute('SELECT version_num FROM alembic_version;')
    result = cursor.fetchone()
    return result[0] if result else None


def check_column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table."""
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = %s AND column_name = %s;
    """, (table_name, column_name))
    return cursor.fetchone() is not None


def update_alembic_version(cursor, version):
    """Update or insert alembic version."""
    cursor.execute('SELECT version_num FROM alembic_version;')
    if cursor.fetchone():
        cursor.execute('UPDATE alembic_version SET version_num = %s;', (version,))
    else:
        cursor.execute('INSERT INTO alembic_version (version_num) VALUES (%s);', (version,))


def main():
    """Main function to fix alembic version."""
    try:
        db_url = get_database_url()
    except ValueError as e:
        print(f'Configuration error: {e}')
        return 1
    
    try:
        with get_db_connection(db_url) as conn:
            with conn.cursor() as cursor:
                current_version = check_current_version(cursor)
                print(f'Current alembic version: {current_version}')
                
                column_exists = check_column_exists(cursor, TARGET_TABLE, TARGET_COLUMN)
                print(f'{TARGET_COLUMN} column exists: {column_exists}')
                
                if column_exists and current_version != TARGET_ALEMBIC_VERSION:
                    print(f'Updating alembic version to {TARGET_ALEMBIC_VERSION}...')
                    update_alembic_version(cursor, TARGET_ALEMBIC_VERSION)
                    conn.commit()
                    print('Alembic version updated successfully')
                else:
                    print('Database is already in correct state')
                    
    except OperationalError as e:
        print(f'Database connection failed: {e}')
        print('Check your DATABASE_URL and network connectivity')
        return 1
    except ProgrammingError as e:
        print(f'Database query failed: {e}')
        print('Check if the database schema is correct')
        return 1
    except Exception as e:
        print(f'Unexpected error: {e}')
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())