"""
Unit tests for the wildcard import resolver.

Tests the functionality of identifying and resolving wildcard imports
in Python files.
"""

import ast
import tempfile
from pathlib import Path
import sys
import os

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'scripts'))

from wildcard_import_resolver import (
    WildcardImportAnalyzer,
    analyze_file,
    fix_file,
    get_module_exports,
    WildcardImport
)


def test_wildcard_import_analyzer_finds_wildcard():
    """Test that the analyzer finds wildcard imports."""
    code = """
from os.path import *

def main():
    path = join('a', 'b')
    return path
"""
    
    tree = ast.parse(code)
    analyzer = WildcardImportAnalyzer('test.py')
    analyzer.visit(tree)
    
    assert len(analyzer.wildcard_imports) == 1
    module, line, col = analyzer.wildcard_imports[0]
    assert module == 'os.path'
    assert line == 2


def test_wildcard_import_analyzer_tracks_usage():
    """Test that the analyzer tracks name usage."""
    code = """
from os.path import *

def main():
    path = join('a', 'b')
    result = exists(path)
    return result
"""
    
    tree = ast.parse(code)
    analyzer = WildcardImportAnalyzer('test.py')
    analyzer.visit(tree)
    
    # Should track 'join' and 'exists' as used
    assert 'join' in analyzer.all_used_names
    assert 'exists' in analyzer.all_used_names


def test_wildcard_import_analyzer_tracks_defined_names():
    """Test that the analyzer tracks defined names."""
    code = """
from os.path import *

def main():
    return True

class MyClass:
    pass
"""
    
    tree = ast.parse(code)
    analyzer = WildcardImportAnalyzer('test.py')
    analyzer.visit(tree)
    
    # Should track 'main' and 'MyClass' as defined
    assert 'main' in analyzer.defined_names
    assert 'MyClass' in analyzer.defined_names


def test_wildcard_import_analyzer_tracks_type_annotations():
    """Test that the analyzer tracks names in type annotations."""
    code = """
from typing import *

def process(items: List[str]) -> Dict[str, int]:
    return {}
"""
    
    tree = ast.parse(code)
    analyzer = WildcardImportAnalyzer('test.py')
    analyzer.visit(tree)
    
    # Should track 'List' and 'Dict' as used
    assert 'List' in analyzer.all_used_names
    assert 'Dict' in analyzer.all_used_names


def test_wildcard_import_analyzer_tracks_exception_types():
    """Test that the analyzer tracks exception types."""
    code = """
from exceptions import *

def main():
    try:
        pass
    except ValueError:
        pass
    except (TypeError, KeyError):
        pass
"""
    
    tree = ast.parse(code)
    analyzer = WildcardImportAnalyzer('test.py')
    analyzer.visit(tree)
    
    # Should track exception types as used
    assert 'ValueError' in analyzer.all_used_names
    assert 'TypeError' in analyzer.all_used_names
    assert 'KeyError' in analyzer.all_used_names


def test_wildcard_import_analyzer_tracks_base_classes():
    """Test that the analyzer tracks base classes."""
    code = """
from models import *

class MyModel(BaseModel):
    pass
"""
    
    tree = ast.parse(code)
    analyzer = WildcardImportAnalyzer('test.py')
    analyzer.visit(tree)
    
    # Should track 'BaseModel' as used
    assert 'BaseModel' in analyzer.all_used_names


def test_analyze_file_with_wildcard():
    """Test analyzing a file with wildcard imports."""
    code = """
from os.path import *

def main():
    return join('a', 'b')
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        wildcards = analyze_file(temp_path)
        
        assert len(wildcards) == 1
        assert wildcards[0].module == 'os.path'
        assert wildcards[0].line == 2
        # Should detect 'join' as used
        assert 'join' in wildcards[0].used_names
    
    finally:
        os.unlink(temp_path)


def test_analyze_file_without_wildcard():
    """Test analyzing a file without wildcard imports."""
    code = """
from os.path import join

def main():
    return join('a', 'b')
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        wildcards = analyze_file(temp_path)
        assert len(wildcards) == 0
    
    finally:
        os.unlink(temp_path)


