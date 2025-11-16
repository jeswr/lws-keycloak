import { SignJWT, generateKeyPair, exportJWK } from 'jose';

/**
 * Mock token factory for testing
 */

interface MockTokenOptions {
  issuer?: string;
  audience?: string | string[];
  subject?: string;
  expiresIn?: number;
  issuedAt?: number;
  jti?: string;
  invalidSignature?: boolean;
}

// Cache for key pairs
let cachedKeyPair: Awaited<ReturnType<typeof generateKeyPair>> | null = null;

/**
 * Create a mock JWT token for testing
 */
export async function createMockToken(options: MockTokenOptions = {}): Promise<string> {
  const {
    issuer = 'http://localhost:8080/realms/lws',
    audience = 'http://localhost:3001/storage',
    subject = 'test-user',
    expiresIn = 300,
    issuedAt = Math.floor(Date.now() / 1000),
    jti = `test-jti-${Date.now()}-${Math.random()}`,
    invalidSignature = false
  } = options;

  // Generate or reuse key pair
  if (!cachedKeyPair) {
    cachedKeyPair = await generateKeyPair('RS256');
    // Expose public JWKS for validator in test environment
    const jwk = await exportJWK(cachedKeyPair.publicKey);
    (globalThis as any).__TEST_JWKS = { keys: [{ ...jwk, kid: 'test-key-1', alg: 'RS256', use: 'sig' }] };
  }

  const { privateKey } = cachedKeyPair;

  const exp = issuedAt + expiresIn;

  const token = await new SignJWT({
    aud: audience,
    jti,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setIssuer(issuer)
    .setSubject(subject)
    .setIssuedAt(issuedAt)
    .setExpirationTime(exp)
    .sign(invalidSignature ? (await generateKeyPair('RS256')).privateKey : privateKey);

  return token;
}

/**
 * Get public JWK for mock tokens
 */
export async function getMockJWK() {
  if (!cachedKeyPair) {
    cachedKeyPair = await generateKeyPair('RS256');
    const jwkInit = await exportJWK(cachedKeyPair.publicKey);
    (globalThis as any).__TEST_JWKS = { keys: [{ ...jwkInit, kid: 'test-key-1', alg: 'RS256', use: 'sig' }] };
  }
  const jwk = await exportJWK(cachedKeyPair.publicKey);
  return { ...jwk, kid: 'test-key-1', alg: 'RS256', use: 'sig' };
}
