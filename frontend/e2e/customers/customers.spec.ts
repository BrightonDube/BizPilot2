/**
 * customers.spec.ts — E2E tests for the Customers feature.
 * Covers: list rendering, search, create form, detail view.
 */
import { test, expect } from '@playwright/test';
import { setupAuth, makePaginatedResponse, MOCK_CUSTOMER } from '../helpers';

test.setTimeout(30000);

async function setupCustomerMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/customers*', async (route) => {
    const url = route.request().url();
    if (url.match(/\/customers\/[^/?]+(\?|$)/)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CUSTOMER) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePaginatedResponse([MOCK_CUSTOMER])) });
    }
  });
}

test.describe('Customers list', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupCustomerMocks(page);
  });

  test('navigates to /customers', async ({ page }) => {
    await page.goto('/customers');
    await expect(page).toHaveURL(/\/customers/);
  });

  test('renders customer full name', async ({ page }) => {
    await page.goto('/customers');
    await expect(page.getByText('Alice Tester')).toBeVisible({ timeout: 10000 });
  });

  test('renders customer email', async ({ page }) => {
    await page.goto('/customers');
    await expect(page.getByText('alice@test.com')).toBeVisible({ timeout: 10000 });
  });

  test('has search input', async ({ page }) => {
    await page.goto('/customers');
    await expect(page.locator('input[type="search"], input[placeholder*="search" i]').first()).toBeVisible({ timeout: 10000 });
  });

  test('has New Customer button', async ({ page }) => {
    await page.goto('/customers');
    const btn = page.getByRole('link', { name: /new customer|add customer/i }).or(
      page.getByRole('button', { name: /new customer|add customer/i })
    );
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Create customer', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupCustomerMocks(page);
  });

  test('navigates to /customers/new', async ({ page }) => {
    await page.goto('/customers/new');
    await expect(page).toHaveURL(/customers\/new/);
  });

  test('renders first name and email fields', async ({ page }) => {
    await page.goto('/customers/new');
    await expect(page.locator('input[id*="first_name" i], input[name*="first_name" i]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('submits form and redirects', async ({ page }) => {
    await page.route('**/api/v1/customers', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ...MOCK_CUSTOMER, id: 'cust-new' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makePaginatedResponse([MOCK_CUSTOMER])) });
      }
    });
    await page.goto('/customers/new');
    const firstNameInput = page.locator('input[id*="first_name" i], input[name*="first_name" i]').first();
    await firstNameInput.fill('Test');
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('test@example.com');
    await page.getByRole('button', { name: /save|create|add/i }).first().click();
    await expect(page).toHaveURL(/\/customers(?!\/new)/, { timeout: 10000 });
  });
});

test.describe('Customer detail', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupCustomerMocks(page);
  });

  test('renders customer name on detail page', async ({ page }) => {
    await page.goto(`/customers/${MOCK_CUSTOMER.id}`);
    await expect(page.getByText('Alice Tester')).toBeVisible({ timeout: 10000 });
  });
});
