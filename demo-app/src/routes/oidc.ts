import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { config } from '../config.js';

const router = Router();

// OpenID Connect configuration endpoint
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const authUrl = `${config.keycloak.url}/realms/${config.keycloak.realm}/protocol/openid-connect/auth`;
    const tokenUrl = `${config.keycloak.url}/realms/${config.keycloak.realm}/protocol/openid-connect/token`;
    const redirectUri = `http://localhost:${config.port}/oidc-callback`;
    
    res.json({
      authUrl,
      tokenUrl,
      clientId: config.keycloak.clientId,
      redirectUri,
      realm: config.keycloak.realm,
      keycloakUrl: config.keycloak.url,
    });
  } catch (error) {
    console.error('Error getting OIDC config:', error);
    res.status(500).json({ error: 'Failed to get OIDC configuration' });
  }
});

// Get authorization URL for OpenID Connect flow
router.get('/auth-url', (_req: Request, res: Response) => {
  const state = Math.random().toString(36).substring(7);
  const nonce = Math.random().toString(36).substring(7);
  
  const params = new URLSearchParams({
    client_id: config.keycloak.clientId,
    redirect_uri: `http://localhost:${config.port}/oidc-callback`,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    nonce,
    // Request audience for the authorization server
    resource: config.authorizationServer,
  });
  
  const authUrl = `${config.keycloak.url}/realms/${config.keycloak.realm}/protocol/openid-connect/auth?${params}`;
  
  res.json({ authUrl, state, nonce });
});

// Exchange authorization code for ID token
router.post('/token', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }
    
    const tokenUrl = `${config.keycloak.url}/realms/${config.keycloak.realm}/protocol/openid-connect/token`;
    const redirectUri = `http://localhost:${config.port}/oidc-callback`;
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.keycloak.clientId,
      redirect_uri: redirectUri,
    });
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', errorText);
      return res.status(response.status).json({ 
        error: 'Token exchange failed',
        details: errorText 
      });
    }
    
    const data = await response.json() as any;
    
    res.json({
      idToken: data.id_token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    });
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    res.status(500).json({ error: 'Failed to exchange authorization code' });
  }
});

// Validate ID token (for demonstration)
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }
    
    // Decode the token (without verification for demo purposes)
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    res.json({
      valid: true,
      payload,
      tokenType: 'urn:ietf:params:oauth:token-type:id_token',
    });
  } catch (error) {
    console.error('Error validating ID token:', error);
    res.status(500).json({ error: 'Failed to validate ID token' });
  }
});

export default router;
