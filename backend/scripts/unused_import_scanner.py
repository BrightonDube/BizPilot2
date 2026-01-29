#!/usr/bin/env python3
"""
Python Unused Import Scanner

This script analyzes Python files to identify unused imports.
It parses files using the AST module, extracts all import statements,
builds a name usage map, and identifies imports that are never referenced.

Usage:
    python unused_import_scanner.py <file_or_directory>
    python unused_import_scanner.py --check-all  # Scan entire backend directory
"""

import ast
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Set, Tuple


@dataclass
class ImportInfo:
    """Information about an import statement."""
    module: str
    names: List[str]
    line: int
    col: int
    import_type: str  # 'import' or 'from_import'
    alias_map: Dict[str, str]  # Maps imported name to alias (if any)


@dataclass
class UnusedImport:
    """Information about an unused import."""
    file_path: str
    module: str
    name: str
    line: int
    col: int


class ImportUsageAnalyzer(ast.NodeVisitor):
    """AST visitor that tracks import statements and name usage."""
    
    def __init__(self):
        self.imports: List[ImportInfo] = []
        self.used_names: Set[str] = set()
        self.current_scope_names: Set[str] = set()
        
    def visit_Import(self, node: ast.Import) -> None:
        """Visit an 'import' statement."""
        names = []
        alias_map = {}
        
        for alias in node.names:
            # For 'import foo' or 'import foo as bar'
            imported_name = alias.asname if alias.asname else alias.name
            names.append(imported_name)
            alias_map[imported_name] = alias.name
            
        self.imports.append(ImportInfo(
            module='',
            names=names,
            line=node.lineno,
            col=node.col_offset,
            import_type='import',
            alias_map=alias_map
        ))
        
        self.generic_visit(node)
    
    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        """Visit a 'from ... import ...' statement."""
        if node.module is None:
            # Relative import like 'from . import foo'
            module = '.'
        else:
            module = node.module
            
        names = []
        alias_map = {}
        
        for alias in node.names:
            if alias.name == '*':
                # Wildcard import - we can't track individual names
                names.append('*')
                alias_map['*'] = '*'
            else:
                # Regular import or aliased import
                imported_name = alias.asname if alias.asname else alias.name
                names.append(imported_name)
                alias_map[imported_name] = alias.name
        
        self.imports.append(ImportInfo(
            module=module,
            names=names,
            line=node.lineno,
            col=node.col_offset,
            import_type='from_import',
            alias_map=alias_map
        ))
        
        self.generic_visit(node)
    
    def visit_Name(self, node: ast.Name) -> None:
        """Visit a Name node (variable/function reference)."""
        # Track usage of names (but not in import context)
        if isinstance(node.ctx, (ast.Load, ast.Del)):
            self.used_names.add(node.id)
        
        self.generic_visit(node)
    
    def visit_Attribute(self, node: ast.Attribute) -> None:
        """Visit an Attribute node (e.g., module.function)."""
        # For 'import foo; foo.bar()', we need to track 'foo'
        if isinstance(node.value, ast.Name):
            self.used_names.add(node.value.id)
        
        self.generic_visit(node)
    
    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """Visit a function definition."""
        # Function names are defined, not used
        self.current_scope_names.add(node.name)
        self.generic_visit(node)
    
    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        """Visit an async function definition."""
        self.current_scope_names.add(node.name)
        self.generic_visit(node)
    
    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        """Visit a class definition."""
        self.current_scope_names.add(node.name)
        
        # Check base classes for usage
        for base in node.bases:
            if isinstance(base, ast.Name):
                self.used_names.add(base.id)
        
        self.generic_visit(node)
    
    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
        """Visit an exception handler."""
        # Exception types are used
        if node.type:
            if isinstance(node.type, ast.Name):
                self.used_names.add(node.type.id)
            elif isinstance(node.type, ast.Tuple):
                for elt in node.type.elts:
                    if isinstance(elt, ast.Name):
                        self.used_names.add(elt.id)
        
        self.generic_visit(node)
    
    def visit_arg(self, node: ast.arg) -> None:
        """Visit a function argument."""
        # Check type annotations
        if node.annotation:
            if isinstance(node.annotation, ast.Name):
                self.used_names.add(node.annotation.id)
        
        self.generic_visit(node)
    
    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        """Visit an annotated assignment."""
        # Type annotations use names
        if isinstance(node.annotation, ast.Name):
            self.used_names.add(node.annotation.id)
        
        self.generic_visit(node)


