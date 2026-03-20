#!/usr/bin/env python
"""Standalone test runner for Property 12: Failed Payment Isolation.

This script runs the property-based tests for failed payment isolation
to verify that layby state remains unchanged when payment processing fails.
"""

import os
import sys

# Set required environment variables
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

# Run the specific test class
if __name__ == "__main__":
    import pytest
    
    # Run only the TestFailedPaymentIsolation class
    exit_code = pytest.main([
        "app/tests/property/test_properties_layby.py::TestFailedPaymentIsolation",
        "-v",
        "--tb=short",
        "--maxfail=1",
        "-x"
    ])
    
    sys.exit(exit_code)
