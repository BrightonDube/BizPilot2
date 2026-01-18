/**
 * Quick Responsive Design Check
 * Simplified test focusing on key responsive elements
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 }
};

async function quickResponsiveCheck() {
  console.log('🔍 Quick Responsive Design Check...\n');
  
  const browser = await puppeteer.launch({ headless: false }); // Show browser for visual inspection
  
  try {
    // Test home page only for quick verification
    const page = await browser.newPage();
    
    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      console.log(`📱 Testing ${viewportName} (${viewport.width}x${viewport.height})`);
      
      await page.setViewport(viewport);
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      // Wait a bit for initial render
      await page.waitForTimeout(3000);
      
      // Check for horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      if (hasHorizontalScroll) {
        console.log(`❌ ${viewportName}: Has horizontal scroll`);
      } else {
        console.log(`✅ ${viewportName}: No horizontal scroll`);
      }
      
      // Check navigation visibility
      const navCheck = await page.evaluate((isMobile) => {
        const mobileBtn = document.querySelector('button[aria-label*="menu"]');
        const desktopNav = document.querySelector('.md\\:flex');
        
        if (isMobile) {
          return {
            mobileMenuVisible: mobileBtn && window.getComputedStyle(mobileBtn).display !== 'none',
            desktopNavHidden: !desktopNav || window.getComputedStyle(desktopNav).display === 'none'
          };
        } else {
          return {
            mobileMenuHidden: !mobileBtn || window.getComputedStyle(mobileBtn).display === 'none',
            desktopNavVisible: desktopNav && window.getComputedStyle(desktopNav).display !== 'none'
          };
        }
      }, viewportName === 'mobile');
      
      if (viewportName === 'mobile') {
        if (navCheck.mobileMenuVisible && navCheck.desktopNavHidden) {
          console.log(`✅ ${viewportName}: Navigation correctly shows mobile menu`);
        } else {
          console.log(`❌ ${viewportName}: Navigation issues - mobile menu: ${navCheck.mobileMenuVisible}, desktop nav hidden: ${navCheck.desktopNavHidden}`);
        }
      } else {
        if (navCheck.mobileMenuHidden && navCheck.desktopNavVisible) {
          console.log(`✅ ${viewportName}: Navigation correctly shows desktop menu`);
        } else {
          console.log(`❌ ${viewportName}: Navigation issues - mobile menu hidden: ${navCheck.mobileMenuHidden}, desktop nav visible: ${navCheck.desktopNavVisible}`);
        }
      }
      
      // Check grid layouts
      const gridCheck = await page.evaluate(() => {
        const grids = document.querySelectorAll('.grid');
        let gridIssues = 0;
        
        grids.forEach(grid => {
          const style = window.getComputedStyle(grid);
          if (style.display !== 'grid') {
            gridIssues++;
          }
        });
        
        return { totalGrids: grids.length, issues: gridIssues };
      });
      
      if (gridCheck.issues === 0) {
        console.log(`✅ ${viewportName}: All ${gridCheck.totalGrids} grid layouts working`);
      } else {
        console.log(`❌ ${viewportName}: ${gridCheck.issues}/${gridCheck.totalGrids} grid layouts have issues`);
      }
      
      console.log(''); // Add spacing
    }
    
    // Test mobile menu functionality
    console.log('📱 Testing mobile menu functionality...');
    await page.setViewport(VIEWPORTS.mobile);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const mobileMenuBtn = await page.$('button[aria-label*="menu"]');
    if (mobileMenuBtn) {
      await mobileMenuBtn.click();
      await page.waitForTimeout(1000);
      
      const menuVisible = await page.evaluate(() => {
        const menu = document.querySelector('.md\\:hidden .py-4');
        return menu && window.getComputedStyle(menu).display !== 'none';
      });
      
      if (menuVisible) {
        console.log('✅ Mobile menu opens correctly');
      } else {
        console.log('❌ Mobile menu does not open');
      }
    } else {
      console.log('❌ Mobile menu button not found');
    }
    
    console.log('\n🎉 Quick responsive check completed!');
    console.log('👀 Browser window left open for manual inspection');
    console.log('Press Ctrl+C to close when done inspecting');
    
    // Keep browser open for manual inspection
    await new Promise(() => {}); // Keep running until manually stopped
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Browser will be closed when process is terminated
  }
}

quickResponsiveCheck();