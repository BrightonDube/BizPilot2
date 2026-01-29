"""
Unit tests for the boolean comparison fixer.

Tests verify that the fixer correctly identifies and fixes non-Pythonic
boolean comparisons in Python code.

Feature: technical-debt-cleanup
Validates: Requirements 6.1, 6.2, 6.3
"""

import tempfile
import os
from pathlib import Path
import sys

# Add scripts directory to path
scripts_dir = Path(__file__).parent.parent.parent / 'scripts'
sys.path.insert(0, str(scripts_dir))

from boolean_comparison_fixer import (  # noqa: E402
    analyze_file,
    fix_file
)


def test_identify_x_equals_true():
    """Test identification of 'x == True' pattern."""
    code = """
def check_status(is_active):
    if is_active == True:
        return "active"
    return "inactive"
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        comparisons = analyze_file(temp_path)
        
        assert len(comparisons) == 1
        assert comparisons[0].pattern == 'is_active == True'
        assert comparisons[0].replacement == 'is_active'
        assert comparisons[0].line == 3
    finally:
        os.unlink(temp_path)


def test_identify_x_equals_false():
    """Test identification of 'x == False' pattern."""
    code = """
def check_status(is_active):
    if is_active == False:
        return "inactive"
    return "active"
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        comparisons = analyze_file(temp_path)
        
        assert len(comparisons) == 1
        assert comparisons[0].pattern == 'is_active == False'
        assert comparisons[0].replacement == 'not is_active'
        assert comparisons[0].line == 3
    finally:
        os.unlink(temp_path)


def test_identify_true_equals_x():
    """Test identification of 'True == x' pattern."""
    code = """
def check_status(is_active):
    if True == is_active:
        return "active"
    return "inactive"
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        comparisons = analyze_file(temp_path)
        
        assert len(comparisons) == 1
        assert comparisons[0].pattern == 'True == is_active'
        assert comparisons[0].replacement == 'is_active'
        assert comparisons[0].line == 3
    finally:
        os.unlink(temp_path)


def test_identify_false_equals_x():
    """Test identification of 'False == x' pattern."""
    code = """
def check_status(is_active):
    if False == is_active:
        return "inactive"
    return "active"
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        comparisons = analyze_file(temp_path)
        
        assert len(comparisons) == 1
        assert comparisons[0].pattern == 'False == is_active'
        assert comparisons[0].replacement == 'not is_active'
        assert comparisons[0].line == 3
    finally:
        os.unlink(temp_path)


def test_identify_attribute_comparison():
    """Test identification of attribute boolean comparisons."""
    code = """
def check_device(device):
    if device.is_active == True:
        return "active"
    return "inactive"
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        comparisons = analyze_file(temp_path)
        
        assert len(comparisons) == 1
        assert 'device.is_active' in comparisons[0].pattern
        assert comparisons[0].replacement == 'device.is_active'
    finally:
        os.unlink(temp_path)


def test_ignore_non_boolean_comparisons():
    """Test that non-boolean comparisons are ignored."""
    code = """
def check_value(x):
    if x == 5:
        return "five"
    if x == "hello":
        return "greeting"
    return "other"
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        comparisons = analyze_file(temp_path)
        
        # Should find no boolean comparisons
        assert len(comparisons) == 0
    finally:
        os.unlink(temp_path)


def test_ignore_is_comparisons():
    """Test that 'is True' and 'is False' are ignored (they're already correct)."""
    code = """
def check_value(x):
    if x is True:
        return "true"
    if x is False:
        return "false"
    return "other"
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        comparisons = analyze_file(temp_path)
        
        # Should find no issues (is True/False is acceptable)
        assert len(comparisons) == 0
    finally:
        os.unlink(temp_path)


def test_fix_x_equals_true():
    """Test fixing 'x == True' to 'x'."""
    code = """
def check_status(is_active):
    if is_active == True:
        return "active"
    return "inactive"
"""
    
    expected = """
def check_status(is_active):
    if is_active:
        return "active"
    return "inactive"
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        comparisons = analyze_file(temp_path)
        assert len(comparisons) == 1
        
        # Apply fix
        result = fix_file(temp_path, comparisons)
        assert result is True
        
        # Read fixed content
        with open(temp_path, 'r') as f:
            fixed_content = f.read()
        
        assert fixed_content == expected
    finally:
        os.unlink(temp_path)


