# Demo App Tests

This directory contains Playwright end-to-end tests for the LWS demo application.

## Test Suites

### UI Components (`ui-components.spec.ts`)
- Page structure and layout
- Step indicator functionality
- Authentication suite cards
- Responsive design

### SSI-CID Authentication (`ssi-auth.spec.ts`)
- Complete SSI-CID authentication flow
- Keypair generation
- Self-issued credential creation
- Token claims validation
- Token exchange
- Authenticated requests

### OpenID Connect Authentication (`oidc-auth.spec.ts`)
- OpenID Connect flow initiation
- Redirect to Keycloak
- Callback handling
- State validation

### API Endpoints (`api-endpoints.spec.ts`)
- OIDC configuration endpoints
- SSI keypair generation
- Credential creation and validation
- Authorization server discovery
- Agent CID document endpoints

## Running Tests

```bash
# Run all tests
npm test

# Run with UI mode (interactive)
npm run test:ui

# Run in headed mode (see browser)
npm run test:headed

# Run in debug mode
npm run test:debug

# Run specific test file
npx playwright test tests/ssi-auth.spec.ts

# Run specific test by name
npx playwright test -g "should complete SSI-CID"
```

## Prerequisites

Before running tests, ensure:

1. Demo app dependencies are installed:
   ```bash
   npm install
   ```

2. Playwright browsers are installed:
   ```bash
   npx playwright install
   ```

3. Backend services are running (for integration tests):
   ```bash
   # From project root
   npm run dev:all:parallel
   ```

## Test Configuration

Tests are configured in `playwright.config.ts`:

- Base URL: `http://localhost:3002`
- Test timeout: 30 seconds per test
- Retries: 2 in CI, 0 locally
- Workers: 1 (sequential execution)
- Web server auto-start: enabled

## Writing New Tests

Example test structure:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    // Arrange
    await page.locator('button').click();
    
    // Act
    await page.waitForTimeout(1000);
    
    // Assert
    await expect(page.locator('#output')).toContainText('expected');
  });
});
```

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

## CI/CD Integration

Tests can be run in CI with:

```bash
CI=true npm test
```

This enables:
- 2 retries on failure
- No browser reuse
- Screenshot on failure
- Trace on first retry

## Troubleshooting

**Tests timeout**
- Increase timeout in config
- Ensure services are running
- Check network connectivity

**Element not found**
- Verify selectors match current HTML
- Add wait conditions before assertions
- Check for timing issues

**Service not available**
- Ensure demo app is running on port 3002
- Check backend services are healthy
- Review service logs

## Coverage

Tests cover:
- ✅ UI rendering and interactions
- ✅ SSI-CID authentication flow
- ✅ OpenID Connect flow initiation
- ✅ API endpoint responses
- ✅ Token generation and validation
- ✅ Error handling
- ✅ Responsive design

## Notes

- Tests run serially (workers: 1) to avoid race conditions
- The web server is automatically started before tests
- Tests use the actual demo app, not mocks
- Some tests may fail if backend services aren't configured
