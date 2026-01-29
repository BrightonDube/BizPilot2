#!/usr/bin/env python3
"""
Comprehensive verification script for customer-accounts migration and seeding.
Validates: All Requirements

This script verifies:
1. All tables exist with correct schema
2. Seed data was created successfully
3. Data integrity (foreign keys, constraints)
4. Indexes are in place
5. Relationships work correctly
"""

import sqlite3
import sys
from datetime import datetime
from typing import List, Dict, Any

# ANSI color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'

class VerificationResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.errors: List[str] = []
        
    def add_pass(self, message: str):
        self.passed += 1
        print(f"{GREEN}✓{RESET} {message}")
        
    def add_fail(self, message: str):
        self.failed += 1
        self.errors.append(message)
        print(f"{RED}✗{RESET} {message}")
        
    def add_warning(self, message: str):
        self.warnings += 1
        print(f"{YELLOW}⚠{RESET} {message}")
        
    def print_summary(self):
        print("\n" + "=" * 80)
        print(f"{BOLD}VERIFICATION SUMMARY{RESET}")
        print("=" * 80)
        print(f"{GREEN}Passed:{RESET} {self.passed}")
        print(f"{RED}Failed:{RESET} {self.failed}")
        print(f"{YELLOW}Warnings:{RESET} {self.warnings}")
        
        if self.errors:
            print(f"\n{RED}Errors:{RESET}")
            for error in self.errors:
                print(f"  - {error}")
        
        print("=" * 80)
        
        if self.failed == 0:
            print(f"{GREEN}{BOLD}✓ ALL VERIFICATIONS PASSED{RESET}")
            return True
        else:
            print(f"{RED}{BOLD}✗ VERIFICATION FAILED{RESET}")
            return False


def print_section(title: str):
    print(f"\n{BLUE}{BOLD}{'=' * 80}{RESET}")
    print(f"{BLUE}{BOLD}{title}{RESET}")
    print(f"{BLUE}{BOLD}{'=' * 80}{RESET}")


def verify_table_exists(cursor: sqlite3.Cursor, table_name: str, result: VerificationResult) -> bool:
    """Verify that a table exists in the database."""
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,)
    )
    exists = cursor.fetchone() is not None
    
    if exists:
        result.add_pass(f"Table '{table_name}' exists")
    else:
        result.add_fail(f"Table '{table_name}' does not exist")
    
    return exists


def verify_table_schema(cursor: sqlite3.Cursor, table_name: str, 
                        expected_columns: Dict[str, Dict[str, Any]], 
                        result: VerificationResult):
    """Verify that a table has the expected columns and types."""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    
    actual_columns = {col[1]: {'type': col[2], 'notnull': col[3], 'default': col[4]} 
                     for col in columns}
    
    # Check for missing columns
    for col_name, col_info in expected_columns.items():
        if col_name not in actual_columns:
            result.add_fail(f"Column '{col_name}' missing from '{table_name}'")
        else:
            # Verify column type (case-insensitive)
            actual_type = actual_columns[col_name]['type'].upper()
            expected_type = col_info['type'].upper()
            
            if actual_type != expected_type:
                result.add_fail(
                    f"Column '{col_name}' in '{table_name}' has type '{actual_type}', "
                    f"expected '{expected_type}'"
                )
            else:
                result.add_pass(f"Column '{table_name}.{col_name}' has correct type")
    
    # Check for unexpected columns
    for col_name in actual_columns:
        if col_name not in expected_columns:
            result.add_warning(f"Unexpected column '{col_name}' in '{table_name}'")


def verify_indexes(cursor: sqlite3.Cursor, table_name: str, 
                   expected_indexes: List[str], result: VerificationResult):
    """Verify that expected indexes exist on a table."""
    cursor.execute(f"PRAGMA index_list({table_name})")
    indexes = cursor.fetchall()
    
    actual_indexes = [idx[1] for idx in indexes]
    
    for expected_idx in expected_indexes:
        if any(expected_idx in actual_idx for actual_idx in actual_indexes):
            result.add_pass(f"Index on '{table_name}' for '{expected_idx}' exists")
        else:
            result.add_fail(f"Index on '{table_name}' for '{expected_idx}' missing")


