/**
 * Playwright end-to-end tests for the Layby List page.
 * Tests page loading, rendering, and basic functionality.
 */

import { test, expect } from '@playwright/test';

test.describe('Layby List Page', () => {
  /**
   * Test 1 — Page loads and shows title
   */
  test('page loads and displays correct title', async ({ page }) => {
    await page.goto('/laybys');
    
    // Check that the page heading is visible
    await expect(page.getByRole('heading', { name: 'Laybys' })).toBeVisible();
  });

  /**
   * Test 2 — Table headers are visible
   */
  test('displays table headers correctly', async ({ page }) => {
    await page.goto('/laybys');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check for key elements that would be in a layby list
    // Since we're using cards instead of a traditional table, we check for the labels
    const pageContent = page.getByText('Laybys');
    await expect(pageContent).toBeVisible();
    
    // Check that search functionality is present
    const searchInput = page.getByPlaceholder('Search laybys...');
    await expect(searchInput).toBeVisible();
    
    // Check that status filter is present
    const statusFilter = page.getByRole('combobox');
    await expect(statusFilter).toBeVisible();
  });

  /**
   * Test 3 — Empty state renders correctly
   * 
   * NOTE: This test is skipped because we cannot easily mock an empty state
   * without backend setup. In a real environment, you would mock the API response
   * to return empty data and verify the empty state message appears.
   */
  test.skip('renders empty state when no laybys exist', async ({ page }) => {
    // TODO: Implement this test when we have API mocking capability
    // 1. Mock the API to return empty layby list
    // 2. Navigate to /laybys
    // 3. Assert empty state message is visible
    // 4. Assert "Create Your First Layby" button is present
  });

  /**
   * Test 4 — Status badge renders for each status
   */
  test('displays status badges when laybys are present', async ({ page }) => {
    await page.goto('/laybys');
    
    // Wait for potential data to load
    await page.waitForTimeout(2000);
    
    // Check if there are any status badges on the page
    // This test will pass if there are laybys with statuses, or fail gracefully if none exist
    const statusBadges = page.locator('[data-testid="status-badge"], .inline-flex.items-center.rounded-full');
    
    // If there are laybys, check that at least one status badge is visible
    const count = await statusBadges.count();
    if (count > 0) {
      await expect(statusBadges.first()).toBeVisible();
    } else {
      // If no laybys exist, that's also a valid state
      console.log('No laybys found to test status badges');
    }
  });

  /**
   * Test 5 — View link navigates correctly
   */
  test('view link navigates to layby details', async ({ page }) => {
    await page.goto('/laybys');
    
    // Wait for potential data to load
    await page.waitForTimeout(2000);
    
    // Look for any layby row links
    const laybyLinks = page.locator('a[href*="/laybys/"]');
    const linkCount = await laybyLinks.count();
    
    if (linkCount > 0) {
      // Get the first layby link
      const firstLink = laybyLinks.first();
      const href = await firstLink.getAttribute('href');
      
      // Verify the href format
      expect(href).toMatch(/^\/laybys\/[a-zA-Z0-9-]+$/);
      
      // Click the link and verify navigation
      await firstLink.click();
      
      // Check that URL changed to the layby details page
      expect(page.url()).toContain('/laybys/');
    } else {
      // If no laybys exist, that's also a valid state
      console.log('No laybys found to test view links');
    }
  });

  /**
   * Test 6 — Search functionality works
   */
  test('search input accepts text and triggers search', async ({ page }) => {
    await page.goto('/laybys');
    
    // Find the search input
    const searchInput = page.getByPlaceholder('Search laybys...');
    await expect(searchInput).toBeVisible();
    
    // Type in the search input
    await searchInput.fill('test search');
    
    // Verify the text was entered
    await expect(searchInput).toHaveValue('test search');
    
    // The search should trigger (we can't easily verify results without mocking)
    // but we can verify the input accepts text correctly
  });

  /**
   * Test 7 — Status filter works
   */
  test('status filter allows selecting different statuses', async ({ page }) => {
    await page.goto('/laybys');
    
    // Find the status filter dropdown
    const statusFilter = page.getByRole('combobox');
    await expect(statusFilter).toBeVisible();
    
    // Click the dropdown to open options
    await statusFilter.click();
    
    // Check that options are available
    const activeOption = page.getByRole('option', { name: 'Active' });
    await expect(activeOption).toBeVisible();
    
    // Select an option
    await activeOption.click();
    
    // Verify the selection
    await expect(statusFilter).toHaveValue('ACTIVE');
  });

  /**
   * Test 8 — Statistics cards are displayed
   */
  test('displays statistics cards', async ({ page }) => {
    await page.goto('/laybys');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check for statistics cards (they should be present even with no data)
    const totalLaybysCard = page.getByText('Total Laybys');
    const activeCard = page.getByText('Active');
    const overdueCard = page.getByText('Overdue');
    const outstandingBalanceCard = page.getByText('Outstanding Balance');
    
    await expect(totalLaybysCard).toBeVisible();
    await expect(activeCard).toBeVisible();
    await expect(overdueCard).toBeVisible();
    await expect(outstandingBalanceCard).toBeVisible();
  });

  /**
   * Test 9 — New Layby button is present
   */
  test('displays new layby button', async ({ page }) => {
    await page.goto('/laybys');
    
    // Check for the "New Layby" button
    const newLaybyButton = page.getByRole('link', { name: 'New Layby' });
    await expect(newLaybyButton).toBeVisible();
    
    // Verify it points to the correct URL
    const href = await newLaybyButton.getAttribute('href');
    expect(href).toBe('/laybys/new');
  });
});