def analyze_file(file_path: str) -> Tuple[List[ImportInfo], Set[str]]:
    """
    Analyze a Python file to extract imports and name usage.
    
    Args:
        file_path: Path to the Python file
        
    Returns:
        Tuple of (imports, used_names)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            source = f.read()
        
        tree = ast.parse(source, filename=file_path)
        analyzer = ImportUsageAnalyzer()
        analyzer.visit(tree)
        
        return analyzer.imports, analyzer.used_names
        
    except SyntaxError as e:
        print(f"Syntax error in {file_path}: {e}", file=sys.stderr)
        return [], set()
    except Exception as e:
        print(f"Error analyzing {file_path}: {e}", file=sys.stderr)
        return [], set()


def find_unused_imports(file_path: str) -> List[UnusedImport]:
    """
    Find all unused imports in a Python file.
    
    Args:
        file_path: Path to the Python file
        
    Returns:
        List of UnusedImport objects
    """
    imports, used_names = analyze_file(file_path)
    unused = []
    
    for imp in imports:
        # Skip wildcard imports (can't determine usage)
        if '*' in imp.names:
            continue
        
        for name in imp.names:
            # Check if the imported name is used
            if name not in used_names:
                unused.append(UnusedImport(
                    file_path=file_path,
                    module=imp.module if imp.module else imp.alias_map.get(name, name),
                    name=name,
                    line=imp.line,
                    col=imp.col
                ))
    
    return unused


def scan_directory(directory: str, exclude_dirs: Set[str] = None) -> List[UnusedImport]:
    """
    Recursively scan a directory for Python files and find unused imports.
    
    Args:
        directory: Path to the directory to scan
        exclude_dirs: Set of directory names to exclude
        
    Returns:
        List of all unused imports found
    """
    if exclude_dirs is None:
        exclude_dirs = {'venv', '__pycache__', '.pytest_cache', '.ruff_cache', 
                       'node_modules', '.git', '.hypothesis', 'alembic/versions'}
    
    all_unused = []
    directory_path = Path(directory)
    
    for root, dirs, files in os.walk(directory_path):
        # Filter out excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
        
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                unused = find_unused_imports(file_path)
                all_unused.extend(unused)
    
    return all_unused


def format_report(unused_imports: List[UnusedImport]) -> str:
    """
    Format unused imports into a readable report.
    
    Args:
        unused_imports: List of unused imports
        
    Returns:
        Formatted report string
    """
    if not unused_imports:
        return "✓ No unused imports found!"
    
    # Group by file
    by_file: Dict[str, List[UnusedImport]] = {}
    for imp in unused_imports:
        if imp.file_path not in by_file:
            by_file[imp.file_path] = []
        by_file[imp.file_path].append(imp)
    
    lines = [f"Found {len(unused_imports)} unused imports in {len(by_file)} files:\n"]
    
    for file_path in sorted(by_file.keys()):
        lines.append(f"\n{file_path}:")
        for imp in sorted(by_file[file_path], key=lambda x: x.line):
            if imp.module:
                lines.append(f"  Line {imp.line}: from {imp.module} import {imp.name}")
            else:
                lines.append(f"  Line {imp.line}: import {imp.name}")
    
    return '\n'.join(lines)


def main():
    """Main entry point for the scanner."""
    if len(sys.argv) < 2:
        print("Usage: python unused_import_scanner.py <file_or_directory>")
        print("       python unused_import_scanner.py --check-all")
        sys.exit(1)
    
    target = sys.argv[1]
    
    if target == '--check-all':
        # Scan the entire backend directory
        backend_dir = Path(__file__).parent.parent
        print(f"Scanning {backend_dir}...")
        unused = scan_directory(str(backend_dir))
    elif os.path.isfile(target):
        # Scan a single file
        print(f"Scanning {target}...")
        unused = find_unused_imports(target)
    elif os.path.isdir(target):
        # Scan a directory
        print(f"Scanning {target}...")
        unused = scan_directory(target)
    else:
        print(f"Error: {target} is not a valid file or directory")
        sys.exit(1)
    
    # Print report
    report = format_report(unused)
    print(report)
    
    # Exit with error code if unused imports found
    sys.exit(0 if not unused else 1)


if __name__ == '__main__':
    main()
