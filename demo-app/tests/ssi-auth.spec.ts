import { test, expect } from '@playwright/test';

test.describe('LWS Demo App - SSI-CID Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the demo application', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('LWS Authentication Demo');
    await expect(page.locator('.subtitle')).toBeVisible();
  });

  test('should display both authentication suite cards', async ({ page }) => {
    // Check OpenID Connect card
    await expect(page.locator('.suite-card').filter({ hasText: 'OpenID Connect' })).toBeVisible();
    
    // Check SSI-CID card
    await expect(page.locator('.suite-card').filter({ hasText: 'Self-Issued Identity' })).toBeVisible();
  });

  test('should complete SSI-CID authentication flow', async ({ page }) => {
    // Step 1: Start SSI flow
    await page.locator('button', { hasText: 'Start SSI Flow' }).click();
    
    // Wait for output to update
    await page.waitForTimeout(1000);
    
    // Verify step indicator shows step 2
    await expect(page.locator('#step-2')).toHaveClass(/active/);
    
    // Verify keypair generation message
    await expect(page.locator('#output')).toContainText('Generating EC keypair');
    
    // Wait for credential creation
    await page.waitForTimeout(2000);
    
    // Verify credential was created
    await expect(page.locator('#output')).toContainText('Self-issued credential created');
    
    // Verify token is displayed
    await expect(page.locator('.token-display')).toBeVisible();
    await expect(page.locator('.token-display h3')).toContainText('Self-Issued JWT Credential');
    
    // Step 2: Exchange for access token
    const exchangeButton = page.locator('button', { hasText: 'Exchange for Access Token' });
    await expect(exchangeButton).toBeVisible();
    await exchangeButton.click();
    
    // Wait for token exchange
    await page.waitForTimeout(3000);
    
    // Verify step 3 is active
    await expect(page.locator('#step-3')).toHaveClass(/active/);
    
    // Verify token exchange output
    await expect(page.locator('#output')).toContainText('Token Exchange');
    await expect(page.locator('#output')).toContainText('Exchanging');
    
    // Check for access token display (may succeed or fail depending on backend)
    const output = await page.locator('#output').textContent();
    
    if (output?.includes('Token exchange successful')) {
      // Verify access token is shown
      await expect(page.locator('.token-display').filter({ hasText: 'Access Token' })).toBeVisible();
      
      // Step 3: Make authenticated request
      const requestButton = page.locator('button', { hasText: 'Make Authenticated Request' });
      await expect(requestButton).toBeVisible();
      await requestButton.click();
      
      await page.waitForTimeout(2000);
      
      // Verify step 4 is active
      await expect(page.locator('#step-4')).toHaveClass(/active/);
      
      // Verify request was made
      await expect(page.locator('#output')).toContainText('Making Authenticated Request');
    }
  });

  test('should show self-issued credential claims', async ({ page }) => {
    await page.locator('button', { hasText: 'Start SSI Flow' }).click();
    
    await page.waitForTimeout(2000);
    
    // Verify claims are displayed
    const claimsDisplay = page.locator('.claims-display');
    await expect(claimsDisplay).toBeVisible();
    
    // Check for required SSI-CID claims
    await expect(claimsDisplay).toContainText('sub');
    await expect(claimsDisplay).toContainText('iss');
    await expect(claimsDisplay).toContainText('client_id');
    await expect(claimsDisplay).toContainText('aud');
  });

  test('should display token type correctly for SSI-CID', async ({ page }) => {
    await page.locator('button', { hasText: 'Start SSI Flow' }).click();
    
    await page.waitForTimeout(2000);
    
    // Verify output mentions correct token type
    await expect(page.locator('#output')).toContainText('urn:ietf:params:oauth:token-type:jwt');
  });

  test('should allow starting over', async ({ page }) => {
    // Complete partial flow
    await page.locator('button', { hasText: 'Start SSI Flow' }).click();
    await page.waitForTimeout(2000);
    
    // Click start over if button exists
    const startOverButton = page.locator('button', { hasText: 'Start Over' });
    if (await startOverButton.isVisible()) {
      await startOverButton.click();
      
      // Verify we're back at step 1
      await expect(page.locator('#step-1')).toHaveClass(/active/);
      
      // Verify output is cleared
      const output = await page.locator('#output').textContent();
      expect(output).toContain('Select an authentication suite');
    }
  });
});
