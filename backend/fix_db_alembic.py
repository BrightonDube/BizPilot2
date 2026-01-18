#!/usr/bin/env python3
"""
Fix database alembic version to match current schema state.
"""
import os
import psycopg2
from urllib.parse import urlparse

def main():
    # Parse DATABASE_URL
    db_url = 'postgresql://doadmin:AVNS_Yt4deUv5k-rD3ECUTPA@bizpilot-postgres-do-user-30635323-0.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require'
    parsed = urlparse(db_url)

    try:
        conn = psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port,
            database=parsed.path[1:],
            user=parsed.username,
            password=parsed.password,
            sslmode='require'
        )
        
        cursor = conn.cursor()
        
        # Check current alembic version
        cursor.execute('SELECT version_num FROM alembic_version;')
        current_version = cursor.fetchone()
        print(f'Current alembic version: {current_version[0] if current_version else None}')
        
        # Check if subscription_tiers table exists and has is_custom_pricing column
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'subscription_tiers' 
            AND column_name = 'is_custom_pricing';
        """)
        column_exists = cursor.fetchone()
        print(f'is_custom_pricing column exists: {column_exists is not None}')
        
        # If column exists but version is wrong, update alembic version
        if column_exists and (not current_version or current_version[0] != 'ef3bb807b7d5'):
            print('Updating alembic version to ef3bb807b7d5...')
            if current_version:
                cursor.execute('UPDATE alembic_version SET version_num = %s;', ('ef3bb807b7d5',))
            else:
                cursor.execute('INSERT INTO alembic_version (version_num) VALUES (%s);', ('ef3bb807b7d5',))
            conn.commit()
            print('Alembic version updated successfully')
        else:
            print('Database is already in correct state')
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f'Error: {e}')
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main())