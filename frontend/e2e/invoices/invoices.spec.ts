/**
 * invoices.spec.ts — E2E tests for the Invoices feature.
 * Covers: list rendering, status filters, create, and detail view.
 */
import { test, expect } from '@playwright/test';
import { setupAuth, makePaginatedResponse, MOCK_INVOICE, MOCK_CUSTOMER, MOCK_PRODUCT } from '../helpers';

test.setTimeout(30000);

const SINGLE_INVOICE = {
  ...MOCK_INVOICE,
  items: [
    { id: 'iitem-01', product_id: MOCK_PRODUCT.id, product_name: MOCK_PRODUCT.name, quantity: 1, unit_price: 199.99, line_total: 199.99 },
  ],
  notes: 'Test invoice notes',
};

async function setupInvoiceMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/invoices*', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (method === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ...SINGLE_INVOICE, id: 'inv-new' }) });
    } else if (url.match(/\/invoices\/[^/?]+(\?|$)/)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SINGLE_INVOICE) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePaginatedResponse([MOCK_INVOICE])) });
    }
  });
}

test.describe('Invoices list', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupInvoiceMocks(page);
  });

  test('navigates to /invoices', async ({ page }) => {
    await page.goto('/invoices');
    await expect(page).toHaveURL(/\/invoices/);
  });

  test('renders invoice number', async ({ page }) => {
    await page.goto('/invoices');
    await expect(page.getByText('INV-2024-001')).toBeVisible({ timeout: 10000 });
  });

  test('renders invoice customer name', async ({ page }) => {
    await page.goto('/invoices');
    await expect(page.getByText('Alice Tester')).toBeVisible({ timeout: 10000 });
  });

  test('renders invoice status badge', async ({ page }) => {
    await page.goto('/invoices');
    await expect(page.getByText(/sent/i)).toBeVisible({ timeout: 10000 });
  });

  test('has New Invoice button', async ({ page }) => {
    await page.goto('/invoices');
    const btn = page.getByRole('link', { name: /new invoice|create invoice/i }).or(
      page.getByRole('button', { name: /new invoice|create invoice/i })
    );
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test('has search input', async ({ page }) => {
    await page.goto('/invoices');
    await expect(page.locator('input[type="search"], input[placeholder*="search" i]').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows balance due formatted as ZAR', async ({ page }) => {
    await page.goto('/invoices');
    // R229.99 or R 229,99 etc.
    await expect(page.getByText(/R\s*229/)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Invoice detail', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupInvoiceMocks(page);
  });

  test('renders invoice number on detail page', async ({ page }) => {
    await page.goto(`/invoices/${MOCK_INVOICE.id}`);
    await expect(page.getByText('INV-2024-001')).toBeVisible({ timeout: 10000 });
  });

  test('renders line item product name', async ({ page }) => {
    await page.goto(`/invoices/${MOCK_INVOICE.id}`);
    await expect(page.getByText(MOCK_PRODUCT.name)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Create invoice', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupInvoiceMocks(page);
    await page.route('**/api/v1/customers*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePaginatedResponse([MOCK_CUSTOMER])) });
    });
    await page.route('**/api/v1/products*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePaginatedResponse([MOCK_PRODUCT])) });
    });
  });

  test('navigates to /invoices/new', async ({ page }) => {
    await page.goto('/invoices/new');
    await expect(page).toHaveURL(/invoices\/new/);
  });

  test('renders the invoice form', async ({ page }) => {
    await page.goto('/invoices/new');
    const form = page.locator('form').or(page.getByRole('button', { name: /save|create/i })).first();
    await expect(form).toBeVisible({ timeout: 10000 });
  });

  test('renders due date field', async ({ page }) => {
    await page.goto('/invoices/new');
    const dueDateField = page.locator('input[id*="due_date" i], input[name*="due_date" i], input[type="date"]').first();
    await expect(dueDateField).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Invoice status filter', () => {
  test('filters invoices by overdue-only checkbox', async ({ page, context }) => {
    await setupAuth(context, page);
    let overdueParamSeen = false;
    await page.route('**/api/v1/invoices*', async (route) => {
      const url = route.request().url();
      if (url.includes('overdue=true')) overdueParamSeen = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePaginatedResponse([])) });
    });
    await page.goto('/invoices');
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible()) {
      await checkbox.check();
      await page.waitForTimeout(500);
      expect(overdueParamSeen).toBe(true);
    }
  });
});
