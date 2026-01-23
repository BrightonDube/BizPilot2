# Wildcard Import Resolver

## Overview

The Wildcard Import Resolver is a Python script that analyzes Python files to identify wildcard imports (`from module import *`) and resolves them to explicit named imports based on actual usage in the file.

## Purpose

Wildcard imports are considered bad practice in Python because:
- They make it unclear which names are being imported
- They can cause namespace pollution
- They make static analysis tools less effective
- They can lead to unexpected behavior when the imported module changes

This tool helps maintain code quality by:
1. Identifying all wildcard imports in the codebase
2. Analyzing which names from the wildcard import are actually used
3. Generating explicit import statements with only the used names
4. Optionally fixing the files automatically

## Implementation

### Algorithm

The resolver follows this algorithm:

1. **Parse Python files** using the AST module to find `from module import *` statements
2. **Build usage map** by traversing the AST to identify all names referenced in the file
3. **Determine module exports** by inspecting the imported module's `__all__` or public attributes
4. **Calculate used names** by intersecting the usage map with module exports
5. **Generate explicit imports** with only the names that are actually used

### Key Features

- **AST-based analysis**: Uses Python's ast module for accurate parsing
- **Module inspection**: Dynamically inspects modules to determine available exports
- **Relative import support**: Handles relative imports (e.g., `from . import *`)
- **Type annotation tracking**: Tracks names used in type annotations
- **Multi-line formatting**: Formats long import lists across multiple lines for readability
- **Comment preservation**: Preserves inline comments when replacing imports

### Special Cases

#### SQLAlchemy Model Registration

For files like `init_test_db.py` and `alembic/env.py`, wildcard imports are used for side effects - they register SQLAlchemy models with `Base.metadata`. In these cases:

- The models are not directly referenced in the code
- The import is needed for its side effect (registration)
- The resolver will detect "no names used" but the import is still necessary

**Solution**: For these files, we should import all model classes explicitly to maintain the registration behavior while eliminating the wildcard import.

## Usage

### Check for wildcard imports

```bash
# Scan entire backend directory
python scripts/wildcard_import_resolver.py --check-all

# Scan specific file
python scripts/wildcard_import_resolver.py path/to/file.py

# Scan specific directory
python scripts/wildcard_import_resolver.py path/to/directory
```

### Fix wildcard imports

```bash
# Fix specific file
python scripts/wildcard_import_resolver.py --fix path/to/file.py

# Fix all files in directory
python scripts/wildcard_import_resolver.py --fix path/to/directory

# Fix entire backend
python scripts/wildcard_import_resolver.py --fix .
```

## Example

### Before

```python
from app.models import *

def create_user():
    user = User(name="John")
    return user
```

### After

```python
from app.models import User

def create_user():
    user = User(name="John")
    return user
```

### Before (Multiple names)

```python
from app.models import *

def process_order():
    order = Order()
    item = OrderItem()
    status = OrderStatus.PENDING
    return order, item, status
```

### After (Multiple names)

```python
from app.models import (
    Order,
    OrderItem,
    OrderStatus
)

def process_order():
    order = Order()
    item = OrderItem()
    status = OrderStatus.PENDING
    return order, item, status
```

## Integration with Ruff

This tool addresses the following Ruff errors:
- **F403**: `from module import *` used; unable to detect undefined names
- **F405**: Name may be undefined, or defined from star imports

After running the resolver, these errors should be eliminated.

## Limitations

1. **Dynamic imports**: Cannot resolve wildcard imports that are constructed dynamically
2. **Side effects**: May not detect imports needed only for side effects (like SQLAlchemy model registration)
3. **Module availability**: Requires the imported module to be available for inspection
4. **Complex relative imports**: May have difficulty with complex relative import patterns

## Best Practices

1. **Review changes**: Always review the changes before committing
2. **Run tests**: Run the test suite after fixing wildcard imports to ensure nothing broke
3. **Check linting**: Run `ruff check` to verify all F403/F405 errors are resolved
4. **Manual verification**: For files with side-effect imports (like model registration), manually verify the explicit imports include all necessary names

## Task Completion

This implementation satisfies:
- **Requirement 7.1**: Replaces wildcard imports with explicit named imports
- **Requirement 7.2**: Identifies all symbols actually used from the imported module
- **Task 11.1**: Implements wildcard import resolver with parsing, usage mapping, and explicit import generation

## Related Files

- `backend/scripts/wildcard_import_resolver.py` - Main implementation
- `backend/init_test_db.py` - File with wildcard import (SQLAlchemy registration)
- `backend/alembic/env.py` - File with wildcard import (SQLAlchemy registration)
- `backend/app/models/__init__.py` - Module being imported with wildcard

## Next Steps

After implementing the resolver:
1. Run the resolver to identify all wildcard imports
2. For SQLAlchemy registration files, manually replace with explicit imports of all models
3. For other files, use the `--fix` option to automatically resolve
4. Run tests to ensure no regressions
5. Run `ruff check` to verify F403/F405 errors are eliminated
