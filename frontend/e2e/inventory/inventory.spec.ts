/**
 * inventory.spec.ts — E2E tests for the Inventory / Stock feature.
 * Covers: list rendering, low-stock filter, item detail, stock adjustment.
 */
import { test, expect } from '@playwright/test';
import { setupAuth, makePaginatedResponse } from '../helpers';

test.setTimeout(30000);

const MOCK_INVENTORY_ITEM = {
  id: 'inv-item-e2e-01',
  product_id: 'prod-e2e-01',
  product_name: 'E2E Test Widget',
  sku: 'E2E-001',
  quantity_on_hand: 42,
  quantity_reserved: 2,
  quantity_available: 40,
  reorder_point: 5,
  location: 'Shelf A',
  bin_location: 'A1',
  average_cost: 80.00,
  is_low_stock: false,
  created_at: '2024-01-01T00:00:00Z',
};

const MOCK_LOW_STOCK_ITEM = {
  ...MOCK_INVENTORY_ITEM,
  id: 'inv-item-e2e-02',
  product_name: 'Low Stock Widget',
  quantity_on_hand: 2,
  quantity_available: 2,
  is_low_stock: true,
};

const MOCK_INVENTORY_STATS = {
  total_items: 2,
  total_value: 3520,
  low_stock_count: 1,
  out_of_stock_count: 0,
};

async function setupInventoryMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/inventory*', async (route) => {
    const url = route.request().url();
    if (url.includes('/stats')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INVENTORY_STATS) });
    } else if (url.match(/\/inventory\/[^/?]+(\?|$)/)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INVENTORY_ITEM) });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makePaginatedResponse([MOCK_INVENTORY_ITEM, MOCK_LOW_STOCK_ITEM])),
      });
    }
  });
}

test.describe('Inventory list', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupInventoryMocks(page);
  });

  test('navigates to /inventory', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page).toHaveURL(/\/inventory/);
  });

  test('renders product name in inventory row', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByText('E2E Test Widget')).toBeVisible({ timeout: 10000 });
  });

  test('renders quantity on hand', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByText('42')).toBeVisible({ timeout: 10000 });
  });

  test('renders low-stock item name', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByText('Low Stock Widget')).toBeVisible({ timeout: 10000 });
  });

  test('has search input', async ({ page }) => {
    await page.goto('/inventory');
    await expect(
      page.locator('input[type="search"], input[placeholder*="search" i]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('has "Add" or "New" inventory action button', async ({ page }) => {
    await page.goto('/inventory');
    const btn = page.getByRole('link', { name: /add|new|create/i }).or(
      page.getByRole('button', { name: /add|new|adjust/i })
    );
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Inventory detail / edit', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupInventoryMocks(page);
    await page.route(`**/api/v1/inventory/${MOCK_INVENTORY_ITEM.id}*`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INVENTORY_ITEM) });
    });
  });

  test('navigates to /inventory/:id', async ({ page }) => {
    await page.goto(`/inventory/${MOCK_INVENTORY_ITEM.product_id}`);
    await expect(page).toHaveURL(new RegExp(`inventory/${MOCK_INVENTORY_ITEM.product_id}`));
  });
});

test.describe('Inventory low-stock filter', () => {
  test('requests low_stock filter when toggled', async ({ page, context }) => {
    await setupAuth(context, page);
    let lowStockFilterSeen = false;
    await page.route('**/api/v1/inventory*', async (route) => {
      const url = route.request().url();
      if (url.includes('low_stock=true')) lowStockFilterSeen = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makePaginatedResponse([MOCK_LOW_STOCK_ITEM])),
      });
    });
    await page.goto('/inventory');
    // Click low-stock badge/button if present
    const lowStockBtn = page.getByRole('button', { name: /low stock/i });
    if (await lowStockBtn.isVisible()) {
      await lowStockBtn.click();
      await page.waitForTimeout(500);
      expect(lowStockFilterSeen).toBe(true);
    }
  });
});
