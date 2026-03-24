/**
 * orders.spec.ts — E2E tests for the Orders feature.
 * Covers: list rendering, status filters, order detail, create order.
 */
import { test, expect } from '@playwright/test';
import { setupAuth, makePaginatedResponse, MOCK_ORDER, MOCK_CUSTOMER, MOCK_PRODUCT } from '../helpers';

test.setTimeout(30000);

const SINGLE_ORDER = {
  ...MOCK_ORDER,
  items: [
    { id: 'item-01', product_id: MOCK_PRODUCT.id, product_name: MOCK_PRODUCT.name, quantity: 1, unit_price: 199.99, line_total: 199.99 },
  ],
};

async function setupOrderMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/orders*', async (route) => {
    const url = route.request().url();
    if (url.match(/\/orders\/[^/?]+(\?|$)/)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SINGLE_ORDER) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePaginatedResponse([MOCK_ORDER])) });
    }
  });
}

test.describe('Orders list', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupOrderMocks(page);
  });

  test('navigates to /orders', async ({ page }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/orders/);
  });

  test('renders order number', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByText('ORD-2024-001')).toBeVisible({ timeout: 10000 });
  });

  test('renders order customer name', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByText('Alice Tester')).toBeVisible({ timeout: 10000 });
  });

  test('renders order status badge', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByText(/confirmed/i)).toBeVisible({ timeout: 10000 });
  });

  test('has New Order link', async ({ page }) => {
    await page.goto('/orders');
    const btn = page.getByRole('link', { name: /new order|create order/i }).or(
      page.getByRole('button', { name: /new order|create order/i })
    );
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('has search input', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.locator('input[type="search"], input[placeholder*="search" i]').first()).toBeVisible({ timeout: 10000 });
  });

  test('filters by status on select change', async ({ page }) => {
    let filterCalled = false;
    await page.route('**/api/v1/orders*', async (route) => {
      const url = route.request().url();
      if (url.includes('status=pending')) filterCalled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePaginatedResponse([])) });
    });
    await page.goto('/orders');
    // Select pending status from filter dropdown
    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('pending');
    await page.waitForTimeout(500);
    expect(filterCalled).toBe(true);
  });
});

test.describe('Order detail', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupOrderMocks(page);
  });

  test('renders order number on detail page', async ({ page }) => {
    await page.goto(`/orders/${MOCK_ORDER.id}`);
    await expect(page.getByText('ORD-2024-001')).toBeVisible({ timeout: 10000 });
  });

  test('renders line item product name', async ({ page }) => {
    await page.goto(`/orders/${MOCK_ORDER.id}`);
    await expect(page.getByText(MOCK_PRODUCT.name)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Create order', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupOrderMocks(page);
    await page.route('**/api/v1/customers*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePaginatedResponse([MOCK_CUSTOMER])) });
    });
    await page.route('**/api/v1/products*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePaginatedResponse([MOCK_PRODUCT])) });
    });
  });

  test('navigates to /orders/new', async ({ page }) => {
    await page.goto('/orders/new');
    await expect(page).toHaveURL(/orders\/new/);
  });

  test('renders the order form', async ({ page }) => {
    await page.goto('/orders/new');
    // Should render some form element
    await expect(page.locator('form, [data-testid="order-form"]').or(page.getByRole('button', { name: /save|create|add item/i })).first()).toBeVisible({ timeout: 10000 });
  });
});
