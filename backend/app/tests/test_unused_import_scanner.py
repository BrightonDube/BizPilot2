"""
Unit tests for the unused import scanner.

Tests verify that the scanner correctly identifies unused imports
in various scenarios including simple imports, from imports, aliases,
and edge cases.
"""

import ast
import tempfile
from pathlib import Path

# Import the scanner module
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'scripts'))
from unused_import_scanner import (
    find_unused_imports,
    ImportUsageAnalyzer
)


class TestImportUsageAnalyzer:
    """Test the ImportUsageAnalyzer AST visitor."""
    
    def test_simple_import_used(self):
        """Test that a simple import that is used is detected correctly."""
        code = """
import os
print(os.path.join('a', 'b'))
"""
        tree = ast.parse(code)
        analyzer = ImportUsageAnalyzer()
        analyzer.visit(tree)
        
        assert len(analyzer.imports) == 1
        assert 'os' in analyzer.imports[0].names
        assert 'os' in analyzer.used_names
    
    def test_simple_import_unused(self):
        """Test that a simple import that is unused is detected correctly."""
        code = """
import os
import sys
print("hello")
"""
        tree = ast.parse(code)
        analyzer = ImportUsageAnalyzer()
        analyzer.visit(tree)
        
        assert len(analyzer.imports) == 2
        assert 'os' not in analyzer.used_names
        assert 'sys' not in analyzer.used_names
    
    def test_from_import_used(self):
        """Test that a from import that is used is detected correctly."""
        code = """
from datetime import datetime
now = datetime.now()
"""
        tree = ast.parse(code)
        analyzer = ImportUsageAnalyzer()
        analyzer.visit(tree)
        
        assert len(analyzer.imports) == 1
        assert 'datetime' in analyzer.imports[0].names
        assert 'datetime' in analyzer.used_names
    
    def test_from_import_unused(self):
        """Test that a from import that is unused is detected correctly."""
        code = """
from datetime import datetime, timedelta
now = datetime.now()
"""
        tree = ast.parse(code)
        analyzer = ImportUsageAnalyzer()
        analyzer.visit(tree)
        
        assert len(analyzer.imports) == 1
        assert 'datetime' in analyzer.imports[0].names
        assert 'timedelta' in analyzer.imports[0].names
        assert 'datetime' in analyzer.used_names
        assert 'timedelta' not in analyzer.used_names
    
    def test_import_with_alias(self):
        """Test that imports with aliases are tracked correctly."""
        code = """
import numpy as np
arr = np.array([1, 2, 3])
"""
        tree = ast.parse(code)
        analyzer = ImportUsageAnalyzer()
        analyzer.visit(tree)
        
        assert len(analyzer.imports) == 1
        assert 'np' in analyzer.imports[0].names
        assert 'np' in analyzer.used_names
    
    def test_from_import_with_alias(self):
        """Test that from imports with aliases are tracked correctly."""
        code = """
from datetime import datetime as dt
now = dt.now()
"""
        tree = ast.parse(code)
        analyzer = ImportUsageAnalyzer()
        analyzer.visit(tree)
        
        assert len(analyzer.imports) == 1
        assert 'dt' in analyzer.imports[0].names
        assert 'dt' in analyzer.used_names
    
    def test_type_annotation_usage(self):
        """Test that type annotations count as usage."""
        code = """
from typing import Optional
def foo(x: Optional[int]) -> None:
    pass
"""
        tree = ast.parse(code)
        analyzer = ImportUsageAnalyzer()
        analyzer.visit(tree)
        
        assert 'Optional' in analyzer.used_names
    
    def test_exception_handler_usage(self):
        """Test that exception types count as usage."""
        code = """
from ValueError import ValueError
try:
    pass
except ValueError:
    pass
"""
        tree = ast.parse(code)
        analyzer = ImportUsageAnalyzer()
        analyzer.visit(tree)
        
        assert 'ValueError' in analyzer.used_names
    
    def test_base_class_usage(self):
        """Test that base classes count as usage."""
        code = """
from abc import ABC
class MyClass(ABC):
    pass
"""
        tree = ast.parse(code)
        analyzer = ImportUsageAnalyzer()
        analyzer.visit(tree)
        
        assert 'ABC' in analyzer.used_names


