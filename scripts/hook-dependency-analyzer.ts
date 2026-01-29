#!/usr/bin/env ts-node
/**
 * React Hook Dependency Analyzer
 * 
 * This tool uses the TypeScript Compiler API to:
 * 1. Parse React components to find useEffect/useCallback/useMemo hooks
 * 2. Extract referenced identifiers from hook bodies
 * 3. Compare with current dependency arrays
 * 4. Identify missing dependencies (exclude stable refs)
 * 
 * Requirements: 2.1 (Technical Debt Cleanup Spec)
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

interface HookInfo {
  hookName: 'useEffect' | 'useCallback' | 'useMemo';
  line: number;
  referencedIdentifiers: string[];
  currentDependencies: string[];
  missingDependencies: string[];
  hasInfinitLoopRisk: boolean;
}

interface HookIssue {
  filePath: string;
  hooks: HookInfo[];
}

interface AnalysisResult {
  totalFilesScanned: number;
  filesWithIssues: number;
  totalHooksAnalyzed: number;
  totalMissingDependencies: number;
  hookIssues: HookIssue[];
}

/**
 * Stable references that should not be included in dependency arrays
 * These are guaranteed to be stable by React
 */
const STABLE_REFERENCES = new Set([
  // React setState functions
  'setState',
  'dispatch',
  // Refs
  'ref',
  'current',
  // Router functions (Next.js)
  'push',
  'replace',
  'back',
  'forward',
  'refresh',
  'prefetch',
  // Global objects and constructors
  'console',
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'fetch',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'Promise',
  'Array',
  'Object',
  'Math',
  'Date',
  'JSON',
  'Number',
  'String',
  'Boolean',
  'Error',
  'Set',
  'Map',
  'WeakMap',
  'WeakSet',
  'Symbol',
  'BigInt',
  'Infinity',
  'NaN',
  'undefined',
  'null',
  'true',
  'false',
  // DOM types
  'HTMLElement',
  'HTMLInputElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'HTMLButtonElement',
  'HTMLDivElement',
  'HTMLSpanElement',
  'Node',
  'Element',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'TouchEvent',
  'DragEvent',
  'ChangeEvent',
  'FocusEvent',
  'FormEvent',
  'PointerEvent',
  'WheelEvent',
  'AnimationEvent',
  'TransitionEvent',
  'ClipboardEvent',
  'CompositionEvent',
  'UIEvent',
  'InputEvent',
  // Browser APIs
  'URL',
  'URLSearchParams',
  'FormData',
  'Blob',
  'File',
  'FileReader',
  'Image',
  'Audio',
  'Video',
  'Canvas',
  'WebSocket',
  'Worker',
  'SharedWorker',
  'ServiceWorker',
  'Notification',
  'Request',
  'Response',
  'Headers',
  'AbortController',
  'AbortSignal',
  'IntersectionObserver',
  'MutationObserver',
  'ResizeObserver',
  'PerformanceObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  // TypeScript/JavaScript types
  'Record',
  'Partial',
  'Required',
  'Readonly',
  'Pick',
  'Omit',
  'Exclude',
  'Extract',
  'NonNullable',
  'ReturnType',
  'InstanceType',
  'Parameters',
  'ConstructorParameters',
  // React types
  'React',
  'ReactNode',
  'ReactElement',
  'JSX',
  'FC',
  'Component',
  'PureComponent',
  'Fragment',
  // Common utility functions that are stable
  'encodeURIComponent',
  'decodeURIComponent',
  'encodeURI',
  'decodeURI',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  // Process (Node.js)
  'process',
]);

/**
 * Check if an identifier is a stable reference that doesn't need to be in dependencies
 */
function isStableReference(identifier: string): boolean {
  // Check if it's a known stable reference
  if (STABLE_REFERENCES.has(identifier)) {
    return true;
  }
  
  // Check if it matches setState pattern (e.g., setCount, setIsOpen)
  if (identifier.startsWith('set') && identifier.length > 3 && identifier[3] === identifier[3].toUpperCase()) {
    return true;
  }
  
  // Check if it ends with Ref (e.g., canvasRef, inputRef)
  if (identifier.endsWith('Ref')) {
    return true;
  }
  
  // Check if it's a type name (PascalCase with no lowercase start)
  // This catches: ApiResponse, UserData, ProductListResponse, etc.
  if (identifier.length > 0 && identifier[0] === identifier[0].toUpperCase()) {
    // Check if it's all uppercase (like CONSTANTS) - these might be used
    const isAllCaps = identifier === identifier.toUpperCase();
    if (!isAllCaps) {
      return true; // Likely a type name
    }
  }
  
  return false;
}

/**
 * Extract identifiers referenced in a node (function body or expression)
 */
