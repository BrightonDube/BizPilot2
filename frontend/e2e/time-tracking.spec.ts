import { test, expect } from '@playwright/test';

test.describe('Time Tracking Settings & Payroll Report', () => {
  // Assuming a generic login process or authenticated state for admin
  test.beforeEach(async ({ page }) => {
    // This is a placeholder for actual authentication
    // await page.goto('/login');
    // await page.fill('input[name="email"]', 'admin@example.com');
    // await page.fill('input[name="password"]', 'password');
    // await page.click('button[type="submit"]');
  });

  test('should allow admin to update "Paid Hours on Auto Clock-Out"', async ({ page }) => {
    // Navigate to settings page
    await page.goto('/settings');

    // Wait for Time Tracking Settings section
    const timeTrackingSection = page.locator('h3', { hasText: 'Time Tracking & Payroll' });
    await expect(timeTrackingSection).toBeVisible();

    // Check that the input exists
    const autoClockOutInput = page.locator('input#auto_clock_out_paid_hours');
    await expect(autoClockOutInput).toBeVisible();

    // Update the value
    await autoClockOutInput.fill('5.5');
    
    // Save settings
    const saveButton = page.locator('button', { hasText: 'Save Changes' });
    await saveButton.click();

    // Verify successful save toast/message if applicable
    // await expect(page.locator('text=Settings saved successfully')).toBeVisible();
    
    // Reload and verify
    await page.reload();
    await expect(autoClockOutInput).toHaveValue('5.5');
  });

  test('Payroll Report displays penalty hours column correctly', async ({ page }) => {
    // Navigate to time tracking page
    await page.goto('/time-tracking');

    // Click on the Payroll Report tab
    const payrollTab = page.locator('button', { hasText: 'Payroll Report' });
    await payrollTab.click();

    // Ensure the table headers include Penalty Hours
    const penaltyHeader = page.locator('th', { hasText: 'Penalty Hours' });
    await expect(penaltyHeader).toBeVisible();

    // Assuming we have mock data, we could check for an alert triangle or non-zero value
    // For now we just check that the list renders correctly with columns
    const employeeRows = page.locator('tbody tr');
    // Wait for rows to load if any
    
    // We expect the correct columns: Employee, Email, Total Hours, Break Hours, Penalty Hours, Net Hours, Entries
    const tableHeaderCount = await page.locator('thead th').count();
    expect(tableHeaderCount).toBe(7);
  });
});