def verify_seed_data(cursor: sqlite3.Cursor, result: VerificationResult):
    """Verify that seed data was created successfully."""
    print_section("SEED DATA VERIFICATION")
    
    # Check customer_accounts
    cursor.execute("SELECT COUNT(*) FROM customer_accounts")
    account_count = cursor.fetchone()[0]
    
    if account_count > 0:
        result.add_pass(f"Found {account_count} customer account(s)")
        
        # Get sample account details
        cursor.execute("""
            SELECT id, account_number, status, credit_limit, current_balance 
            FROM customer_accounts 
            LIMIT 3
        """)
        accounts = cursor.fetchall()
        
        print(f"\n{BOLD}Sample Accounts:{RESET}")
        for acc in accounts:
            print(f"  - Account #{acc[1]}: Status={acc[2]}, "
                  f"Credit Limit=${acc[3]:.2f}, Balance=${acc[4]:.2f}")
    else:
        result.add_fail("No customer accounts found in seed data")
    
    # Check account_transactions
    cursor.execute("SELECT COUNT(*) FROM account_transactions")
    transaction_count = cursor.fetchone()[0]
    
    if transaction_count > 0:
        result.add_pass(f"Found {transaction_count} transaction(s)")
        
        # Get transaction breakdown
        cursor.execute("""
            SELECT transaction_type, COUNT(*), SUM(amount)
            FROM account_transactions
            GROUP BY transaction_type
        """)
        transactions = cursor.fetchall()
        
        print(f"\n{BOLD}Transaction Breakdown:{RESET}")
        for txn in transactions:
            print(f"  - {txn[0]}: {txn[1]} transaction(s), Total: ${txn[2]:.2f}")
    else:
        result.add_warning("No transactions found in seed data")
    
    # Check account_payments
    cursor.execute("SELECT COUNT(*) FROM account_payments")
    payment_count = cursor.fetchone()[0]
    
    if payment_count > 0:
        result.add_pass(f"Found {payment_count} payment(s)")
    else:
        result.add_warning("No payments found in seed data")
    
    # Check payment_allocations
    cursor.execute("SELECT COUNT(*) FROM payment_allocations")
    allocation_count = cursor.fetchone()[0]
    
    if allocation_count > 0:
        result.add_pass(f"Found {allocation_count} payment allocation(s)")
    else:
        result.add_warning("No payment allocations found in seed data")


def verify_data_integrity(cursor: sqlite3.Cursor, result: VerificationResult):
    """Verify data integrity including foreign keys and constraints."""
    print_section("DATA INTEGRITY VERIFICATION")
    
    # Verify foreign key relationships
    # Check that all account_transactions reference valid accounts
    cursor.execute("""
        SELECT COUNT(*) 
        FROM account_transactions at
        LEFT JOIN customer_accounts ca ON at.account_id = ca.id
        WHERE ca.id IS NULL
    """)
    orphaned_transactions = cursor.fetchone()[0]
    
    if orphaned_transactions == 0:
        result.add_pass("All transactions reference valid accounts")
    else:
        result.add_fail(f"Found {orphaned_transactions} orphaned transaction(s)")
    
    # Check that all account_payments reference valid accounts
    cursor.execute("""
        SELECT COUNT(*) 
        FROM account_payments ap
        LEFT JOIN customer_accounts ca ON ap.account_id = ca.id
        WHERE ca.id IS NULL
    """)
    orphaned_payments = cursor.fetchone()[0]
    
    if orphaned_payments == 0:
        result.add_pass("All payments reference valid accounts")
    else:
        result.add_fail(f"Found {orphaned_payments} orphaned payment(s)")
    
    # Check that all payment_allocations reference valid payments and transactions
    cursor.execute("""
        SELECT COUNT(*) 
        FROM payment_allocations pa
        LEFT JOIN account_payments ap ON pa.payment_id = ap.id
        WHERE ap.id IS NULL
    """)
    orphaned_allocations_payment = cursor.fetchone()[0]
    
    if orphaned_allocations_payment == 0:
        result.add_pass("All payment allocations reference valid payments")
    else:
        result.add_fail(f"Found {orphaned_allocations_payment} payment allocation(s) with invalid payment")
    
    cursor.execute("""
        SELECT COUNT(*) 
        FROM payment_allocations pa
        LEFT JOIN account_transactions at ON pa.transaction_id = at.id
        WHERE at.id IS NULL
    """)
    orphaned_allocations_transaction = cursor.fetchone()[0]
    
    if orphaned_allocations_transaction == 0:
        result.add_pass("All payment allocations reference valid transactions")
    else:
        result.add_fail(f"Found {orphaned_allocations_transaction} payment allocation(s) with invalid transaction")
    
    # Verify balance calculations
    cursor.execute("""
        SELECT 
            ca.id,
            ca.account_number,
            ca.current_balance,
            COALESCE(SUM(CASE 
                WHEN at.transaction_type = 'charge' THEN at.amount
                WHEN at.transaction_type = 'payment' THEN -at.amount
                WHEN at.transaction_type = 'adjustment' THEN at.amount
                WHEN at.transaction_type = 'write_off' THEN -at.amount
                ELSE 0
            END), 0) as calculated_balance
        FROM customer_accounts ca
        LEFT JOIN account_transactions at ON ca.id = at.account_id
        GROUP BY ca.id, ca.account_number, ca.current_balance
    """)
    
    balance_mismatches = []
    for row in cursor.fetchall():
        account_id, account_number, stored_balance, calculated_balance = row
        if abs(stored_balance - calculated_balance) > 0.01:  # Allow for rounding
            balance_mismatches.append(
                f"Account {account_number}: stored=${stored_balance:.2f}, "
                f"calculated=${calculated_balance:.2f}"
            )
    
    if not balance_mismatches:
        result.add_pass("All account balances match transaction history")
    else:
        for mismatch in balance_mismatches:
            result.add_fail(f"Balance mismatch: {mismatch}")
    
    # Verify credit limit constraints
    cursor.execute("""
        SELECT account_number, current_balance, credit_limit
        FROM customer_accounts
        WHERE current_balance > credit_limit
    """)
    
    over_limit = cursor.fetchall()
    if not over_limit:
        result.add_pass("No accounts exceed credit limit")
    else:
        for acc in over_limit:
            result.add_warning(
                f"Account {acc[0]} exceeds credit limit: "
                f"Balance=${acc[1]:.2f}, Limit=${acc[2]:.2f}"
            )