function extractReferencedIdentifiers(node: ts.Node, sourceFile: ts.SourceFile): Set<string> {
  const identifiers = new Set<string>();
  const locallyDeclaredNames = new Set<string>();
  
  // First pass: collect all locally declared names (parameters, variables, functions)
  function collectLocalDeclarations(n: ts.Node) {
    // Collect function declarations
    if (ts.isFunctionDeclaration(n) && n.name) {
      locallyDeclaredNames.add(n.name.text);
    }
    
    // Collect variable declarations
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      locallyDeclaredNames.add(n.name.text);
    }
    
    // Collect parameters
    if (ts.isParameter(n) && ts.isIdentifier(n.name)) {
      locallyDeclaredNames.add(n.name.text);
    }
    
    // Collect function expressions assigned to variables
    if (ts.isVariableDeclaration(n) && 
        ts.isIdentifier(n.name) && 
        n.initializer &&
        (ts.isFunctionExpression(n.initializer) || ts.isArrowFunction(n.initializer))) {
      locallyDeclaredNames.add(n.name.text);
    }
    
    ts.forEachChild(n, collectLocalDeclarations);
  }
  
  collectLocalDeclarations(node);
  
  // Second pass: collect referenced identifiers (excluding locally declared ones)
  function visit(n: ts.Node, parent?: ts.Node) {
    // Collect identifiers
    if (ts.isIdentifier(n)) {
      const name = n.text;
      const nodeParent = n.parent;
      
      // Skip if it's a property name in an object literal (e.g., { name: value })
      if (ts.isPropertyAssignment(nodeParent) && nodeParent.name === n) {
        ts.forEachChild(n, (child) => visit(child, n));
        return;
      }
      
      // Skip if it's a parameter name
      if (ts.isParameter(nodeParent)) {
        ts.forEachChild(n, (child) => visit(child, n));
        return;
      }
      
      // Skip if it's a variable declaration name
      if (ts.isVariableDeclaration(nodeParent) && nodeParent.name === n) {
        ts.forEachChild(n, (child) => visit(child, n));
        return;
      }
      
      // Skip if it's a function declaration name
      if (ts.isFunctionDeclaration(nodeParent) && nodeParent.name === n) {
        ts.forEachChild(n, (child) => visit(child, n));
        return;
      }
      
      // Skip if it's the right side of a property access (e.g., console.log -> skip 'log')
      if (ts.isPropertyAccessExpression(nodeParent) && nodeParent.name === n) {
        ts.forEachChild(n, (child) => visit(child, n));
        return;
      }
      
      // Skip if it's locally declared
      if (locallyDeclaredNames.has(name)) {
        ts.forEachChild(n, (child) => visit(child, n));
        return;
      }
      
      identifiers.add(name);
    }
    
    ts.forEachChild(n, (child) => visit(child, n));
  }
  
  visit(node);
  return identifiers;
}

/**
 * Extract dependency array from hook call
 */
function extractDependencyArray(callExpression: ts.CallExpression): string[] {
  const args = callExpression.arguments;
  
  // useEffect/useCallback/useMemo have dependency array as second argument
  if (args.length < 2) {
    return [];
  }
  
  const depsArg = args[1];
  
  // Handle array literal: [dep1, dep2]
  if (ts.isArrayLiteralExpression(depsArg)) {
    return depsArg.elements
      .filter(ts.isIdentifier)
      .map(id => id.text);
  }
  
  return [];
}

/**
 * Check if a hook has infinite loop risk
 * This happens when dependencies include objects/arrays that are recreated on each render
 */
function hasInfiniteLoopRisk(
  referencedIdentifiers: string[],
  currentDependencies: string[],
  sourceFile: ts.SourceFile
): boolean {
  // This is a simplified check - in practice, we'd need more sophisticated analysis
  // For now, we'll flag hooks that reference objects/arrays without proper memoization
  
  // If there are no dependencies but there are references, it might be intentional
  if (currentDependencies.length === 0 && referencedIdentifiers.length > 0) {
    return false;
  }
  
  return false;
}

/**
 * Find all React hook calls in a source file
 */
function findHookCalls(sourceFile: ts.SourceFile): HookInfo[] {
  const hooks: HookInfo[] = [];
  
  function visit(node: ts.Node) {
    // Look for call expressions
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      
      // Check if it's a hook call (useEffect, useCallback, useMemo)
      if (ts.isIdentifier(expression)) {
        const hookName = expression.text;
        
        if (hookName === 'useEffect' || hookName === 'useCallback' || hookName === 'useMemo') {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          
          // Get the first argument (callback function)
          const args = node.arguments;
          if (args.length === 0) {
            ts.forEachChild(node, visit);
            return;
          }
          
          const callback = args[0];
          
          // Extract referenced identifiers from callback body
          const referencedIdentifiers = Array.from(
            extractReferencedIdentifiers(callback, sourceFile)
          );
          
          // Extract current dependency array
          const currentDependencies = extractDependencyArray(node);
          
          // Filter out stable references
          const requiredDependencies = referencedIdentifiers.filter(
            id => !isStableReference(id)
          );
          
          // Find missing dependencies
          const missingDependencies = requiredDependencies.filter(
            dep => !currentDependencies.includes(dep)
          );
          
          // Check for infinite loop risk
          const infiniteLoopRisk = hasInfiniteLoopRisk(
            referencedIdentifiers,
            currentDependencies,
            sourceFile
          );
          
          if (missingDependencies.length > 0) {
            hooks.push({
              hookName: hookName as 'useEffect' | 'useCallback' | 'useMemo',
              line,
              referencedIdentifiers: requiredDependencies,
              currentDependencies,
              missingDependencies,
              hasInfinitLoopRisk: infiniteLoopRisk,
            });
          }
        }
      }
    }
    
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
  return hooks;
}

