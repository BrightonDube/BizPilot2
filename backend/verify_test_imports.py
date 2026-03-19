#!/usr/bin/env python
"""Verify that the test file can be imported without errors."""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

try:
    # Try to import the test module
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    
    from app.tests.property.test_properties_layby import TestFailedPaymentIsolation
    
    print("✓ Successfully imported TestFailedPaymentIsolation")
    print(f"✓ Test class has {len([m for m in dir(TestFailedPaymentIsolation) if m.startswith('test_')])} test methods")
    
    # List the test methods
    test_methods = [m for m in dir(TestFailedPaymentIsolation) if m.startswith('test_')]
    for method in test_methods:
        print(f"  - {method}")
    
    print("\n✓ All imports successful! The test file is syntactically correct.")
    
except Exception as e:
    print(f"✗ Error importing test: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
