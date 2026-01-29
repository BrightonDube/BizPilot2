#!/usr/bin/env python3
"""
Python Boolean Comparison Fixer

This script analyzes Python files to identify and fix non-Pythonic boolean comparisons.
It parses files using the AST module, finds Compare nodes with boolean comparisons,
and generates replacements following Python best practices.

Patterns fixed:
- x == True  → x
- x == False → not x
- True == x  → x
- False == x → not x

Usage:
    python boolean_comparison_fixer.py <file_or_directory>
    python boolean_comparison_fixer.py --check-all  # Scan entire backend directory
    python boolean_comparison_fixer.py --fix <file>  # Fix issues in file
"""

import ast
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Set


@dataclass
class BooleanComparison:
    """Information about a boolean comparison that needs fixing."""
    file_path: str
    line: int
    col: int
    pattern: str  # 'x == True', 'x == False', 'True == x', 'False == x'
    variable: str  # The variable being compared
    replacement: str  # The suggested replacement


class BooleanComparisonAnalyzer(ast.NodeVisitor):
    """AST visitor that finds boolean comparisons."""
    
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.comparisons: List[BooleanComparison] = []
        self.source_lines: List[str] = []
        
    def visit_Compare(self, node: ast.Compare) -> None:
        """Visit a Compare node to check for boolean comparisons."""
        # We only handle single comparisons (not chained like x == y == z)
        if len(node.ops) == 1 and len(node.comparators) == 1:
            op = node.ops[0]
            left = node.left
            right = node.comparators[0]
            
            # Check if this is an equality comparison
            if isinstance(op, ast.Eq):
                # Pattern 1: x == True
                if isinstance(right, ast.Constant) and right.value is True:
                    var_name = self._get_expression_text(left)
                    self.comparisons.append(BooleanComparison(
                        file_path=self.file_path,
                        line=node.lineno,
                        col=node.col_offset,
                        pattern=f'{var_name} == True',
                        variable=var_name,
                        replacement=var_name
                    ))
                
                # Pattern 2: x == False
                elif isinstance(right, ast.Constant) and right.value is False:
                    var_name = self._get_expression_text(left)
                    self.comparisons.append(BooleanComparison(
                        file_path=self.file_path,
                        line=node.lineno,
                        col=node.col_offset,
                        pattern=f'{var_name} == False',
                        variable=var_name,
                        replacement=f'not {var_name}'
                    ))
                
                # Pattern 3: True == x
                elif isinstance(left, ast.Constant) and left.value is True:
                    var_name = self._get_expression_text(right)
                    self.comparisons.append(BooleanComparison(
                        file_path=self.file_path,
                        line=node.lineno,
                        col=node.col_offset,
                        pattern=f'True == {var_name}',
                        variable=var_name,
                        replacement=var_name
                    ))
                
                # Pattern 4: False == x
                elif isinstance(left, ast.Constant) and left.value is False:
                    var_name = self._get_expression_text(right)
                    self.comparisons.append(BooleanComparison(
                        file_path=self.file_path,
                        line=node.lineno,
                        col=node.col_offset,
                        pattern=f'False == {var_name}',
                        variable=var_name,
                        replacement=f'not {var_name}'
                    ))
        
        self.generic_visit(node)
    
    def _get_expression_text(self, node: ast.AST) -> str:
        """
        Get the text representation of an AST node.
        For simple cases, reconstruct the expression.
        """
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            # Handle attribute access like obj.attr
            value = self._get_expression_text(node.value)
            return f'{value}.{node.attr}'
        elif isinstance(node, ast.Subscript):
            # Handle subscript like obj[key]
            value = self._get_expression_text(node.value)
            slice_val = self._get_expression_text(node.slice)
            return f'{value}[{slice_val}]'
        elif isinstance(node, ast.Call):
            # Handle function calls
            func = self._get_expression_text(node.func)
            return f'{func}(...)'
        elif isinstance(node, ast.Constant):
            return repr(node.value)
        else:
            # For complex expressions, use ast.unparse if available (Python 3.9+)
            try:
                return ast.unparse(node)
            except AttributeError:
                # Fallback for older Python versions
                return '<expression>'


