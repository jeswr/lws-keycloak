#!/usr/bin/env tsx

/**
 * Create Test User for E2E Tests
 * 
 * This script creates a test user in Keycloak for use in E2E tests.
 */

import fetch from 'node-fetch';

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN || 'admin';
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
const REALM_NAME = 'lws';

interface TokenResponse {
  access_token: string;
}

async function getAdminToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  });

  const response = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get admin token: ${response.status}`);
  }

  const data = await response.json() as TokenResponse;
  return data.access_token;
}

async function createDemoClient(token: string): Promise<void> {
  console.log('Creating demo-client...');

  // Check if client exists
  const searchResponse = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients?clientId=demo-client`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const existingClients = await searchResponse.json() as Array<{ id: string }>;
  
  if (existingClients.length > 0) {
    console.log('✓ demo-client already exists');
    return;
  }

  // Create client
  const clientConfig = {
    clientId: 'demo-client',
    name: 'Demo Application',
    enabled: true,
    publicClient: true,
    standardFlowEnabled: true,
    directAccessGrantsEnabled: true,
    protocol: 'openid-connect',
    redirectUris: ['http://localhost:3002/*'],
    webOrigins: ['http://localhost:3002'],
    attributes: {
      'pkce.code.challenge.method': 'S256',
    },
  };

  const createResponse = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(clientConfig),
  });

  if (!createResponse.ok) {
    const text = await createResponse.text();
    throw new Error(`Failed to create demo-client: ${createResponse.status} ${text}`);
  }

  console.log('✓ demo-client created');
}

async function createTestUser(token: string): Promise<void> {
  console.log('Creating test user...');

  const username = 'testuser';
  
  // Check if user exists
  const searchResponse = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${username}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const existingUsers = await searchResponse.json() as Array<{ id: string }>;
  
  if (existingUsers.length > 0) {
    console.log('✓ Test user already exists');
    return;
  }

  // Create user
  const userConfig = {
    username: 'testuser',
    email: 'testuser@example.com',
    firstName: 'Test',
    lastName: 'User',
    enabled: true,
    emailVerified: true,
    credentials: [
      {
        type: 'password',
        value: 'testpass123',
        temporary: false,
      },
    ],
  };

  const createResponse = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userConfig),
  });

  if (!createResponse.ok && createResponse.status !== 201) {
    const text = await createResponse.text();
    throw new Error(`Failed to create test user: ${createResponse.status} ${text}`);
  }

  console.log('✓ Test user created');
  console.log('  Username: testuser');
  console.log('  Password: testpass123');
}

async function main() {
  try {
    console.log('=== Creating Test User for E2E Tests ===\n');

    const token = await getAdminToken();
    
    await createDemoClient(token);
    await createTestUser(token);

    console.log('\n✅ Setup complete!');
    console.log('\nYou can now run E2E tests with:');
    console.log('  npm test tests/oidc-e2e.spec.ts');
    
  } catch (error) {
    console.error('\n❌ Failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
