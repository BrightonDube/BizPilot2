/**
 * helpers.ts — Shared Playwright E2E utilities
 *
 * Provides:
 * - setupAuth: injects access_token cookie and mocks /auth/me so the Next.js
 *   middleware lets every request through without a real backend.
 * - mockApi: convenience wrapper around page.route for JSON API responses.
 * - Standard mock data factories used across all spec files.
 */

import { type Page, type BrowserContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Mock user returned by /auth/me */
export const MOCK_USER = {
  id: 'user-e2e-01',
  email: 'demo@bizpilot.co.za',
  first_name: 'Demo',
  last_name: 'User',
  role: 'owner',
  business_id: 'biz-e2e-01',
};

/**
 * Inject a fake access_token cookie and mock the /auth/me endpoint so
 * Next.js middleware treats the browser as authenticated.
 * Call this at the start of any test that needs a logged-in state.
 */
export async function setupAuth(context: BrowserContext, page: Page) {
  // Set the HttpOnly cookie that the middleware checks for
  await context.addCookies([
    {
      name: 'access_token',
      value: 'e2e-fake-jwt-token',
      domain: 'localhost',
      path: '/',
      httpOnly: false,  // Playwright can only set non-httpOnly for the context
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  // Mock the middleware's auth validation call
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) });
  });
}

/**
 * Perform the login flow via the real form UI while mocking the backend.
 * Useful for auth-flow tests that need to test the login page itself.
 */
export async function loginViaForm(page: Page) {
  // Mock the login API
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'e2e-fake-jwt-token',
        refresh_token: 'e2e-fake-refresh-token',
        user: MOCK_USER,
      }),
    });
  });

  // Mock /auth/me for the post-login redirect
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) });
  });

  await page.goto('/auth/login');
  await page.fill('input[type="email"]', 'demo@bizpilot.co.za');
  await page.fill('input[type="password"]', 'Demo@2024');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 15000 });
}

// ---------------------------------------------------------------------------
// Generic API mock helper
// ---------------------------------------------------------------------------

/** Fulfill a URL pattern with a JSON body and optional HTTP status. */
export async function mockApi(
  page: Page,
  urlPattern: string,
  body: unknown,
  status = 200,
) {
  await page.route(urlPattern, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

// ---------------------------------------------------------------------------
// Reusable mock-data factories
// ---------------------------------------------------------------------------

export function makePaginatedResponse<T>(items: T[]) {
  return {
    items,
    total: items.length,
    page: 1,
    per_page: 20,
    pages: 1,
  };
}

export const MOCK_PRODUCT = {
  id: 'prod-e2e-01',
  name: 'E2E Test Widget',
  sku: 'E2E-001',
  selling_price: 199.99,
  cost_price: 80.00,
  quantity: 42,
  category_id: 'cat-e2e-01',
  category_name: 'E2E Category',
  is_active: true,
  track_inventory: true,
};

export const MOCK_CUSTOMER = {
  id: 'cust-e2e-01',
  first_name: 'Alice',
  last_name: 'Tester',
  email: 'alice@test.com',
  phone: '+27821234567',
  company_name: 'Test Co',
  customer_type: 'individual',
  total_orders: 3,
  total_spent: 599.97,
  address_line1: '1 Test Street',
  city: 'Cape Town',
  country: 'ZA',
};

export const MOCK_ORDER = {
  id: 'ord-e2e-01',
  order_number: 'ORD-2024-001',
  customer_name: 'Alice Tester',
  customer_id: 'cust-e2e-01',
  status: 'confirmed',
  payment_status: 'paid',
  subtotal: 199.99,
  tax_amount: 30.00,
  discount_amount: 0,
  total: 229.99,
  items_count: 1,
  order_date: '2024-03-01T10:00:00Z',
  created_at: '2024-03-01T10:00:00Z',
};

export const MOCK_INVOICE = {
  id: 'inv-e2e-01',
  invoice_number: 'INV-2024-001',
  customer_name: 'Alice Tester',
  customer_id: 'cust-e2e-01',
  status: 'sent',
  subtotal: 199.99,
  tax_amount: 30.00,
  discount_amount: 0,
  total: 229.99,
  amount_paid: 0,
  balance_due: 229.99,
  issue_date: '2024-03-01',
  due_date: '2024-03-31',
  is_overdue: false,
  created_at: '2024-03-01T10:00:00Z',
};

export const MOCK_SUPPLIER = {
  id: 'sup-e2e-01',
  name: 'E2E Supplies Ltd',
  contact_name: 'Bob Supplier',
  email: 'bob@supplies.com',
  phone: '+27829876543',
  address: '42 Supply Road',
  city: 'Johannesburg',
  country: 'ZA',
  payment_terms: 30,
  is_active: true,
};

export const MOCK_DASHBOARD_DATA = {
  stats: {
    total_revenue: 125000,
    total_orders: 48,
    total_customers: 22,
    total_products: 15,
    orders_today: 3,
    revenue_today: 8750,
    orders_this_month: 18,
    revenue_this_month: 45000,
    pending_invoices: 2,
    pending_invoice_amount: 5800,
    low_stock_products: 4,
    currency: 'ZAR',
  },
  recent_orders: [MOCK_ORDER],
  top_products: [
    { id: MOCK_PRODUCT.id, name: MOCK_PRODUCT.name, sku: MOCK_PRODUCT.sku, quantity_sold: 12, revenue: 2399.88 },
  ],
  revenue_by_month: [],
  products_by_category: [],
  inventory_status: [],
};
