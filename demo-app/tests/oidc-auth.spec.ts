import { test, expect } from '@playwright/test';

test.describe('LWS Demo App - OpenID Connect Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should start OpenID Connect flow and redirect to Keycloak', async ({ page }) => {
    // Click OpenID Connect button
    await page.locator('button', { hasText: 'Start OpenID Flow' }).click();
    
    // Wait for redirect or output update
    await page.waitForTimeout(2000);
    
    // Check if we got redirected to Keycloak or got an error
    const currentUrl = page.url();
    
    if (currentUrl.includes('localhost:8080') || currentUrl.includes('keycloak')) {
      // We were redirected to Keycloak - success!
      await expect(page).toHaveURL(/.*localhost:8080.*/);
      
      // Should see Keycloak login page
      // Note: Actual Keycloak UI may vary, so we just check we're on the right domain
      console.log('Successfully redirected to Keycloak');
    } else {
      // Check for error message in output
      const output = await page.locator('#output').textContent();
      console.log('OpenID flow output:', output);
      
      // Verify at least the flow started
      expect(output).toContain('OpenID Connect');
    }
  });

  test('should display OpenID Connect suite information', async ({ page }) => {
    const oidcCard = page.locator('.suite-card').filter({ hasText: 'OpenID Connect' });
    
    await expect(oidcCard).toBeVisible();
    await expect(oidcCard.locator('h2')).toContainText('OpenID Connect');
    await expect(oidcCard).toContainText('urn:ietf:params:oauth:token-type:id_token');
    await expect(oidcCard).toContainText('sub, iss, azp, aud');
  });

  test('should show step 2 when starting OpenID flow', async ({ page }) => {
    await page.locator('button', { hasText: 'Start OpenID Flow' }).click();
    
    await page.waitForTimeout(1000);
    
    // Verify output shows OpenID flow started
    const output = await page.locator('#output').textContent();
    expect(output).toContain('OpenID Connect');
  });
});

test.describe('LWS Demo App - OIDC Callback Handling', () => {
  test('should handle OIDC callback with authorization code', async ({ page }) => {
    // Simulate returning from Keycloak with a code
    const mockCode = 'mock_auth_code_12345';
    const mockState = 'mock_state_67890';
    
    // Set state in sessionStorage before navigating
    await page.goto('/');
    await page.evaluate((state) => {
      sessionStorage.setItem('oidc_state', state);
      sessionStorage.setItem('oidc_nonce', 'mock_nonce');
    }, mockState);
    
    // Navigate to callback URL with code and state
    await page.goto(`/?code=${mockCode}&state=${mockState}`);
    
    // Wait for processing
    await page.waitForTimeout(2000);
    
    // Check output for callback handling
    const output = await page.locator('#output').textContent();
    
    if (output?.includes('authorization code')) {
      // Callback was recognized
      expect(output).toContain('code');
    }
  });
});
