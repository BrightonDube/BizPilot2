"""
Schema Synchronization Script

This script ensures the database schema matches the models by:
1. Adding missing columns to existing tables
2. Creating missing tables
3. Validating the schema matches the models

Run this before seeding to ensure schema consistency.
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from app.core.sync_database import sync_engine

def fix_subscription_tiers(conn):
    """Add missing is_custom_pricing column to subscription_tiers."""
    print("Checking subscription_tiers table...")
    
    result = conn.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'subscription_tiers' AND column_name = 'is_custom_pricing'
    """))
    
    if not result.fetchone():
        print("  Adding is_custom_pricing column...")
        conn.execute(text("""
            ALTER TABLE subscription_tiers 
            ADD COLUMN is_custom_pricing BOOLEAN DEFAULT FALSE NOT NULL
        """))
        conn.commit()
        print("  ✓ Added is_custom_pricing column")
    else:
        print("  ✓ is_custom_pricing column exists")


def fix_orders_table(conn):
    """Add missing payment_status column to orders."""
    print("Checking orders table...")
    
    # Check if payment_status column exists
    result = conn.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payment_status'
    """))
    
    if not result.fetchone():
        print("  Adding payment_status column...")
        
        # First, check if the enum type exists
        result = conn.execute(text("""
            SELECT 1 FROM pg_type WHERE typname = 'paymentstatus'
        """))
        
        if not result.fetchone():
            # Create the enum type
            conn.execute(text("""
                CREATE TYPE paymentstatus AS ENUM ('pending', 'paid', 'partial', 'failed', 'refunded')
            """))
            print("  Created paymentstatus enum type")
        
        # Add the column
        conn.execute(text("""
            ALTER TABLE orders 
            ADD COLUMN payment_status paymentstatus DEFAULT 'pending'
        """))
        conn.commit()
        print("  ✓ Added payment_status column")
    else:
        print("  ✓ payment_status column exists")


def create_stock_reservations_table(conn):
    """Create stock_reservations table if it doesn't exist."""
    print("Checking stock_reservations table...")
    
    result = conn.execute(text("""
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'stock_reservations'
    """))
    
    if not result.fetchone():
        print("  Creating stock_reservations table...")
        conn.execute(text("""
            CREATE TABLE stock_reservations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                layby_id UUID NOT NULL REFERENCES laybys(id) ON DELETE CASCADE,
                product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
                location_id UUID,
                quantity INTEGER NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'reserved',
                reserved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                released_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                deleted_at TIMESTAMP WITH TIME ZONE,
                UNIQUE(layby_id, product_id, location_id)
            )
        """))
        
        # Create indexes
        conn.execute(text("CREATE INDEX idx_stock_reservations_product ON stock_reservations(product_id)"))
        conn.execute(text("CREATE INDEX idx_stock_reservations_layby ON stock_reservations(layby_id)"))
        conn.execute(text("CREATE INDEX idx_stock_reservations_status ON stock_reservations(status)"))
        conn.execute(text("CREATE INDEX idx_stock_reservations_location ON stock_reservations(location_id)"))
        
        conn.commit()
        print("  ✓ Created stock_reservations table with indexes")
    else:
        print("  ✓ stock_reservations table exists")


def fix_invoices_table(conn):
    """Add missing columns to invoices table."""
    print("Checking invoices table...")
    
    # Check for missing columns
    missing_columns = []
    
    for col_name in ['payment_reference', 'payment_gateway_fees', 'gateway_status']:
        result = conn.execute(text(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'invoices' AND column_name = '{col_name}'
        """))
        
        if not result.fetchone():
            missing_columns.append(col_name)
    
    if missing_columns:
        print(f"  Adding missing columns: {', '.join(missing_columns)}...")
        
        if 'payment_reference' in missing_columns:
            conn.execute(text("""
                ALTER TABLE invoices 
                ADD COLUMN payment_reference VARCHAR(255)
            """))
        
        if 'payment_gateway_fees' in missing_columns:
            conn.execute(text("""
                ALTER TABLE invoices 
                ADD COLUMN payment_gateway_fees NUMERIC(12,2) DEFAULT 0
            """))
        
        if 'gateway_status' in missing_columns:
            conn.execute(text("""
                ALTER TABLE invoices 
                ADD COLUMN gateway_status VARCHAR(50)
            """))
        
        conn.commit()
        print(f"  ✓ Added {len(missing_columns)} missing columns")
    else:
        print("  ✓ All required columns exist")


def main():
    """Run all schema fixes."""
    print("\n" + "=" * 60)
    print("Schema Synchronization Script")
    print("=" * 60 + "\n")
    
    with sync_engine.connect() as conn:
        try:
            fix_subscription_tiers(conn)
            fix_orders_table(conn)
            fix_invoices_table(conn)
            create_stock_reservations_table(conn)
            
            print("\n" + "=" * 60)
            print("✅ Schema synchronization complete!")
            print("=" * 60 + "\n")
            
        except Exception as e:
            conn.rollback()
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    main()
