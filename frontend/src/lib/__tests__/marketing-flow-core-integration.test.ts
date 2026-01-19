/**
 * Core Integration Tests for Marketing Flow
 * 
 * These tests validate the core integration between middleware, pricing configuration,
 * and AI messaging without requiring a running server. They test the business logic
 * and data flow that powers the marketing pages.
 * 
 * Task 8.3: Write integration tests for marketing flow
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '../../../middleware';
import { PRICING_PLANS, PricingUtils, AI_MESSAGING } from '../pricing-config';
import { AI_MESSAGING_CONFIG, AIMessagingUtils } from '../ai-messaging-config';

describe('Marketing Flow Core Integration Tests', () => {
  
  describe('Complete User Journey Integration', () => {
    /**
     * Test complete guest user journey through marketing system
     * Validates Requirements 1.1, 1.2, 1.3, 1.4
     */
    test('should handle complete guest user journey through marketing pages', async () => {
      const marketingRoutes = ['/', '/features', '/industries', '/faq', '/pricing'];
      const userJourneySteps = [];

      // Simulate user journey through all marketing pages
      for (const route of marketingRoutes) {
        const request = new NextRequest(`https://example.com${route}`, {
          method: 'GET',
          headers: new Headers({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          })
        });

        // Mock auth check to return false (guest user)
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockRejectedValue(new Error('No auth'));

        const response = await middleware(request);

        // Should allow access (no redirect to login)
        if (response instanceof NextResponse && response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          expect(location).not.toContain('/auth/login');
        }

        userJourneySteps.push({
          route,
          allowed: !response || response.status !== 401,
          timestamp: Date.now()
        });

        global.fetch = originalFetch;
      }

      // All steps should be successful
      expect(userJourneySteps.every(step => step.allowed)).toBe(true);
      expect(userJourneySteps).toHaveLength(marketingRoutes.length);
    });

    /**
     * Test navigation flow between marketing pages
     * Validates Requirements 1.3
     */
    test('should support seamless navigation between marketing pages', async () => {
      const navigationFlow = [
        { from: '/', to: '/features', context: 'home-to-features' },
        { from: '/features', to: '/pricing', context: 'features-to-pricing' },
        { from: '/pricing', to: '/industries', context: 'pricing-to-industries' },
        { from: '/industries', to: '/faq', context: 'industries-to-faq' },
        { from: '/faq', to: '/', context: 'faq-to-home' }
      ];

      for (const nav of navigationFlow) {
        // Test navigation from source page
        const fromRequest = new NextRequest(`https://example.com${nav.from}`, {
          method: 'GET',
          headers: new Headers({
            'Accept': 'text/html',
            'Referer': `https://example.com${nav.from}`
          })
        });

        // Test navigation to target page
        const toRequest = new NextRequest(`https://example.com${nav.to}`, {
          method: 'GET',
          headers: new Headers({
            'Accept': 'text/html',
            'Referer': `https://example.com${nav.from}`
          })
        });

        // Mock guest user (no auth)
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockRejectedValue(new Error('No auth'));

        const fromResponse = await middleware(fromRequest);
        const toResponse = await middleware(toRequest);

        // Both pages should be accessible (NextResponse.next() returns a Response object)
        if (fromResponse instanceof NextResponse && fromResponse.status >= 300 && fromResponse.status < 400) {
          const location = fromResponse.headers.get('location');
          expect(location).not.toContain('/auth/login');
        }
        if (toResponse instanceof NextResponse && toResponse.status >= 300 && toResponse.status < 400) {
          const location = toResponse.headers.get('location');
          expect(location).not.toContain('/auth/login');
        }

        global.fetch = originalFetch;
      }
    });
  });

  describe('Authentication Redirect Integration', () => {
    /**
     * Test authenticated user redirection from marketing pages
     * Validates Requirements 1.5
     */
    test('should redirect authenticated users from marketing pages to dashboard', async () => {
      const marketingRoutes = ['/', '/features', '/industries', '/faq', '/pricing'];
      
      for (const route of marketingRoutes) {
        const request = new NextRequest(`https://example.com${route}`, {
          method: 'GET',
          headers: new Headers({
            'Accept': 'text/html',
            'Cookie': 'access_token=valid_token; refresh_token=valid_refresh'
          })
        });

        // Mock successful auth check
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ user: { id: 1, email: 'test@example.com' } })
        });

        const response = await middleware(request);

        // Should redirect to dashboard
        expect(response).toBeInstanceOf(NextResponse);
        expect(response.status).toBe(302);
        
        const location = response.headers.get('location');
        expect(location).toContain('/dashboard');
        // For home page ('/'), the location will contain it, so we need to check more specifically
        if (route !== '/') {
          expect(location).not.toContain(route);
        }

        global.fetch = originalFetch;
      }
    });

    /**
     * Test authentication state transitions
     * Validates Requirements 1.5
     */
    test('should handle authentication state transitions correctly', async () => {
      const testRoute = '/pricing';
      
      // Test 1: Guest user access
      const guestRequest = new NextRequest(`https://example.com${testRoute}`, {
        method: 'GET',
        headers: new Headers({ 'Accept': 'text/html' })
      });

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('No auth'));

      const guestResponse = await middleware(guestRequest);
      // Guest response should either be undefined (pass through) or not redirect to login
      if (guestResponse instanceof NextResponse && guestResponse.status >= 300 && guestResponse.status < 400) {
        const location = guestResponse.headers.get('location');
        expect(location).not.toContain('/auth/login');
      }

      // Test 2: Authenticated user access
      const authRequest = new NextRequest(`https://example.com${testRoute}`, {
        method: 'GET',
        headers: new Headers({
          'Accept': 'text/html',
          'Cookie': 'access_token=valid; refresh_token=valid'
        })
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ user: { id: 1 } })
      });

      const authResponse = await middleware(authRequest);
      expect(authResponse.status).toBe(302);
      expect(authResponse.headers.get('location')).toContain('/dashboard');

      // Test 3: Invalid token (should treat as guest)
      const invalidTokenRequest = new NextRequest(`https://example.com${testRoute}`, {
        method: 'GET',
        headers: new Headers({
          'Accept': 'text/html',
          'Cookie': 'access_token=invalid; refresh_token=invalid'
        })
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401
      });

      const invalidResponse = await middleware(invalidTokenRequest);
      // Invalid token should be treated as guest (pass through or not redirect to login)
      if (invalidResponse instanceof NextResponse && invalidResponse.status >= 300 && invalidResponse.status < 400) {
        const location = invalidResponse.headers.get('location');
        expect(location).not.toContain('/auth/login');
      }

      global.fetch = originalFetch;
    });
  });

  describe('Pricing Page Integration', () => {
    /**
     * Test pricing page data integration
     * Validates centralized pricing configuration usage
     */
    test('should integrate pricing configuration correctly', async () => {
      // Test pricing data completeness
      expect(PRICING_PLANS).toHaveLength(3);
      
      // Test each plan has required data for marketing display
      PRICING_PLANS.forEach(plan => {
        expect(plan.id).toBeTruthy();
        expect(plan.displayName).toBeTruthy();
        expect(plan.description).toBeTruthy();
        expect(typeof plan.monthlyPrice).toBe('number');
        expect(typeof plan.yearlyPrice).toBe('number');
        expect(Array.isArray(plan.features)).toBe(true);
        expect(plan.features.length).toBeGreaterThan(0);
        expect(plan.aiFeatures).toBeTruthy();
      });

      // Test pricing utilities integration
      const starterPlan = PRICING_PLANS.find(p => p.id === 'starter')!;
      const professionalPlan = PRICING_PLANS.find(p => p.id === 'professional')!;

      // Test price formatting
      expect(PricingUtils.formatPrice(0, 'ZAR')).toBe('Free');
      expect(PricingUtils.formatPrice(49900, 'ZAR')).toBe('R499');

      // Test billing cycle pricing
      expect(PricingUtils.getPriceForCycle(starterPlan, 'monthly')).toBe(0);
      expect(PricingUtils.getPriceForCycle(professionalPlan, 'monthly')).toBe(49900);

      // Test AI features integration
      const starterAICount = PricingUtils.getAIFeaturesCount(starterPlan);
      const professionalAICount = PricingUtils.getAIFeaturesCount(professionalPlan);
      
      expect(starterAICount).toBeGreaterThan(0);
      expect(professionalAICount).toBeGreaterThan(starterAICount);

      // Test benefits conversion
      const benefits = PricingUtils.convertFeaturesToBenefits(professionalPlan);
      expect(benefits.length).toBeGreaterThan(0);
      expect(benefits.some(b => b.checked)).toBe(true);
    });

    /**
     * Test pricing page AI messaging integration
     * Validates AI messaging configuration usage
     */
    test('should integrate AI messaging correctly in pricing context', async () => {
      // Test AI messaging availability
      expect(AI_MESSAGING.heroTagline).toBeTruthy();
      expect(AI_MESSAGING.keyBenefits).toHaveLength(5);
      expect(AI_MESSAGING.automationBenefits.length).toBeGreaterThanOrEqual(5);

      // Test AI messaging contains pricing-relevant content
      const pricingRelevantBenefits = AI_MESSAGING.automationBenefits.filter(benefit =>
        benefit.toLowerCase().includes('profit') ||
        benefit.toLowerCase().includes('cost') ||
        benefit.toLowerCase().includes('save') ||
        benefit.toLowerCase().includes('optimize')
      );
      expect(pricingRelevantBenefits.length).toBeGreaterThan(0);

      // Test AI messaging utilities
      const pricingComponents = AIMessagingUtils.getComponentsByContext('pricing');
      expect(pricingComponents.length).toBeGreaterThan(0);

      // Test AI emphasis in pricing context
      const shouldEmphasize = AIMessagingUtils.shouldEmphasizeAI('pricing');
      expect(shouldEmphasize).toBe(true);

      // Test AI capabilities integration
      const capabilities = AI_MESSAGING_CONFIG.capabilities;
      expect(capabilities.length).toBeGreaterThan(0);
      
      capabilities.forEach(capability => {
        expect(capability.businessBenefits).toBeTruthy();
        expect(capability.businessBenefits.length).toBeGreaterThan(0);
        expect(capability.userControlAspects).toBeTruthy();
        expect(capability.privacyFeatures).toBeTruthy();
      });
    });

    /**
     * Test pricing and AI messaging consistency
     * Validates consistent messaging across pricing and AI configurations
     */
    test('should maintain consistency between pricing and AI messaging', async () => {
      // Test that AI features in pricing plans align with AI messaging
      const allAIFeatures = PRICING_PLANS.flatMap(plan => 
        Object.keys(plan.aiFeatures).filter(key => plan.aiFeatures[key as keyof typeof plan.aiFeatures])
      );

      const aiCapabilityNames = AI_MESSAGING_CONFIG.capabilities.map(cap => 
        cap.name.toLowerCase().replace(/\s+/g, '')
      );

      // Should have some overlap between pricing AI features and messaging capabilities
      const hasOverlap = allAIFeatures.some(feature => 
        aiCapabilityNames.some(capName => 
          feature.toLowerCase().includes(capName.substring(0, 5)) ||
          capName.includes(feature.substring(0, 5))
        )
      );
      expect(hasOverlap).toBe(true);

      // Test that pricing descriptions mention AI appropriately
      PRICING_PLANS.forEach(plan => {
        const aiFeatureCount = PricingUtils.getAIFeaturesCount(plan);
        if (aiFeatureCount > 0) {
          const hasAIInDescription = plan.description.toLowerCase().includes('ai') ||
                                   plan.description.toLowerCase().includes('intelligent') ||
                                   plan.description.toLowerCase().includes('smart');
          expect(hasAIInDescription).toBe(true);
        }
      });
    });
  });

  describe('Cross-Page Data Flow Integration', () => {
    /**
     * Test data consistency across marketing pages
     * Validates Requirements 1.4
     */
    test('should maintain consistent data across marketing pages', async () => {
      // Test that pricing data is consistent
      const pricingPlans = PRICING_PLANS;
      expect(pricingPlans).toHaveLength(3);

      // Test that AI messaging is consistent
      const aiMessaging = AI_MESSAGING;
      expect(aiMessaging.heroTagline).toBeTruthy();

      // Test cross-page data references
      const recommendedPlan = PricingUtils.getRecommendedPlan();
      expect(recommendedPlan).toBeTruthy();
      expect(recommendedPlan!.recommended).toBe(true);

      // Test that AI capabilities align with pricing features
      const enterprisePlan = PRICING_PLANS.find(p => p.id === 'enterprise')!;
      const enterpriseAIFeatures = PricingUtils.getEnabledAIFeatures(enterprisePlan);
      expect(enterpriseAIFeatures.length).toBeGreaterThan(0);

      // Test industry use cases integration
      const industryUseCases = AI_MESSAGING_CONFIG.industryUseCases;
      expect(industryUseCases.length).toBeGreaterThan(0);
      
      industryUseCases.forEach(useCase => {
        expect(useCase.aiCapabilities.length).toBeGreaterThan(0);
        expect(useCase.automationBenefits.length).toBeGreaterThan(0);
        expect(useCase.controlFeatures.length).toBeGreaterThan(0);
      });
    });

    /**
     * Test feature comparison integration
     * Validates feature data consistency
     */
    test('should integrate feature comparison data correctly', async () => {
      // Import feature comparison data
      const { FEATURE_COMPARISON } = await import('../pricing-config');
      
      expect(FEATURE_COMPARISON.length).toBeGreaterThan(0);
      
      FEATURE_COMPARISON.forEach(category => {
        expect(category.category).toBeTruthy();
        expect(category.features.length).toBeGreaterThan(0);
        
        category.features.forEach(feature => {
          expect(feature.name).toBeTruthy();
          expect(feature).toHaveProperty('starter');
          expect(feature).toHaveProperty('professional');
          expect(feature).toHaveProperty('enterprise');
        });
      });

      // Test that feature comparison aligns with pricing plans
      const planIds = PRICING_PLANS.map(p => p.id);
      const comparisonPlanKeys = ['starter', 'professional', 'enterprise'];
      
      expect(planIds.sort()).toEqual(comparisonPlanKeys.sort());
    });
  });

  describe('Error Handling Integration', () => {
    /**
     * Test error handling across marketing flow
     * Validates graceful error handling
     */
    test('should handle errors gracefully across marketing flow', async () => {
      // Test middleware error handling
      const request = new NextRequest('https://example.com/pricing', {
        method: 'GET',
        headers: new Headers({
          'Accept': 'text/html',
          'Cookie': 'access_token=malformed_token'
        })
      });

      // Mock auth service failure
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const response = await middleware(request);
      
      // Should handle auth failure gracefully (treat as guest - pass through or not redirect to login)
      if (response instanceof NextResponse && response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        expect(location).not.toContain('/auth/login');
      }

      global.fetch = originalFetch;

      // Test pricing configuration error handling
      expect(() => PricingUtils.getPlanById('nonexistent')).not.toThrow();
      expect(PricingUtils.getPlanById('nonexistent')).toBeUndefined();

      // Test AI messaging error handling
      expect(() => AIMessagingUtils.getIndustryUseCase('nonexistent')).not.toThrow();
      expect(AIMessagingUtils.getIndustryUseCase('nonexistent')).toBeUndefined();
    });

    /**
     * Test edge cases in marketing flow
     * Validates robustness
     */
    test('should handle edge cases in marketing flow', async () => {
      // Test empty/malformed requests
      const edgeRequests = [
        new NextRequest('https://example.com/', { method: 'GET' }),
        new NextRequest('https://example.com/pricing?invalid=param', { method: 'GET' }),
        new NextRequest('https://example.com/features#section', { method: 'GET' })
      ];

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('No auth'));

      for (const request of edgeRequests) {
        const response = await middleware(request);
        // Should not throw errors and should handle gracefully
        if (response instanceof NextResponse && response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          expect(location).not.toContain('/auth/login');
        }
      }

      global.fetch = originalFetch;

      // Test edge cases in pricing utilities
      expect(PricingUtils.formatPrice(-1, 'ZAR')).toBeTruthy();
      expect(PricingUtils.calculateYearlySavings(0, 100)).toBe(0);
      expect(PricingUtils.calculateYearlySavings(100, 0)).toBe(0);

      // Test edge cases in AI messaging
      expect(AIMessagingUtils.getComponentsByContext('invalid')).toEqual([]);
      expect(AIMessagingUtils.getFAQsByCategory('invalid' as 'privacy')).toEqual([]);
    });
  });

  describe('Performance Integration', () => {
    /**
     * Test performance characteristics of marketing flow
     * Validates efficient data access
     */
    test('should provide efficient data access for marketing flow', async () => {
      // Test pricing data access performance
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        PricingUtils.getPlanById('professional');
        PricingUtils.formatPrice(49900, 'ZAR');
        PricingUtils.getRecommendedPlan();
      }
      
      const pricingTime = Date.now() - startTime;
      expect(pricingTime).toBeLessThan(100); // Should be very fast

      // Test AI messaging access performance
      const aiStartTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        AIMessagingUtils.getComponentsByContext('pricing');
        AIMessagingUtils.shouldEmphasizeAI('features');
        AIMessagingUtils.getValuePropositionsByContext('features');
      }
      
      const aiTime = Date.now() - aiStartTime;
      expect(aiTime).toBeLessThan(100); // Should be very fast

      // Test middleware performance
      const middlewareStartTime = Date.now();
      
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('No auth'));
      
      for (let i = 0; i < 10; i++) {
        const request = new NextRequest('https://example.com/pricing', {
          method: 'GET',
          headers: new Headers({ 'Accept': 'text/html' })
        });
        await middleware(request);
      }
      
      const middlewareTime = Date.now() - middlewareStartTime;
      expect(middlewareTime).toBeLessThan(1000); // Should be reasonably fast
      
      global.fetch = originalFetch;
    });
  });
});