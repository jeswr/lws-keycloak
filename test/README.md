# LWS Test Suite

Comprehensive testing for the LWS-Keycloak reference implementation.

## Test Categories

### 1. Unit Tests
- Individual component functionality
- Validators, parsers, utilities
- Storage backend operations
- Cache management

### 2. Integration Tests
- End-to-end authentication flows
- Token exchange processes
- CID/DID resolution
- Resource access with authorization

### 3. Security Tests
- JTI replay prevention
- Token lifetime enforcement
- Signature verification
- Path traversal protection
- TLS/HTTPS enforcement

### 4. Performance Tests
- Token validation throughput
- Cache hit rates
- Concurrent request handling
- Resource storage operations

## Running Tests

### All Tests
```bash
npm test
```

### Specific Suite
```bash
npm test -- unit
npm test -- integration
npm test -- security
```

### Coverage
```bash
npm run test:coverage
```

## Test Structure

```
test/
├── unit/
│   ├── cid-resolver.test.ts
│   ├── did-key-resolver.test.ts
│   ├── token-validator.test.ts
│   ├── authorization-enforcer.test.ts
│   └── storage-backend.test.ts
├── integration/
│   ├── openid-flow.test.ts
│   ├── ssi-cid-flow.test.ts
│   ├── ssi-did-key-flow.test.ts
│   └── resource-access.test.ts
├── security/
│   ├── jti-replay.test.ts
│   ├── token-lifetime.test.ts
│   ├── path-traversal.test.ts
│   └── signature-validation.test.ts
└── fixtures/
    ├── jwks.json
    ├── cid-documents/
    ├── did-keys/
    └── tokens.json
```

## Writing Tests

### Example Unit Test

```typescript
import { describe, it, expect } from 'vitest';
import { TokenValidator } from '../src/validators/token-validator';

describe('TokenValidator', () => {
  it('should validate a valid JWT', async () => {
    const validator = new TokenValidator({
      asUri: 'http://localhost:8080/realms/lws',
      realm: 'http://localhost:3001/storage'
    });
    
    const result = await validator.validate(validToken);
    expect(result.valid).toBe(true);
  });
  
  it('should reject expired tokens', async () => {
    const result = await validator.validate(expiredToken);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('expired');
  });
});
```

### Example Integration Test

```typescript
import { describe, it, expect } from 'vitest';
import { testFlow } from './helpers/flow-tester';

describe('OpenID Flow', () => {
  it('should complete full authentication flow', async () => {
    const result = await testFlow({
      authSuite: 'openid',
      subjectToken: getOpenIdToken(),
      resource: '/storage/test.txt'
    });
    
    expect(result.authenticated).toBe(true);
    expect(result.resource).toBeDefined();
  });
});
```

## Test Fixtures

Fixtures are located in `test/fixtures/` and include:

- Sample CID documents
- did:key URIs and public keys
- Valid and invalid JWTs
- JWKS endpoints
- Test user data

## Continuous Integration

Tests run automatically on:
- Every commit (unit tests)
- Pull requests (all tests)
- Pre-deployment (full suite)

## Coverage Goals

- Unit tests: >90%
- Integration tests: >80%
- Overall: >85%
