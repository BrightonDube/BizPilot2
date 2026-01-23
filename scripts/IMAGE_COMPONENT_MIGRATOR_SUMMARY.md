# Image Component Migrator Summary

## Overview

The Image Component Migrator is a TypeScript tool that analyzes JSX/TSX files to identify HTML `<img>` tags and provides migration guidance for converting them to Next.js `<Image />` components.

## Purpose

This tool supports **Task 7.1** of the Technical Debt Cleanup specification by:
- Parsing JSX/TSX files to find `<img>` elements
- Extracting attributes (src, alt, className, etc.)
- Determining appropriate sizing strategies (fixed/fill/responsive)
- Generating Image component replacements

## Features

### 1. Attribute Extraction
- Extracts all attributes from `<img>` tags
- Handles both string literals and JSX expressions
- Preserves className, style, and data attributes
- Captures event handlers (onLoad, onError, etc.)

### 2. Sizing Strategy Detection
The tool automatically determines the best sizing strategy:

- **Fixed**: When width and height are explicitly provided
  ```tsx
  <img src="test.jpg" width="800" height="600" />
  → <Image src="test.jpg" width={800} height={600} />
  ```

- **Fill**: When image should fill its container (detected by patterns)
  - Classes: `w-full`, `h-full`, `object-cover`, `object-contain`, `absolute`, `inset-0`
  - Styles: `width: 100%`, `height: 100%`
  ```tsx
  <img src="test.jpg" className="w-full h-full object-cover" />
  → <Image src="test.jpg" fill sizes="100vw" className="w-full h-full object-cover" />
  ```

- **Responsive**: Default fallback with reasonable dimensions
  ```tsx
  <img src="test.jpg" alt="Test" />
  → <Image src="test.jpg" alt="Test" width={800} height={600} sizes="..." />
  ```

### 3. Import Detection
- Checks if `Image` is already imported from `next/image`
- Flags files that need the import added

### 4. Comprehensive Reporting
- Console output with detailed migration suggestions
- JSON report for programmatic processing
- Line and column numbers for easy navigation

## Usage

### Command Line

```bash
# From scripts directory
pnpm exec ts-node image-component-migrator.ts ../frontend/src --json=image-migration-report.json

# Or using the npm script
pnpm scan:image-migration
```

### Programmatic Usage

```typescript
import { scanDirectory, analyzeFile } from './image-component-migrator';

// Scan entire directory
const result = scanDirectory('../frontend/src');
console.log(`Found ${result.totalImagesFound} images in ${result.filesWithImages} files`);

// Analyze single file
const migration = analyzeFile('path/to/component.tsx');
if (migration) {
  console.log(`Found ${migration.images.length} images`);
}
```

## Current Scan Results

**Scan Date**: 2026-01-23

### Summary
- **Total files scanned**: 144
- **Files with img tags**: 3
- **Total img tags found**: 4

### Files Requiring Migration

1. **frontend/src/app/(dashboard)/settings/page.tsx**
   - 1 image (avatar)
   - Strategy: fill
   - Needs Image import

2. **frontend/src/components/ui/image-display.tsx**
   - 2 images
   - Strategy: fill
   - Needs Image import

3. **frontend/src/components/ui/image-input.tsx**
   - 1 image (preview)
   - Strategy: fill
   - Needs Image import

## Migration Notes

When migrating images to Next.js Image component:

1. **Review sizing strategies** - The tool provides suggestions, but you should verify they match your design intent
2. **For fill mode** - Ensure parent element has `position: relative`
3. **Add Image import** - `import Image from 'next/image'`
4. **Test rendering** - Verify images display correctly after migration
5. **Consider priority prop** - Add `priority` for above-the-fold images
6. **Adjust sizes attribute** - Fine-tune the `sizes` attribute based on actual responsive breakpoints

## Testing

The tool includes comprehensive unit tests covering:
- Attribute extraction (string literals and JSX expressions)
- Sizing strategy determination (fixed, fill, responsive)
- Image element detection (self-closing and with closing tags)
- Import detection
- Edge cases (no attributes, complex expressions, data attributes)

Run tests:
```bash
pnpm test image-component-migrator.test.ts
```

**Test Results**: ✅ 22/22 tests passing

## Architecture

The tool follows the same pattern as other scanners in the scripts directory:

```
image-component-migrator.ts
├── extractAttributes()       - Parse JSX attributes
├── determineSizingStrategy() - Analyze sizing patterns
├── generateReplacement()     - Create Image component code
├── findImageElements()       - Locate img tags in AST
├── hasImageImport()          - Check for existing imports
├── analyzeFile()             - Process single file
├── scanDirectory()           - Process directory tree
└── main()                    - CLI entry point
```

## Requirements Validated

This implementation validates the following requirements from the Technical Debt Cleanup spec:

- **Requirement 4.1**: Parse JSX/TSX files to find `<img>` elements ✅
- **Requirement 4.2**: Extract attributes (src, alt, className, etc.) ✅
- **Requirement 4.3**: Determine appropriate sizing strategy ✅
- **Requirement 4.4**: Generate Image component replacements ✅

## Next Steps

The next task (7.2) will use this tool's output to perform the actual migration:
1. Add `import Image from 'next/image'` to files
2. Replace `<img>` tags with `<Image />` components
3. Adjust sizing props as needed
4. Test image rendering
5. Validate with linting and build

## Files Created

- `scripts/image-component-migrator.ts` - Main tool implementation
- `scripts/image-component-migrator.test.ts` - Unit tests
- `scripts/image-migration-report.json` - Scan results
- `scripts/IMAGE_COMPONENT_MIGRATOR_SUMMARY.md` - This document

## Related Documentation

- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [Technical Debt Cleanup Spec](.kiro/specs/technical-debt-cleanup/)
- [Design Document](.kiro/specs/technical-debt-cleanup/design.md)
