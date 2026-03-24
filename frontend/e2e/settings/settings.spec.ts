/**
 * settings.spec.ts — E2E tests for the Settings feature.
 * Covers: page load, profile tab, business tab, security tab, billing tab.
 */
import { test, expect } from '@playwright/test';
import { setupAuth, MOCK_USER } from '../helpers';

test.setTimeout(30000);

const MOCK_BUSINESS = {
  id: 'biz-e2e-01',
  name: 'E2E Test Business',
  email: 'biz@test.com',
  phone: '+27211234567',
  address: '1 Business Street',
  city: 'Cape Town',
  country: 'ZA',
  currency: 'ZAR',
  tax_number: '1234567890',
  tax_rate: 15,
};

const MOCK_SUBSCRIPTION: Record<string, unknown> = {
  id: 'sub-e2e-01',
  tier: 'pro',
  status: 'active',
  current_period_end: '2025-12-31T00:00:00Z',
};

async function setupSettingsMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/business*', async (route) => {
    const method = route.request().method();
    if (method === 'PATCH' || method === 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BUSINESS) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BUSINESS) });
    }
  });
  await page.route('**/api/v1/users/me*', async (route) => {
    const method = route.request().method();
    if (method === 'PATCH' || method === 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) });
    }
  });
  await page.route('**/api/v1/subscriptions*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SUBSCRIPTION) });
  });
  await page.route('**/api/v1/settings*', async (route) => {
    const method = route.request().method();
    if (method === 'PATCH' || method === 'PUT' || method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        auto_clock_out_paid_hours: 8,
        default_currency: 'ZAR',
        tax_rate: 15,
      }) });
    }
  });
}

test.describe('Settings page', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupSettingsMocks(page);
  });

  test('navigates to /settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
  });

  test('renders settings page heading', async ({ page }) => {
    await page.goto('/settings');
    await expect(
      page.getByRole('heading', { name: /settings/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('renders Profile tab', async ({ page }) => {
    await page.goto('/settings');
    await expect(
      page.getByRole('tab', { name: /profile/i }).or(page.getByRole('button', { name: /profile/i })).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('renders Business tab', async ({ page }) => {
    await page.goto('/settings');
    await expect(
      page.getByRole('tab', { name: /business/i }).or(page.getByRole('button', { name: /business/i })).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('renders Security tab', async ({ page }) => {
    await page.goto('/settings');
    await expect(
      page.getByRole('tab', { name: /security/i }).or(page.getByRole('button', { name: /security/i })).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('renders Billing tab', async ({ page }) => {
    await page.goto('/settings');
    await expect(
      page.getByRole('tab', { name: /billing/i }).or(page.getByRole('button', { name: /billing/i })).first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Settings — Profile tab', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupSettingsMocks(page);
  });

  test('shows email pre-populated from mock user', async ({ page }) => {
    await page.goto('/settings');
    // Click Profile tab if needed
    const profileTab = page.getByRole('tab', { name: /profile/i }).or(page.getByRole('button', { name: /profile/i })).first();
    if (await profileTab.isVisible()) await profileTab.click();
    await expect(page.getByText(MOCK_USER.email)).toBeVisible({ timeout: 10000 });
  });

  test('has Save Changes button on profile tab', async ({ page }) => {
    await page.goto('/settings');
    const profileTab = page.getByRole('tab', { name: /profile/i }).or(page.getByRole('button', { name: /profile/i })).first();
    if (await profileTab.isVisible()) await profileTab.click();
    await expect(page.getByRole('button', { name: /save/i }).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Settings — Business tab', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupSettingsMocks(page);
  });

  test('shows business name on business tab', async ({ page }) => {
    await page.goto('/settings?tab=business');
    const businessTab = page.getByRole('tab', { name: /business/i }).or(page.getByRole('button', { name: /business/i })).first();
    if (await businessTab.isVisible()) await businessTab.click();
    await expect(page.getByText('E2E Test Business')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Settings — Time Tracking', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context, page);
    await setupSettingsMocks(page);
  });

  test('time tracking section shows auto clock-out field if present', async ({ page }) => {
    await page.goto('/settings');
    const ttSection = page.locator('h3, h4').filter({ hasText: /time tracking/i });
    if (await ttSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      const hoursInput = page.locator('input#auto_clock_out_paid_hours');
      await expect(hoursInput).toBeVisible();
    }
  });
});
