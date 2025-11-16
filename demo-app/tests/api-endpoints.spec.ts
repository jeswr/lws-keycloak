import { test, expect } from '@playwright/test';

test.describe('LWS Demo App - API Endpoints', () => {
  test('should get OIDC configuration', async ({ request }) => {
    const response = await request.get('/api/oidc/config');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('authUrl');
    expect(data).toHaveProperty('tokenUrl');
    expect(data).toHaveProperty('clientId');
    expect(data).toHaveProperty('redirectUri');
  });

  test('should get OIDC auth URL', async ({ request }) => {
    const response = await request.get('/api/oidc/auth-url');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('authUrl');
    expect(data).toHaveProperty('state');
    expect(data).toHaveProperty('nonce');
    expect(data.authUrl).toContain('localhost:8080');
    expect(data.authUrl).toContain('response_type=code');
  });

  test('should generate SSI keypair', async ({ request }) => {
    const response = await request.post('/api/ssi/generate-keypair');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('kid');
    expect(data).toHaveProperty('publicKey');
    expect(data).toHaveProperty('agentId');
    expect(data.publicKey).toHaveProperty('kty', 'EC');
    expect(data.publicKey).toHaveProperty('alg', 'ES256');
  });

  test('should create SSI credential', async ({ request }) => {
    // First generate a keypair
    const keyResponse = await request.post('/api/ssi/generate-keypair');
    const { kid } = await keyResponse.json();
    
    // Create credential with the kid
    const response = await request.post('/api/ssi/create-credential', {
      data: { kid }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('credential');
    expect(data).toHaveProperty('tokenType', 'urn:ietf:params:oauth:token-type:jwt');
    expect(data).toHaveProperty('agentId');
    
    // Verify credential is a JWT (3 parts separated by dots)
    const parts = data.credential.split('.');
    expect(parts).toHaveLength(3);
  });

  test('should validate SSI credential', async ({ request }) => {
    // Generate keypair and create credential
    const keyResponse = await request.post('/api/ssi/generate-keypair');
    const { kid } = await keyResponse.json();
    
    const credResponse = await request.post('/api/ssi/create-credential', {
      data: { kid }
    });
    const { credential } = await credResponse.json();
    
    // Validate the credential
    const response = await request.post('/api/ssi/validate', {
      data: { credential }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('valid', true);
    expect(data).toHaveProperty('payload');
    expect(data.payload).toHaveProperty('sub');
    expect(data.payload).toHaveProperty('iss');
    expect(data.payload).toHaveProperty('client_id');
    
    // Verify self-issued requirement
    expect(data.payload.sub).toBe(data.payload.iss);
    expect(data.payload.sub).toBe(data.payload.client_id);
  });

  test('should discover authorization server', async ({ request }) => {
    const response = await request.get('/api/storage/discover');
    
    // Response might succeed or fail depending on storage server availability
    if (response.ok()) {
      const data = await response.json();
      // If storage server is running, we should get these fields
      if (data.asUri) {
        expect(data).toHaveProperty('realm');
        expect(data).toHaveProperty('rawHeader');
      }
    }
  });

  test('should get agent CID document', async ({ request }) => {
    const kid = 'test-key-id';
    const response = await request.get(`/agents/demo-agent?kid=${kid}`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('@context');
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('authentication');
    expect(Array.isArray(data.authentication)).toBeTruthy();
  });

  test('should register and retrieve public key', async ({ request }) => {
    const kid = `test-${Date.now()}`;
    const publicKey = {
      kid,
      kty: 'EC',
      crv: 'P-256',
      alg: 'ES256',
      x: 'test-x',
      y: 'test-y'
    };
    
    // Register key
    const registerResponse = await request.post('/agents/demo-agent/register-key', {
      data: { kid, publicKey }
    });
    expect(registerResponse.ok()).toBeTruthy();
    
    // Retrieve CID with key
    const getResponse = await request.get(`/agents/demo-agent/key/${kid}`);
    expect(getResponse.ok()).toBeTruthy();
    
    const data = await getResponse.json();
    expect(data.authentication[0].publicKeyJwk).toEqual(publicKey);
  });

  test('should return 404 for unknown public key', async ({ request }) => {
    const response = await request.get('/agents/demo-agent/key/nonexistent');
    expect(response.status()).toBe(404);
  });

  test('should require kid for SSI credential creation', async ({ request }) => {
    const response = await request.post('/api/ssi/create-credential', {
      data: {}
    });
    expect(response.status()).toBe(400);
  });

  test('should return 404 for nonexistent keypair', async ({ request }) => {
    const response = await request.post('/api/ssi/create-credential', {
      data: { kid: 'nonexistent-key' }
    });
    expect(response.status()).toBe(404);
  });
});
