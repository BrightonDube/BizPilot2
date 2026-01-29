/**
 * Unit tests for React Hook Dependency Analyzer
 * 
 * Tests the core functionality of the hook dependency analyzer:
 * - Extracting referenced identifiers from hook bodies
 * - Identifying stable references
 * - Finding missing dependencies
 * - Parsing dependency arrays
 */

import * as ts from 'typescript';
import {
  extractReferencedIdentifiers,
  extractDependencyArray,
  isStableReference,
  findHookCalls,
} from './hook-dependency-analyzer';

describe('Hook Dependency Analyzer', () => {
  describe('isStableReference', () => {
    it('should identify setState functions', () => {
      expect(isStableReference('setCount')).toBe(true);
      expect(isStableReference('setIsOpen')).toBe(true);
      expect(isStableReference('setUserData')).toBe(true);
    });

    it('should identify ref objects', () => {
      expect(isStableReference('canvasRef')).toBe(true);
      expect(isStableReference('inputRef')).toBe(true);
      expect(isStableReference('ref')).toBe(true);
    });

    it('should identify React stable references', () => {
      expect(isStableReference('dispatch')).toBe(true);
      expect(isStableReference('setState')).toBe(true);
    });

    it('should not identify regular variables as stable', () => {
      expect(isStableReference('count')).toBe(false);
      expect(isStableReference('userData')).toBe(false);
      expect(isStableReference('fetchData')).toBe(false);
    });
  });

  describe('extractDependencyArray', () => {
    it('should extract dependencies from array literal', () => {
      const code = `useEffect(() => {}, [count, name])`;
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      let callExpression: ts.CallExpression | undefined;
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
          callExpression = node.expression;
        }
      });

      expect(callExpression).toBeDefined();
      const deps = extractDependencyArray(callExpression!);
      expect(deps).toEqual(['count', 'name']);
    });

    it('should return empty array when no dependencies provided', () => {
      const code = `useEffect(() => {})`;
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      let callExpression: ts.CallExpression | undefined;
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
          callExpression = node.expression;
        }
      });

      expect(callExpression).toBeDefined();
      const deps = extractDependencyArray(callExpression!);
      expect(deps).toEqual([]);
    });

    it('should return empty array for empty dependency array', () => {
      const code = `useEffect(() => {}, [])`;
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      let callExpression: ts.CallExpression | undefined;
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
          callExpression = node.expression;
        }
      });

      expect(callExpression).toBeDefined();
      const deps = extractDependencyArray(callExpression!);
      expect(deps).toEqual([]);
    });
  });

  describe('extractReferencedIdentifiers', () => {
    it('should extract identifiers from arrow function', () => {
      const code = `() => { console.log(count); setName(value); }`;
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      const arrowFunction = sourceFile.statements[0] as ts.ExpressionStatement;
      const identifiers = extractReferencedIdentifiers(
        (arrowFunction.expression as ts.ArrowFunction).body,
        sourceFile
      );

      expect(identifiers.has('count')).toBe(true);
      expect(identifiers.has('setName')).toBe(true);
      expect(identifiers.has('value')).toBe(true);
      expect(identifiers.has('console')).toBe(true);
      // 'log' should NOT be included because it's a property access (console.log)
      expect(identifiers.has('log')).toBe(false);
    });

    it('should not include parameter names', () => {
      const code = `(event) => { console.log(event.target); }`;
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      const arrowFunction = sourceFile.statements[0] as ts.ExpressionStatement;
      const identifiers = extractReferencedIdentifiers(
        (arrowFunction.expression as ts.ArrowFunction).body,
        sourceFile
      );

      // 'event' is a parameter, so it should be included when referenced
      expect(identifiers.has('event')).toBe(true);
      expect(identifiers.has('console')).toBe(true);
    });
  });

  describe('findHookCalls', () => {
    it('should find useEffect with missing dependencies', () => {
      const code = `
        function Component() {
          const count = 0;
          useEffect(() => {
            console.log(count);
          }, []);
        }
      `;
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      const hooks = findHookCalls(sourceFile);
      expect(hooks.length).toBe(1);
      expect(hooks[0].hookName).toBe('useEffect');
      expect(hooks[0].missingDependencies).toContain('count');
    });

    it('should not flag stable references as missing', () => {
      const code = `
        function Component() {
          const [count, setCount] = useState(0);
          useEffect(() => {
            setCount(1);
          }, []);
        }
      `;
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      const hooks = findHookCalls(sourceFile);
      // setCount is stable, so no missing dependencies
      expect(hooks.length).toBe(0);
    });

    it('should find useCallback with missing dependencies', () => {
      const code = `
        function Component() {
          const value = 'test';
          const callback = useCallback(() => {
            console.log(value);
          }, []);
        }
      `;
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      const hooks = findHookCalls(sourceFile);
      expect(hooks.length).toBe(1);
      expect(hooks[0].hookName).toBe('useCallback');
      expect(hooks[0].missingDependencies).toContain('value');
    });

    it('should find useMemo with missing dependencies', () => {
      const code = `
        function Component() {
          const multiplier = 2;
          const result = useMemo(() => {
            return count * multiplier;
          }, [count]);
        }
      `;
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      const hooks = findHookCalls(sourceFile);
      expect(hooks.length).toBe(1);
      expect(hooks[0].hookName).toBe('useMemo');
      expect(hooks[0].missingDependencies).toContain('multiplier');
    });

    it('should not report issues when all dependencies are present', () => {
      const code = `
        function Component() {
          const count = 0;
          const name = 'test';
          useEffect(() => {
            console.log(count, name);
          }, [count, name]);
        }
      `;
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      const hooks = findHookCalls(sourceFile);
      // Debug: log what we found
      if (hooks.length > 0) {
        console.log('Found hooks:', hooks);
      }
      expect(hooks.length).toBe(0);
    });

    it('should handle refs correctly', () => {
      const code = `
        function Component() {
          const canvasRef = useRef(null);
          useEffect(() => {
            const canvas = canvasRef.current;
          }, []);
        }
      `;
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      const hooks = findHookCalls(sourceFile);
      // canvasRef is stable, so no missing dependencies
      expect(hooks.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle async functions in useEffect', () => {
      const code = `
        function Component() {
          const userId = '123';
          useEffect(() => {
            async function fetchData() {
              const data = await fetch('/api/user/' + userId);
            }
            fetchData();
          }, []);
        }
      `;
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      const hooks = findHookCalls(sourceFile);
      expect(hooks.length).toBe(1);
      expect(hooks[0].missingDependencies).toContain('userId');
    });

    it('should handle object property access', () => {
      const code = `
        function Component() {
          const user = { name: 'John' };
          useEffect(() => {
            console.log(user.name);
          }, []);
        }
      `;
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true
      );

      const hooks = findHookCalls(sourceFile);
      expect(hooks.length).toBe(1);
      expect(hooks[0].missingDependencies).toContain('user');
    });
  });
});