def main():
    """Main verification function."""
    print(f"\n{BOLD}{'=' * 80}{RESET}")
    print(f"{BOLD}CUSTOMER ACCOUNTS - MIGRATION AND SEEDING VERIFICATION{RESET}")
    print(f"{BOLD}{'=' * 80}{RESET}")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    result = VerificationResult()
    
    try:
        # Connect to database
        conn = sqlite3.connect('test.db')
        cursor = conn.cursor()
        
        # Enable foreign key constraints
        cursor.execute("PRAGMA foreign_keys = ON")
        
        # 1. Verify all tables exist
        print_section("TABLE EXISTENCE VERIFICATION")
        
        tables = [
            'customer_accounts',
            'account_transactions',
            'account_payments',
            'payment_allocations',
            'account_statements',
            'collection_activities',
            'account_write_offs'
        ]
        
        all_tables_exist = True
        for table in tables:
            if not verify_table_exists(cursor, table, result):
                all_tables_exist = False
        
        if not all_tables_exist:
            print(f"\n{RED}Cannot continue verification - missing tables{RESET}")
            conn.close()
            sys.exit(1)
        
        # 2. Verify table schemas
        print_section("SCHEMA VERIFICATION")
        
        # Define expected schemas (key columns only)
        schemas = {
            'customer_accounts': {
                'id': {'type': 'VARCHAR'},
                'customer_id': {'type': 'VARCHAR'},
                'business_id': {'type': 'VARCHAR'},
                'account_number': {'type': 'VARCHAR'},
                'status': {'type': 'VARCHAR'},
                'credit_limit': {'type': 'NUMERIC'},
                'current_balance': {'type': 'NUMERIC'},
                'payment_terms': {'type': 'INTEGER'},
                'created_at': {'type': 'DATETIME'},
                'updated_at': {'type': 'DATETIME'}
            },
            'account_transactions': {
                'id': {'type': 'VARCHAR'},
                'account_id': {'type': 'VARCHAR'},
                'transaction_type': {'type': 'VARCHAR'},
                'amount': {'type': 'NUMERIC'},
                'balance_after': {'type': 'NUMERIC'},
                'created_at': {'type': 'DATETIME'}
            },
            'account_payments': {
                'id': {'type': 'VARCHAR'},
                'account_id': {'type': 'VARCHAR'},
                'amount': {'type': 'NUMERIC'},
                'payment_method': {'type': 'VARCHAR'},
                'created_at': {'type': 'DATETIME'}
            },
            'payment_allocations': {
                'id': {'type': 'VARCHAR'},
                'payment_id': {'type': 'VARCHAR'},
                'transaction_id': {'type': 'VARCHAR'},
                'amount': {'type': 'NUMERIC'}
            }
        }
        
        for table, expected_cols in schemas.items():
            verify_table_schema(cursor, table, expected_cols, result)
        
        # 3. Verify indexes
        print_section("INDEX VERIFICATION")
        
        index_checks = {
            'customer_accounts': ['customer_id', 'business_id', 'status'],
            'account_transactions': ['account_id', 'due_date'],
            'account_payments': ['account_id'],
            'account_statements': ['account_id']
        }
        
        for table, expected_indexes in index_checks.items():
            verify_indexes(cursor, table, expected_indexes, result)
        
        # 4. Verify seed data
        verify_seed_data(cursor, result)
        
        # 5. Verify data integrity
        verify_data_integrity(cursor, result)
        
        # Close connection
        conn.close()
        
        # Print summary
        success = result.print_summary()
        
        print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        sys.exit(0 if success else 1)
        
    except Exception as e:
        print(f"\n{RED}ERROR: {e}{RESET}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
