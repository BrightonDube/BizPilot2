import { test, expect, type Page } from '@playwright/test';

test.setTimeout(60000);

async function login(page: Page) {
  await page.goto('/auth/login');
  
  const emailInput = page.locator('input[type="email"]');
  try {
    // Check if we are on login page
    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    // If input not found, maybe we are already redirected
    if (page.url().includes('dashboard')) {
      return;
    }
    // Or maybe redirection is in progress
    try {
      await page.waitForURL(/dashboard/, { timeout: 5000 });
      return;
    } catch {
      throw new Error(`Login failed: Not on login page and not on dashboard. Current URL: ${page.url()}`);
    }
  }

  await page.fill('input[type="email"]', 'demo@bizpilot.co.za');
  await page.fill('input[type="password"]', 'Demo@2024');
  await page.click('button[type="submit"]');
  // Wait for redirect to dashboard or home
  await page.waitForURL(/dashboard|$/);
}

test.describe('POS Core Screen', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Auth
    await page.route('**/api/v1/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'mock-token', token_type: 'bearer' })
      });
    });
    
    await page.route('**/api/v1/auth/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u1',
          email: 'demo@bizpilot.co.za',
          full_name: 'Demo User',
          is_active: true,
          is_superuser: true
        })
      });
    });

    await page.route('**/api/v1/business/status', async route => {
        await route.fulfill({ status: 200, body: JSON.stringify({ status: 'active' }) });
    });

    // Mock products/categories for ALL tests to prevent real backend calls
    await page.route('**/api/v1/products*', async route => {
      const json = {
        items: [
          {
            id: 'p1',
            name: 'Playwright Product',
            selling_price: 50.00,
            status: 'active',
            track_inventory: false,
            quantity: 100,
            image_url: null
          }
        ],
        total: 1
      };
      await route.fulfill({ json });
    });

    await page.route('**/api/v1/categories*', async route => {
        const json = {
            items: [
                { id: 'c1', name: 'Test Category', icon: null, color: null, parent_id: null }
            ]
        };
        await route.fulfill({ json });
    });

    await page.route('**/api/v1/orders', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'order-mock-123', order_number: 'ORD-001' })
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/v1/orders/order-mock-123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order_number: 'ORD-001',
          items_count: 1,
          items: [{ id: 'i1', name: 'Playwright Product', quantity: 1, total: 57.50 }],
          total: 57.50
        })
      });
    });

    await login(page);
  });

  test('loads POS interface components', async ({ page }) => {
    // Navigate to POS
    await page.goto('/pos');
    
    // Check if the page loaded
    await expect(page).toHaveURL(/\/pos/);
    
    // Check main panels
    const searchInput = page.getByPlaceholder('Search products...');
    await expect(searchInput).toBeVisible();
    
    const cartHeader = page.getByRole('heading', { name: 'Cart' });
    await expect(cartHeader).toBeVisible();
    
    // Check if categories are loading or loaded
    // Initially skeleton, then buttons.
    // Wait for at least "All" button which is always there if loaded
    const allButton = page.getByRole('button', { name: 'All' });
    // It might take time to load categories
    await expect(allButton).toBeVisible({ timeout: 10000 });
  });

  test('cart interaction with mocked data', async ({ page }) => {
    await page.goto('/pos');
    
    // Find our product
    const productButton = page.getByRole('button', { name: 'Playwright Product' });
    await expect(productButton).toBeVisible();
    
    // Add to cart
    await productButton.click();
    
    // Check cart item is visible in the right panel
    const cartItem = page.getByText('Playwright Product').last();
    await expect(cartItem).toBeVisible();
    
    // Check Checkout button appears with price (50 + 15% tax = 57.50)
    const checkoutButton = page.getByRole('button', { name: /checkout/i });
    await expect(checkoutButton).toBeVisible();
    await expect(checkoutButton).toContainText('R57.50');
    
    // Test quantity increase — locate the row's plus button
    const quantityPlusButton = page.locator('[aria-label="Increase quantity"]').first();
    await quantityPlusButton.click();
    
    // Expect total to double: 57.50 * 2 = 115.00
    await expect(checkoutButton).toContainText('R115.00');
  });

  test('complete sale flow: add item → payment → receipt', async ({ page }) => {
    await page.goto('/pos');

    // Step 1: Add product to cart
    const productButton = page.getByRole('button', { name: 'Playwright Product' });
    await expect(productButton).toBeVisible({ timeout: 10000 });
    await productButton.click();

    // Step 2: Verify cart has item and click Checkout
    const checkoutButton = page.getByRole('button', { name: /checkout/i });
    await expect(checkoutButton).toBeVisible();
    await expect(checkoutButton).toContainText('R57.50');
    await checkoutButton.click();

    // Step 3: Should navigate to payment page
    await expect(page).toHaveURL(/\/pos\/payment/);
    await expect(page.getByText('Payment Processing')).toBeVisible();

    // Step 4: Select Cash payment method
    const cashButton = page.getByRole('button', { name: 'Cash' });
    await expect(cashButton).toBeVisible();
    await cashButton.click();

    // Step 5: Click Exact Amount in the cash panel
    const exactAmountButton = page.getByRole('button', { name: /exact amount/i });
    await expect(exactAmountButton).toBeVisible();
    await exactAmountButton.click();

    // Step 6: Verify balance is cleared and Finalize Sale is enabled
    const finalizeButton = page.getByRole('button', { name: /finalize sale/i });
    await expect(finalizeButton).toBeVisible();
    await expect(finalizeButton).toBeEnabled();

    // Step 7: Finalize the order
    await finalizeButton.click();

    // Step 8: Should navigate to receipt page
    await expect(page).toHaveURL(/\/pos\/receipt\?orderId=order-mock-123/, { timeout: 10000 });

    // Step 9: Verify receipt shows order details
    await expect(page.getByText('ORD-001')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Playwright Product')).toBeVisible();
  });
});
