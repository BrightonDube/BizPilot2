/**
 * reports.spec.ts — E2E tests for the Reports feature.
 * Covers: main reports page, sales report, inventory report, staff report.
 */
import { test, expect } from '@playwright/test';
import { setupAuth } from '../helpers';

test.setTimeout(30000);

const MOCK_REPORT_STATS = {
  total_revenue: 45000,
  total_orders: 18,
  total_customers: 22,
  total_products: 15,
  revenue_change: 12.5,
  orders_change: 8.0,
  customers_change: 5.2,
};

const MOCK_REVENUE_TREND = [
  { date: '2024-01-01', revenue: 8000, orders: 3 },
  { date: '2024-02-01', revenue: 12000, orders: 5 },
  { date: '2024-03-01', revenue: 15000, orders: 7 },
];

const MOCK_TOP_PRODUCTS = [
  { id: 'p1', name: 'Widget A', sales: 24, revenue: 4800 },
  { id: 'p2', name: 'Widget B', sales: 18, revenue: 3600 },
];

async function setupReportMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/reports*', async (route) => {
    const url = route.request().url();
    if (url.includes('/revenue') || url.includes('/trend')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_REVENUE_TREND) });
    } else if (url.includes('/products')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TOP_PRODUCTS) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_REPORT_STATS) });
    }
  });
  // Also mock individual report sub-routes
  await page.route('**/api/v1/sales*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) });
  });
}

test.describe('Reports main page', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupReportMocks(page);
  });

  test('navigates to /reports', async ({ page }) => {
    await page.goto('/reports');
    await expect(page).toHaveURL(/\/reports/);
  });

  test('renders a heading with "Reports" or "Analytics"', async ({ page }) => {
    await page.goto('/reports');
    await expect(
      page.getByRole('heading', { name: /reports|analytics/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('renders revenue stat card', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByText(/total revenue|revenue/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('renders orders stat card', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByText(/total orders|orders/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('renders top-products section', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByText(/top products|best.?selling/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('has date-range or period selector', async ({ page }) => {
    await page.goto('/reports');
    const selector = page.locator('select').or(page.getByRole('combobox')).first();
    await expect(selector).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Sales report page', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupReportMocks(page);
    await page.route('**/api/v1/reports/sales*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, pages: 0, per_page: 20 }) });
    });
  });

  test('navigates to /reports/sales', async ({ page }) => {
    await page.goto('/reports/sales');
    await expect(page).toHaveURL(/reports\/sales/);
  });

  test('renders sales report heading', async ({ page }) => {
    await page.goto('/reports/sales');
    await expect(
      page.getByRole('heading', { name: /sales/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Inventory report page', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupReportMocks(page);
    await page.route('**/api/v1/reports/inventory*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    });
    await page.route('**/api/v1/inventory*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, pages: 0, per_page: 20 }) });
    });
  });

  test('navigates to /reports/inventory', async ({ page }) => {
    await page.goto('/reports/inventory');
    await expect(page).toHaveURL(/reports\/inventory/);
  });

  test('renders inventory report heading', async ({ page }) => {
    await page.goto('/reports/inventory');
    await expect(
      page.getByRole('heading', { name: /inventory/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Staff report page', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupReportMocks(page);
    await page.route('**/api/v1/reports/staff*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    });
  });

  test('navigates to /reports/staff', async ({ page }) => {
    await page.goto('/reports/staff');
    await expect(page).toHaveURL(/reports\/staff/);
  });
});
