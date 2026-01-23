# Python Unused Import Scanner

## Overview

The unused import scanner is a static analysis tool that identifies unused imports in Python files. It uses Python's AST (Abstract Syntax Tree) module to parse files, extract import statements, build a name usage map, and identify imports that are never referenced in the code.

## Features

- **AST-based Analysis**: Uses Python's built-in `ast` module for accurate parsing
- **Comprehensive Import Detection**: Handles both `import` and `from...import` statements
- **Alias Support**: Correctly tracks imports with aliases (e.g., `import numpy as np`)
- **Type Annotation Tracking**: Recognizes imports used in type hints
- **Exception Handler Tracking**: Detects imports used in exception handling
- **Base Class Tracking**: Identifies imports used as base classes
- **Wildcard Import Handling**: Skips wildcard imports (`from module import *`) as usage cannot be determined
- **Recursive Directory Scanning**: Can scan entire directory trees
- **Detailed Reporting**: Groups results by file with line numbers

## Usage

### Scan a Single File

```bash
python scripts/unused_import_scanner.py path/to/file.py
```

### Scan a Directory

```bash
python scripts/unused_import_scanner.py path/to/directory
```

### Scan Entire Backend

```bash
python scripts/unused_import_scanner.py --check-all
```

## Output Format

The scanner produces a detailed report showing:
- Total number of unused imports found
- Number of files with unused imports
- File-by-file breakdown with line numbers
- Import type (simple import vs from import)

Example output:

```
Found 4 unused imports in 1 files:

app/api/admin_subscriptions.py:
  Line 14: from datetime import datetime
  Line 15: from typing import Optional
  Line 16: from uuid import UUID
  Line 23: from app.models.subscription import FeatureOverride
```

## Exit Codes

- `0`: No unused imports found (success)
- `1`: Unused imports found (failure)

This makes the scanner suitable for use in CI/CD pipelines.

## Implementation Details

### Algorithm

1. **Parse File**: Use `ast.parse()` to create an Abstract Syntax Tree
2. **Extract Imports**: Visit all `Import` and `ImportFrom` nodes
3. **Build Usage Map**: Traverse the AST to find all name references
4. **Identify Unused**: Compare imported names against usage map
5. **Report Results**: Format and display unused imports

### AST Visitor

The `ImportUsageAnalyzer` class extends `ast.NodeVisitor` and tracks:

- **Import statements**: `visit_Import()` and `visit_ImportFrom()`
- **Name references**: `visit_Name()` for variable/function usage
- **Attribute access**: `visit_Attribute()` for module.function patterns
- **Type annotations**: `visit_arg()` and `visit_AnnAssign()`
- **Exception handlers**: `visit_ExceptHandler()`
- **Class definitions**: `visit_ClassDef()` for base class tracking

### Special Cases Handled

1. **Import Aliases**: Tracks both original and aliased names
2. **Module Attributes**: Recognizes `module.function()` as usage of `module`
3. **Type Hints**: Counts type annotations as usage
4. **Exception Types**: Counts exception handler types as usage
5. **Base Classes**: Counts class inheritance as usage
6. **Wildcard Imports**: Skips analysis (cannot determine individual usage)

## Testing

The scanner includes comprehensive unit tests covering:

- Simple imports (used and unused)
- From imports (used and unused)
- Import aliases
- Type annotations
- Exception handlers
- Base classes
- Edge cases (empty files, no imports, etc.)
- Real-world scenarios (FastAPI routes, Pydantic models, pytest fixtures)

Run tests:

```bash
cd backend
python -m pytest app/tests/test_unused_import_scanner.py -v
```

## Integration with Technical Debt Cleanup

This scanner is part of the technical debt cleanup specification (task 8.1). It validates:

- **Requirement 5.2**: Ensures all imports in Python files are referenced at least once
- **Property 1**: Import Usage Invariant - all imports must be used

## Limitations

1. **Wildcard Imports**: Cannot determine which names from `from module import *` are used
2. **Dynamic Imports**: Does not detect `__import__()` or `importlib.import_module()`
3. **String References**: Names in strings or comments don't count as usage
4. **Conditional Imports**: May flag imports inside `if TYPE_CHECKING:` blocks

## Future Enhancements

Potential improvements:

- Auto-fix mode to automatically remove unused imports
- Integration with ruff/flake8 for unified linting
- Support for detecting unused imports in `if TYPE_CHECKING:` blocks
- Configurable exclusion patterns
- JSON output format for CI/CD integration

## Related Files

- **Scanner**: `backend/scripts/unused_import_scanner.py`
- **Tests**: `backend/app/tests/test_unused_import_scanner.py`
- **Spec**: `.kiro/specs/technical-debt-cleanup/`

## Requirements Validated

- **Requirement 5.2**: Import statements must be referenced at least once
- **Property 1**: Import Usage Invariant (Python version)
