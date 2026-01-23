#!/usr/bin/env ts-node
/**
 * Image Component Migrator
 * 
 * This tool uses the TypeScript Compiler API to:
 * 1. Parse JSX/TSX files to find <img> elements
 * 2. Extract attributes (src, alt, className, etc.)
 * 3. Determine appropriate sizing strategy (fixed/fill/responsive)
 * 4. Generate Image component replacements
 * 
 * Requirements: 4.1, 4.2 (Technical Debt Cleanup Spec)
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

interface ImageAttributes {
  src?: string;
  alt?: string;
  className?: string;
  style?: string;
  width?: string;
  height?: string;
  loading?: string;
  [key: string]: string | undefined;
}

interface SizingStrategy {
  type: 'fixed' | 'fill' | 'responsive';
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
}

interface ImageMigration {
  line: number;
  column: number;
  originalElement: string;
  attributes: ImageAttributes;
  sizingStrategy: SizingStrategy;
  suggestedReplacement: string;
}

interface FileMigration {
  filePath: string;
  needsImageImport: boolean;
  images: ImageMigration[];
}

interface MigrationResult {
  totalFilesScanned: number;
  filesWithImages: number;
  totalImagesFound: number;
  migrations: FileMigration[];
}

/**
 * Extract attributes from a JSX element
 */
function extractAttributes(element: ts.JsxElement | ts.JsxSelfClosingElement): ImageAttributes {
  const attributes: ImageAttributes = {};
  
  const jsxAttributes = ts.isJsxElement(element)
    ? element.openingElement.attributes
    : element.attributes;
  
  jsxAttributes.properties.forEach((prop) => {
    if (ts.isJsxAttribute(prop) && ts.isIdentifier(prop.name)) {
      const name = prop.name.text;
      
      if (prop.initializer) {
        if (ts.isStringLiteral(prop.initializer)) {
          // String literal: src="image.jpg"
          attributes[name] = prop.initializer.text;
        } else if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
          // JSX expression: src={imageSrc}
          attributes[name] = prop.initializer.expression.getText();
        }
      } else {
        // Boolean attribute: loading
        attributes[name] = 'true';
      }
    }
  });
  
  return attributes;
}

/**
 * Determine the appropriate sizing strategy for an image
 */
function determineSizingStrategy(attributes: ImageAttributes): SizingStrategy {
  // Strategy 1: Fixed - when width and height are explicitly provided
  if (attributes.width && attributes.height) {
    const width = parseInt(attributes.width, 10);
    const height = parseInt(attributes.height, 10);
    
    if (!isNaN(width) && !isNaN(height)) {
      return {
        type: 'fixed',
        width,
        height,
      };
    }
  }
  
  // Strategy 2: Fill - when image should fill its container
  // This is a heuristic based on common patterns
  const className = attributes.className || '';
  const style = attributes.style || '';
  
  // Check for common fill patterns in className or style
  const fillPatterns = [
    'w-full',
    'h-full',
    'object-cover',
    'object-contain',
    'absolute',
    'inset-0',
    'width: 100%',
    'height: 100%',
  ];
  
  const hasFillPattern = fillPatterns.some(
    pattern => className.includes(pattern) || style.includes(pattern)
  );
  
  if (hasFillPattern) {
    return {
      type: 'fill',
      fill: true,
      sizes: '100vw', // Default, should be adjusted based on actual usage
    };
  }
  
  // Strategy 3: Responsive - default fallback
  // Use reasonable defaults that can be adjusted
  return {
    type: 'responsive',
    width: 800,
    height: 600,
    sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  };
}

/**
 * Generate the suggested Image component replacement
 */