def analyze_file(file_path: str) -> List[BooleanComparison]:
    """
    Analyze a Python file to find boolean comparisons.
    
    Args:
        file_path: Path to the Python file
        
    Returns:
        List of BooleanComparison objects
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            source = f.read()
        
        tree = ast.parse(source, filename=file_path)
        analyzer = BooleanComparisonAnalyzer(file_path)
        analyzer.source_lines = source.splitlines()
        analyzer.visit(tree)
        
        return analyzer.comparisons
        
    except SyntaxError as e:
        print(f"Syntax error in {file_path}: {e}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"Error analyzing {file_path}: {e}", file=sys.stderr)
        return []


def fix_file(file_path: str, comparisons: List[BooleanComparison]) -> bool:
    """
    Fix boolean comparisons in a file.
    
    Args:
        file_path: Path to the Python file
        comparisons: List of comparisons to fix
        
    Returns:
        True if file was modified, False otherwise
    """
    if not comparisons:
        return False
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            source = f.read()
        
        # Sort comparisons by line number in reverse order
        # This ensures we fix from bottom to top, preserving line numbers
        sorted_comparisons = sorted(comparisons, key=lambda x: x.line, reverse=True)
        
        lines = source.splitlines(keepends=True)
        
        for comp in sorted_comparisons:
            line_idx = comp.line - 1  # Convert to 0-based index
            if line_idx < 0 or line_idx >= len(lines):
                continue
            
            line = lines[line_idx]
            
            # Build the exact pattern to replace
            if 'True' in comp.pattern:
                # Pattern: x == True or True == x
                if comp.pattern.startswith('True =='):
                    # True == x → x
                    pattern = f'True == {comp.variable}'
                    lines[line_idx] = line.replace(pattern, comp.variable)
                else:
                    # x == True → x
                    pattern = f'{comp.variable} == True'
                    lines[line_idx] = line.replace(pattern, comp.variable)
            
            elif 'False' in comp.pattern:
                # Pattern: x == False or False == x
                if comp.pattern.startswith('False =='):
                    # False == x → not x
                    pattern = f'False == {comp.variable}'
                    lines[line_idx] = line.replace(pattern, f'not {comp.variable}')
                else:
                    # x == False → not x
                    pattern = f'{comp.variable} == False'
                    lines[line_idx] = line.replace(pattern, f'not {comp.variable}')
        
        # Write the modified content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        
        return True
        
    except Exception as e:
        print(f"Error fixing {file_path}: {e}", file=sys.stderr)
        return False


def scan_directory(directory: str, exclude_dirs: Set[str] = None) -> List[BooleanComparison]:
    """
    Recursively scan a directory for Python files and find boolean comparisons.
    
    Args:
        directory: Path to the directory to scan
        exclude_dirs: Set of directory names to exclude
        
    Returns:
        List of all boolean comparisons found
    """
    if exclude_dirs is None:
        exclude_dirs = {'venv', '__pycache__', '.pytest_cache', '.ruff_cache', 
                       'node_modules', '.git', '.hypothesis', 'alembic/versions'}
    
    all_comparisons = []
    directory_path = Path(directory)
    
    for root, dirs, files in os.walk(directory_path):
        # Filter out excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
        
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                comparisons = analyze_file(file_path)
                all_comparisons.extend(comparisons)
    
    return all_comparisons


def format_report(comparisons: List[BooleanComparison]) -> str:
    """
    Format boolean comparisons into a readable report.
    
    Args:
        comparisons: List of boolean comparisons
        
    Returns:
        Formatted report string
    """
    if not comparisons:
        return "✓ No boolean comparison issues found!"
    
    # Group by file
    by_file = {}
    for comp in comparisons:
        if comp.file_path not in by_file:
            by_file[comp.file_path] = []
        by_file[comp.file_path].append(comp)
    
    lines = [f"Found {len(comparisons)} boolean comparison issues in {len(by_file)} files:\n"]
    
    for file_path in sorted(by_file.keys()):
        lines.append(f"\n{file_path}:")
        for comp in sorted(by_file[file_path], key=lambda x: x.line):
            lines.append(f"  Line {comp.line}: {comp.pattern}")
            lines.append(f"    → Suggested fix: {comp.replacement}")
    
    return '\n'.join(lines)


def main():
    """Main entry point for the fixer."""
    if len(sys.argv) < 2:
        print("Usage: python boolean_comparison_fixer.py <file_or_directory>")
        print("       python boolean_comparison_fixer.py --check-all")
        print("       python boolean_comparison_fixer.py --fix <file_or_directory>")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == '--check-all':
        # Scan the entire backend directory
        backend_dir = Path(__file__).parent.parent
        print(f"Scanning {backend_dir}...")
        comparisons = scan_directory(str(backend_dir))
        report = format_report(comparisons)
        print(report)
        sys.exit(0 if not comparisons else 1)
    
    elif command == '--fix':
        if len(sys.argv) < 3:
            print("Error: --fix requires a file or directory argument")
            sys.exit(1)
        
        target = sys.argv[2]
        
        if os.path.isfile(target):
            # Fix a single file
            print(f"Analyzing {target}...")
            comparisons = analyze_file(target)
            if comparisons:
                print(f"Found {len(comparisons)} issues. Fixing...")
                if fix_file(target, comparisons):
                    print(f"✓ Fixed {target}")
                else:
                    print(f"✗ Failed to fix {target}")
                    sys.exit(1)
            else:
                print(f"✓ No issues found in {target}")
        
        elif os.path.isdir(target):
            # Fix all files in directory
            print(f"Scanning {target}...")
            comparisons = scan_directory(target)
            
            if not comparisons:
                print("✓ No issues found")
                sys.exit(0)
            
            # Group by file
            by_file = {}
            for comp in comparisons:
                if comp.file_path not in by_file:
                    by_file[comp.file_path] = []
                by_file[comp.file_path].append(comp)
            
            print(f"Found {len(comparisons)} issues in {len(by_file)} files. Fixing...")
            
            fixed_count = 0
            for file_path, file_comparisons in by_file.items():
                if fix_file(file_path, file_comparisons):
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
            comparisons = analyze_file(target)
        elif os.path.isdir(target):
            # Scan a directory
            print(f"Scanning {target}...")
            comparisons = scan_directory(target)
        else:
            print(f"Error: {target} is not a valid file or directory")
            sys.exit(1)
        
        # Print report
        report = format_report(comparisons)
        print(report)
        
        # Exit with error code if issues found
        sys.exit(0 if not comparisons else 1)


if __name__ == '__main__':
    main()
