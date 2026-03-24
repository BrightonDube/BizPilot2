/**
 * products.spec.ts — E2E tests for the Products feature.
 *
 * Covers: product list page (rendering, search, filters),
 * create-product form, edit-product form, and delete flow.
 */

import { test, expect } from '@playwright/test';
import { setupAuth, makePaginatedResponse, MOCK_PRODUCT } from '../helpers';

test.setTimeout(30000);

const PRODUCT_LIST_URL = '**/api/v1/products*';
const CATEGORY_URL = '**/api/v1/categories*';

async function setupProductMocks(page: import('@playwright/test').Page) {
  await page.route(PRODUCT_LIST_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makePaginatedResponse([MOCK_PRODUCT])),
    });
  });

  await page.route(CATEGORY_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: 'cat-e2e-01', name: 'E2E Category' }] }),
    });
  });
}

// ---------------------------------------------------------------------------
// Product list
// ---------------------------------------------------------------------------

test.describe('Products list', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupProductMocks(page);
  });

  test('navigates to /products without errors', async ({ page }) => {
    await page.goto('/products');
    await expect(page).toHaveURL(/\/products/);
  });

  test('renders product name from mock data', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByText('E2E Test Widget')).toBeVisible({ timeout: 10000 });
  });

  test('renders product SKU', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByText('E2E-001')).toBeVisible({ timeout: 10000 });
  });

  test('renders "Add Product" or "New Product" button', async ({ page }) => {
    await page.goto('/products');
    const addBtn = page.getByRole('link', { name: /add product|new product/i }).or(
      page.getByRole('button', { name: /add product|new product/i })
    );
    await expect(addBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test('has a search input', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('input[placeholder*="search" i], input[type="search"]').first()).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Create product
// ---------------------------------------------------------------------------

test.describe('Create product', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupProductMocks(page);
  });

  test('navigates to /products/new', async ({ page }) => {
    await page.goto('/products/new');
    await expect(page).toHaveURL(/products\/new/);
  });

  test('renders product name field', async ({ page }) => {
    await page.goto('/products/new');
    const nameInput = page.locator('input[id="name"], input[name="name"], input[placeholder*="name" i]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
  });

  test('renders price field', async ({ page }) => {
    await page.goto('/products/new');
    const priceInput = page.locator('input[id*="price" i], input[name*="price" i], input[placeholder*="price" i]').first();
    await expect(priceInput).toBeVisible({ timeout: 10000 });
  });

  test('renders Save / Create button', async ({ page }) => {
    await page.goto('/products/new');
    const saveBtn = page.getByRole('button', { name: /save|create|add product/i });
    await expect(saveBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test('submits create form and handles success', async ({ page }) => {
    // Mock create endpoint
    await page.route('**/api/v1/products', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_PRODUCT, id: 'prod-new-01', name: 'Newly Created' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makePaginatedResponse([MOCK_PRODUCT])),
        });
      }
    });

    await page.goto('/products/new');

    // Fill required fields — use placeholder-based locators for resilience
    const nameInput = page.locator('input[id="name"], input[name="name"]').first();
    await nameInput.fill('Newly Created');

    const priceInput = page.locator('input[id*="selling_price" i], input[name*="selling_price" i], input[id*="price" i]').first();
    await priceInput.fill('199.99');

    const saveBtn = page.getByRole('button', { name: /save|create/i }).first();
    await saveBtn.click();

    // Expect redirect back to the product list
    await expect(page).toHaveURL(/\/products(?!\/new)/, { timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Edit product
// ---------------------------------------------------------------------------

test.describe('Edit product', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupProductMocks(page);

    // Mock single product fetch
    await page.route(`**/api/v1/products/${MOCK_PRODUCT.id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PRODUCT),
      });
    });
  });

  test('navigates to /products/:id/edit', async ({ page }) => {
    await page.goto(`/products/${MOCK_PRODUCT.id}/edit`);
    await expect(page).toHaveURL(new RegExp(`products/${MOCK_PRODUCT.id}/edit`));
  });

  test('pre-populates product name field', async ({ page }) => {
    await page.goto(`/products/${MOCK_PRODUCT.id}/edit`);
    const nameInput = page.locator('input[id="name"], input[name="name"]').first();
    await expect(nameInput).toHaveValue(MOCK_PRODUCT.name, { timeout: 10000 });
  });
});
