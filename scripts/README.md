# BizPilot2 Scripts

Build and maintenance scripts for the BizPilot2 monorepo.

## Unused Import Scanner

A TypeScript-based tool that scans the frontend codebase for unused imports using the TypeScript Compiler API.

### Features

- ✅ Scans all TypeScript/TSX files in the frontend
- ✅ Detects unused named imports, default imports, and namespace imports
- ✅ Handles JSX components and type references
- ✅ Generates detailed console output and JSON reports
- ✅ Fully tested with 17 unit tests

### Usage

From the project root:

```bash
# Scan frontend for unused imports
pnpm scan:unused-imports

# Generate JSON report
cd scripts
pnpm scan:unused-imports -- --json=../unused-imports-report.json

# Scan a specific directory
cd scripts
pnpm scan:unused-imports ../frontend/src/components
```

### Output

The scanner provides:

1. **Console Output**: Human-readable list of unused imports per file
2. **JSON Report**: Machine-readable report with detailed information
3. **Exit Code**: Returns 1 if unused imports found, 0 if clean

### Example Output

```
🔍 Scanning directory: ../frontend/src

=== Unused Import Scanner Results ===

Total files scanned: 173
Files with unused imports: 20
Total unused imports: 34

Files with unused imports:

📄 frontend/src/app/(dashboard)/admin/page.tsx
   Line 5: UserX
   Import: import { Users, CreditCard, UserX } from 'lucide-react'
```

### Architecture

The scanner uses the TypeScript Compiler API to:

1. **Parse AST**: Create source file AST for each TypeScript/TSX file
2. **Extract Imports**: Identify all import declarations (named, default, namespace)
3. **Build Usage Map**: Traverse AST to find all identifier usages
4. **Identify Unused**: Compare imports against usage map
5. **Generate Report**: Output results in console and/or JSON format

### Algorithm Details

#### Import Extraction
- Handles named imports: `import { useState } from 'react'`
- Handles default imports: `import React from 'react'`
- Handles namespace imports: `import * as React from 'react'`
- Handles type-only imports: `import type { FC } from 'react'`
- Ignores side-effect imports: `import 'styles.css'`

#### Usage Detection
- Detects identifier usage in code
- Detects JSX element usage: `<Button />`
- Detects type reference usage: `const user: User`
- Detects namespace usage: `React.createElement()`
- Excludes import declarations from usage check

### Testing

Run the test suite:

```bash
cd scripts
pnpm test

# Watch mode
pnpm test:watch
```

Test coverage:
- 17 unit tests covering all major functionality
- Integration tests with temporary file creation
- Edge case handling (empty files, aliased imports, etc.)

### Requirements

Validates **Requirement 1.2** from the Technical Debt Cleanup spec:
> WHEN an import statement exists in a file, THE System SHALL ensure that import is referenced at least once in the file

### Implementation Notes

- Uses TypeScript Compiler API for accurate AST parsing
- Excludes `node_modules`, `.next`, `dist`, `build`, and `__tests__` directories
- Handles Windows and Unix path separators
- Provides detailed line numbers for each unused import
- Distinguishes between type-only and regular imports
- Identifies namespace imports separately

### Future Enhancements

Potential improvements for future iterations:

1. **Auto-fix mode**: Automatically remove unused imports
2. **CI/CD integration**: Fail builds if unused imports detected
3. **Incremental scanning**: Only scan changed files
4. **Configuration file**: Allow custom exclude patterns
5. **IDE integration**: VS Code extension for real-time detection

### Related Tasks

This scanner is part of Task 2.1 in the Technical Debt Cleanup spec:
- Task 2.2: Remove unused imports from frontend files
- Task 2.3: Write property test for import usage invariant
- Task 2.4: Validate frontend imports cleanup
