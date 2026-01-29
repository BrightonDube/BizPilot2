#!/usr/bin/env python3
"""
Python Wildcard Import Resolver

This script analyzes Python files to identify wildcard imports (from module import *)
and resolves them to explicit named imports based on actual usage in the file.

It parses files using the AST module, finds wildcard imports, builds a usage map,
and generates explicit import statements with only the names that are actually used.

Usage:
    python wildcard_import_resolver.py <file_or_directory>
    python wildcard_import_resolver.py --check-all  # Scan entire backend directory
    python wildcard_import_resolver.py --fix <file>  # Fix wildcard imports in file
"""

import ast
import importlib
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Set, Tuple


@dataclass
class WildcardImport:
    """Information about a wildcard import statement."""
    file_path: str
    module: str
    line: int
    col: int
    used_names: Set[str]  # Names from this module that are actually used


class WildcardImportAnalyzer(ast.NodeVisitor):
    """AST visitor that finds wildcard imports and tracks name usage."""
    
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.wildcard_imports: List[Tuple[str, int, int]] = []  # (module, line, col)
        self.all_used_names: Set[str] = set()
        self.defined_names: Set[str] = set()  # Names defined in this file
        
    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        """Visit a 'from ... import ...' statement."""
        # Check for wildcard imports
        for alias in node.names:
            if alias.name == '*':
                module = node.module if node.module else '.'
                self.wildcard_imports.append((module, node.lineno, node.col_offset))
        
        self.generic_visit(node)
    
    def visit_Name(self, node: ast.Name) -> None:
        """Visit a Name node (variable/function reference)."""
        # Track usage of names
        if isinstance(node.ctx, ast.Load):
            self.all_used_names.add(node.id)
        elif isinstance(node.ctx, ast.Store):
            # Track names defined in this file
            self.defined_names.add(node.id)
        
        self.generic_visit(node)
    
    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """Visit a function definition."""
        self.defined_names.add(node.name)
        self.generic_visit(node)
    
    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        """Visit an async function definition."""
        self.defined_names.add(node.name)
        self.generic_visit(node)
    
    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        """Visit a class definition."""
        self.defined_names.add(node.name)
        
        # Check base classes for usage
        for base in node.bases:
            if isinstance(base, ast.Name):
                self.all_used_names.add(base.id)
        
        self.generic_visit(node)
    
    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
        """Visit an exception handler."""
        # Exception types are used
        if node.type:
            if isinstance(node.type, ast.Name):
                self.all_used_names.add(node.type.id)
            elif isinstance(node.type, ast.Tuple):
                for elt in node.type.elts:
                    if isinstance(elt, ast.Name):
                        self.all_used_names.add(elt.id)
        
        self.generic_visit(node)
    
    def visit_arg(self, node: ast.arg) -> None:
        """Visit a function argument."""
        # Check type annotations
        if node.annotation:
            self._extract_names_from_annotation(node.annotation)
        
        self.generic_visit(node)
    
    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        """Visit an annotated assignment."""
        # Type annotations use names
        if node.annotation:
            self._extract_names_from_annotation(node.annotation)
        
        self.generic_visit(node)
    
    def _extract_names_from_annotation(self, annotation: ast.AST) -> None:
        """Extract names from type annotations."""
        if isinstance(annotation, ast.Name):
            self.all_used_names.add(annotation.id)
        elif isinstance(annotation, ast.Subscript):
            # Handle generic types like List[str], Dict[str, int]
            if isinstance(annotation.value, ast.Name):
                self.all_used_names.add(annotation.value.id)
            self._extract_names_from_annotation(annotation.slice)
        elif isinstance(annotation, ast.Tuple):
            for elt in annotation.elts:
                self._extract_names_from_annotation(elt)
        elif isinstance(annotation, ast.BinOp):
            # Handle union types like str | int
            self._extract_names_from_annotation(annotation.left)
            self._extract_names_from_annotation(annotation.right)