function generateReplacement(
  attributes: ImageAttributes,
  sizing: SizingStrategy
): string {
  const props: string[] = [];
  
  // Add src (required)
  if (attributes.src) {
    props.push(`src=${attributes.src.startsWith('{') ? attributes.src : `"${attributes.src}"`}`);
  } else {
    props.push('src=""');
  }
  
  // Add alt (required)
  if (attributes.alt) {
    props.push(`alt=${attributes.alt.startsWith('{') ? attributes.alt : `"${attributes.alt}"`}`);
  } else {
    props.push('alt=""');
  }
  
  // Add sizing props
  if (sizing.type === 'fixed' || sizing.type === 'responsive') {
    props.push(`width={${sizing.width}}`);
    props.push(`height={${sizing.height}}`);
    
    if (sizing.sizes) {
      props.push(`sizes="${sizing.sizes}"`);
    }
  } else if (sizing.type === 'fill') {
    props.push('fill');
    
    if (sizing.sizes) {
      props.push(`sizes="${sizing.sizes}"`);
    }
  }
  
  // Add className if present
  if (attributes.className) {
    props.push(
      `className=${attributes.className.startsWith('{') ? attributes.className : `"${attributes.className}"`}`
    );
  }
  
  // Add style if present (though it's better to use className)
  if (attributes.style) {
    props.push(
      `style=${attributes.style.startsWith('{') ? attributes.style : `"${attributes.style}"`}`
    );
  }
  
  // Add other attributes (excluding width/height/loading as they're handled differently)
  Object.keys(attributes).forEach((key) => {
    if (!['src', 'alt', 'className', 'style', 'width', 'height', 'loading'].includes(key)) {
      const value = attributes[key];
      if (value) {
        props.push(
          `${key}=${value.startsWith('{') ? value : `"${value}"`}`
        );
      }
    }
  });
  
  return `<Image ${props.join(' ')} />`;
}

/**
 * Find all <img> JSX elements in a source file
 */
function findImageElements(sourceFile: ts.SourceFile): ImageMigration[] {
  const migrations: ImageMigration[] = [];
  
  function visit(node: ts.Node) {
    // Check for JSX self-closing element: <img />
    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName;
      
      if (ts.isIdentifier(tagName) && tagName.text === 'img') {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const attributes = extractAttributes(node);
        const sizingStrategy = determineSizingStrategy(attributes);
        const suggestedReplacement = generateReplacement(attributes, sizingStrategy);
        
        migrations.push({
          line: position.line + 1,
          column: position.character + 1,
          originalElement: node.getText(sourceFile),
          attributes,
          sizingStrategy,
          suggestedReplacement,
        });
      }
    }
    
    // Check for JSX element with closing tag: <img></img>
    if (ts.isJsxElement(node)) {
      const openingElement = node.openingElement;
      const tagName = openingElement.tagName;
      
      if (ts.isIdentifier(tagName) && tagName.text === 'img') {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const attributes = extractAttributes(node);
        const sizingStrategy = determineSizingStrategy(attributes);
        const suggestedReplacement = generateReplacement(attributes, sizingStrategy);
        
        migrations.push({
          line: position.line + 1,
          column: position.character + 1,
          originalElement: node.getText(sourceFile),
          attributes,
          sizingStrategy,
          suggestedReplacement,
        });
      }
    }
    
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
  return migrations;
}

/**
 * Check if a file already imports Image from next/image
 */
function hasImageImport(sourceFile: ts.SourceFile): boolean {
  let hasImport = false;
  
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      
      if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text === 'next/image') {
        // Check if it imports 'Image'
        const importClause = node.importClause;
        
        if (importClause?.name?.text === 'Image') {
          hasImport = true;
        }
        
        if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
          importClause.namedBindings.elements.forEach((element) => {
            if (element.name.text === 'Image') {
              hasImport = true;
            }
          });
        }
      }
    }
    
    if (!hasImport) {
      ts.forEachChild(node, visit);
    }
  }
  
  visit(sourceFile);
  return hasImport;
}

/**
 * Analyze a single file for image migrations
 */
function analyzeFile(filePath: string): FileMigration | null {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );
  
  const images = findImageElements(sourceFile);
  
  if (images.length === 0) {
    return null;
  }
  
  const needsImageImport = !hasImageImport(sourceFile);
  
  return {
    filePath: path.relative(process.cwd(), filePath),
    needsImageImport,
    images,
  };
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
        // Include .tsx and .jsx files
        if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) {
          files.push(fullPath);
        }
      }
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * Scan directory for image migrations
 */