def test_fix_x_equals_false():
    """Test fixing 'x == False' to 'not x'."""
    code = """
def check_status(is_active):
    if is_active == False:
        return "inactive"
    return "active"
"""
    
    expected = """
def check_status(is_active):
    if not is_active:
        return "inactive"
    return "active"
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        comparisons = analyze_file(temp_path)
        assert len(comparisons) == 1
        
        # Apply fix
        result = fix_file(temp_path, comparisons)
        assert result is True
        
        # Read fixed content
        with open(temp_path, 'r') as f:
            fixed_content = f.read()
        
        assert fixed_content == expected
    finally:
        os.unlink(temp_path)


def test_fix_multiple_comparisons():
    """Test fixing multiple boolean comparisons in one file."""
    code = """
def check_status(is_active, is_verified):
    if is_active == True:
        if is_verified == False:
            return "active but unverified"
        return "active and verified"
    return "inactive"
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        comparisons = analyze_file(temp_path)
        assert len(comparisons) == 2
        
        # Apply fix
        result = fix_file(temp_path, comparisons)
        assert result is True
        
        # Read fixed content
        with open(temp_path, 'r') as f:
            fixed_content = f.read()
        
        # Verify both fixes applied
        assert 'is_active == True' not in fixed_content
        assert 'is_verified == False' not in fixed_content
        assert 'if is_active:' in fixed_content
        assert 'if not is_verified:' in fixed_content
    finally:
        os.unlink(temp_path)


def test_fix_preserves_formatting():
    """Test that fixing preserves indentation and formatting."""
    code = """
class DeviceService:
    def check_device(self, device):
        if device.is_active == True:
            return True
        return False
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        comparisons = analyze_file(temp_path)
        assert len(comparisons) == 1
        
        # Apply fix
        result = fix_file(temp_path, comparisons)
        assert result is True
        
        # Read fixed content
        with open(temp_path, 'r') as f:
            fixed_content = f.read()
        
        # Verify indentation preserved
        assert '        if device.is_active:' in fixed_content
        assert 'class DeviceService:' in fixed_content
    finally:
        os.unlink(temp_path)


def test_sqlalchemy_query_comparison():
    """Test fixing boolean comparisons in SQLAlchemy queries."""
    code = """
from sqlalchemy import select, and_

def get_active_devices(session):
    stmt = select(Device).where(
        and_(
            Device.business_id == 123,
            Device.is_active == True
        )
    )
    return session.execute(stmt).scalars().all()
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        comparisons = analyze_file(temp_path)
        assert len(comparisons) == 1
        assert 'Device.is_active' in comparisons[0].pattern
        
        # Apply fix
        result = fix_file(temp_path, comparisons)
        assert result is True
        
        # Read fixed content
        with open(temp_path, 'r') as f:
            fixed_content = f.read()
        
        # Verify fix applied
        assert 'Device.is_active == True' not in fixed_content
        assert 'Device.is_active' in fixed_content
    finally:
        os.unlink(temp_path)


def test_no_changes_for_clean_file():
    """Test that clean files are not modified."""
    code = """
def check_status(is_active):
    if is_active:
        return "active"
    if not is_active:
        return "inactive"
    return "unknown"
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        comparisons = analyze_file(temp_path)
        assert len(comparisons) == 0
        
        # Try to fix (should return False since no changes needed)
        result = fix_file(temp_path, comparisons)
        assert result is False
        
        # Read content (should be unchanged)
        with open(temp_path, 'r') as f:
            content = f.read()
        
        assert content == code
    finally:
        os.unlink(temp_path)


def test_syntax_error_handling():
    """Test that syntax errors are handled gracefully."""
    code = """
def broken_function(
    # Missing closing parenthesis and body
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        # Should not crash, should return empty list
        comparisons = analyze_file(temp_path)
        assert comparisons == []
    finally:
        os.unlink(temp_path)


if __name__ == '__main__':
    # Run all tests
    import pytest
    pytest.main([__file__, '-v'])
