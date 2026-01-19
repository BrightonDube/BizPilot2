/**
 * Property-Based Tests for Route Classification Accuracy
 * 
 * These tests validate universal properties that should hold true for
 * route classification logic in the middleware using property-based testing.
 * 
 * **Feature: marketing-pages-redesign, Property 4: Route Classification Accuracy**
 * **Validates: Requirements 6.4**
 */

import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '../../../middleware';

// Mock the fetch function to control authentication responses
const originalFetch = global.fetch;

/**
 * Property 4: Route Classification Accuracy
 * 
 * For any request path, the middleware should correctly classify marketing pages 
 * as guest-accessible and protected pages as authentication-required.
 * 
 * **Validates: Requirements 6.4**
 */
describe('Property 4: Route Classification Accuracy', () => {
  
  // Define route categories for classification testing
  const MARKETING_ROUTES = [
    '/',
    '/features',
    '/industries', 
    '/faq',
    '/pricing'
  ];

  const AUTH_ROUTES = [
    '/auth',
    '/auth/login',
    '/auth/signup',
    '/auth/forgot-password',
    '/auth/reset-password'
  ];

  const PROTECTED_ROUTES = [
    '/dashboard',
    '/dashboard/inventory',
    '/dashboard/orders',
    '/dashboard/customers',
    '/dashboard/analytics',
    '/dashboard/settings',
    '/admin',
    '/admin/users',
    '/admin/system',
    '/profile',
    '/settings',
    '/subscription',
    '/billing',
    '/api/inventory',
    '/api/orders',
    '/api/customers'
  ];

  const NEXT_INTERNAL_ROUTES = [
    '/_next/static/css/app.css',
    '/_next/static/js/main.js',
    '/_next/image',
    '/_next/webpack-hmr'
  ];

  // Mock unauthenticated response
  const mockUnauthenticatedResponse = () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ authenticated: false })
    });
  };

  // Mock authenticated response
  const mockAuthenticatedResponse = () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ authenticated: true })
    });
  };

  // Restore original fetch after each test
  afterEach(() => {
    global.fetch = originalFetch;
  });

  // Generate comprehensive test cases for route classification
  const generateRouteClassificationTestCases = () => {
    const testCases: Array<{
      path: string;
      expectedCategory: 'marketing' | 'auth' | 'protected' | 'next-internal';
      method: string;
      headers: Record<string, string>;
      cookies: Record<string, string>;
      description: string;
    }> = [];

    // Marketing routes test cases
    MARKETING_ROUTES.forEach(route => {
      // Test with different HTTP methods
      ['GET', 'POST', 'PUT', 'DELETE'].forEach(method => {
        testCases.push({
          path: route,
          expectedCategory: 'marketing',
          method,
          headers: { 'Accept': 'text/html' },
          cookies: {},
          description: `${method} ${route} should be classified as marketing route`
        });

        // Test with RSC headers
        testCases.push({
          path: route,
          expectedCategory: 'marketing',
          method,
          headers: { 'RSC': '1', 'Accept': 'text/x-component' },
          cookies: {},
          description: `${method} ${route} with RSC headers should be classified as marketing route`
        });

        // Test with prefetch headers
        testCases.push({
          path: route,
          expectedCategory: 'marketing',
          method,
          headers: { 'Next-Router-Prefetch': '1' },
          cookies: {},
          description: `${method} ${route} with prefetch headers should be classified as marketing route`
        });
      });
    });

    // Auth routes test cases
    AUTH_ROUTES.forEach(route => {
      ['GET', 'POST'].forEach(method => {
        testCases.push({
          path: route,
          expectedCategory: 'auth',
          method,
          headers: { 'Accept': 'text/html' },
          cookies: {},
          description: `${method} ${route} should be classified as auth route`
        });
      });
    });

    // Protected routes test cases
    PROTECTED_ROUTES.forEach(route => {
      ['GET', 'POST', 'PUT', 'DELETE'].forEach(method => {
        testCases.push({
          path: route,
          expectedCategory: 'protected',
          method,
          headers: { 'Accept': 'application/json' },
          cookies: {},
          description: `${method} ${route} should be classified as protected route`
        });
      });
    });

    // Next.js internal routes test cases
    NEXT_INTERNAL_ROUTES.forEach(route => {
      testCases.push({
        path: route,
        expectedCategory: 'next-internal',
        method: 'GET',
        headers: { 'Accept': '*/*' },
        cookies: {},
        description: `GET ${route} should be classified as Next.js internal route`
      });
    });

    return testCases;
  };

  // Helper function to create mock NextRequest
  const createMockRequest = (
    path: string,
    method: string = 'GET',
    headers: Record<string, string> = {},
    cookies: Record<string, string> = {}
  ): NextRequest => {
    const url = `https://example.com${path}`;
    const request = new NextRequest(url, { method });
    
    // Set headers
    Object.entries(headers).forEach(([key, value]) => {
      request.headers.set(key, value);
    });

    // Set cookies
    Object.entries(cookies).forEach(([key, value]) => {
      request.cookies.set(key, value);
    });

    return request;
  };

  // Helper function to determine if middleware classifies route correctly
  const isRouteClassifiedCorrectly = async (
    request: NextRequest,
    expectedCategory: string,
    isAuthenticated: boolean = false
  ): Promise<boolean> => {
    // Set up authentication mock
    if (isAuthenticated) {
      mockAuthenticatedResponse();
    } else {
      mockUnauthenticatedResponse();
    }

    try {
      const response = await middleware(request);
      
      // Check classification based on response behavior
      switch (expectedCategory) {
        case 'marketing':
          // Marketing routes should allow guest access (NextResponse.next())
          // But redirect authenticated users to dashboard
          if (isAuthenticated) {
            return response instanceof NextResponse && 
                   response.status >= 300 && response.status < 400 &&
                   response.headers.get('location')?.includes('/dashboard');
          } else {
            // For unauthenticated users, marketing routes should pass through
            // NextResponse.next() returns a response that allows the request to continue
            return response instanceof NextResponse && 
                   (!response.status || response.status === 200 || response.status >= 200 && response.status < 300);
          }
          
        case 'auth':
          // Auth routes should allow guest access but redirect authenticated users
          if (isAuthenticated) {
            return response instanceof NextResponse && 
                   response.status >= 300 && response.status < 400 &&
                   response.headers.get('location')?.includes('/dashboard');
          } else {
            return response instanceof NextResponse && 
                   (!response.status || response.status === 200 || response.status >= 200 && response.status < 300);
          }
          
        case 'protected':
          // Protected routes should redirect unauthenticated users to login
          // And allow authenticated users through
          if (isAuthenticated) {
            return response instanceof NextResponse && 
                   (!response.status || response.status === 200 || response.status >= 200 && response.status < 300);
          } else {
            return response instanceof NextResponse && 
                   response.status >= 300 && response.status < 400 &&
                   response.headers.get('location')?.includes('/auth/login');
          }
          
        case 'next-internal':
          // Next.js internal routes should always pass through with NextResponse.next()
          return response instanceof NextResponse && 
                 (!response.status || response.status === 200 || response.status >= 200 && response.status < 300);
          
        default:
          return false;
      }
    } catch (error) {
      console.error('Route classification test error:', error);
      return false;
    }
  };

  test('should correctly classify all route types for unauthenticated users', async () => {
    const testCases = generateRouteClassificationTestCases();
    
    // Run property test with minimum 100 iterations as per design
    for (let iteration = 0; iteration < Math.max(100, testCases.length); iteration++) {
      const testCase = testCases[iteration % testCases.length];
      const request = createMockRequest(
        testCase.path,
        testCase.method,
        testCase.headers,
        testCase.cookies
      );

      // Property: Route classification should be accurate for unauthenticated users
      const isCorrect = await isRouteClassifiedCorrectly(
        request,
        testCase.expectedCategory,
        false // unauthenticated
      );

      if (!isCorrect) {
        console.error(`Failed test case:`, {
          path: testCase.path,
          category: testCase.expectedCategory,
          method: testCase.method,
          description: testCase.description
        });
      }

      expect(isCorrect).toBe(true);
      
      // Additional property checks based on route type
      const { pathname } = request.nextUrl;
      
      // Property: Marketing routes should be identified correctly
      if (MARKETING_ROUTES.includes(pathname)) {
        expect(testCase.expectedCategory).toBe('marketing');
      }
      
      // Property: Auth routes should be identified correctly
      if (AUTH_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
        expect(testCase.expectedCategory).toBe('auth');
      }
      
      // Property: Protected routes should be identified correctly
      if (PROTECTED_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
        expect(testCase.expectedCategory).toBe('protected');
      }
      
      // Property: Next.js internal routes should be identified correctly
      if (pathname.startsWith('/_next')) {
        expect(testCase.expectedCategory).toBe('next-internal');
      }
    }
  });

  test('should correctly classify all route types for authenticated users', async () => {
    const testCases = generateRouteClassificationTestCases();
    
    // Run property test with minimum 100 iterations
    for (let iteration = 0; iteration < Math.max(100, testCases.length); iteration++) {
      const testCase = testCases[iteration % testCases.length];
      const request = createMockRequest(
        testCase.path,
        testCase.method,
        testCase.headers,
        { access_token: 'valid-token', refresh_token: 'valid-refresh' }
      );

      // Property: Route classification should be accurate for authenticated users
      const isCorrect = await isRouteClassifiedCorrectly(
        request,
        testCase.expectedCategory,
        true // authenticated
      );

      expect(isCorrect).toBe(true);
    }
  });

  test('should maintain consistent classification across different request variations', async () => {
    // Property: Route classification should be consistent regardless of request variations
    const baseRoutes = [...MARKETING_ROUTES, ...AUTH_ROUTES, ...PROTECTED_ROUTES.slice(0, 3)];
    
    for (let iteration = 0; iteration < 100; iteration++) {
      const route = baseRoutes[iteration % baseRoutes.length];
      
      // Test with different header combinations
      const headerVariations = [
        { 'Accept': 'text/html' },
        { 'Accept': 'application/json' },
        { 'RSC': '1' },
        { 'Next-Router-Prefetch': '1' },
        { 'User-Agent': 'Mozilla/5.0' },
        { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0' }
      ];

      const expectedCategory = MARKETING_ROUTES.includes(route) ? 'marketing' :
                              AUTH_ROUTES.some(r => route === r || route.startsWith(r + '/')) ? 'auth' :
                              'protected';

      // Property: Classification should be consistent across header variations
      for (const headers of headerVariations) {
        const request = createMockRequest(route, 'GET', headers);
        const isCorrect = await isRouteClassifiedCorrectly(request, expectedCategory, false);
        expect(isCorrect).toBe(true);
      }
    }
  });

  test('should handle edge cases and malformed routes correctly', async () => {
    const edgeCaseRoutes = [
      '/features/',           // Trailing slash
      '/features?param=1',    // Query parameters
      '/features#section',    // Hash fragment
      '/FEATURES',           // Different case
      '/features/subpage',   // Subpaths of marketing routes
      '/dashboard/../features', // Path traversal attempts
      '//features',          // Double slashes
      '/features%20test',    // URL encoded
      '',                    // Empty path
      '/',                   // Root path
    ];

    for (let iteration = 0; iteration < 100; iteration++) {
      const route = edgeCaseRoutes[iteration % edgeCaseRoutes.length];
      const request = createMockRequest(route);
      
      try {
        const response = await middleware(request);
        
        // Property: Middleware should handle all routes without throwing errors
        expect(response).toBeInstanceOf(NextResponse);
        
        // Property: Response should have valid status code
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(600);
        
      } catch (error) {
        // Property: Middleware should not throw unhandled errors
        fail(`Middleware threw error for route ${route}: ${error}`);
      }
    }
  });

  test('should correctly identify marketing routes with exact path matching', async () => {
    // Property: Marketing route identification should use exact path matching
    for (let iteration = 0; iteration < 100; iteration++) {
      const marketingRoute = MARKETING_ROUTES[iteration % MARKETING_ROUTES.length];
      
      // Test exact match
      const exactRequest = createMockRequest(marketingRoute);
      mockUnauthenticatedResponse();
      const exactResponse = await middleware(exactRequest);
      
      // Property: Exact marketing routes should allow guest access
      expect(exactResponse.status).toBe(200);
      
      // Test non-marketing route that might be similar
      const nonMarketingRoute = marketingRoute + '/subpage';
      if (!MARKETING_ROUTES.includes(nonMarketingRoute)) {
        const nonMarketingRequest = createMockRequest(nonMarketingRoute);
        mockUnauthenticatedResponse();
        const nonMarketingResponse = await middleware(nonMarketingRequest);
        
        // Property: Non-marketing routes should redirect to login for unauthenticated users
        expect(nonMarketingResponse.status).toBeGreaterThanOrEqual(300);
        expect(nonMarketingResponse.status).toBeLessThan(400);
      }
    }
  });

  test('should maintain route classification consistency across authentication states', async () => {
    // Property: Route classification logic should be consistent regardless of auth state
    const testRoutes = [
      { path: '/', category: 'marketing' },
      { path: '/features', category: 'marketing' },
      { path: '/pricing', category: 'marketing' },
      { path: '/auth/login', category: 'auth' },
      { path: '/dashboard', category: 'protected' },
      { path: '/_next/static/test.js', category: 'next-internal' }
    ];

    for (let iteration = 0; iteration < 100; iteration++) {
      const testRoute = testRoutes[iteration % testRoutes.length];
      
      // Test with unauthenticated user
      const unauthRequest = createMockRequest(testRoute.path);
      mockUnauthenticatedResponse();
      const unauthResponse = await middleware(unauthRequest);
      
      // Test with authenticated user
      const authRequest = createMockRequest(testRoute.path, 'GET', {}, { 
        access_token: 'valid-token' 
      });
      mockAuthenticatedResponse();
      const authResponse = await middleware(authRequest);
      
      // Property: Both responses should be valid NextResponse objects
      expect(unauthResponse).toBeInstanceOf(NextResponse);
      expect(authResponse).toBeInstanceOf(NextResponse);
      
      // Property: Route classification behavior should follow expected patterns
      switch (testRoute.category) {
        case 'marketing':
        case 'auth':
          // Unauthenticated: allow access, Authenticated: redirect to dashboard
          expect(unauthResponse.status).toBe(200);
          expect(authResponse.status).toBeGreaterThanOrEqual(300);
          expect(authResponse.status).toBeLessThan(400);
          break;
          
        case 'protected':
          // Unauthenticated: redirect to login, Authenticated: allow access
          expect(unauthResponse.status).toBeGreaterThanOrEqual(300);
          expect(unauthResponse.status).toBeLessThan(400);
          expect(authResponse.status).toBe(200);
          break;
          
        case 'next-internal':
          // Both: allow access
          expect(unauthResponse.status).toBe(200);
          expect(authResponse.status).toBe(200);
          break;
      }
    }
  });
});
   