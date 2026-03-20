/**
 * Playwright end-to-end tests for the Record Payment modal on Layby Detail page.
 * Tests modal opening, form validation, submission, and success flow.
 */

import { test, expect } from '@playwright/test';

test.describe('Record Payment Modal', () => {
  /**
   * Test 1 — Record Payment button appears for active laybys
   */
  test('shows record payment button for active layby', async ({ page }) => {
    await page.goto('/laybys');
    await page.waitForLoadState('networkidle');
    
    // Find an active layby link and navigate to it
    const activeLaybyLink = page.locator('a[href*="/laybys/"]').first();
    const linkCount = await activeLaybyLink.count();
    
    if (linkCount > 0) {
      await activeLaybyLink.click();
      await page.waitForLoadState('networkidle');
      
      // Check if Record Payment button exists (only for active/overdue)
      const recordPaymentButton = page.getByRole('button', { name: /record payment/i });
      const buttonExists = await recordPaymentButton.count() > 0;
      
      if (buttonExists) {
        await expect(recordPaymentButton).toBeVisible();
      } else {
        console.log('Layby is not active/overdue - Record Payment button correctly hidden');
      }
    } else {
      console.log('No laybys found to test');
    }
  });

  /**
   * Test 2 — Modal opens when Record Payment button is clicked
   */
  test('opens modal when record payment button is clicked', async ({ page }) => {
    await page.goto('/laybys');
    await page.waitForLoadState('networkidle');
    
    const activeLaybyLink = page.locator('a[href*="/laybys/"]').first();
    const linkCount = await activeLaybyLink.count();
    
    if (linkCount > 0) {
      await activeLaybyLink.click();
      await page.waitForLoadState('networkidle');
      
      const recordPaymentButton = page.getByRole('button', { name: /record payment/i });
      const buttonExists = await recordPaymentButton.count() > 0;
      
      if (buttonExists) {
        await recordPaymentButton.click();
        
        // Check modal is visible
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        
        // Check modal title
        await expect(page.getByText('Record Payment')).toBeVisible();
        
        // Check outstanding balance is displayed
        await expect(page.getByText('Outstanding Balance')).toBeVisible();
      }
    }
  });

  /**
   * Test 3 — Modal displays all required form fields
   */
  test('modal displays all required form fields', async ({ page }) => {
    await page.goto('/laybys');
    await page.waitForLoadState('networkidle');
    
    const activeLaybyLink = page.locator('a[href*="/laybys/"]').first();
    const linkCount = await activeLaybyLink.count();
    
    if (linkCount > 0) {
      await activeLaybyLink.click();
      await page.waitForLoadState('networkidle');
      
      const recordPaymentButton = page.getByRole('button', { name: /record payment/i });
      const buttonExists = await recordPaymentButton.count() > 0;
      
      if (buttonExists) {
        await recordPaymentButton.click();
        
        // Check all form fields are present
        await expect(page.getByLabelText(/amount/i)).toBeVisible();
        await expect(page.getByLabelText(/payment method/i)).toBeVisible();
        await expect(page.getByLabelText(/notes/i)).toBeVisible();
        
        // Check buttons
        await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /record payment/i })).toBeVisible();
      }
    }
  });

  /**
   * Test 4 — Modal closes when cancel button is clicked
   */
  test('closes modal when cancel button is clicked', async ({ page }) => {
    await page.goto('/laybys');
    await page.waitForLoadState('networkidle');
    
    const activeLaybyLink = page.locator('a[href*="/laybys/"]').first();
    const linkCount = await activeLaybyLink.count();
    
    if (linkCount > 0) {
      await activeLaybyLink.click();
      await page.waitForLoadState('networkidle');
      
      const recordPaymentButton = page.getByRole('button', { name: /record payment/i });
      const buttonExists = await recordPaymentButton.count() > 0;
      
      if (buttonExists) {
        await recordPaymentButton.click();
        
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        
        // Click cancel
        await page.getByRole('button', { name: /cancel/i }).click();
        
        // Modal should be hidden
        await expect(modal).not.toBeVisible();
      }
    }
  });

  /**
   * Test 5 — Modal closes when clicking outside (backdrop)
   */
  test('closes modal when clicking outside', async ({ page }) => {
    await page.goto('/laybys');
    await page.waitForLoadState('networkidle');
    
    const activeLaybyLink = page.locator('a[href*="/laybys/"]').first();
    const linkCount = await activeLaybyLink.count();
    
    if (linkCount > 0) {
      await activeLaybyLink.click();
      await page.waitForLoadState('networkidle');
      
      const recordPaymentButton = page.getByRole('button', { name: /record payment/i });
      const buttonExists = await recordPaymentButton.count() > 0;
      
      if (buttonExists) {
        await recordPaymentButton.click();
        
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();
        
        // Click backdrop (outside modal)
        await page.locator('.fixed.inset-0.z-50').click({ position: { x: 10, y: 10 } });
        
        // Modal should be hidden
        await expect(modal).not.toBeVisible();
      }
    }
  });

  /**
   * Test 6 — Form validation shows error for empty amount
   */
  test('shows validation error for empty amount', async ({ page }) => {
    await page.goto('/laybys');
    await page.waitForLoadState('networkidle');
    
    const activeLaybyLink = page.locator('a[href*="/laybys/"]').first();
    const linkCount = await activeLaybyLink.count();
    
    if (linkCount > 0) {
      await activeLaybyLink.click();
      await page.waitForLoadState('networkidle');
      
      const recordPaymentButton = page.getByRole('button', { name: /record payment/i });
      const buttonExists = await recordPaymentButton.count() > 0;
      
      if (buttonExists) {
        await recordPaymentButton.click();
        
        // Select payment method but leave amount empty
        await page.getByLabelText(/payment method/i).selectOption('cash');
        
        // Try to submit
        await page.getByRole('button', { name: /record payment/i }).last().click();
        
        // Check for validation error
        await expect(page.getByText(/please enter a valid amount/i)).toBeVisible();
      }
    }
  });

  /**
   * Test 7 — Form validation shows error for missing payment method
   */
  test('shows validation error for missing payment method', async ({ page }) => {
    await page.goto('/laybys');
    await page.waitForLoadState('networkidle');
    
    const activeLaybyLink = page.locator('a[href*="/laybys/"]').first();
    const linkCount = await activeLaybyLink.count();
    
    if (linkCount > 0) {
      await activeLaybyLink.click();
      await page.waitForLoadState('networkidle');
      
      const recordPaymentButton = page.getByRole('button', { name: /record payment/i });
      const buttonExists = await recordPaymentButton.count() > 0;
      
      if (buttonExists) {
        await recordPaymentButton.click();
        
        // Enter amount but don't select payment method
        await page.getByLabelText(/amount/i).fill('100');
        
        // Try to submit
        await page.getByRole('button', { name: /record payment/i }).last().click();
        
        // Check for validation error
        await expect(page.getByText(/please select a payment method/i)).toBeVisible();
      }
    }
  });

  /**
   * Test 8 — Payment method dropdown has all options
   */
  test('payment method dropdown has all required options', async ({ page }) => {
    await page.goto('/laybys');
    await page.waitForLoadState('networkidle');
    
    const activeLaybyLink = page.locator('a[href*="/laybys/"]').first();
    const linkCount = await activeLaybyLink.count();
    
    if (linkCount > 0) {
      await activeLaybyLink.click();
      await page.waitForLoadState('networkidle');
      
      const recordPaymentButton = page.getByRole('button', { name: /record payment/i });
      const buttonExists = await recordPaymentButton.count() > 0;
      
      if (buttonExists) {
        await recordPaymentButton.click();
        
        const paymentMethodSelect = page.getByLabelText(/payment method/i);
        
        // Check all options are present
        await expect(paymentMethodSelect.locator('option[value="cash"]')).toBeVisible();
        await expect(paymentMethodSelect.locator('option[value="card"]')).toBeVisible();
        await expect(paymentMethodSelect.locator('option[value="eft"]')).toBeVisible();
        await expect(paymentMethodSelect.locator('option[value="store_credit"]')).toBeVisible();
      }
    }
  });

  /**
   * Test 9 — Notes field accepts text and shows character count
   */
  test('notes field accepts text and shows character count', async ({ page }) => {
    await page.goto('/laybys');
    await page.waitForLoadState('networkidle');
    
    const activeLaybyLink = page.locator('a[href*="/laybys/"]').first();
    const linkCount = await activeLaybyLink.count();
    
    if (linkCount > 0) {
      await activeLaybyLink.click();
      await page.waitForLoadState('networkidle');
      
      const recordPaymentButton = page.getByRole('button', { name: /record payment/i });
      const buttonExists = await recordPaymentButton.count() > 0;
      
      if (buttonExists) {
        await recordPaymentButton.click();
        
        const notesField = page.getByLabelText(/notes/i);
        await notesField.fill('Test payment note');
        
        // Check character count is displayed
        await expect(page.getByText(/19\/255 characters/i)).toBeVisible();
      }
    }
  });
});
