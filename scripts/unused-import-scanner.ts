#!/usr/bin/env ts-node
/**
 * Unused Import Scanner for TypeScript/TSX files
 * 
 * This tool uses the TypeScript Compiler API to:
 * 1. Parse AST of TypeScript/TSX files
 * 2. Extract all import declarations
 * 3. Build usage map of identifiers
 * 4. Identify imports that are never referenced
 * 5. Generate list of unused imports per file
 * 
 * Requirements: 1.2 (Technical Debt Cleanup Spec)
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

interface ImportInfo {
  name: string;
  importClause: string;
  line: number;
  isTypeOnly: boolean;
  isNamespaceImport: boolean;
}

interface UnusedImport {
  filePath: string;
  imports: ImportInfo[];
}

interface ScanResult {
  totalFilesScanned: number;
  filesWithUnusedImports: number;
  totalUnusedImports: number;
  unusedImports: UnusedImport[];
}

/**
 * Extract all import declarations from a source file
 */
function extractImportDeclarations(sourceFile: ts.SourceFile): ImportInfo[] {
  const imports: ImportInfo[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const importClause = node.importClause;
      if (!importClause) {
        // Side-effect import like: import 'styles.css'
        ts.forEachChild(node, visit);
        return;
      }

      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const isTypeOnly = node.importClause?.isTypeOnly || false;

      // Handle default import: import React from 'react'
      if (importClause.name) {
        imports.push({
          name: importClause.name.text,
          importClause: node.getText(sourceFile),
          line,
          isTypeOnly,
          isNamespaceImport: false,
        });
      }

      // Handle named imports: import { useState, useEffect } from 'react'
      if (importClause.namedBindings) {
        if (ts.isNamedImports(importClause.namedBindings)) {
          importClause.namedBindings.elements.forEach((element: ts.ImportSpecifier) => {
            imports.push({
              name: element.name.text,
              importClause: node.getText(sourceFile),
              line,
              isTypeOnly: isTypeOnly || element.isTypeOnly,
              isNamespaceImport: false,
            });
          });
        } else if (ts.isNamespaceImport(importClause.namedBindings)) {
          // Handle namespace import: import * as React from 'react'
          imports.push({
            name: importClause.namedBindings.name.text,
            importClause: node.getText(sourceFile),
            line,
            isTypeOnly,
            isNamespaceImport: true,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

/**
 * Build a map of all identifier usages in the source file
 * Returns a Set of identifier names that are used
 */
function buildIdentifierUsageMap(sourceFile: ts.SourceFile, imports: ImportInfo[]): Set<string> {
  const usedIdentifiers = new Set<string>();
  const importNames = new Set(imports.map(imp => imp.name));

  function visit(node: ts.Node) {
    // Skip import declarations themselves
    if (ts.isImportDeclaration(node)) {
      return;
    }

    // Check for identifier usage
    if (ts.isIdentifier(node)) {
      const name = node.text;
      // Only track identifiers that match our imports
      if (importNames.has(name)) {
        usedIdentifiers.add(name);
      }
    }

    // Special handling for JSX elements (e.g., <Button />)
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName;
      if (ts.isIdentifier(tagName) && importNames.has(tagName.text)) {
        usedIdentifiers.add(tagName.text);
      }
    }

    // Special handling for type references
    if (ts.isTypeReferenceNode(node)) {
      const typeName = node.typeName;
      if (ts.isIdentifier(typeName) && importNames.has(typeName.text)) {
        usedIdentifiers.add(typeName.text);
      }
    }

    // Special handling for namespace/qualified names (e.g., React.FC)
    if (ts.isPropertyAccessExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression) && importNames.has(expression.text)) {
        usedIdentifiers.add(expression.text);
      }
    }

    // Handle re-exports: export { Button } from './Button'
    if (ts.isExportDeclaration(node) && node.exportClause) {
      if (ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach(element => {
          const name = element.propertyName?.text || element.name.text;
          if (importNames.has(name)) {
            usedIdentifiers.add(name);
          }
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return usedIdentifiers;
}

/**
 * Identify unused imports in a file
 */
function identifyUnusedImports(filePath: string): ImportInfo[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  const imports = extractImportDeclarations(sourceFile);
  const usedIdentifiers = buildIdentifierUsageMap(sourceFile, imports);

  // Filter out used imports
  const unusedImports = imports.filter(imp => !usedIdentifiers.has(imp.name));

  return unusedImports;
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
        // Include .ts and .tsx files
        if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          files.push(fullPath);
        }
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Scan directory for unused imports
 */
function scanDirectory(dir: string): ScanResult {
  const excludeDirs = ['node_modules', '.next', 'dist', 'build', '__tests__'];
  const files = findTypeScriptFiles(dir, excludeDirs);

  const unusedImports: UnusedImport[] = [];
  let totalUnusedImports = 0;

  for (const file of files) {
    try {
      const unused = identifyUnusedImports(file);
      if (unused.length > 0) {
        unusedImports.push({
          filePath: path.relative(process.cwd(), file),
          imports: unused,
        });
        totalUnusedImports += unused.length;
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  return {
    totalFilesScanned: files.length,
    filesWithUnusedImports: unusedImports.length,
    totalUnusedImports,
    unusedImports,
  };
}

/**
 * Format and display scan results
 */
function displayResults(result: ScanResult) {
  console.log('\n=== Unused Import Scanner Results ===\n');
  console.log(`Total files scanned: ${result.totalFilesScanned}`);
  console.log(`Files with unused imports: ${result.filesWithUnusedImports}`);
  console.log(`Total unused imports: ${result.totalUnusedImports}\n`);

  if (result.unusedImports.length === 0) {
    console.log('✅ No unused imports found!\n');
    return;
  }

  console.log('Files with unused imports:\n');

  for (const file of result.unusedImports) {
    console.log(`📄 ${file.filePath}`);
    for (const imp of file.imports) {
      const typeLabel = imp.isTypeOnly ? ' (type-only)' : '';
      const namespaceLabel = imp.isNamespaceImport ? ' (namespace)' : '';
      console.log(`   Line ${imp.line}: ${imp.name}${typeLabel}${namespaceLabel}`);
      console.log(`   Import: ${imp.importClause}`);
    }
    console.log('');
  }
}

/**
 * Generate JSON report
 */
function generateJsonReport(result: ScanResult, outputPath: string) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFilesScanned: result.totalFilesScanned,
      filesWithUnusedImports: result.filesWithUnusedImports,
      totalUnusedImports: result.totalUnusedImports,
    },
    files: result.unusedImports.map(file => ({
      path: file.filePath,
      unusedImports: file.imports.map(imp => ({
        name: imp.name,
        line: imp.line,
        importClause: imp.importClause,
        isTypeOnly: imp.isTypeOnly,
        isNamespaceImport: imp.isNamespaceImport,
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

  console.log(`\n🔍 Scanning directory: ${targetDir}\n`);

  const result = scanDirectory(targetDir);
  displayResults(result);

  if (jsonOutput) {
    generateJsonReport(result, jsonOutput);
  }

  // Exit with error code if unused imports found
  process.exit(result.totalUnusedImports > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  extractImportDeclarations,
  buildIdentifierUsageMap,
  identifyUnusedImports,
  scanDirectory,
  ScanResult,
  UnusedImport,
  ImportInfo,
}; names (e.g., React.FC)
    if (ts.isPropertyAccessExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression) && importNames.has(expression.text)) {
        usedIdentifiers.add(expression.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return usedIdentifiers;
}

/**
 * Identify unused imports in a file
 */
function identifyUnusedImports(filePath: string): ImportInfo[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  const imports = extractImportDeclarations(sourceFile);
  const usedIdentifiers = buildIdentifierUsageMap(sourceFile, imports);

  // Filter out used imports
  const unusedImports = imports.filter(imp => !usedIdentifiers.has(imp.name));

  return unusedImports;
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
        // Include .ts and .tsx files
        if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          files.push(fullPath);
        }
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Scan directory for unused imports
 */
function scanDirectory(dir: string): ScanResult {
  const excludeDirs = ['node_modules', '.next', 'dist', 'build', '__tests__'];
  const files = findTypeScriptFiles(dir, excludeDirs);

  const unusedImports: UnusedImport[] = [];
  let totalUnusedImports = 0;

  for (const file of files) {
    try {
      const unused = identifyUnusedImports(file);
      if (unused.length > 0) {
        unusedImports.push({
          filePath: path.relative(process.cwd(), file),
          imports: unused,
        });
        totalUnusedImports += unused.length;
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  return {
    totalFilesScanned: files.length,
    filesWithUnusedImports: unusedImports.length,
    totalUnusedImports,
    unusedImports,
  };
}

/**
 * Format and display scan results
 */
function displayResults(result: ScanResult) {
  console.log('\n=== Unused Import Scanner Results ===\n');
  console.log(`Total files scanned: ${result.totalFilesScanned}`);
  console.log(`Files with unused imports: ${result.filesWithUnusedImports}`);
  console.log(`Total unused imports: ${result.totalUnusedImports}\n`);

  if (result.unusedImports.length === 0) {
    console.log('✅ No unused imports found!\n');
    return;
  }

  console.log('Files with unused imports:\n');

  for (const file of result.unusedImports) {
    console.log(`📄 ${file.filePath}`);
    for (const imp of file.imports) {
      const typeLabel = imp.isTypeOnly ? ' (type-only)' : '';
      const namespaceLabel = imp.isNamespaceImport ? ' (namespace)' : '';
      console.log(`   Line ${imp.line}: ${imp.name}${typeLabel}${namespaceLabel}`);
      console.log(`   Import: ${imp.importClause}`);
    }
    console.log('');
  }
}

/**
 * Generate JSON report
 */
function generateJsonReport(result: ScanResult, outputPath: string) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFilesScanned: result.totalFilesScanned,
      filesWithUnusedImports: result.filesWithUnusedImports,
      totalUnusedImports: result.totalUnusedImports,
    },
    files: result.unusedImports.map(file => ({
      path: file.filePath,
      unusedImports: file.imports.map(imp => ({
        name: imp.name,
        line: imp.line,
        importClause: imp.importClause,
        isTypeOnly: imp.isTypeOnly,
        isNamespaceImport: imp.isNamespaceImport,
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

  console.log(`\n🔍 Scanning directory: ${targetDir}\n`);

  const result = scanDirectory(targetDir);
  displayResults(result);

  if (jsonOutput) {
    generateJsonReport(result, jsonOutput);
  }

  // Exit with error code if unused imports found
  process.exit(result.totalUnusedImports > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  extractImportDeclarations,
  buildIdentifierUsageMap,
  identifyUnusedImports,
  scanDirectory,
  ScanResult,
  UnusedImport,
  ImportInfo,
};
