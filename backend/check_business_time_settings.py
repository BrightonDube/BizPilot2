#!/usr/bin/env python3
"""
Check if business_time_settings table exists and has data.
"""
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
        
        # Check if business_time_settings table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'business_time_settings'
            );
        """)
        table_exists = cursor.fetchone()[0]
        print(f'business_time_settings table exists: {table_exists}')
        
        if table_exists:
            # Check if it has data
            cursor.execute('SELECT COUNT(*) FROM business_time_settings;')
            row_count = cursor.fetchone()[0]
            print(f'business_time_settings row count: {row_count}')
        
        # Check stock_reservations indexes
        cursor.execute("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'stock_reservations' 
            AND indexname LIKE 'ix_stock_reservations_%';
        """)
        indexes = cursor.fetchall()
        print(f'stock_reservations indexes: {[idx[0] for idx in indexes]}')
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f'Error: {e}')
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main())