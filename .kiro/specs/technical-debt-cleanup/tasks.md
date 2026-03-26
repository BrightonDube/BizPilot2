# Implementation Plan: Technical Debt Cleanup

## Overview

This implementation plan addresses 57 frontend lint warnings and 18 backend ruff errors through systematic, validated cleanup operations. Each task includes validation steps to ensure zero regressions. The cleanup is organized into independent modules that can be executed sequentially with rollback capability at each step.

## Tasks

- [x] 1. Setup and baseline validation
  - Create backup branch for safety (`git checkout -b tech-debt-cleanup`)
  - Run and capture baseline metrics: `pnpm lint` (frontend), `python -m ruff check .` (backend)
  - Run and capture baseline test results: `pnpm test` (frontend), `pytest` (backend)
  - Document baseline: 57 frontend warnings, 18 backend errors, X passing tests
  - _Requirements: 9.1, 9.2, 10.1, 10.2_

- [x] 2. Frontend unused imports cleanup
  - [x] 2.1 Implement unused import scanner for TypeScript/TSX files
    - Use TypeScript Compiler API to parse AST
    - Extract all import declarations and build usage map
    - Identify imports that are never referenced
    - Generate list of unused imports per file
    - _Requirements: 1.2_
  
  - [x] 2.2 Remove unused imports from frontend files
    - Process files: UserX, Plus, Edit2, Tag, Badge, Loader2, Package, ArrowUpDown, History, Trash2 imports
    - Apply automated removal using AST transformation
    - Preserve file formatting and comments
    - _Requirements: 1.1, 1.2_
  
  - [x]* 2.3 Write property test for import usage invariant
    - **Property 1: Import Usage Invariant**
    - Generate random TypeScript files with imports
    - Verify all imports are referenced in code
    - **Validates: Requirements 1.2**
  
  - [x] 2.4 Validate frontend imports cleanup
    - Run `pnpm lint` and verify unused import warnings reduced
    - Run `pnpm tsc --noEmit` to check for type errors
    - Run `pnpm build` to ensure build succeeds
    - Run `pnpm test` to ensure tests still pass
    - _Requirements: 1.4, 8.4, 9.1, 9.3_

- [x] 3. Checkpoint - Frontend imports validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. React Hook dependency fixes
  - [x] 4.1 Implement hook dependency analyzer
    - Parse React components to find useEffect/useCallback/useMemo hooks
    - Extract referenced identifiers from hook bodies
    - Compare with current dependency arrays
    - Identify missing dependencies (exclude stable refs)
    - _Requirements: 2.1_
  
  - [x] 4.2 Fix missing dependencies in hooks
    - Process hooks: loadTransactions, fetchOrder, fetchOrders, fetchReportData, fetchProducts, fetchChartData
    - Add missing dependencies to dependency arrays
    - Wrap functions with useCallback where needed
    - Handle complex hooks in shader-background.tsx
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x]* 4.3 Write property test for hook dependency completeness
    - **Property 2: Hook Dependency Completeness**
    - Generate random React components with hooks
    - Verify all referenced identifiers are in dependency arrays
    - **Validates: Requirements 2.1, 2.2, 2.3**
  
  - [x] 4.4 Validate hook dependency fixes
    - Run `pnpm lint` and verify React Hook warnings eliminated
    - Run `pnpm test` to ensure no infinite loops introduced
    - Manually test components with fixed hooks for correct behavior
    - _Requirements: 2.5, 8.3_

- [x] 5. Frontend unused variables cleanup
  - [x] 5.1 Implement unused variable scanner
    - Parse TypeScript files to find variable declarations
    - Build usage map for all identifiers
    - Identify variables that are declared but never used
    - _Requirements: 3.2_
  
  - [x] 5.2 Remove unused variables
    - Process variables: router, formatDate, formatDateTime, formatPercentage, error, billingProvider, etc.
    - Remove unused variable declarations
    - Preserve functionality and formatting
    - _Requirements: 3.1, 3.2_
  
  - [x]* 5.3 Write property test for variable usage invariant
    - **Property 3: Variable Usage Invariant**
    - Generate random TypeScript files with variables
    - Verify all declared variables are referenced
    - **Validates: Requirements 3.2**
  
  - [x] 5.4 Validate unused variables cleanup
    - Run `pnpm lint` and verify unused variable warnings eliminated
    - Run `pnpm test` to ensure tests still pass
    - _Requirements: 3.1, 3.3, 8.3_

- [x] 6. Checkpoint - Frontend cleanup validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Next.js Image component migration
  - [x] 7.1 Implement image component migrator
    - Parse JSX/TSX files to find <img> elements
    - Extract attributes (src, alt, className, etc.)
    - Determine appropriate sizing strategy (fixed/fill/responsive)
    - Generate Image component replacements
    - _Requirements: 4.1, 4.2_
  
  - [x] 7.2 Migrate img tags to Image components
    - Process files: image-display.tsx, image-input.tsx
    - Replace <img> with Next.js <Image />
    - Add Image imports from 'next/image'
    - Configure width/height or fill props appropriately
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x]* 7.3 Write property test for image component migration
    - **Property 4: Image Component Migration Completeness**
    - **Property 5: Image Attribute Preservation**
    - **Property 6: Image Component Sizing**
    - Verify no img tags remain in codebase
    - Verify all attributes preserved during migration
    - Verify all Image components have proper sizing
    - **Validates: Requirements 4.1, 4.2, 4.3**
  
  - [x] 7.4 Validate image migration
    - Run `pnpm lint` to check for any new warnings
    - Run `pnpm build` to ensure build succeeds
    - Visually test image rendering in development
    - Run `pnpm test` to ensure tests still pass
    - _Requirements: 4.4, 8.4_

