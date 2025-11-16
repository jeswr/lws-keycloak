#!/usr/bin/env tsx

/**
 * Keycloak Setup Script
 * 
 * This script sets up the Keycloak realm and clients required for the LWS implementation.
 * It configures:
 * - LWS realm
 * - Client applications
 * - Token exchange settings
 * - Authentication flows
 */

import fetch from 'node-fetch';

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN || 'admin';
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
const REALM_NAME = 'lws';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Wait for Keycloak to be ready
 */
async function waitForKeycloak(maxAttempts = 30, delayMs = 2000): Promise<void> {
  console.log('Waiting for Keycloak to be ready...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${KEYCLOAK_URL}/realms/master`, {
        method: 'GET',
      });
      
      if (response.ok) {
        console.log('✓ Keycloak is ready');
        return;
      }
    } catch (error) {
      // Connection failed, continue waiting
    }
    
    if (attempt < maxAttempts) {
      console.log(`  Attempt ${attempt}/${maxAttempts} - waiting ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw new Error(`Keycloak did not become ready after ${maxAttempts} attempts`);
}

/**
 * Get admin access token
 */
async function getAdminToken(): Promise<string> {
  console.log('Getting admin access token...');
  
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
    const text = await response.text();
    throw new Error(`Failed to get admin token: ${response.status} ${text}`);
  }

  const data = await response.json() as TokenResponse;
  console.log('✓ Got admin access token');
  return data.access_token;
}

/**
 * Create or update LWS realm
 */
async function setupRealm(token: string): Promise<void> {
  console.log(`\nSetting up realm: ${REALM_NAME}...`);

  // Check if realm exists
  const checkResponse = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (checkResponse.ok) {
    console.log('✓ Realm already exists');
    return;
  }

  // Create realm
  const realmConfig = {
    realm: REALM_NAME,
    enabled: true,
    displayName: 'Linked Web Storage',
    registrationAllowed: true,
    loginWithEmailAllowed: true,
    duplicateEmailsAllowed: false,
    resetPasswordAllowed: true,
    editUsernameAllowed: false,
    bruteForceProtected: true,
    accessTokenLifespan: 300,
    ssoSessionIdleTimeout: 1800,
    ssoSessionMaxLifespan: 36000,
  };

  const createResponse = await fetch(`${KEYCLOAK_URL}/admin/realms`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(realmConfig),
  });

  if (!createResponse.ok) {
    const text = await createResponse.text();
    throw new Error(`Failed to create realm: ${createResponse.status} ${text}`);
  }

  console.log('✓ Realm created successfully');
}

/**
 * Create storage server client
 */
async function setupStorageClient(token: string): Promise<void> {
  console.log('\nSetting up storage server client...');

  const clientId = 'lws-storage-server';

  // Check if client exists
  const searchResponse = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients?clientId=${clientId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!searchResponse.ok) {
    throw new Error(`Failed to check for existing client: ${searchResponse.status}`);
  }

  const existingClients = await searchResponse.json() as Array<{ id: string; clientId: string }>;
  
  if (existingClients.length > 0) {
    console.log('✓ Storage server client already exists');
    return;
  }

  // Create client
  const clientConfig = {
    clientId: clientId,
    name: 'LWS Storage Server',
    description: 'Resource server for LWS protected resources',
    enabled: true,
    publicClient: false,
    serviceAccountsEnabled: true,
    standardFlowEnabled: false,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: true,
    authorizationServicesEnabled: true,
    protocol: 'openid-connect',
    attributes: {
      'access.token.lifespan': '300',
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
    throw new Error(`Failed to create storage client: ${createResponse.status} ${text}`);
  }

  console.log('✓ Storage server client created');
}

/**
 * Create client application
 */
async function setupClientApp(token: string): Promise<void> {
  console.log('\nSetting up client application...');

  const clientId = 'lws-client-app';

  // Check if client exists
  const searchResponse = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients?clientId=${clientId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!searchResponse.ok) {
    throw new Error(`Failed to check for existing client: ${searchResponse.status}`);
  }

  const existingClients = await searchResponse.json() as Array<{ id: string; clientId: string }>;
  
  if (existingClients.length > 0) {
    console.log('✓ Client application already exists');
    return;
  }

  // Create client
  const clientConfig = {
    clientId: clientId,
    name: 'LWS Client Application',
    description: 'Example client application for LWS',
    enabled: true,
    publicClient: true,
    standardFlowEnabled: true,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: true,
    protocol: 'openid-connect',
    redirectUris: ['http://localhost:*/*', 'https://localhost:*/*'],
    webOrigins: ['+'],
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
    throw new Error(`Failed to create client app: ${createResponse.status} ${text}`);
  }

  console.log('✓ Client application created');
}

/**
 * Main setup function
 */
async function main() {
  try {
    console.log('=== LWS Keycloak Setup ===\n');
    console.log(`Keycloak URL: ${KEYCLOAK_URL}`);
    console.log(`Realm: ${REALM_NAME}\n`);

    // Wait for Keycloak to be ready
    await waitForKeycloak();

    // Get admin token
    const token = await getAdminToken();

    // Setup realm
    await setupRealm(token);

    // Setup clients
    await setupStorageClient(token);
    await setupClientApp(token);

    console.log('\n=== Setup Complete ===\n');
    console.log('Keycloak Configuration:');
    console.log(`  Admin Console: ${KEYCLOAK_URL}/admin`);
    console.log(`  Realm: ${REALM_NAME}`);
    console.log(`  Storage Client: lws-storage-server`);
    console.log(`  Client App: lws-client-app`);
    console.log('\nYou can now start using the LWS implementation!');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
