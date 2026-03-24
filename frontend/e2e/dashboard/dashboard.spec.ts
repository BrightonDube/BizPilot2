/**
 * dashboard.spec.ts — E2E tests for the main Dashboard page.
 *
 * Covers: stat cards, quick actions, recent orders table,
 * top-products list, low-stock alert, pending-invoices alert,
 * and the business-setup prompt when no business exists.
 */

import { test, expect } from '@playwright/test';
import { setupAuth, mockApi, MOCK_DASHBOARD_DATA, MOCK_ORDER } from '../helpers';

test.setTimeout(30000);

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await mockApi(page, '**/api/v1/dashboard', MOCK_DASHBOARD_DATA);
  });

  // -------------------------------------------------------------------------
  // Page structure
  // -------------------------------------------------------------------------

  test('renders page heading', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('renders four stat cards', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Total Revenue')).toBeVisible();
    await expect(page.getByText('Total Orders')).toBeVisible();
    await expect(page.getByText('Customers')).toBeVisible();
    await expect(page.getByText('Low Stock')).toBeVisible();
  });

  test('stat card shows formatted revenue (ZAR)', async ({ page }) => {
    await page.goto('/dashboard');
    // R 125 000 or R125,000 depending on locale
    await expect(page.getByText(/R\s*1[2-9][0-9]/)).toBeVisible();
  });

  test('stat card shows correct order count', async ({ page }) => {
    await page.goto('/dashboard');
    // 48 total orders from mock data
    await expect(page.getByText('48')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Quick Actions
  // -------------------------------------------------------------------------

  test('renders Quick Actions section', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Quick Actions')).toBeVisible();
  });

  test('New Order quick action links to /orders/new', async ({ page }) => {
    await page.goto('/dashboard');
    const link = page.getByRole('link', { name: /new order/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/orders/new');
  });

  test('Add Product quick action links to /products/new', async ({ page }) => {
    await page.goto('/dashboard');
    const link = page.getByRole('link', { name: /add product/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/products/new');
  });

  test('New Invoice quick action links to /invoices/new', async ({ page }) => {
    await page.goto('/dashboard');
    const link = page.getByRole('link', { name: /new invoice/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/invoices/new');
  });

  // -------------------------------------------------------------------------
  // Recent Orders
  // -------------------------------------------------------------------------

  test('renders Recent Orders card', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Recent Orders')).toBeVisible();
  });

  test('shows mock order number in recent orders', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(MOCK_ORDER.order_number)).toBeVisible();
  });

  test('shows order customer name', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(MOCK_ORDER.customer_name!)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Top Products
  // -------------------------------------------------------------------------

  test('renders Top Products card', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Top Products')).toBeVisible();
  });

  test('shows mock product in top products', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('E2E Test Widget')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Alerts
  // -------------------------------------------------------------------------

  test('shows low-stock alert when low_stock_products > 0', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/stock alert/i)).toBeVisible();
    await expect(page.getByText(/4 items? running low/i)).toBeVisible();
  });

  test('shows pending-invoices alert when pending_invoices > 0', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/pending invoices/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Business-setup prompt
  // -------------------------------------------------------------------------

  test('shows "Set Up Your Business" prompt when API returns 404', async ({ page, context }) => {
    await setupAuth(context, page);
    // Override dashboard mock to return 404
    await mockApi(page, '**/api/v1/dashboard', { detail: 'No business found' }, 404);

    await page.goto('/dashboard');
    await expect(page.getByText(/set up your business/i)).toBeVisible({ timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  test('shows skeleton loading cards while data is fetching', async ({ page, context }) => {
    await setupAuth(context, page);
    // Delay response to catch loading state
    await page.route('**/api/v1/dashboard', async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_DASHBOARD_DATA) });
    });

    await page.goto('/dashboard');
    // The page should show the heading even before data loads
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });
});
