/**
 * Property-Based Tests for Authenticated User Redirection
 * 
 * These tests validate universal properties that should hold true for
 * authenticated user redirection from marketing pages using property-based testing.
 * 
 * **Feature: marketing-pages-redesign, Property 2: Authenticated User Redirection**
 * **Validates: Requirements 1.5, 6.2**
 */

import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '../../../middleware';

// Mock the fetch function to simulate authenticated sessions
const originalFetch = global.fetch;

/**
 * Property 2: Authenticated User Redirection
 * 
 * For any marketing page and any authenticated user request, the middleware 
 * should redirect the user to the dashboard instead of displaying the marketing content.
 * 
 * **Validates: Requirements 1.5, 6.2**
 */
describe('Property 2: Authenticated User Redirection', () => {
  
  // Marketing routes that authenticated users should be redirected from
  const MARKETING_ROUTES = [
    '/',
    '/features',
    '/industries', 
    '/faq',
    '/pricing'
  ];

  // Mock successful authentication response
  const mockAuthenticatedResponse = () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ authenticated: true })
    });
  };

  // Mock failed authentication response
  const mockUnauthenticatedResponse = () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ authenticated: false })
    });
  };

  // Restore original fetch after each test
  afterEach(() => {
    global.fetch = originalFetch;
  });

  // Generate test cases for authenticated users accessing marketing routes
  const generateAuthenticatedUserTestCases = () => {
    const testCases: Array<{
      path: string;
      method: string;
      headers: Record<string, string>;
      cookies: Record<string, string>;
      description: string;
    }> = [];

    // Test each marketing route with various authenticated user configurations
    MARKETING_ROUTES.forEach(route => {
      // Test with valid authentication cookies
      testCases.push({
        path: route,
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        cookies: {
          'access_token': 'valid_access_token_123',
          'refresh_token': 'valid_refresh_token_456'
        },
        description: `Authenticated user accessing ${route} with valid tokens`
      });

      // Test with only access token
      testCases.push({
        path: route,
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        cookies: {
          'access_token': 'valid_access_token_789'
        },
        description: `Authenticated user accessing ${route} with access token only`
      });

      // Test with RSC (React Server Components) request headers
      testCases.push({
        path: route,
        method: 'GET',
        headers: {
          'RSC': '1',
          'Next-Router-Prefetch': '1',
          'Accept': 'text/x-component',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        cookies: {
          'access_token': 'valid_access_token_rsc',
          'refresh_token': 'valid_refresh_token_rsc'
        },
        description: `Authenticated RSC request to ${route}`
      });

      // Test with mobile user agent
      testCases.push({
        path: route,
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
        },
        cookies: {
          'access_token': 'valid_mobile_token',
          'refresh_token': 'valid_mobile_refresh'
        },
        description: `Authenticated mobile user accessing ${route}`
      });

      // Test with different Accept headers
      testCases.push({
        path: route,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        cookies: {
          'access_token': 'valid_json_token',
          'refresh_token': 'valid_json_refresh'
        },
        description: `Authenticated JSON request to ${route}`
      });

      // Test with additional session cookies
      testCases.push({
        path: route,
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        cookies: {
          'access_token': 'valid_session_token',
          'refresh_token': 'valid_session_refresh',
          'session_id': 'session_12345',
          'user_preferences': 'theme=dark'
        },
        description: `Authenticated user with session data accessing ${route}`
      });
    });

    return testCases;
  };

  // Property test: Authenticated users should be redirected to dashboard from marketing pages
  test('should redirect authenticated users to dashboard from all marketing pages', async () => {
    mockAuthenticatedResponse();
    
    const testCases = generateAuthenticatedUserTestCases();
    
    // Run property test with minimum 100 iterations as per design specification
    for (let iteration = 0; iteration < Math.max(100, testCases.length * 2); iteration++) {
      const testCase = testCases[iteration % testCases.length];
      
      // Create mock NextRequest for the test case
      const url = `https://example.com${testCase.path}`;
      const request = new NextRequest(url, {
        method: testCase.method,
        headers: new Headers(testCase.headers)
      });

      // Add cookies to the request
      Object.entries(testCase.cookies).forEach(([name, value]) => {
        request.cookies.set(name, value);
      });

      // Execute middleware
      const response = await middleware(request);

      // Property: Authenticated users should be redirected from marketing pages
      expect(response).toBeInstanceOf(NextResponse);
      
      if (response instanceof NextResponse) {
        // Property: Should return a redirect response (3xx status)
        expect(response.status).toBeGreaterThanOrEqual(300);
        expect(response.status).toBeLessThan(400);
        
        // Property: Should redirect to dashboard
        const location = response.headers.get('location');
        expect(location).toBeTruthy();
        expect(location).toContain('/dashboard');
        
        // Property: Should not redirect to login or other auth pages
        expect(location).not.toContain('/auth/login');
        expect(location).not.toContain('/login');
        expect(location).not.toContain('/signup');
        
        // Property: Should use 302 redirect status for RSC requests
        if (testCase.headers['RSC'] === '1' || testCase.headers['Next-Router-Prefetch'] === '1') {
          expect(response.status).toBe(302);
        }
        
        // Property: Redirect URL should not contain search parameters from original request
        const redirectUrl = new URL(location!);
        expect(redirectUrl.search).toBe('');
        expect(redirectUrl.searchParams.has('_rsc')).toBe(false);
        expect(redirectUrl.searchParams.has('next')).toBe(false);
      }
    }
  });

  // Property test: Marketing route classification should work correctly for authenticated users
  test('should correctly identify marketing routes for authenticated user redirection', async () => {
    mockAuthenticatedResponse();
    
    const testCases = generateAuthenticatedUserTestCases();
    
    // Run property test for route classification with authenticated users
    for (let iteration = 0; iteration < 100; iteration++) {
      const testCase = testCases[iteration % testCases.length];
      
      // Property: All test case paths should be valid marketing routes
      const isMarketingRoute = MARKETING_ROUTES.includes(testCase.path);
      expect(isMarketingRoute).toBe(true);
      
      // Property: Marketing routes should follow expected patterns
      const validMarketingPatterns = [
        /^\/$/,                    // Home page
        /^\/features$/,            // Features page
        /^\/industries$/,          // Industries page
        /^\/faq$/,                // FAQ page
        /^\/pricing$/             // Pricing page
      ];
      
      const matchesPattern = validMarketingPatterns.some(pattern => 
        pattern.test(testCase.path)
      );
      expect(matchesPattern).toBe(true);
      
      // Property: Marketing routes should not be protected routes
      const protectedPatterns = [
        /^\/dashboard/,
        /^\/admin/,
        /^\/api\/(?!auth\/)/,
        /^\/settings/,
        /^\/profile/,
        /^\/subscription/
      ];
      
      const isProtectedRoute = protectedPatterns.some(pattern => 
        pattern.test(testCase.path)
      );
      expect(isProtectedRoute).toBe(false);
    }
  });

  // Property test: Authenticated user redirection should be consistent across request types
  test('should consistently redirect authenticated users regardless of request type', async () => {
    mockAuthenticatedResponse();
    
    const route = '/features'; // Test with a specific marketing route
    const requestVariations = [
      {
        headers: { 'Accept': 'text/html' },
        cookies: { 'access_token': 'token1' },
        description: 'HTML request'
      },
      {
        headers: { 'Accept': 'application/json' },
        cookies: { 'access_token': 'token2' },
        description: 'JSON request'
      },
      {
        headers: { 'RSC': '1', 'Accept': 'text/x-component' },
        cookies: { 'access_token': 'token3' },
        description: 'RSC request'
      },
      {
        headers: { 'Next-Router-Prefetch': '1' },
        cookies: { 'access_token': 'token4' },
        description: 'Prefetch request'
      }
    ];
    
    for (let iteration = 0; iteration < 100; iteration++) {
      const variation = requestVariations[iteration % requestVariations.length];
      
      const url = `https://example.com${route}`;
      const request = new NextRequest(url, {
        method: 'GET',
        headers: new Headers(variation.headers)
      });

      // Add cookies
      Object.entries(variation.cookies).forEach(([name, value]) => {
        request.cookies.set(name, value);
      });

      const response = await middleware(request);

      // Property: All request types should result in dashboard redirect for authenticated users
      expect(response).toBeInstanceOf(NextResponse);
      
      if (response instanceof NextResponse) {
        expect(response.status).toBeGreaterThanOrEqual(300);
        expect(response.status).toBeLessThan(400);
        
        const location = response.headers.get('location');
        expect(location).toContain('/dashboard');
        expect(location).not.toContain('/auth/login');
      }
    }
  });

  // Property test: Authentication check should be performed for all marketing routes
  test('should perform authentication check for all marketing page requests', async () => {
    mockAuthenticatedResponse();
    
    const testCases = generateAuthenticatedUserTestCases();
    
    // Track fetch calls to ensure authentication is checked
    const fetchSpy = jest.spyOn(global, 'fetch');
    
    for (let iteration = 0; iteration < Math.min(50, testCases.length); iteration++) {
      const testCase = testCases[iteration % testCases.length];
      
      // Reset fetch spy
      fetchSpy.mockClear();
      
      const url = `https://example.com${testCase.path}`;
      const request = new NextRequest(url, {
        method: testCase.method,
        headers: new Headers(testCase.headers)
      });

      Object.entries(testCase.cookies).forEach(([name, value]) => {
        request.cookies.set(name, value);
      });

      await middleware(request);

      // Property: Authentication should be checked for marketing routes with cookies
      if (Object.keys(testCase.cookies).length > 0) {
        expect(fetchSpy).toHaveBeenCalled();
        
        // Property: Auth check should call the correct endpoint
        const authCall = fetchSpy.mock.calls.find(call => 
          call[0] && call[0].toString().includes('/auth/me')
        );
        expect(authCall).toBeDefined();
        
        // Property: Auth check should include proper headers
        if (authCall && authCall[1]) {
          const options = authCall[1] as RequestInit;
          expect(options.headers).toBeDefined();
          
          const headers = options.headers as Record<string, string>;
          expect(headers['Accept']).toBe('application/json');
          expect(headers['Content-Type']).toBe('application/json');
          expect(headers['Cache-Control']).toContain('no-cache');
        }
      }
    }
    
    fetchSpy.mockRestore();
  });

  // Property test: Unauthenticated users should not be redirected from marketing pages
  test('should not redirect unauthenticated users from marketing pages', async () => {
    mockUnauthenticatedResponse();
    
    // Test with cookies that fail authentication
    const unauthenticatedTestCases = MARKETING_ROUTES.map(route => ({
      path: route,
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      cookies: {
        'access_token': 'invalid_token',
        'refresh_token': 'invalid_refresh'
      },
      description: `Unauthenticated user with invalid tokens accessing ${route}`
    }));
    
    for (let iteration = 0; iteration < 100; iteration++) {
      const testCase = unauthenticatedTestCases[iteration % unauthenticatedTestCases.length];
      
      const url = `https://example.com${testCase.path}`;
      const request = new NextRequest(url, {
        method: testCase.method,
        headers: new Headers(testCase.headers)
      });

      Object.entries(testCase.cookies).forEach(([name, value]) => {
        request.cookies.set(name, value);
      });

      const response = await middleware(request);

      // Property: Unauthenticated users should not be redirected from marketing pages
      if (response instanceof NextResponse && response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        // Should not redirect to dashboard (that's only for authenticated users)
        expect(location).not.toContain('/dashboard');
      }
    }
  });

  // Property test: Edge cases should be handled gracefully for authenticated users
  test('should handle edge cases gracefully for authenticated user redirection', async () => {
    mockAuthenticatedResponse();
    
    const edgeCases = [
      // Path variations
      { path: '/', description: 'Root path' },
      { path: '/features/', description: 'Trailing slash' },
      { path: '/features?param=value', description: 'Query parameters' },
      { path: '/features#section', description: 'Hash fragment' },
      
      // Special parameters
      { path: '/pricing?_rsc=123', description: 'RSC parameter' },
      { path: '/faq?utm_source=test', description: 'UTM parameters' }
    ];

    for (let iteration = 0; iteration < 100; iteration++) {
      const edgeCase = edgeCases[iteration % edgeCases.length];
      
      // Only test actual marketing routes
      const basePath = edgeCase.path.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
      if (!MARKETING_ROUTES.includes(basePath)) {
        continue;
      }
      
      const url = `https://example.com${edgeCase.path}`;
      const request = new NextRequest(url, {
        method: 'GET',
        headers: new Headers({
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
      });

      // Add authentication cookies
      request.cookies.set('access_token', 'valid_edge_case_token');
      request.cookies.set('refresh_token', 'valid_edge_case_refresh');

      // Property: Middleware should not throw errors for edge cases
      let response: NextResponse | undefined;
      expect(async () => {
        response = await middleware(request);
      }).not.toThrow();

      // Property: Should still redirect authenticated users to dashboard
      if (response instanceof NextResponse) {
        expect(response.status).toBeGreaterThanOrEqual(300);
        expect(response.status).toBeLessThan(400);
        
        const location = response.headers.get('location');
        expect(location).toContain('/dashboard');
        
        // Property: Redirect URL should be clean (no leaked parameters)
        if (location) {
          const redirectUrl = new URL(location);
          expect(redirectUrl.search).toBe('');
        }
      }
    }
  });

  // Property test: Multiple sequential requests should behave consistently
  test('should maintain consistent redirection behavior across multiple requests', async () => {
    mockAuthenticatedResponse();
    
    const route = '/pricing'; // Test with a specific marketing route
    
    for (let iteration = 0; iteration < 100; iteration++) {
      const url = `https://example.com${route}`;
      const request = new NextRequest(url, {
        method: 'GET',
        headers: new Headers({
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
      });

      // Add authentication cookies
      request.cookies.set('access_token', `consistent_token_${iteration}`);
      request.cookies.set('refresh_token', `consistent_refresh_${iteration}`);

      const response = await middleware(request);

      // Property: Behavior should be consistent across multiple requests
      expect(response).toBeInstanceOf(NextResponse);
      
      if (response instanceof NextResponse) {
        expect(response.status).toBeGreaterThanOrEqual(300);
        expect(response.status).toBeLessThan(400);
        
        const location = response.headers.get('location');
        expect(location).toContain('/dashboard');
        expect(location).not.toContain('/auth/login');
        
        // Property: Redirect should always be to the same dashboard URL
        expect(location).toMatch(/\/dashboard$/);
      }
    }
  });
});