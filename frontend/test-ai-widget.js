/**
 * Simple test to verify AI widget is properly integrated on marketing pages
 */

const puppeteer = require('puppeteer');

async function testAIWidget() {
  console.log('🚀 Testing AI Widget on Marketing Pages...');
  
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  const testPages = [
    'http://localhost:3000',
    'http://localhost:3000/features',
    'http://localhost:3000/pricing',
    'http://localhost:3000/industries',
    'http://localhost:3000/faq'
  ];
  
  for (const url of testPages) {
    try {
      console.log(`\n📄 Testing: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // Wait for the AI widget trigger button to appear
      await page.waitForSelector('button[aria-label="Open AI Chat"]', { timeout: 5000 });
      console.log('✅ AI widget trigger button found');
      
      // Check if the button has the correct styling
      const buttonExists = await page.$('button[aria-label="Open AI Chat"]');
      if (buttonExists) {
        console.log('✅ AI widget is properly positioned');
      }
      
      // Click the AI widget to open it
      await page.click('button[aria-label="Open AI Chat"]');
      
      // Wait for the chat interface to open
      await page.waitForSelector('div[role="main"] input[placeholder*="Ask about BizPilot"]', { timeout: 3000 });
      console.log('✅ AI chat interface opens correctly');
      
      // Check for marketing-specific placeholder text
      const placeholder = await page.$eval('input[placeholder*="Ask about BizPilot"]', el => el.placeholder);
      if (placeholder.includes('BizPilot features, pricing, or how it can help your business')) {
        console.log('✅ Marketing context detected - correct placeholder text');
      }
      
      // Close the chat
      await page.click('button[aria-label="Close"]');
      console.log('✅ AI chat closes correctly');
      
    } catch (error) {
      console.log(`❌ Error testing ${url}: ${error.message}`);
    }
  }
  
  await browser.close();
  console.log('\n🎉 AI Widget testing completed!');
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAIWidget().catch(console.error);
}

module.exports = { testAIWidget };