def get_module_exports(module_name: str, file_path: str) -> Set[str]:
    """
    Get the list of names exported by a module.
    
    Args:
        module_name: Name of the module to inspect
        file_path: Path to the file importing the module (for relative imports)
        
    Returns:
        Set of exported names
    """
    try:
        # Handle relative imports
        if module_name.startswith('.'):
            # For relative imports, we need to determine the package
            # This is complex, so we'll try to read the module's __init__.py
            file_dir = Path(file_path).parent
            
            # Count leading dots to determine how many levels up
            level = len(module_name) - len(module_name.lstrip('.'))
            module_name_clean = module_name.lstrip('.')
            
            # Go up the directory tree
            current_dir = file_dir
            for _ in range(level):
                current_dir = current_dir.parent
            
            # Build the module path
            if module_name_clean:
                module_path = current_dir / module_name_clean.replace('.', '/')
            else:
                module_path = current_dir
            
            # Try to read __init__.py
            init_file = module_path / '__init__.py'
            if init_file.exists():
                with open(init_file, 'r', encoding='utf-8') as f:
                    source = f.read()
                
                tree = ast.parse(source)
                
                # Look for __all__ definition
                for node in ast.walk(tree):
                    if isinstance(node, ast.Assign):
                        for target in node.targets:
                            if isinstance(target, ast.Name) and target.id == '__all__':
                                if isinstance(node.value, (ast.List, ast.Tuple)):
                                    return {
                                        elt.s if isinstance(elt, ast.Str) else elt.value
                                        for elt in node.value.elts
                                        if isinstance(elt, (ast.Str, ast.Constant))
                                    }
                
                # If no __all__, extract all public names
                exports = set()
                for node in ast.walk(tree):
                    if isinstance(node, ast.ImportFrom):
                        for alias in node.names:
                            name = alias.asname if alias.asname else alias.name
                            if not name.startswith('_'):
                                exports.add(name)
                    elif isinstance(node, ast.Import):
                        for alias in node.names:
                            name = alias.asname if alias.asname else alias.name
                            if not name.startswith('_'):
                                exports.add(name)
                    elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                        if not node.name.startswith('_'):
                            exports.add(node.name)
                    elif isinstance(node, ast.Assign):
                        for target in node.targets:
                            if isinstance(target, ast.Name) and not target.id.startswith('_'):
                                exports.add(target.id)
                
                return exports
        
        else:
            # Try to import the module dynamically
            try:
                module = importlib.import_module(module_name)
                
                # Check for __all__
                if hasattr(module, '__all__'):
                    return set(module.__all__)
                
                # Otherwise, return all public attributes
                return {name for name in dir(module) if not name.startswith('_')}
            
            except (ImportError, ModuleNotFoundError):
                # Module not available, return empty set
                return set()
    
    except Exception as e:
        print(f"Warning: Could not inspect module {module_name}: {e}", file=sys.stderr)
        return set()


