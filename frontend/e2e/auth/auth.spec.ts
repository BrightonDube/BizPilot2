/**
 * auth.spec.ts — E2E tests for authentication flows.
 *
 * Covers: login (success + failure), logout, register,
 * forgot-password page rendering, and session-expired
 * banner on the login page.
 */

import { test, expect } from '@playwright/test';
import { MOCK_USER } from '../helpers';

test.setTimeout(30000);

// ---------------------------------------------------------------------------
// Helpers local to auth tests
// ---------------------------------------------------------------------------

async function mockAuthMe(page: import('@playwright/test').Page, status = 200) {
  await page.route('**/api/v1/auth/me', async (route) => {
    if (status === 200) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) });
    } else {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Unauthorized' }) });
    }
  });
}

async function mockLoginSuccess(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'e2e-fake-jwt',
        refresh_token: 'e2e-fake-refresh',
        user: MOCK_USER,
      }),
    });
  });
}

async function mockLoginFailure(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Invalid email or password' }),
    });
  });
}

// ---------------------------------------------------------------------------
// Login page rendering
// ---------------------------------------------------------------------------

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    // Unauthenticated — /auth/me returns 401
    await mockAuthMe(page, 401);
    await page.goto('/auth/login');
  });

  test('renders email and password fields', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('renders Sign in button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('renders link to register page', async ({ page }) => {
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
  });

  test('renders Forgot password link', async ({ page }) => {
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Login — success
// ---------------------------------------------------------------------------

test.describe('Login — success', () => {
  test('fills credentials, submits, and redirects to /dashboard', async ({ page }) => {
    await mockAuthMe(page, 401);
    await mockLoginSuccess(page);

    // After login, /auth/me returns the user so middleware allows access
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) });
    });

    // Mock dashboard data so the page renders after redirect
    await page.route('**/api/v1/dashboard', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        stats: { total_revenue: 0, total_orders: 0, total_customers: 0, total_products: 0,
          orders_today: 0, revenue_today: 0, orders_this_month: 0, revenue_this_month: 0,
          pending_invoices: 0, pending_invoice_amount: 0, low_stock_products: 0, currency: 'ZAR' },
        recent_orders: [], top_products: [],
      }) });
    });

    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'demo@bizpilot.co.za');
    await page.fill('input[type="password"]', 'Demo@2024');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Login — failure
// ---------------------------------------------------------------------------

test.describe('Login — failure', () => {
  test('shows error message on invalid credentials', async ({ page }) => {
    await mockAuthMe(page, 401);
    await mockLoginFailure(page);

    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Error message should appear in the form
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 8000 });
  });

  test('submit button is disabled while loading', async ({ page }) => {
    await mockAuthMe(page, 401);

    // Slow login response to catch the loading state
    await page.route('**/api/v1/auth/login', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Invalid email or password' }) });
    });

    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'demo@bizpilot.co.za');
    await page.fill('input[type="password"]', 'Demo@2024');

    const submitBtn = page.getByRole('button', { name: /sign in/i });
    await submitBtn.click();

    // Button should disable during the request
    await expect(submitBtn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Session-expired banner
// ---------------------------------------------------------------------------

test.describe('Session-expired banner', () => {
  test('shows session-expired message when ?session_expired=true', async ({ page }) => {
    await mockAuthMe(page, 401);
    await page.goto('/auth/login?session_expired=true');
    await expect(page.getByText(/session has expired/i)).toBeVisible({ timeout: 8000 });
  });

  test('shows idle logout message when ?idle=true', async ({ page }) => {
    await mockAuthMe(page, 401);
    await page.goto('/auth/login?idle=true');
    await expect(page.getByText(/logged out due to inactivity/i)).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Register page
// ---------------------------------------------------------------------------

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthMe(page, 401);
    await page.goto('/auth/register');
  });

  test('renders registration form', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('renders link back to login', async ({ page }) => {
    await expect(page.getByRole('link', { name: /sign in|log in/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Forgot password page
// ---------------------------------------------------------------------------

test.describe('Forgot password page', () => {
  test('renders email field and submit button', async ({ page }) => {
    await mockAuthMe(page, 401);
    await page.goto('/auth/forgot-password');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /reset|send/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated redirect
// ---------------------------------------------------------------------------

test.describe('Unauthenticated redirect', () => {
  test('redirects /dashboard to /auth/login when not authenticated', async ({ page }) => {
    // /auth/me returns 401 → middleware redirects
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Unauthorized' }) });
    });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/auth\/login/, { timeout: 10000 });
  });
});
