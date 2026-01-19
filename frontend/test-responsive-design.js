/**
 * Responsive Design Verification Test
 * Tests all marketing pages across different device sizes
 * Verifies design consistency, animations, and interactions
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const PAGES_TO_TEST = [
  '/',
  '/features',
  '/industries', 
  '/pricing',
  '/faq'
];

// Device viewports to test
const VIEWPORTS = {
  mobile: { width: 375, height: 667, deviceScaleFactor: 2 },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  largeDesktop: { width: 1920, height: 1080, deviceScaleFactor: 1 }
};

// Elements to check for responsive behavior
const RESPONSIVE_ELEMENTS = [
  // Navigation
  'nav',
  '[role="navigation"]',
  '.md\\:flex', // Desktop navigation items
  'button[aria-label*="menu"]', // Mobile menu button
  
  // Layout containers
  '.max-w-7xl',
  '.max-w-4xl', 
  '.grid',
  '.flex',
  
  // Marketing specific elements
  '.animate-fade-in-up',
  '.bg-gradient-to-r',
  '.rounded-xl',
  
  // Interactive elements
  'a[href="/auth/register"]',
  'a[href="/auth/login"]',
  'button',
  
  // Content sections
  'section',
  'main',
  'footer'
];

class ResponsiveDesignTester {
  constructor() {
    this.browser = null;
    this.results = {
      passed: 0,
      failed: 0,
      issues: []
    };
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async testPage(url, viewport, viewportName) {
    const page = await this.browser.newPage();
    
    try {
      // Set viewport
      await page.setViewport(viewport);
      
      console.log(`Testing ${url} on ${viewportName} (${viewport.width}x${viewport.height})`);
      
      // Navigate to page
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Wait for animations to complete
      await page.waitForTimeout(2000);
      
      // Test navigation responsiveness
      await this.testNavigation(page, viewportName);
      
      // Test layout elements
      await this.testLayoutElements(page, viewportName, url);
      
      // Test interactive elements
      await this.testInteractiveElements(page, viewportName, url);
      
      // Test animations and transitions
      await this.testAnimations(page, viewportName, url);
      
      // Check for horizontal scroll (should not exist)
      await this.testHorizontalScroll(page, viewportName, url);
      
      // Test mobile menu functionality (mobile only)
      if (viewportName === 'mobile') {
        await this.testMobileMenu(page, url);
      }
      
      this.results.passed++;
      console.log(`✅ ${url} on ${viewportName} - PASSED`);
      
    } catch (error) {
      this.results.failed++;
      this.results.issues.push({
        page: url,
        viewport: viewportName,
        error: error.message
      });
      console.log(`❌ ${url} on ${viewportName} - FAILED: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  async testNavigation(page, viewportName) {
    // Check navigation exists and is visible
    const nav = await page.$('nav');
    if (!nav) {
      throw new Error('Navigation not found');
    }
    
    // Check navigation is sticky
    const navStyles = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      return window.getComputedStyle(nav).position;
    });
    
    if (!navStyles.includes('sticky') && !navStyles.includes('fixed')) {
      throw new Error('Navigation is not sticky/fixed');
    }
    
    // Check mobile vs desktop navigation
    if (viewportName === 'mobile') {
      // Mobile menu button should be visible
      const mobileMenuBtn = await page.$('button[aria-label*="menu"]');
      if (!mobileMenuBtn) {
        throw new Error('Mobile menu button not found');
      }
      
      // Desktop navigation should be hidden
      const desktopNav = await page.$('.md\\:flex');
      if (desktopNav) {
        const isVisible = await page.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none';
        }, desktopNav);
        
        if (isVisible) {
          throw new Error('Desktop navigation visible on mobile');
        }
      }
    } else {
      // Desktop navigation should be visible
      const desktopNav = await page.$('.md\\:flex');
      if (!desktopNav) {
        throw new Error('Desktop navigation not found');
      }
      
      // Mobile menu button should be hidden
      const mobileMenuBtn = await page.$('button[aria-label*="menu"]');
      if (mobileMenuBtn) {
        const isVisible = await page.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none';
        }, mobileMenuBtn);
        
        if (isVisible) {
          throw new Error('Mobile menu button visible on desktop');
        }
      }
    }
  }

  async testLayoutElements(page, viewportName, url) {
    // Check that grid layouts adapt properly
    const grids = await page.$$('.grid');
    for (const grid of grids) {
      const gridStyles = await page.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          gridTemplateColumns: style.gridTemplateColumns,
          display: style.display
        };
      }, grid);
      
      if (gridStyles.display !== 'grid') {
        throw new Error('Grid element not displaying as grid');
      }
    }
    
    // Check container max-widths are respected
    const containers = await page.$$('.max-w-7xl, .max-w-4xl');
    for (const container of containers) {
      const containerWidth = await page.evaluate(el => {
        return el.getBoundingClientRect().width;
      }, container);
      
      // Container should not exceed viewport width
      const viewport = await page.viewport();
      if (containerWidth > viewport.width) {
        throw new Error(`Container width (${containerWidth}px) exceeds viewport width (${viewport.width}px)`);
      }
    }
  }

  async testInteractiveElements(page, viewportName, url) {
    // Test button hover states and interactions
    const buttons = await page.$$('button, a[href*="/auth"]');
    
    for (const button of buttons) {
      // Check button is clickable
      const isClickable = await page.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.pointerEvents !== 'none' && style.display !== 'none';
      }, button);
      
      if (!isClickable) {
        throw new Error('Interactive element not clickable');
      }
      
      // Test hover state (desktop only)
      if (viewportName !== 'mobile') {
        await button.hover();
        await page.waitForTimeout(100); // Wait for hover transition
      }
    }
  }

  async testAnimations(page, viewportName, url) {
    // Check that animation classes are present
    const animatedElements = await page.$$('.animate-fade-in-up, .animate-fade-in, .animate-slide-up');
    
    if (animatedElements.length === 0 && url !== '/') {
      // Most marketing pages should have animations
      console.warn(`No animated elements found on ${url}`);
    }
    
    // Check that animations don't cause layout issues
    for (const element of animatedElements) {
      const elementRect = await page.evaluate(el => {
        return el.getBoundingClientRect();
      }, element);
      
      // Element should be within viewport bounds
      const viewport = await page.viewport();
      if (elementRect.left < 0 || elementRect.right > viewport.width) {
        throw new Error('Animated element extends beyond viewport');
      }
    }
  }

  async testHorizontalScroll(page, viewportName, url) {
    // Check for horizontal scrollbar
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    if (hasHorizontalScroll) {
      throw new Error('Page has horizontal scroll');
    }
  }

  async testMobileMenu(page, url) {
    // Test mobile menu functionality
    const mobileMenuBtn = await page.$('button[aria-label*="menu"]');
    if (!mobileMenuBtn) {
      throw new Error('Mobile menu button not found');
    }
    
    // Click to open menu
    await mobileMenuBtn.click();
    await page.waitForTimeout(500); // Wait for animation
    
    // Check if menu is visible
    const mobileMenu = await page.$('.md\\:hidden .py-4');
    if (!mobileMenu) {
      throw new Error('Mobile menu not found after clicking button');
    }
    
    const isVisible = await page.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.opacity !== '0';
    }, mobileMenu);
    
    if (!isVisible) {
      throw new Error('Mobile menu not visible after clicking button');
    }
    
    // Test menu links
    const menuLinks = await page.$$('.md\\:hidden a');
    if (menuLinks.length === 0) {
      throw new Error('No links found in mobile menu');
    }
    
    // Click to close menu
    await mobileMenuBtn.click();
    await page.waitForTimeout(500); // Wait for animation
  }

  async runAllTests() {
    console.log('🚀 Starting Responsive Design Verification Tests...\n');
    
    for (const pagePath of PAGES_TO_TEST) {
      const url = BASE_URL + pagePath;
      
      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        await this.testPage(url, viewport, viewportName);
      }
      
      console.log(''); // Add spacing between pages
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.passed + this.results.failed,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: `${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`
      },
      issues: this.results.issues,
      testedPages: PAGES_TO_TEST,
      testedViewports: Object.keys(VIEWPORTS)
    };
    
    // Write report to file
    const reportPath = path.join(__dirname, 'responsive-design-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 Test Results Summary:');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Success Rate: ${report.summary.successRate}`);
    
    if (this.results.issues.length > 0) {
      console.log('\n❌ Issues Found:');
      this.results.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.page} (${issue.viewport}): ${issue.error}`);
      });
    } else {
      console.log('\n✅ All responsive design tests passed!');
    }
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    return report;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function main() {
  const tester = new ResponsiveDesignTester();
  
  try {
    await tester.init();
    await tester.runAllTests();
    const report = await tester.generateReport();
    
    // Exit with error code if tests failed
    if (report.summary.failed > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { ResponsiveDesignTester };