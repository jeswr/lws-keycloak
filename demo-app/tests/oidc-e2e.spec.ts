import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for OpenID Connect Authentication Flow
 * 
 * These tests validate the complete OIDC authentication flow including:
 * - Redirecting to Keycloak login page
 * - Entering credentials and logging in
 * - Handling the redirect back to the demo app
 * - Exchanging authorization code for tokens
 * - Displaying the ID token
 * 
 * Prerequisites:
 * - Keycloak running on http://localhost:8080
 * - Realm "lws" exists
 * - Test user "testuser" with password "testpass123" exists
 * - Client "demo-client" is configured with redirect URI http://localhost:3002/*
 */

// Test user credentials (created by scripts/create-test-user.ts)
const TEST_USER = {
  username: 'testuser',
  password: 'testpass123',
};

/**
 * Helper function to wait for a specific step to become active
 */
async function waitForStep(page: Page, stepNumber: number) {
  await expect(page.locator(`.step-${stepNumber}`)).toHaveClass(/active|completed/, {
    timeout: 5000,
  });
}

test.describe('OpenID Connect E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Log all console messages for debugging
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      console.log(`[Browser ${type}]:`, text);
    });
    
    // Log any page errors
    page.on('pageerror', (err) => console.error('Browser error:', err.message));
  });

  test('should complete full OIDC authentication flow', async ({ page }) => {
    // Step 1: Navigate to demo app
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('LWS Authentication Demo');

    // Wait for Keycloak realm discovery endpoint to be reachable (startup can be slow)
    for (let attempt = 1; attempt <= 30; attempt++) {
      const resp = await page.request.get('http://localhost:8080/realms/lws/.well-known/openid-configuration');
      if (resp.ok()) {
        console.log(`Keycloak reachable after ${attempt} attempt(s)`);
        break;
      }
      if (attempt === 30) {
        throw new Error('Keycloak not reachable after waiting 30 seconds');
      }
      await page.waitForTimeout(1000);
    }

    // Step 2: Click the OpenID Connect button and wait for Keycloak redirect
    await Promise.all([
      page.waitForURL(/.*localhost:8080.*/, { timeout: 15000 }),
      page.locator('button', { hasText: 'Start OpenID Flow' }).click(),
    ]);

    // Step 3: Verify we're on the Keycloak login page
    await expect(page).toHaveURL(/.*localhost:8080.*/);
    await expect(page.locator('#username')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#password')).toBeVisible();

    // Step 4: Enter credentials and submit
    await page.fill('#username', TEST_USER.username);
    await page.fill('#password', TEST_USER.password);
    
    // Click login and wait for redirect back to demo app
    await Promise.all([
      page.waitForURL(/.*localhost:3002\/\??.*/, { timeout: 15000 }),
      page.locator('input[type="submit"]').click(),
    ]);

    // Step 5: Verify we're back on the demo app with the auth code
    console.log('Current URL after redirect:', page.url());
    const url = new URL(page.url());
    expect(url.hostname).toBe('localhost');
    expect(url.port).toBe('3002');
    expect(url.searchParams.has('code')).toBeTruthy();

    // The callback page should redirect to / with the query params
    // Wait for that redirect if we're still on /oidc-callback
    if (page.url().includes('/oidc-callback')) {
      await page.waitForURL(/.*localhost:3002\/\?.*/, { timeout: 5000 });
    }
    
    console.log('URL after callback processing:', page.url());

    // Step 6: Wait for token to be displayed
    const tokenDisplay = page.locator('.token-display');
    await expect(tokenDisplay).toBeVisible({ timeout: 10000 });
    
    // Verify token content is displayed
    const tokenContent = await tokenDisplay.textContent();
    expect(tokenContent).toBeTruthy();
    expect(tokenContent!.length).toBeGreaterThan(0);

    // Step 7: Verify the token section shows it's an ID token
    const tokenSection = page.locator('#token-section');
    await expect(tokenSection).toBeVisible();
    const tokenSectionText = await tokenSection.textContent();
    expect(tokenSectionText).toContain('ID Token');

    // Step 8: Verify we're on step 3 (token received)
    await waitForStep(page, 3);

    // Step 9: Verify the output log shows success
    const output = page.locator('#output');
    const outputText = await output.textContent();
    expect(outputText).toContain('ID token received');
  });

  test('should handle login errors gracefully', async ({ page }) => {
    // Navigate to demo app
    await page.goto('/');

    for (let attempt = 1; attempt <= 30; attempt++) {
      const resp = await page.request.get('http://localhost:8080/realms/lws/.well-known/openid-configuration');
      if (resp.ok()) break;
      if (attempt === 30) throw new Error('Keycloak not reachable for error test');
      await page.waitForTimeout(1000);
    }

    // Start OIDC flow
    await Promise.all([
      page.waitForURL(/.*localhost:8080.*/, { timeout: 15000 }),
      page.locator('button', { hasText: 'Start OpenID Flow' }).click(),
    ]);

    // Enter incorrect credentials
    await page.fill('#username', TEST_USER.username);
    await page.fill('#password', 'wrongpassword');
    await page.locator('input[type="submit"]').click();

    // Wait a moment for the error to appear
    await page.waitForTimeout(2000);

    // Verify we're still on Keycloak (login failed)
    await expect(page).toHaveURL(/.*localhost:8080.*/);
    
    // Verify error message is displayed
    const errorElement = page.locator('.alert-error, .kc-feedback-text, #input-error');
    await expect(errorElement).toBeVisible({ timeout: 5000 });
  });

  test('should allow user to cancel login and return to demo', async ({ page }) => {
    // Navigate to demo app
    await page.goto('/');

    for (let attempt = 1; attempt <= 30; attempt++) {
      const resp = await page.request.get('http://localhost:8080/realms/lws/.well-known/openid-configuration');
      if (resp.ok()) break;
      if (attempt === 30) throw new Error('Keycloak not reachable for cancel test');
      await page.waitForTimeout(1000);
    }

    // Start OIDC flow
    await Promise.all([
      page.waitForURL(/.*localhost:8080.*/, { timeout: 15000 }),
      page.locator('button', { hasText: 'Start OpenID Flow' }).click(),
    ]);

    // Navigate back to demo app (simulating user clicking back button)
    await page.goto('http://localhost:3002');

    // Verify we're back on the demo app home page
    await expect(page).toHaveURL('http://localhost:3002/');
    await expect(page.locator('h1')).toContainText('LWS Authentication Demo');

    // Verify we can still start the flow again
    const startButton = page.locator('button', { hasText: 'Start OpenID Flow' });
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeEnabled();
  });
});

