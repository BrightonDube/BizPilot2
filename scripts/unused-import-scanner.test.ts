/**
 * Unit tests for unused import scanner
 * 
 * Tests the core functionality of the TypeScript/TSX unused import scanner
 * Requirements: 1.2 (Technical Debt Cleanup Spec)
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import {
  extractImportDeclarations,
  buildIdentifierUsageMap,
  identifyUnusedImports,
  ImportInfo,
} from './unused-import-scanner';

describe('Unused Import Scanner', () => {
  describe('extractImportDeclarations', () => {
    it('should extract named imports', () => {
      const code = `import { useState, useEffect } from 'react';`;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);

      expect(imports).toHaveLength(2);
      expect(imports[0].name).toBe('useState');
      expect(imports[1].name).toBe('useEffect');
      expect(imports[0].isNamespaceImport).toBe(false);
    });

    it('should extract default imports', () => {
      const code = `import React from 'react';`;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);

      expect(imports).toHaveLength(1);
      expect(imports[0].name).toBe('React');
      expect(imports[0].isNamespaceImport).toBe(false);
    });

    it('should extract namespace imports', () => {
      const code = `import * as React from 'react';`;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);

      expect(imports).toHaveLength(1);
      expect(imports[0].name).toBe('React');
      expect(imports[0].isNamespaceImport).toBe(true);
    });

    it('should extract type-only imports', () => {
      const code = `import type { FC } from 'react';`;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);

      expect(imports).toHaveLength(1);
      expect(imports[0].name).toBe('FC');
      expect(imports[0].isTypeOnly).toBe(true);
    });

    it('should handle mixed default and named imports', () => {
      const code = `import React, { useState } from 'react';`;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);

      expect(imports).toHaveLength(2);
      expect(imports[0].name).toBe('React');
      expect(imports[1].name).toBe('useState');
    });

    it('should ignore side-effect imports', () => {
      const code = `import 'styles.css';`;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);

      expect(imports).toHaveLength(0);
    });
  });

  describe('buildIdentifierUsageMap', () => {
    it('should detect identifier usage in code', () => {
      const code = `
        import { useState } from 'react';
        const [count, setCount] = useState(0);
      `;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);
      const usageMap = buildIdentifierUsageMap(sourceFile, imports);

      expect(usageMap.has('useState')).toBe(true);
    });

    it('should detect JSX element usage', () => {
      const code = `
        import { Button } from './ui';
        export default function App() {
          return <Button>Click me</Button>;
        }
      `;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);
      const usageMap = buildIdentifierUsageMap(sourceFile, imports);

      expect(usageMap.has('Button')).toBe(true);
    });

    it('should detect type reference usage', () => {
      const code = `
        import type { User } from './types';
        const user: User = { name: 'John' };
      `;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);
      const usageMap = buildIdentifierUsageMap(sourceFile, imports);

      expect(usageMap.has('User')).toBe(true);
    });

    it('should detect namespace usage', () => {
      const code = `
        import * as React from 'react';
        const element = React.createElement('div');
      `;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);
      const usageMap = buildIdentifierUsageMap(sourceFile, imports);

      expect(usageMap.has('React')).toBe(true);
    });

    it('should not detect unused imports', () => {
      const code = `
        import { useState, useEffect } from 'react';
        const [count, setCount] = useState(0);
      `;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);
      const usageMap = buildIdentifierUsageMap(sourceFile, imports);

      expect(usageMap.has('useState')).toBe(true);
      expect(usageMap.has('useEffect')).toBe(false);
    });
  });

  describe('Integration tests', () => {
    it('should identify unused imports in a complete file', () => {
      const code = `
        import React, { useState, useEffect } from 'react';
        import { Button, Card } from './ui';
        
        export default function App() {
          const [count, setCount] = useState(0);
          return <Button>Count: {count}</Button>;
        }
      `;
      
      // Create a temporary file
      const tempFile = path.join(__dirname, 'test-temp.tsx');
      fs.writeFileSync(tempFile, code);
      
      try {
        const unusedImports = identifyUnusedImports(tempFile);
        
        // Should find React, useEffect, and Card as unused
        expect(unusedImports.length).toBeGreaterThan(0);
        
        const unusedNames = unusedImports.map(imp => imp.name);
        expect(unusedNames).toContain('React');
        expect(unusedNames).toContain('useEffect');
        expect(unusedNames).toContain('Card');
        expect(unusedNames).not.toContain('useState');
        expect(unusedNames).not.toContain('Button');
      } finally {
        // Clean up
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });

    it('should handle files with no unused imports', () => {
      const code = `
        import { useState } from 'react';
        
        export default function App() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `;
      
      const tempFile = path.join(__dirname, 'test-temp2.tsx');
      fs.writeFileSync(tempFile, code);
      
      try {
        const unusedImports = identifyUnusedImports(tempFile);
        expect(unusedImports).toHaveLength(0);
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });

    it('should handle JSX components correctly', () => {
      const code = `
        import { Card, CardHeader, CardContent } from './ui';
        
        export default function Dashboard() {
          return (
            <Card>
              <CardHeader>Title</CardHeader>
              <CardContent>Content</CardContent>
            </Card>
          );
        }
      `;
      
      const tempFile = path.join(__dirname, 'test-temp3.tsx');
      fs.writeFileSync(tempFile, code);
      
      try {
        const unusedImports = identifyUnusedImports(tempFile);
        expect(unusedImports).toHaveLength(0);
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle empty files', () => {
      const code = ``;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);
      
      expect(imports).toHaveLength(0);
    });

    it('should handle files with only imports', () => {
      const code = `
        import { useState } from 'react';
        import { Button } from './ui';
      `;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);
      const usageMap = buildIdentifierUsageMap(sourceFile, imports);
      
      expect(imports).toHaveLength(2);
      expect(usageMap.size).toBe(0);
    });

    it('should handle aliased imports', () => {
      const code = `
        import { Settings as SettingsIcon } from 'lucide-react';
        export default function App() {
          return <SettingsIcon />;
        }
      `;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const imports = extractImportDeclarations(sourceFile);
      const usageMap = buildIdentifierUsageMap(sourceFile, imports);
      
      // The import name is 'SettingsIcon' (the alias)
      expect(imports[0].name).toBe('SettingsIcon');
      expect(usageMap.has('SettingsIcon')).toBe(true);
    });
  });
});