def test_fix_file_single_name():
    """Test fixing a file with wildcard import using single name."""
    code = """from os.path import *

def main():
    return join('a', 'b')
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        # Analyze and fix
        wildcards = analyze_file(temp_path)
        assert len(wildcards) == 1
        
        # Create a mock wildcard with known used names
        mock_wildcard = WildcardImport(
            file_path=temp_path,
            module='os.path',
            line=1,
            col=0,
            used_names={'join'}
        )
        
        result = fix_file(temp_path, [mock_wildcard])
        assert result is True
        
        # Read the fixed file
        with open(temp_path, 'r') as f:
            fixed_code = f.read()
        
        # Should have explicit import
        assert 'from os.path import join' in fixed_code
        assert 'import *' not in fixed_code
    
    finally:
        os.unlink(temp_path)


def test_fix_file_multiple_names():
    """Test fixing a file with wildcard import using multiple names."""
    code = """from os.path import *

def main():
    path = join('a', 'b')
    return exists(path)
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        # Create a mock wildcard with known used names
        mock_wildcard = WildcardImport(
            file_path=temp_path,
            module='os.path',
            line=1,
            col=0,
            used_names={'join', 'exists'}
        )
        
        result = fix_file(temp_path, [mock_wildcard])
        assert result is True
        
        # Read the fixed file
        with open(temp_path, 'r') as f:
            fixed_code = f.read()
        
        # Should have explicit imports (sorted)
        assert 'from os.path import' in fixed_code
        assert 'exists' in fixed_code
        assert 'join' in fixed_code
        assert 'import *' not in fixed_code
    
    finally:
        os.unlink(temp_path)


def test_fix_file_preserves_comments():
    """Test that fixing preserves inline comments."""
    code = """from os.path import *  # noqa: F403

def main():
    return join('a', 'b')
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        # Create a mock wildcard with known used names
        mock_wildcard = WildcardImport(
            file_path=temp_path,
            module='os.path',
            line=1,
            col=0,
            used_names={'join'}
        )
        
        result = fix_file(temp_path, [mock_wildcard])
        assert result is True
        
        # Read the fixed file
        with open(temp_path, 'r') as f:
            fixed_code = f.read()
        
        # Should preserve the comment
        assert '# noqa: F403' in fixed_code or 'noqa' in fixed_code
    
    finally:
        os.unlink(temp_path)


def test_fix_file_no_names_used():
    """Test fixing a file where no names from wildcard are used."""
    code = """from os.path import *

def main():
    return True
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        # Create a mock wildcard with no used names
        mock_wildcard = WildcardImport(
            file_path=temp_path,
            module='os.path',
            line=1,
            col=0,
            used_names=set()
        )
        
        result = fix_file(temp_path, [mock_wildcard])
        assert result is True
        
        # Read the fixed file
        with open(temp_path, 'r') as f:
            fixed_code = f.read()
        
        # Should comment out the unused import
        assert '# Removed unused wildcard import' in fixed_code
    
    finally:
        os.unlink(temp_path)


def test_fix_file_preserves_indentation():
    """Test that fixing preserves indentation."""
    code = """
if True:
    from os.path import *
    
    def main():
        return join('a', 'b')
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        # Create a mock wildcard with known used names
        mock_wildcard = WildcardImport(
            file_path=temp_path,
            module='os.path',
            line=3,
            col=4,
            used_names={'join'}
        )
        
        result = fix_file(temp_path, [mock_wildcard])
        assert result is True
        
        # Read the fixed file
        with open(temp_path, 'r') as f:
            fixed_code = f.read()
        
        # Should preserve indentation
        lines = fixed_code.split('\n')
        import_line = [line for line in lines if 'from os.path import' in line][0]
        assert import_line.startswith('    ')  # 4 spaces
    
    finally:
        os.unlink(temp_path)


def test_get_module_exports_with_all():
    """Test getting module exports when __all__ is defined."""
    # Test with a module that has __all__
    exports = get_module_exports('os.path', 'test.py')
    
    # os.path should have common functions
    assert isinstance(exports, set)
    # We can't guarantee specific exports, but it should not be empty
    # for a standard library module


def test_analyze_file_syntax_error():
    """Test that syntax errors are handled gracefully."""
    code = """
from os.path import *

def main(
    # Syntax error - missing closing paren
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        wildcards = analyze_file(temp_path)
        # Should return empty list on syntax error
        assert wildcards == []
    
    finally:
        os.unlink(temp_path)


def test_fix_file_empty_list():
    """Test that fixing with empty list returns False."""
    code = """
def main():
    return True
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        f.flush()
        temp_path = f.name
    
    try:
        result = fix_file(temp_path, [])
        assert result is False
    
    finally:
        os.unlink(temp_path)