def analyze_file(file_path: str) -> List[WildcardImport]:
    """
    Analyze a Python file to find wildcard imports and determine used names.
    
    Args:
        file_path: Path to the Python file
        
    Returns:
        List of WildcardImport objects
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            source = f.read()
        
        tree = ast.parse(source, filename=file_path)
        analyzer = WildcardImportAnalyzer(file_path)
        analyzer.visit(tree)
        
        if not analyzer.wildcard_imports:
            return []
        
        # For each wildcard import, determine which names are used
        results = []
        
        for module, line, col in analyzer.wildcard_imports:
            # Get all names exported by the module
            module_exports = get_module_exports(module, file_path)
            
            # Determine which names from this module are actually used
            # (used in file but not defined in file)
            used_from_module = (analyzer.all_used_names - analyzer.defined_names) & module_exports
            
            results.append(WildcardImport(
                file_path=file_path,
                module=module,
                line=line,
                col=col,
                used_names=used_from_module
            ))
        
        return results
        
    except SyntaxError as e:
        print(f"Syntax error in {file_path}: {e}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"Error analyzing {file_path}: {e}", file=sys.stderr)
        return []


def fix_file(file_path: str, wildcard_imports: List[WildcardImport]) -> bool:
    """
    Fix wildcard imports in a file by replacing them with explicit imports.
    
    Args:
        file_path: Path to the Python file
        wildcard_imports: List of wildcard imports to fix
        
    Returns:
        True if file was modified, False otherwise
    """
    if not wildcard_imports:
        return False
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Sort by line number in reverse order to preserve line numbers
        sorted_imports = sorted(wildcard_imports, key=lambda x: x.line, reverse=True)
        
        for imp in sorted_imports:
            line_idx = imp.line - 1  # Convert to 0-based index
            
            if line_idx < 0 or line_idx >= len(lines):
                continue
            
            # Get the original line
            original_line = lines[line_idx]
            
            # Preserve indentation and comments
            indent = len(original_line) - len(original_line.lstrip())
            indent_str = original_line[:indent]
            
            # Check if there's a comment on the line
            comment = ''
            if '#' in original_line:
                comment_idx = original_line.index('#')
                comment = '  ' + original_line[comment_idx:].rstrip()
            
            # Generate the explicit import statement
            if imp.used_names:
                # Sort names for consistency
                sorted_names = sorted(imp.used_names)
                
                # Format the import statement
                if len(sorted_names) <= 3:
                    # Short import - single line
                    names_str = ', '.join(sorted_names)
                    new_line = f"{indent_str}from {imp.module} import {names_str}{comment}\n"
                else:
                    # Long import - multi-line for readability
                    names_str = ',\n'.join(f"{indent_str}    {name}" for name in sorted_names)
                    new_line = f"{indent_str}from {imp.module} import (\n{names_str}\n{indent_str}){comment}\n"
                
                lines[line_idx] = new_line
            else:
                # No names used - remove the import entirely
                lines[line_idx] = f"{indent_str}# Removed unused wildcard import: from {imp.module} import *{comment}\n"
        
        # Write the modified content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        
        return True
        
    except Exception as e:
        print(f"Error fixing {file_path}: {e}", file=sys.stderr)
        return False


def scan_directory(directory: str, exclude_dirs: Set[str] = None) -> List[WildcardImport]:
    """
    Recursively scan a directory for Python files and find wildcard imports.
    
    Args:
        directory: Path to the directory to scan
        exclude_dirs: Set of directory names to exclude
        
    Returns:
        List of all wildcard imports found
    """
    if exclude_dirs is None:
        exclude_dirs = {'venv', '__pycache__', '.pytest_cache', '.ruff_cache', 
                       'node_modules', '.git', '.hypothesis', 'alembic/versions'}
    
    all_wildcards = []
    directory_path = Path(directory)
    
    for root, dirs, files in os.walk(directory_path):
        # Filter out excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
        
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                wildcards = analyze_file(file_path)
                all_wildcards.extend(wildcards)
    
    return all_wildcards


def format_report(wildcard_imports: List[WildcardImport]) -> str:
    """
    Format wildcard imports into a readable report.
    
    Args:
        wildcard_imports: List of wildcard imports
        
    Returns:
        Formatted report string
    """
    if not wildcard_imports:
        return "✓ No wildcard imports found!"
    
    # Group by file
    by_file: Dict[str, List[WildcardImport]] = {}
    for imp in wildcard_imports:
        if imp.file_path not in by_file:
            by_file[imp.file_path] = []
        by_file[imp.file_path].append(imp)
    
    lines = [f"Found {len(wildcard_imports)} wildcard imports in {len(by_file)} files:\n"]
    
    for file_path in sorted(by_file.keys()):
        lines.append(f"\n{file_path}:")
        for imp in sorted(by_file[file_path], key=lambda x: x.line):
            lines.append(f"  Line {imp.line}: from {imp.module} import *")
            if imp.used_names:
                sorted_names = sorted(imp.used_names)
                if len(sorted_names) <= 5:
                    lines.append(f"    → Used names: {', '.join(sorted_names)}")
                else:
                    lines.append(f"    → Used names ({len(sorted_names)}): {', '.join(sorted_names[:5])}, ...")
            else:
                lines.append("    → No names used (import can be removed)")
    
    return '\n'.join(lines)


def main():
    """Main entry point for the resolver."""
    if len(sys.argv) < 2:
        print("Usage: python wildcard_import_resolver.py <file_or_directory>")
        print("       python wildcard_import_resolver.py --check-all")
        print("       python wildcard_import_resolver.py --fix <file_or_directory>")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == '--check-all':
        # Scan the entire backend directory
        backend_dir = Path(__file__).parent.parent
        print(f"Scanning {backend_dir}...")
        wildcards = scan_directory(str(backend_dir))
        report = format_report(wildcards)
        print(report)
        sys.exit(0 if not wildcards else 1)
    
    elif command == '--fix':
        if len(sys.argv) < 3:
            print("Error: --fix requires a file or directory argument")
            sys.exit(1)
        
        target = sys.argv[2]
        
        if os.path.isfile(target):
            # Fix a single file
            print(f"Analyzing {target}...")
            wildcards = analyze_file(target)
            if wildcards:
                print(f"Found {len(wildcards)} wildcard imports. Fixing...")
                if fix_file(target, wildcards):
                    print(f"✓ Fixed {target}")
                else:
                    print(f"✗ Failed to fix {target}")
                    sys.exit(1)
            else:
                print(f"✓ No wildcard imports found in {target}")
        
        elif os.path.isdir(target):
            # Fix all files in directory
            print(f"Scanning {target}...")
            wildcards = scan_directory(target)
            
            if not wildcards:
                print("✓ No wildcard imports found")
                sys.exit(0)
            
            # Group by file
            by_file: Dict[str, List[WildcardImport]] = {}
            for imp in wildcards:
                if imp.file_path not in by_file:
                    by_file[imp.file_path] = []
                by_file[imp.file_path].append(imp)
            
            print(f"Found {len(wildcards)} wildcard imports in {len(by_file)} files. Fixing...")
            
            fixed_count = 0
            for file_path, file_wildcards in by_file.items():
                if fix_file(file_path, file_wildcards):
                    print(f"✓ Fixed {file_path}")
                    fixed_count += 1
                else:
                    print(f"✗ Failed to fix {file_path}")
            
            print(f"\n✓ Fixed {fixed_count}/{len(by_file)} files")
        
        else:
            print(f"Error: {target} is not a valid file or directory")
            sys.exit(1)
    
    else:
        # Scan mode (default)
        target = command
        
        if os.path.isfile(target):
            # Scan a single file
            print(f"Scanning {target}...")
            wildcards = analyze_file(target)
        elif os.path.isdir(target):
            # Scan a directory
            print(f"Scanning {target}...")
            wildcards = scan_directory(target)
        else:
            print(f"Error: {target} is not a valid file or directory")
            sys.exit(1)
        
        # Print report
        report = format_report(wildcards)
        print(report)
        
        # Exit with error code if wildcards found
        sys.exit(0 if not wildcards else 1)


if __name__ == '__main__':
    main()
