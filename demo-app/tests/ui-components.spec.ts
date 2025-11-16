import { test, expect } from '@playwright/test';

test.describe('LWS Demo App - UI Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/LWS Authentication Demo/);
  });

  test('should display step indicator with 4 steps', async ({ page }) => {
    const steps = page.locator('.step');
    await expect(steps).toHaveCount(4);
    
    // Verify step labels
    await expect(steps.nth(0)).toContainText('1. Choose Auth Suite');
    await expect(steps.nth(1)).toContainText('2. Get Credential');
    await expect(steps.nth(2)).toContainText('3. Exchange Token');
    await expect(steps.nth(3)).toContainText('4. Make Request');
  });

  test('should have step 1 active initially', async ({ page }) => {
    await expect(page.locator('#step-1')).toHaveClass(/active/);
    await expect(page.locator('#step-2')).not.toHaveClass(/active/);
  });

  test('should display output section', async ({ page }) => {
    const outputSection = page.locator('.output-section');
    await expect(outputSection).toBeVisible();
    await expect(outputSection.locator('h2')).toContainText('Authentication Flow Output');
  });

  test('should show initial empty output message', async ({ page }) => {
    const output = page.locator('#output');
    await expect(output).toHaveClass(/empty/);
    await expect(output).toContainText('Select an authentication suite to begin');
  });

  test('should have two authentication suite cards', async ({ page }) => {
    const cards = page.locator('.suite-card');
    await expect(cards).toHaveCount(2);
  });

  test('should display spec info for each suite', async ({ page }) => {
    // OpenID Connect spec info
    const oidcSpec = page.locator('.suite-card').filter({ hasText: 'OpenID Connect' }).locator('.spec-info');
    await expect(oidcSpec).toContainText('Token Type');
    await expect(oidcSpec).toContainText('Required Claims');
    
    // SSI-CID spec info
    const ssiSpec = page.locator('.suite-card').filter({ hasText: 'Self-Issued Identity' }).locator('.spec-info');
    await expect(ssiSpec).toContainText('Token Type');
    await expect(ssiSpec).toContainText('Required Claims');
  });

  test('should have action buttons for both suites', async ({ page }) => {
    const oidcButton = page.locator('button', { hasText: 'Start OpenID Flow' });
    const ssiButton = page.locator('button', { hasText: 'Start SSI Flow' });
    
    await expect(oidcButton).toBeVisible();
    await expect(ssiButton).toBeVisible();
    await expect(oidcButton).toBeEnabled();
    await expect(ssiButton).toBeEnabled();
  });
});

test.describe('LWS Demo App - Responsive Design', () => {
  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check that main elements are still visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.suite-card')).toHaveCount(2);
    await expect(page.locator('.step-indicator')).toBeVisible();
  });

  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.auth-suites')).toBeVisible();
  });
});