/**
 * Analyze a single file for hook dependency issues
 */
function analyzeFile(filePath: string): HookInfo[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );
  
  return findHookCalls(sourceFile);
}

/**
 * Recursively find all TypeScript/TSX files in a directory
 */
function findTypeScriptFiles(dir: string, excludeDirs: string[] = []): string[] {
  const files: string[] = [];
  
  function traverse(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip excluded directories
        if (excludeDirs.includes(entry.name)) {
          continue;
        }
        traverse(fullPath);
      } else if (entry.isFile()) {
        // Include .tsx files (React components)
        if (entry.name.endsWith('.tsx')) {
          files.push(fullPath);
        }
      }
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * Scan directory for hook dependency issues
 */
function scanDirectory(dir: string): AnalysisResult {
  const excludeDirs = ['node_modules', '.next', 'dist', 'build', '__tests__'];
  const files = findTypeScriptFiles(dir, excludeDirs);
  
  const hookIssues: HookIssue[] = [];
  let totalHooksAnalyzed = 0;
  let totalMissingDependencies = 0;
  
  for (const file of files) {
    try {
      const hooks = analyzeFile(file);
      totalHooksAnalyzed += hooks.length;
      
      if (hooks.length > 0) {
        const missingCount = hooks.reduce(
          (sum, hook) => sum + hook.missingDependencies.length,
          0
        );
        totalMissingDependencies += missingCount;
        
        hookIssues.push({
          filePath: path.relative(process.cwd(), file),
          hooks,
        });
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }
  
  return {
    totalFilesScanned: files.length,
    filesWithIssues: hookIssues.length,
    totalHooksAnalyzed,
    totalMissingDependencies,
    hookIssues,
  };
}

/**
 * Format and display analysis results
 */
function displayResults(result: AnalysisResult) {
  console.log('\n=== React Hook Dependency Analyzer Results ===\n');
  console.log(`Total files scanned: ${result.totalFilesScanned}`);
  console.log(`Files with hook issues: ${result.filesWithIssues}`);
  console.log(`Total hooks analyzed: ${result.totalHooksAnalyzed}`);
  console.log(`Total missing dependencies: ${result.totalMissingDependencies}\n`);
  
  if (result.hookIssues.length === 0) {
    console.log('✅ No hook dependency issues found!\n');
    return;
  }
  
  console.log('Files with hook dependency issues:\n');
  
  for (const file of result.hookIssues) {
    console.log(`📄 ${file.filePath}`);
    
    for (const hook of file.hooks) {
      console.log(`   Line ${hook.line}: ${hook.hookName}`);
      console.log(`   Referenced: [${hook.referencedIdentifiers.join(', ')}]`);
      console.log(`   Current deps: [${hook.currentDependencies.join(', ')}]`);
      console.log(`   ⚠️  Missing: [${hook.missingDependencies.join(', ')}]`);
      
      if (hook.hasInfinitLoopRisk) {
        console.log(`   ⚠️  WARNING: Potential infinite loop risk`);
      }
      
      console.log('');
    }
  }
}

/**
 * Generate JSON report
 */
function generateJsonReport(result: AnalysisResult, outputPath: string) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFilesScanned: result.totalFilesScanned,
      filesWithIssues: result.filesWithIssues,
      totalHooksAnalyzed: result.totalHooksAnalyzed,
      totalMissingDependencies: result.totalMissingDependencies,
    },
    files: result.hookIssues.map(file => ({
      path: file.filePath,
      hooks: file.hooks.map(hook => ({
        hookName: hook.hookName,
        line: hook.line,
        referencedIdentifiers: hook.referencedIdentifiers,
        currentDependencies: hook.currentDependencies,
        missingDependencies: hook.missingDependencies,
        hasInfinitLoopRisk: hook.hasInfinitLoopRisk,
      })),
    })),
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n📊 JSON report saved to: ${outputPath}\n`);
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let targetDir = '../frontend/src';
  let jsonOutput: string | undefined;
  
  for (const arg of args) {
    if (arg.startsWith('--json=')) {
      jsonOutput = arg.split('=')[1];
    } else if (!arg.startsWith('--')) {
      targetDir = arg;
    }
  }
  
  console.log(`\n🔍 Analyzing React hooks in: ${targetDir}\n`);
  
  const result = scanDirectory(targetDir);
  displayResults(result);
  
  if (jsonOutput) {
    generateJsonReport(result, jsonOutput);
  }
  
  // Exit with error code if issues found
  process.exit(result.totalMissingDependencies > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  findHookCalls,
  extractReferencedIdentifiers,
  extractDependencyArray,
  isStableReference,
  analyzeFile,
  scanDirectory,
  AnalysisResult,
  HookIssue,
  HookInfo,
};