class TestFindUnusedImports:
    """Test the find_unused_imports function."""
    
    def test_no_unused_imports(self):
        """Test file with no unused imports."""
        code = """
import os
from datetime import datetime

def main():
    print(os.getcwd())
    print(datetime.now())
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            
            unused = find_unused_imports(f.name)
            assert len(unused) == 0
    
    def test_single_unused_import(self):
        """Test file with one unused import."""
        code = """
import os
import sys

def main():
    print(os.getcwd())
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            
            unused = find_unused_imports(f.name)
            assert len(unused) == 1
            assert unused[0].name == 'sys'
    
    def test_multiple_unused_imports(self):
        """Test file with multiple unused imports."""
        code = """
import os
import sys
import json
from datetime import datetime, timedelta

def main():
    print(os.getcwd())
    print(datetime.now())
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            
            unused = find_unused_imports(f.name)
            assert len(unused) == 3
            unused_names = {u.name for u in unused}
            assert unused_names == {'sys', 'json', 'timedelta'}
    
    def test_unused_from_import(self):
        """Test unused from import."""
        code = """
from typing import Optional, List, Dict

def foo(x: Optional[int]) -> List[int]:
    return [x] if x else []
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            
            unused = find_unused_imports(f.name)
            assert len(unused) == 1
            assert unused[0].name == 'Dict'
    
    def test_wildcard_import_skipped(self):
        """Test that wildcard imports are skipped."""
        code = """
from os.path import *

def main():
    print(join('a', 'b'))
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            
            unused = find_unused_imports(f.name)
            # Wildcard imports should be skipped
            assert len(unused) == 0


class TestEdgeCases:
    """Test edge cases and special scenarios."""
    
    def test_empty_file(self):
        """Test empty file."""
        code = ""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            
            unused = find_unused_imports(f.name)
            assert len(unused) == 0
    
    def test_no_imports(self):
        """Test file with no imports."""
        code = """
def main():
    print("hello")
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            
            unused = find_unused_imports(f.name)
            assert len(unused) == 0
    
    def test_import_used_in_string(self):
        """Test that imports used only in strings are marked as unused."""
        code = """
import os
print("os.getcwd()")
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            
            unused = find_unused_imports(f.name)
            # String usage doesn't count
            assert len(unused) == 1
            assert unused[0].name == 'os'
    
    def test_import_used_in_comment(self):
        """Test that imports mentioned only in comments are marked as unused."""
        code = """
import os
# Use os.getcwd() here
print("hello")
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            
            unused = find_unused_imports(f.name)
            # Comment usage doesn't count
            assert len(unused) == 1
            assert unused[0].name == 'os'
    
    def test_relative_import(self):
        """Test relative imports."""
        code = """
from . import models
from ..services import user_service

def main():
    print(models)
    print(user_service)
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            
            unused = find_unused_imports(f.name)
            assert len(unused) == 0


class TestRealWorldScenarios:
    """Test real-world code patterns."""
    
    def test_fastapi_route(self):
        """Test FastAPI route with dependencies."""
        code = """
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter()

@router.get("/users")
async def get_users(db: Session = Depends(get_db)):
    return []
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            
            unused = find_unused_imports(f.name)
            # HTTPException is unused
            assert len(unused) == 1
            assert unused[0].name == 'HTTPException'
    
    def test_pydantic_model(self):
        """Test Pydantic model with type annotations."""
        code = """
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class User(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            
            unused = find_unused_imports(f.name)
            # List is unused
            assert len(unused) == 1
            assert unused[0].name == 'List'
    
    def test_test_file_with_fixtures(self):
        """Test pytest test file with fixtures."""
        code = """
import pytest
from unittest.mock import Mock, patch
from app.services import user_service

@pytest.fixture
def mock_db():
    return Mock()

def test_get_user(mock_db):
    result = user_service.get_user(mock_db, 1)
    assert result is not None
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            f.flush()
            
            unused = find_unused_imports(f.name)
            # patch is unused
            assert len(unused) == 1
            assert unused[0].name == 'patch'