- [x] 8. Backend unused imports cleanup
  - [x] 8.1 Implement Python unused import scanner
    - Parse Python files using AST module
    - Extract all import statements (import and from...import)
    - Build name usage map by traversing AST
    - Identify unused imports
    - _Requirements: 5.2_
  
  - [x] 8.2 Remove unused imports from backend files
    - Process files: admin_subscriptions.py, deps.py, mobile_sync.py, permissions.py, subscription.py, subscription_tier_improved.py, device_service.py
    - Remove unused imports: datetime, Optional, UUID, FeatureOverride, DeviceLimitExceeded, DeviceService, AsyncSession, get_db, BusinessSubscription
    - Process test files: remove unused get_permission_service, inspect, Base, Business
    - _Requirements: 5.1, 5.2_
  
  - [x]* 8.3 Write property test for Python import usage
    - **Property 1: Import Usage Invariant** (Python version)
    - Generate random Python files with imports
    - Verify all imports are referenced in code
    - **Validates: Requirements 5.2**
  
  - [x] 8.4 Validate backend imports cleanup
    - Run `python -m ruff check .` and verify unused import errors reduced
    - Run `mypy .` to check for type errors
    - Run `pytest` to ensure all tests still pass
    - _Requirements: 5.1, 5.4, 8.5, 9.2, 9.4_

- [x] 9. Checkpoint - Backend imports validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Backend boolean comparison fixes
  - [x] 10.1 Implement boolean comparison fixer
    - Parse Python files to find Compare AST nodes
    - Identify patterns: `x == True`, `x == False`, `True == x`, `False == x`
    - Generate replacements: `x` or `not x`
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 10.2 Fix boolean comparisons in device_service.py
    - Replace `== True` with direct boolean checks
    - Replace `== False` with `not` operator
    - Preserve logical behavior
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x]* 10.3 Write property test for boolean comparison style
    - **Property 7: Boolean Comparison Pythonic Style**
    - Verify no `== True` or `== False` patterns exist
    - Verify logical behavior unchanged
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
  
  - [x] 10.4 Validate boolean comparison fixes
    - Run `python -m ruff check .` and verify errors eliminated
    - Run `pytest` to ensure behavior unchanged
    - _Requirements: 6.4, 8.3_

- [x] 11. Backend wildcard import resolution
  - [x] 11.1 Implement wildcard import resolver
    - Parse Python files to find `from module import *` statements
    - Build usage map to identify which names are actually used
    - Generate explicit import statements with used names
    - _Requirements: 7.1, 7.2_
  
  - [x] 11.2 Resolve wildcard import in init_test_db.py
    - Identify all symbols used from the wildcard import
    - Replace `from module import *` with explicit imports
    - Verify all used symbols are included
    - _Requirements: 7.1, 7.2_
  
  - [x]* 11.3 Write property test for wildcard import resolution
    - **Property 8: Wildcard Import Resolution**
    - Verify no wildcard imports remain
    - Verify explicit imports include exactly used symbols
    - **Validates: Requirements 7.1, 7.2**
  
  - [x] 11.4 Validate wildcard import resolution
    - Run `python -m ruff check .` and verify F403 errors eliminated
    - Run `pytest` to ensure tests still pass
    - _Requirements: 7.3, 8.3_

- [x] 12. Checkpoint - Backend cleanup validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Final validation and verification
  - [x] 13.1 Run complete frontend validation suite
    - Run `pnpm lint` and verify 0 warnings, 0 errors
    - Run `pnpm tsc --noEmit` and verify 0 type errors
    - Run `pnpm build` and verify successful build
    - Run `pnpm test` and verify all tests pass
    - _Requirements: 9.1, 9.3, 8.4, 10.1_
  
  - [x] 13.2 Run complete backend validation suite
    - Run `python -m ruff check .` and verify 0 errors
    - Run `mypy .` and verify 0 type errors
    - Run `pytest` and verify all tests pass
    - _Requirements: 9.2, 9.4, 10.2_
  
  - [x]* 13.3 Write property test for backward compatibility
    - **Property 9: Backward Compatibility Preservation**
    - **Property 10: Semantic Equivalence**
    - Compare test results before and after cleanup
    - Verify same number of passing tests
    - **Validates: Requirements 1.3, 3.3, 5.3, 6.4, 8.1, 8.2, 10.4**
  
  - [x] 13.4 Generate cleanup report
    - Document total files processed
    - Document total changes applied by category
    - Document validation results (all passing)
    - Document before/after metrics (57→0 frontend warnings, 18→0 backend errors)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 14. Final checkpoint and merge preparation
  - Ensure all tests pass, ask the user if questions arise.
  - Verify production-ready state (all quality gates passed)
  - Prepare for merge to dev branch

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster completion
- Each cleanup category is independent and can be rolled back if validation fails
- Validation steps are critical - never skip them
- All changes must preserve backward compatibility (verified through test suite)
- The cleanup follows a validate-fix-validate pattern for safety
- Backup branch created at start allows easy rollback if needed
- Frontend uses TypeScript/Next.js, Backend uses Python/FastAPI
- Use `pnpm` for all frontend commands (never npm or yarn)
- Run commands from monorepo root or specific workspace directories