test.describe('OpenID Connect E2E Flow - Token Exchange', () => {
  test('should exchange ID token for access token', async ({ page }) => {
    // Complete OIDC flow first
    await page.goto('/');
    for (let attempt = 1; attempt <= 30; attempt++) {
      const resp = await page.request.get('http://localhost:8080/realms/lws/.well-known/openid-configuration');
      if (resp.ok()) break;
      if (attempt === 30) throw new Error('Keycloak not reachable for token exchange test');
      await page.waitForTimeout(1000);
    }
    await Promise.all([
      page.waitForURL(/.*localhost:8080.*/, { timeout: 15000 }),
      page.locator('button', { hasText: 'Start OpenID Flow' }).click(),
    ]);
    
    await page.fill('#username', TEST_USER.username);
    await page.fill('#password', TEST_USER.password);
    await Promise.all([
      page.waitForURL(/.*localhost:3002.*/, { timeout: 15000 }),
      page.locator('input[type="submit"]').click(),
    ]);

    // Wait for ID token to be displayed
    await expect(page.locator('.token-display')).toBeVisible({ timeout: 10000 });

    // Click "Exchange for Access Token" button
    const exchangeButton = page.locator('button', { hasText: 'Exchange for Access Token' });
    await expect(exchangeButton).toBeVisible({ timeout: 5000 });
    await exchangeButton.click();

    // Wait for access token to be displayed
    await page.waitForTimeout(2000);

    // Verify the token section now shows it's an access token
    const tokenSection = page.locator('#token-section');
    const tokenSectionText = await tokenSection.textContent();
    expect(tokenSectionText).toContain('Access Token');

    // Verify the output log shows exchange success
    const output = page.locator('#output');
    const outputText = await output.textContent();
    expect(outputText).toContain('Access token received');
  });
});
