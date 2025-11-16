import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { config } from '../config.js';

const router = Router();

// Discover authorization server from storage server
router.get('/discover', async (_req: Request, res: Response) => {
  try {
    // Make an unauthorized request to storage server to get WWW-Authenticate header
    const response = await fetch(`${config.storageServer}/`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    const wwwAuth = response.headers.get('www-authenticate');
    
    if (!wwwAuth) {
      return res.status(500).json({ 
        error: 'Storage server did not return WWW-Authenticate header' 
      });
    }
    
    // Parse WWW-Authenticate header
    const asUriMatch = wwwAuth.match(/as_uri="([^"]+)"/);
    const realmMatch = wwwAuth.match(/realm="([^"]+)"/);
    const metadataMatch = wwwAuth.match(/storage_metadata="([^"]+)"/);
    
    const asUri = asUriMatch ? asUriMatch[1] : null;
    const realm = realmMatch ? realmMatch[1] : null;
    const storageMetadata = metadataMatch ? metadataMatch[1] : null;
    
    res.json({
      asUri,
      realm,
      storageMetadata,
      rawHeader: wwwAuth,
    });
  } catch (error) {
    console.error('Error discovering authorization server:', error);
    res.status(500).json({ error: 'Failed to discover authorization server' });
  }
});

// Get LWS configuration from authorization server
router.get('/lws-config', async (_req: Request, res: Response) => {
  try {
    const configUrl = `${config.authorizationServer}/.well-known/lws-configuration`;
    
    const response = await fetch(configUrl);
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Failed to fetch LWS configuration',
        status: response.status 
      });
    }
    
    const lwsConfig = await response.json();
    
    res.json(lwsConfig);
  } catch (error) {
    console.error('Error fetching LWS configuration:', error);
    res.status(500).json({ error: 'Failed to fetch LWS configuration' });
  }
});

// Exchange subject token for access token (RFC 8693 Token Exchange)
router.post('/token-exchange', async (req: Request, res: Response) => {
  try {
    const { subjectToken, subjectTokenType, resource } = req.body;
    
    if (!subjectToken || !subjectTokenType) {
      return res.status(400).json({ 
        error: 'Subject token and token type are required' 
      });
    }
    
    const tokenUrl = `${config.authorizationServer}/protocol/openid-connect/token`;
    const targetResource = resource || config.storageServer;
    
    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: subjectToken,
      subject_token_type: subjectTokenType,
      resource: targetResource,
    });
    
    console.log('Token exchange request:', {
      url: tokenUrl,
      resource: targetResource,
      tokenType: subjectTokenType,
    });
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('Token exchange failed:', responseText);
      return res.status(response.status).json({ 
        error: 'Token exchange failed',
        details: responseText,
        status: response.status,
      });
    }
    
    const data = JSON.parse(responseText);
    
    // Decode access token to show claims
    let accessTokenClaims = null;
    if (data.access_token) {
      const parts = data.access_token.split('.');
      if (parts.length === 3) {
        accessTokenClaims = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      }
    }
    
    res.json({
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      accessTokenClaims,
    });
  } catch (error) {
    console.error('Error during token exchange:', error);
    res.status(500).json({ error: 'Failed to perform token exchange' });
  }
});

// Make authenticated request to storage server
router.post('/authenticated-request', async (req: Request, res: Response) => {
  try {
    const { accessToken, method = 'GET', path = '/', body } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }
    
    const url = `${config.storageServer}${path}`;
    
    const options: any = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    };
    
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    
    console.log('Making authenticated request:', {
      url,
      method,
      hasToken: !!accessToken,
    });
    
    const response = await fetch(url, options);
    const responseText = await response.text();
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
    
    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
    });
  } catch (error) {
    console.error('Error making authenticated request:', error);
    res.status(500).json({ error: 'Failed to make authenticated request' });
  }
});

export default router;
