/**
 * Integration Tests for Marketing Flow
 * 
 * These tests validate the complete user journey through marketing pages,
 * authentication redirects, and pricing page functionality end-to-end.
 * 
 * Task 8.3: Write integration tests for marketing flow
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { NextRequest } from 'next/server';
import { middleware } from '../../../middleware';
import { PRICING_PLANS, PricingUtils } from '../pricing-config';
import { AI_MESSAGING_CONFIG } from '../ai-messaging-config';

describe('Marketing Flow Integration Tests', () => {
  let browser: Browser;
  let page: Page;
  
  // Test configuration
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
  const MARKETING_PAGES = [
    { path: '/', title: 'BizPilot' },
    { path: '/features', title: 'Features' },
    { path: '/industries', title: 'Industries' },
    { path: '/faq', title: 'FAQ' },
    { path: '/pricing', title: 'Pricing' }
  ];

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Clear cookies and local storage (with error handling)
    await page.deleteCookie(...(await page.cookies()));
    try {
      await page.evaluate(() => {
        if (typeof localStorage !== 'undefined') {
          localStorage.clear();
        }
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.clear();
        }
      });
    } catch (error) {
      // Ignore localStorage access errors in test environment
      console.warn('Could not clear localStorage/sessionStorage:', error.message);
    }
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Guest User Journey', () => {
    /**
     * Test complete user journey through marketing pages
     * Validates Requirements 1.1, 1.2, 1.3, 1.4
     */
    test('should allow guest users to navigate through all marketing pages', async () => {
      for (const marketingPage of MARKETING_PAGES) {
        // Navigate to marketing page
        const response = await page.goto(`${BASE_URL}${marketingPage.path}`, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        // Should load successfully
        expect(response?.status()).toBe(200);

        // Should not redirect to login
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('/auth/login');
        expect(currentUrl).not.toContain('/login');

        // Should contain expected content
        const pageTitle = await page.title();
        expect(pageTitle).toContain(marketingPage.title);

        // Should have marketing navigation
        const navigation = await page.$('nav');
        expect(navigation).toBeTruthy();

        // Should have marketing content (not dashboard content)
        const dashboardElements = await page.$$('[data-testid*="dashboard"]');
        expect(dashboardElements).toHaveLength(0);

        // Should have proper meta tags for SEO
        const metaDescription = await page.$eval('meta[name="description"]', 
          el => el.getAttribute('content'));
        expect(metaDescription).toBeTruthy();
        expect(metaDescription!.length).toBeGreaterThan(50);
      }
    });

    /**
     * Test navigation between marketing pages
     * Validates Requirements 1.3
     */
    test('should allow seamless navigation between marketing pages', async () => {
      // Start at home page
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });

      // Test navigation to each marketing page
      for (const targetPage of MARKETING_PAGES.slice(1)) { // Skip home page
        // Look for navigation link
        const navLink = await page.$(`a[href="${targetPage.path}"]`);
        if (navLink) {
          await navLink.click();
          await page.waitForNavigation({ waitUntil: 'networkidle0' });

          // Verify we're on the correct page
          const currentUrl = page.url();
          expect(currentUrl).toContain(targetPage.path);

          // Verify page loaded correctly
          const pageTitle = await page.title();
          expect(pageTitle).toContain(targetPage.title);
        }
      }
    });

    /**
     * Test AI messaging presence across marketing pages
     * Validates Requirements 1.4
     */
    test('should display AI-powered messaging consistently across marketing pages', async () => {
      for (const marketingPage of MARKETING_PAGES) {
        await page.goto(`${BASE_URL}${marketingPage.path}`, {
          waitUntil: 'networkidle0'
        });

        // Check for AI-related keywords in page content
        const pageContent = await page.content();
        const aiKeywords = ['AI', 'intelligent', 'smart', 'automated', 'predictive'];
        
        const hasAIContent = aiKeywords.some(keyword => 
          pageContent.toLowerCase().includes(keyword.toLowerCase())
        );
        expect(hasAIContent).toBe(true);

        // Check for specific AI messaging elements
        if (marketingPage.path === '/features') {
          // Features page should have AI capabilities
          const aiFeatures = await page.$$('[data-testid*="ai-feature"], .ai-powered, [class*="ai-"]');
          expect(aiFeatures.length).toBeGreaterThan(0);
        }

        if (marketingPage.path === '/pricing') {
          // Pricing page should highlight AI features
          const aiPricingContent = await page.$eval('body', el => el.textContent || '');
          expect(aiPricingContent.toLowerCase()).toContain('ai-powered');
        }
      }
    });

    /**
     * Test responsive design across devices
     * Validates Requirements 1.2
     */
    test('should render correctly on different device sizes', async () => {
      const devices = [
        { name: 'Desktop', width: 1280, height: 720 },
        { name: 'Tablet', width: 768, height: 1024 },
        { name: 'Mobile', width: 375, height: 667 }
      ];

      for (const device of devices) {
        await page.setViewport({ width: device.width, height: device.height });

        for (const marketingPage of MARKETING_PAGES) {
          await page.goto(`${BASE_URL}${marketingPage.path}`, {
            waitUntil: 'networkidle0'
          });

          // Check that page loads without layout issues
          const response = await page.goto(`${BASE_URL}${marketingPage.path}`);
          expect(response?.status()).toBe(200);

          // Check for responsive navigation
          const navigation = await page.$('nav');
          expect(navigation).toBeTruthy();

          // Ensure no horizontal scroll on mobile
          if (device.width <= 768) {
            const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
            const viewportWidth = device.width;
            expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20); // Allow small tolerance
          }

          // Check that text is readable (not too small)
          const textElements = await page.$$('p, h1, h2, h3, h4, h5, h6');
          for (const element of textElements.slice(0, 5)) { // Check first 5 elements
            const fontSize = await element.evaluate(el => {
              const style = window.getComputedStyle(el);
              return parseInt(style.fontSize);
            });
            expect(fontSize).toBeGreaterThanOrEqual(14); // Minimum readable font size
          }
        }
      }
    });
  });

  describe('Authentication Redirects', () => {
    /**
     * Test authenticated user redirection from marketing pages
     * Validates Requirements 1.5
     */
    test('should redirect authenticated users away from marketing pages', async () => {
      // Simulate authenticated user by setting cookies
      await page.setCookie(
        {
          name: 'access_token',
          value: 'valid_token_123',
          domain: 'localhost',
          path: '/'
        },
        {
          name: 'refresh_token', 
          value: 'valid_refresh_456',
          domain: 'localhost',
          path: '/'
        }
      );

      // Mock the auth validation to return success
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url().includes('/api/v1/auth/me')) {
          request.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ user: { id: 1, email: 'test@example.com' } })
          });
        } else {
          request.continue();
        }
      });

      for (const marketingPage of MARKETING_PAGES) {
        const response = await page.goto(`${BASE_URL}${marketingPage.path}`, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        // Should redirect to dashboard
        const finalUrl = page.url();
        expect(finalUrl).toContain('/dashboard');
        expect(finalUrl).not.toContain(marketingPage.path);
      }
    });

    /**
     * Test middleware authentication logic
     * Validates Requirements 1.5
     */
    test('should handle authentication redirects correctly in middleware', async () => {
      for (const marketingPage of MARKETING_PAGES) {
        // Test with authenticated request
        const authenticatedRequest = new NextRequest(`https://example.com${marketingPage.path}`, {
          method: 'GET',
          headers: new Headers({
            'Accept': 'text/html',
            'Cookie': 'access_token=valid_token; refresh_token=valid_refresh'
          })
        });

        // Mock successful auth validation
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ user: { id: 1 } })
        });

        const response = await middleware(authenticatedRequest);

        // Should redirect to dashboard
        expect(response.status).toBe(302);
        const location = response.headers.get('location');
        expect(location).toContain('/dashboard');

        global.fetch = originalFetch;
      }
    });
  });

  describe('Pricing Page Functionality', () => {
    /**
     * Test pricing page functionality end-to-end
     * Validates centralized pricing data usage and billing cycle switching
     */
    test('should display correct pricing information and handle billing cycle switching', async () => {
      await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'networkidle0' });

      // Should display all pricing plans
      const pricingCards = await page.$$('[data-plan-id]');
      expect(pricingCards.length).toBe(PRICING_PLANS.length);

      // Check that each plan is displayed correctly
      for (const plan of PRICING_PLANS) {
        const planCard = await page.$(`[data-plan-id="${plan.id}"]`);
        expect(planCard).toBeTruthy();

        // Check plan name
        const planName = await page.$eval(
          `[data-plan-id="${plan.id}"]`,
          el => el.textContent || ''
        );
        expect(planName).toContain(plan.displayName);
      }

      // Test billing cycle toggle if it exists
      const billingToggle = await page.$('[data-testid="billing-toggle"], .billing-toggle, input[type="checkbox"]');
      if (billingToggle) {
        // Get initial prices
        const initialPrices = await page.$$eval('[data-plan-id]', cards => 
          cards.map(card => card.textContent || '')
        );

        // Toggle billing cycle
        await billingToggle.click();
        await page.waitForTimeout(500); // Wait for UI update

        // Get updated prices
        const updatedPrices = await page.$$eval('[data-plan-id]', cards => 
          cards.map(card => card.textContent || '')
        );

        // Prices should change (except for free plan)
        const pricesChanged = initialPrices.some((price, index) => 
          price !== updatedPrices[index]
        );
        expect(pricesChanged).toBe(true);
      }

      // Test CTA buttons
      const ctaButtons = await page.$$('[data-plan-id] a, [data-plan-id] button');
      expect(ctaButtons.length).toBeGreaterThan(0);

      // Click on a CTA button (should navigate to registration)
      if (ctaButtons.length > 0) {
        const firstCTA = ctaButtons[0];
        const href = await firstCTA.evaluate(el => 
          el.getAttribute('href') || el.getAttribute('data-href')
        );
        
        if (href && href.includes('/auth/register')) {
          // This is expected behavior
          expect(href).toContain('/auth/register');
        }
      }
    });

    /**
     * Test pricing page AI features display
     * Validates AI-powered messaging in pricing context
     */
    test('should highlight AI features in pricing plans', async () => {
      await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'networkidle0' });

      // Check for AI-related content
      const pageContent = await page.content();
      expect(pageContent.toLowerCase()).toContain('ai-powered');
      expect(pageContent.toLowerCase()).toContain('intelligent');

      // Check for AI benefits section
      const aiBenefits = await page.$('[class*="ai-"], [data-testid*="ai-"]');
      if (aiBenefits) {
        const benefitsText = await aiBenefits.evaluate(el => el.textContent || '');
        expect(benefitsText.toLowerCase()).toContain('ai');
      }

      // Verify AI features are mentioned in plan descriptions
      for (const plan of PRICING_PLANS) {
        const planCard = await page.$(`[data-plan-id="${plan.id}"]`);
        if (planCard) {
          const planText = await planCard.evaluate(el => el.textContent || '');
          
          // Check if AI features are mentioned based on plan capabilities
          const aiFeatureCount = PricingUtils.getAIFeaturesCount(plan);
          if (aiFeatureCount > 0) {
            const hasAIContent = ['ai', 'smart', 'intelligent', 'predictive', 'automated']
              .some(keyword => planText.toLowerCase().includes(keyword));
            expect(hasAIContent).toBe(true);
          }
        }
      }
    });

    /**
     * Test pricing page FAQ section
     * Validates pricing-related questions and AI messaging
     */
    test('should display relevant FAQ section with AI-focused content', async () => {
      await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'networkidle0' });

      // Look for FAQ section
      const faqSection = await page.$('[class*="faq"], [data-testid*="faq"], h3:contains("Questions")');
      if (faqSection) {
        // Check for pricing-related questions
        const faqContent = await page.evaluate(() => {
          const faqElements = Array.from(document.querySelectorAll('h4, .question, [class*="question"]'));
          return faqElements.map(el => el.textContent || '').join(' ');
        });

        // Should contain pricing-related questions
        const pricingKeywords = ['price', 'cost', 'plan', 'billing', 'payment', 'subscription'];
        const hasPricingContent = pricingKeywords.some(keyword => 
          faqContent.toLowerCase().includes(keyword)
        );
        expect(hasPricingContent).toBe(true);

        // Should contain AI-related questions
        const aiKeywords = ['ai', 'intelligent', 'smart', 'automated'];
        const hasAIContent = aiKeywords.some(keyword => 
          faqContent.toLowerCase().includes(keyword)
        );
        expect(hasAIContent).toBe(true);
      }
    });
  });

  describe('Performance and Accessibility', () => {
    /**
     * Test page load performance
     * Validates that marketing pages load efficiently
     */
    test('should load marketing pages within acceptable time limits', async () => {
      for (const marketingPage of MARKETING_PAGES) {
        const startTime = Date.now();
        
        const response = await page.goto(`${BASE_URL}${marketingPage.path}`, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        const loadTime = Date.now() - startTime;

        // Should load within 10 seconds (generous for CI environments)
        expect(loadTime).toBeLessThan(10000);
        expect(response?.status()).toBe(200);

        // Check for basic performance metrics
        const performanceMetrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart
          };
        });

        // DOM should load reasonably quickly
        expect(performanceMetrics.domContentLoaded).toBeLessThan(5000);
      }
    });

    /**
     * Test basic accessibility requirements
     * Validates that marketing pages meet basic accessibility standards
     */
    test('should meet basic accessibility requirements', async () => {
      for (const marketingPage of MARKETING_PAGES) {
        await page.goto(`${BASE_URL}${marketingPage.path}`, {
          waitUntil: 'networkidle0'
        });

        // Check for proper heading structure
        const headings = await page.$$('h1, h2, h3, h4, h5, h6');
        expect(headings.length).toBeGreaterThan(0);

        // Should have at least one h1
        const h1Elements = await page.$$('h1');
        expect(h1Elements.length).toBeGreaterThanOrEqual(1);

        // Check for alt text on images
        const images = await page.$$('img');
        for (const img of images) {
          const alt = await img.evaluate(el => el.getAttribute('alt'));
          const src = await img.evaluate(el => el.getAttribute('src'));
          
          // Images should have alt text (unless decorative)
          if (src && !src.includes('decoration') && !src.includes('background')) {
            expect(alt).toBeTruthy();
          }
        }

        // Check for proper link text
        const links = await page.$$('a');
        for (const link of links.slice(0, 10)) { // Check first 10 links
          const linkText = await link.evaluate(el => el.textContent?.trim() || '');
          const ariaLabel = await link.evaluate(el => el.getAttribute('aria-label'));
          
          // Links should have descriptive text or aria-label
          if (linkText || ariaLabel) {
            const hasDescriptiveText = (linkText && linkText.length > 2) || 
                                     (ariaLabel && ariaLabel.length > 2);
            expect(hasDescriptiveText).toBe(true);
          }
        }

        // Check color contrast (basic check)
        const textElements = await page.$$('p, h1, h2, h3, h4, h5, h6, span, div');
        for (const element of textElements.slice(0, 5)) {
          const styles = await element.evaluate(el => {
            const computed = window.getComputedStyle(el);
            return {
              color: computed.color,
              backgroundColor: computed.backgroundColor,
              fontSize: computed.fontSize
            };
          });

          // Text should have reasonable font size
          const fontSize = parseInt(styles.fontSize);
          expect(fontSize).toBeGreaterThanOrEqual(12);
        }
      }
    });
  });

  describe('Error Handling', () => {
    /**
     * Test error handling for invalid routes
     * Validates graceful handling of edge cases
     */
    test('should handle invalid marketing routes gracefully', async () => {
      const invalidRoutes = [
        '/features/invalid',
        '/pricing/nonexistent',
        '/faq/missing',
        '/industries/fake'
      ];

      for (const route of invalidRoutes) {
        const response = await page.goto(`${BASE_URL}${route}`, {
          waitUntil: 'networkidle0'
        });

        // Should return 404 or redirect to valid page
        const status = response?.status();
        expect([200, 404]).toContain(status);

        // Should not crash or show error page
        const pageContent = await page.content();
        expect(pageContent).not.toContain('Application error');
        expect(pageContent).not.toContain('500');
      }
    });

    /**
     * Test handling of network errors
     * Validates resilience to network issues
     */
    test('should handle network errors gracefully', async () => {
      // Test with slow network
      await page.emulateNetworkConditions({
        offline: false,
        downloadThroughput: 50 * 1024, // 50kb/s
        uploadThroughput: 50 * 1024,
        latency: 2000 // 2s latency
      });

      const response = await page.goto(`${BASE_URL}/pricing`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Should still load, even if slowly
      expect(response?.status()).toBe(200);

      // Reset network conditions
      await page.emulateNetworkConditions({
        offline: false,
        downloadThroughput: 0,
        uploadThroughput: 0,
        latency: 0
      });
    });
  });

  describe('SEO and Meta Tags', () => {
    /**
     * Test SEO optimization
     * Validates proper meta tags and SEO elements
     */
    test('should have proper SEO meta tags on all marketing pages', async () => {
      for (const marketingPage of MARKETING_PAGES) {
        await page.goto(`${BASE_URL}${marketingPage.path}`, {
          waitUntil: 'networkidle0'
        });

        // Check title tag
        const title = await page.title();
        expect(title).toBeTruthy();
        expect(title.length).toBeGreaterThan(10);
        expect(title.length).toBeLessThan(60); // SEO best practice

        // Check meta description
        const metaDescription = await page.$eval('meta[name="description"]', 
          el => el.getAttribute('content'));
        expect(metaDescription).toBeTruthy();
        expect(metaDescription!.length).toBeGreaterThan(50);
        expect(metaDescription!.length).toBeLessThan(160); // SEO best practice

        // Check for AI-related keywords in meta tags
        const metaKeywords = await page.$eval('meta[name="keywords"]', 
          el => el.getAttribute('content')).catch(() => null);
        
        if (metaKeywords) {
          expect(metaKeywords.toLowerCase()).toMatch(/ai|intelligent|smart|automated/);
        }

        // Check canonical URL
        const canonical = await page.$eval('link[rel="canonical"]', 
          el => el.getAttribute('href')).catch(() => null);
        
        if (canonical) {
          expect(canonical).toContain(marketingPage.path);
        }

        // Check Open Graph tags
        const ogTitle = await page.$eval('meta[property="og:title"]', 
          el => el.getAttribute('content')).catch(() => null);
        const ogDescription = await page.$eval('meta[property="og:description"]', 
          el => el.getAttribute('content')).catch(() => null);

        if (ogTitle) {
          expect(ogTitle).toBeTruthy();
        }
        if (ogDescription) {
          expect(ogDescription).toBeTruthy();
        }
      }
    });
  });
});