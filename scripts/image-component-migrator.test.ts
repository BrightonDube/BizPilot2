/**
 * Unit tests for Image Component Migrator
 * 
 * Tests the functionality of the image component migrator tool
 * that converts HTML <img> tags to Next.js <Image /> components.
 */

import * as ts from 'typescript';
import {
  extractAttributes,
  determineSizingStrategy,
  generateReplacement,
  findImageElements,
  hasImageImport,
  ImageAttributes,
  SizingStrategy,
} from './image-component-migrator';

describe('Image Component Migrator', () => {
  describe('extractAttributes', () => {
    it('should extract string literal attributes', () => {
      const code = `const x = <img src="test.jpg" alt="Test image" />`;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      
      let element: ts.JsxSelfClosingElement | undefined;
      
      function visit(node: ts.Node) {
        if (ts.isJsxSelfClosingElement(node)) {
          element = node;
        }
        ts.forEachChild(node, visit);
      }
      
      visit(sourceFile);
      
      expect(element).toBeDefined();
      if (element) {
        const attrs = extractAttributes(element);
        expect(attrs.src).toBe('test.jpg');
        expect(attrs.alt).toBe('Test image');
      }
    });
    
    it('should extract JSX expression attributes', () => {
      const code = `const x = <img src={imageSrc} alt={imageAlt} />`;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      
      let element: ts.JsxSelfClosingElement | undefined;
      
      function visit(node: ts.Node) {
        if (ts.isJsxSelfClosingElement(node)) {
          element = node;
        }
        ts.forEachChild(node, visit);
      }
      
      visit(sourceFile);
      
      expect(element).toBeDefined();
      if (element) {
        const attrs = extractAttributes(element);
        expect(attrs.src).toBe('imageSrc');
        expect(attrs.alt).toBe('imageAlt');
      }
    });
    
    it('should extract className and style attributes', () => {
      const code = `const x = <img src="test.jpg" className="rounded-lg" style="border: 1px solid red" />`;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      
      let element: ts.JsxSelfClosingElement | undefined;
      
      function visit(node: ts.Node) {
        if (ts.isJsxSelfClosingElement(node)) {
          element = node;
        }
        ts.forEachChild(node, visit);
      }
      
      visit(sourceFile);
      
      expect(element).toBeDefined();
      if (element) {
        const attrs = extractAttributes(element);
        expect(attrs.className).toBe('rounded-lg');
        expect(attrs.style).toBe('border: 1px solid red');
      }
    });
  });
  
  describe('determineSizingStrategy', () => {
    it('should return fixed strategy when width and height are provided', () => {
      const attrs: ImageAttributes = {
        src: 'test.jpg',
        width: '800',
        height: '600',
      };
      
      const strategy = determineSizingStrategy(attrs);
      
      expect(strategy.type).toBe('fixed');
      expect(strategy.width).toBe(800);
      expect(strategy.height).toBe(600);
    });
    
    it('should return fill strategy for images with w-full class', () => {
      const attrs: ImageAttributes = {
        src: 'test.jpg',
        className: 'w-full h-full object-cover',
      };
      
      const strategy = determineSizingStrategy(attrs);
      
      expect(strategy.type).toBe('fill');
      expect(strategy.fill).toBe(true);
      expect(strategy.sizes).toBeDefined();
    });
    
    it('should return fill strategy for images with absolute positioning', () => {
      const attrs: ImageAttributes = {
        src: 'test.jpg',
        className: 'absolute inset-0',
      };
      
      const strategy = determineSizingStrategy(attrs);
      
      expect(strategy.type).toBe('fill');
      expect(strategy.fill).toBe(true);
    });
    
    it('should return responsive strategy as default', () => {
      const attrs: ImageAttributes = {
        src: 'test.jpg',
        alt: 'Test',
      };
      
      const strategy = determineSizingStrategy(attrs);
      
      expect(strategy.type).toBe('responsive');
      expect(strategy.width).toBeDefined();
      expect(strategy.height).toBeDefined();
      expect(strategy.sizes).toBeDefined();
    });
  });
  
  describe('generateReplacement', () => {
    it('should generate Image component with fixed sizing', () => {
      const attrs: ImageAttributes = {
        src: 'test.jpg',
        alt: 'Test image',
        className: 'rounded-lg',
      };
      
      const sizing: SizingStrategy = {
        type: 'fixed',
        width: 800,
        height: 600,
      };
      
      const replacement = generateReplacement(attrs, sizing);
      
      expect(replacement).toContain('<Image');
      expect(replacement).toContain('src="test.jpg"');
      expect(replacement).toContain('alt="Test image"');
      expect(replacement).toContain('width={800}');
      expect(replacement).toContain('height={600}');
      expect(replacement).toContain('className="rounded-lg"');
    });
    
    it('should generate Image component with fill mode', () => {
      const attrs: ImageAttributes = {
        src: 'test.jpg',
        alt: 'Test image',
        className: 'object-cover',
      };
      
      const sizing: SizingStrategy = {
        type: 'fill',
        fill: true,
        sizes: '100vw',
      };
      
      const replacement = generateReplacement(attrs, sizing);
      
      expect(replacement).toContain('<Image');
      expect(replacement).toContain('fill');
      expect(replacement).toContain('sizes="100vw"');
    });
    
    it('should handle JSX expression attributes', () => {
      const attrs: ImageAttributes = {
        src: '{imageSrc}',
        alt: '{imageAlt}',
      };
      
      const sizing: SizingStrategy = {
        type: 'fixed',
        width: 800,
        height: 600,
      };
      
      const replacement = generateReplacement(attrs, sizing);
      
      expect(replacement).toContain('src={imageSrc}');
      expect(replacement).toContain('alt={imageAlt}');
    });
    
    it('should provide empty alt if not specified', () => {
      const attrs: ImageAttributes = {
        src: 'test.jpg',
      };
      
      const sizing: SizingStrategy = {
        type: 'fixed',
        width: 800,
        height: 600,
      };
      
      const replacement = generateReplacement(attrs, sizing);
      
      expect(replacement).toContain('alt=""');
    });
  });
  
  describe('findImageElements', () => {
    it('should find self-closing img tags', () => {
      const code = `
        export default function Component() {
          return <img src="test.jpg" alt="Test" />;
        }
      `;
      
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const images = findImageElements(sourceFile);
      
      expect(images).toHaveLength(1);
      expect(images[0].attributes.src).toBe('test.jpg');
      expect(images[0].attributes.alt).toBe('Test');
    });
    
    it('should find img tags with closing tags', () => {
      const code = `
        export default function Component() {
          return <img src="test.jpg" alt="Test"></img>;
        }
      `;
      
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const images = findImageElements(sourceFile);
      
      expect(images).toHaveLength(1);
      expect(images[0].attributes.src).toBe('test.jpg');
    });
    
    it('should find multiple img tags', () => {
      const code = `
        export default function Component() {
          return (
            <div>
              <img src="test1.jpg" alt="Test 1" />
              <img src="test2.jpg" alt="Test 2" />
              <img src="test3.jpg" alt="Test 3" />
            </div>
          );
        }
      `;
      
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const images = findImageElements(sourceFile);
      
      expect(images).toHaveLength(3);
    });
    
    it('should not find other JSX elements', () => {
      const code = `
        export default function Component() {
          return (
            <div>
              <button>Click me</button>
              <span>Text</span>
            </div>
          );
        }
      `;
      
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const images = findImageElements(sourceFile);
      
      expect(images).toHaveLength(0);
    });
  });
  
  describe('hasImageImport', () => {
    it('should detect default Image import', () => {
      const code = `
        import Image from 'next/image';
        
        export default function Component() {
          return <Image src="test.jpg" alt="Test" />;
        }
      `;
      
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const hasImport = hasImageImport(sourceFile);
      
      expect(hasImport).toBe(true);
    });
    
    it('should detect named Image import', () => {
      const code = `
        import { Image } from 'next/image';
        
        export default function Component() {
          return <Image src="test.jpg" alt="Test" />;
        }
      `;
      
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const hasImport = hasImageImport(sourceFile);
      
      expect(hasImport).toBe(true);
    });
    
    it('should return false when no Image import exists', () => {
      const code = `
        import React from 'react';
        
        export default function Component() {
          return <img src="test.jpg" alt="Test" />;
        }
      `;
      
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const hasImport = hasImageImport(sourceFile);
      
      expect(hasImport).toBe(false);
    });
    
    it('should return false when importing from different module', () => {
      const code = `
        import Image from 'some-other-library';
        
        export default function Component() {
          return <img src="test.jpg" alt="Test" />;
        }
      `;
      
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      const hasImport = hasImageImport(sourceFile);
      
      expect(hasImport).toBe(false);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle img tags with no attributes', () => {
      const code = `const x = <img />`;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      
      let element: ts.JsxSelfClosingElement | undefined;
      
      function visit(node: ts.Node) {
        if (ts.isJsxSelfClosingElement(node)) {
          element = node;
        }
        ts.forEachChild(node, visit);
      }
      
      visit(sourceFile);
      
      if (element) {
        const attrs = extractAttributes(element);
        expect(Object.keys(attrs).length).toBe(0);
      }
    });
    
    it('should handle complex className expressions', () => {
      const code = `const x = <img src="test.jpg" className={cn("base-class", isActive && "active")} />`;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      
      let element: ts.JsxSelfClosingElement | undefined;
      
      function visit(node: ts.Node) {
        if (ts.isJsxSelfClosingElement(node)) {
          element = node;
        }
        ts.forEachChild(node, visit);
      }
      
      visit(sourceFile);
      
      if (element) {
        const attrs = extractAttributes(element);
        expect(attrs.className).toContain('cn');
      }
    });
    
    it('should handle images with data attributes', () => {
      const code = `const x = <img src="test.jpg" data-testid="hero-image" data-index="0" />`;
      const sourceFile = ts.createSourceFile('test.tsx', code, ts.ScriptTarget.Latest, true);
      
      let element: ts.JsxSelfClosingElement | undefined;
      
      function visit(node: ts.Node) {
        if (ts.isJsxSelfClosingElement(node)) {
          element = node;
        }
        ts.forEachChild(node, visit);
      }
      
      visit(sourceFile);
      
      if (element) {
        const attrs = extractAttributes(element);
        expect(attrs['data-testid']).toBe('hero-image');
        expect(attrs['data-index']).toBe('0');
      }
    });
  });
});
