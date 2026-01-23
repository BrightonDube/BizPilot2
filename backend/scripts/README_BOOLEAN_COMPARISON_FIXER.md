# Boolean Comparison Fixer

## Overview

The Boolean Comparison Fixer is a Python AST-based tool that identifies and fixes non-Pythonic boolean comparisons in Python code. It enforces Python best practices by replacing explicit boolean comparisons with direct boolean checks.

## Patterns Fixed

| Pattern | Replacement | Example |
|---------|-------------|---------|
| `x == True` | `x` | `if is_active == True:` → `if is_active:` |
| `x == False` | `not x` | `if is_active == False:` → `if not is_active:` |
| `True == x` | `x` | `if True == is_active:` → `if is_active:` |
| `False == x` | `not x` | `if False == is_active:` → `if not is_active:` |

## Features

- **AST-based Analysis**: Uses Python's `ast` module for accurate parsing
- **Attribute Support**: Handles attribute access (e.g., `device.is_active == True`)
- **SQLAlchemy Compatible**: Works with SQLAlchemy query expressions
- **Safe Replacements**: Preserves indentation, formatting, and comments
- **Multiple Fixes**: Can fix multiple comparisons in a single file
- **Error Handling**: Gracefully handles syntax errors and edge cases

## Usage

### Scan Mode (Check Only)

Scan a single file:
```bash
python scripts/boolean_comparison_fixer.py path/to/file.py
```

Scan a directory:
```bash
python scripts/boolean_comparison_fixer.py path/to/directory
```

Scan entire backend:
```bash
python scripts/boolean_comparison_fixer.py --check-all
```

### Fix Mode (Apply Changes)

Fix a single file:
```bash
python scripts/boolean_comparison_fixer.py --fix path/to/file.py
```

Fix all files in a directory:
```bash
python scripts/boolean_comparison_fixer.py --fix path/to/directory
```

Fix entire backend:
```bash
python scripts/boolean_comparison_fixer.py --fix .
```

## Examples

### Before
```python
def get_active_devices(session, business_id):
    stmt = select(Device).where(
        and_(
            Device.business_id == business_id,
            Device.is_active == True
        )
    )
    return session.execute(stmt).scalars().all()
```

### After
```python
def get_active_devices(session, business_id):
    stmt = select(Device).where(
        and_(
            Device.business_id == business_id,
            Device.is_active
        )
    )
    return session.execute(stmt).scalars().all()
```

## Implementation Details

### Architecture

The fixer uses a two-phase approach:

1. **Analysis Phase**: 
   - Parse Python file into AST
   - Visit all `Compare` nodes
   - Identify boolean comparison patterns
   - Extract variable names and line numbers

2. **Fix Phase**:
   - Sort comparisons by line number (reverse order)
   - Replace patterns using string substitution
   - Preserve formatting and indentation
   - Write modified content back to file

### AST Node Visitor

The `BooleanComparisonAnalyzer` class extends `ast.NodeVisitor` and implements:

- `visit_Compare()`: Identifies boolean comparison patterns
- `_get_expression_text()`: Extracts variable names from AST nodes

### Pattern Detection

The fixer detects patterns by checking:
1. Is the comparison operator `==` (equality)?
2. Is one operand a boolean constant (`True` or `False`)?
3. Is the other operand a variable or expression?

### Replacement Strategy

Replacements are applied using string substitution:
- `x == True` → Replace with `x`
- `x == False` → Replace with `not x`
- Reverse order processing preserves line numbers

## Testing

The fixer includes comprehensive unit tests covering:

- ✅ Pattern identification (all 4 patterns)
- ✅ Attribute access (`device.is_active == True`)
- ✅ Multiple comparisons in one file
- ✅ Formatting preservation
- ✅ SQLAlchemy query expressions
- ✅ Clean files (no false positives)
- ✅ Syntax error handling

Run tests:
```bash
python -m pytest app/tests/test_boolean_comparison_fixer.py -v
```

## Integration with Ruff

This fixer addresses Ruff error code **E712**:

```
E712 Avoid equality comparisons to `True`; use `if cond:` for truth checks
```

After running the fixer, verify with:
```bash
python -m ruff check . --select E712
```

## Limitations

1. **String Substitution**: Uses string replacement rather than AST transformation
   - Simpler implementation
   - Preserves formatting better
   - May have edge cases with complex expressions

2. **Single Comparisons Only**: Does not handle chained comparisons like `x == y == True`

3. **No `is` Operator**: Does not flag `x is True` (which is actually acceptable in some contexts)

## Spec Validation

**Feature**: technical-debt-cleanup  
**Task**: 10.1 Implement boolean comparison fixer  
**Validates**: Requirements 6.1, 6.2, 6.3

- ✅ Requirement 6.1: Direct boolean checks instead of equality comparisons
- ✅ Requirement 6.2: Replace `if x == True` with `if x`
- ✅ Requirement 6.3: Replace `if x == False` with `if not x`

## Related Files

- **Script**: `backend/scripts/boolean_comparison_fixer.py`
- **Tests**: `backend/app/tests/test_boolean_comparison_fixer.py`
- **Spec**: `.kiro/specs/technical-debt-cleanup/`

## See Also

- [Unused Import Scanner](README_UNUSED_IMPORT_SCANNER.md)
- [PEP 8 Style Guide](https://pep8.org/#programming-recommendations)
- [Ruff Documentation](https://docs.astral.sh/ruff/rules/comparison-to-true/)
