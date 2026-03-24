/**
 * suppliers.spec.ts — E2E tests for the Suppliers feature.
 * Covers: list rendering, create form, edit form, detail view.
 */
import { test, expect } from '@playwright/test';
import { setupAuth, makePaginatedResponse, MOCK_SUPPLIER } from '../helpers';

test.setTimeout(30000);

async function setupSupplierMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/suppliers*', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (method === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ...MOCK_SUPPLIER, id: 'sup-new' }) });
    } else if (url.match(/\/suppliers\/[^/?]+(\?|$)/)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SUPPLIER) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePaginatedResponse([MOCK_SUPPLIER])) });
    }
  });
}

test.describe('Suppliers list', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupSupplierMocks(page);
  });

  test('navigates to /suppliers', async ({ page }) => {
    await page.goto('/suppliers');
    await expect(page).toHaveURL(/\/suppliers/);
  });

  test('renders supplier name', async ({ page }) => {
    await page.goto('/suppliers');
    await expect(page.getByText('E2E Supplies Ltd')).toBeVisible({ timeout: 10000 });
  });

  test('renders supplier contact name', async ({ page }) => {
    await page.goto('/suppliers');
    await expect(page.getByText('Bob Supplier')).toBeVisible({ timeout: 10000 });
  });

  test('renders supplier email', async ({ page }) => {
    await page.goto('/suppliers');
    await expect(page.getByText('bob@supplies.com')).toBeVisible({ timeout: 10000 });
  });

  test('has New Supplier button', async ({ page }) => {
    await page.goto('/suppliers');
    const btn = page.getByRole('link', { name: /new supplier|add supplier/i }).or(
      page.getByRole('button', { name: /new supplier|add supplier/i })
    );
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('has search input', async ({ page }) => {
    await page.goto('/suppliers');
    await expect(
      page.locator('input[type="search"], input[placeholder*="search" i]').first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Create supplier', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupSupplierMocks(page);
  });

  test('navigates to /suppliers/new', async ({ page }) => {
    await page.goto('/suppliers/new');
    await expect(page).toHaveURL(/suppliers\/new/);
  });

  test('renders supplier name field', async ({ page }) => {
    await page.goto('/suppliers/new');
    const nameInput = page.locator('input[id="name"], input[name="name"]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
  });

  test('renders email field', async ({ page }) => {
    await page.goto('/suppliers/new');
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('submits form and redirects to supplier list', async ({ page }) => {
    await page.goto('/suppliers/new');
    const nameInput = page.locator('input[id="name"], input[name="name"]').first();
    await nameInput.fill('New Test Supplier');
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('new@supplier.com');
    await page.getByRole('button', { name: /save|create|add/i }).first().click();
    await expect(page).toHaveURL(/\/suppliers(?!\/new)/, { timeout: 10000 });
  });
});

test.describe('Edit supplier', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupSupplierMocks(page);
    await page.route('**/api/v1/suppliers/**', async (route) => {
      const method = route.request().method();
      if (method === 'PATCH' || method === 'PUT') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SUPPLIER) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SUPPLIER) });
      }
    });
  });

  test('navigates to /suppliers/:id/edit', async ({ page }) => {
    await page.goto(`/suppliers/${MOCK_SUPPLIER.id}/edit`);
    await expect(page).toHaveURL(new RegExp(`suppliers/${MOCK_SUPPLIER.id}/edit`));
  });

  test('pre-populates supplier name', async ({ page }) => {
    await page.goto(`/suppliers/${MOCK_SUPPLIER.id}/edit`);
    const nameInput = page.locator('input[id="name"], input[name="name"]').first();
    await expect(nameInput).toHaveValue('E2E Supplies Ltd', { timeout: 10000 });
  });
});

test.describe('Supplier detail', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupSupplierMocks(page);
  });

  test('renders supplier detail page', async ({ page }) => {
    await page.goto(`/suppliers/${MOCK_SUPPLIER.id}`);
    await expect(page.getByText('E2E Supplies Ltd')).toBeVisible({ timeout: 10000 });
  });
});