function scanDirectory(dir: string): MigrationResult {
  const excludeDirs = ['node_modules', '.next', 'dist', 'build', '__tests__'];
  const files = findTypeScriptFiles(dir, excludeDirs);
  
  const migrations: FileMigration[] = [];
  let totalImagesFound = 0;
  
  for (const file of files) {
    try {
      const migration = analyzeFile(file);
      
      if (migration) {
        migrations.push(migration);
        totalImagesFound += migration.images.length;
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }
  
  return {
    totalFilesScanned: files.length,
    filesWithImages: migrations.length,
    totalImagesFound,
    migrations,
  };
}

/**
 * Format and display migration results
 */
function displayResults(result: MigrationResult) {
  console.log('\n=== Image Component Migrator Results ===\n');
  console.log(`Total files scanned: ${result.totalFilesScanned}`);
  console.log(`Files with <img> tags: ${result.filesWithImages}`);
  console.log(`Total <img> tags found: ${result.totalImagesFound}\n`);
  
  if (result.migrations.length === 0) {
    console.log('✅ No <img> tags found! All images are using Next.js Image component.\n');
    return;
  }
  
  console.log('Files requiring migration:\n');
  
  for (const file of result.migrations) {
    console.log(`📄 ${file.filePath}`);
    
    if (file.needsImageImport) {
      console.log(`   ⚠️  Needs import: import Image from 'next/image'`);
    }
    
    console.log(`   Found ${file.images.length} image(s):\n`);
    
    for (const img of file.images) {
      console.log(`   Line ${img.line}, Column ${img.column}:`);
      console.log(`   Original: ${img.originalElement.substring(0, 80)}${img.originalElement.length > 80 ? '...' : ''}`);
      console.log(`   Strategy: ${img.sizingStrategy.type}`);
      
      if (img.sizingStrategy.type === 'fixed' || img.sizingStrategy.type === 'responsive') {
        console.log(`   Size: ${img.sizingStrategy.width}x${img.sizingStrategy.height}`);
      } else if (img.sizingStrategy.type === 'fill') {
        console.log(`   Fill: true, Sizes: ${img.sizingStrategy.sizes}`);
      }
      
      console.log(`   Suggested: ${img.suggestedReplacement.substring(0, 80)}${img.suggestedReplacement.length > 80 ? '...' : ''}`);
      console.log('');
    }
  }
  
  console.log('\n📝 Migration Notes:');
  console.log('   1. Review sizing strategies - adjust width/height/sizes as needed');
  console.log('   2. For fill mode, ensure parent has position: relative');
  console.log('   3. Add Image import: import Image from "next/image"');
  console.log('   4. Test image rendering after migration');
  console.log('   5. Consider using priority prop for above-the-fold images\n');
}

/**
 * Generate JSON report
 */
function generateJsonReport(result: MigrationResult, outputPath: string) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFilesScanned: result.totalFilesScanned,
      filesWithImages: result.filesWithImages,
      totalImagesFound: result.totalImagesFound,
    },
    files: result.migrations.map(file => ({
      path: file.filePath,
      needsImageImport: file.needsImageImport,
      images: file.images.map(img => ({
        line: img.line,
        column: img.column,
        originalElement: img.originalElement,
        attributes: img.attributes,
        sizingStrategy: img.sizingStrategy,
        suggestedReplacement: img.suggestedReplacement,
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
  
  console.log(`\n🔍 Scanning for <img> tags in: ${targetDir}\n`);
  
  const result = scanDirectory(targetDir);
  displayResults(result);
  
  if (jsonOutput) {
    generateJsonReport(result, jsonOutput);
  }
  
  // Exit with error code if images found
  process.exit(result.totalImagesFound > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  findImageElements,
  extractAttributes,
  determineSizingStrategy,
  generateReplacement,
  hasImageImport,
  analyzeFile,
  scanDirectory,
  MigrationResult,
  FileMigration,
  ImageMigration,
  ImageAttributes,
  SizingStrategy,
};
