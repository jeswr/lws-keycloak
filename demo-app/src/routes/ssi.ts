import { Router, Request, Response } from 'express';
import * as jose from 'jose';
import { config } from '../config.js';

const router = Router();

// In-memory storage for demo agent keys
const agentKeys = new Map<string, { publicKey: jose.JWK; privateKey: jose.KeyLike }>();

// Generate a new keypair for SSI authentication
router.post('/generate-keypair', async (_req: Request, res: Response) => {
  try {
    const { publicKey, privateKey } = await jose.generateKeyPair('ES256');
    const publicJwk = await jose.exportJWK(publicKey);
    
    // Add kid (key ID)
    const kid = Math.random().toString(36).substring(2, 10);
    publicJwk.kid = kid;
    publicJwk.alg = 'ES256';
    publicJwk.use = 'sig';
    
    // Store the keypair (in production, this would be stored securely)
    agentKeys.set(kid, { publicKey: publicJwk, privateKey });
    
    res.json({
      kid,
      publicKey: publicJwk,
      agentId: config.demoAgentId,
    });
  } catch (error) {
    console.error('Error generating keypair:', error);
    res.status(500).json({ error: 'Failed to generate keypair' });
  }
});

// Create a self-issued JWT credential
router.post('/create-credential', async (req: Request, res: Response) => {
  try {
    const { kid } = req.body;
    
    if (!kid) {
      return res.status(400).json({ error: 'Key ID is required' });
    }
    
    const keyPair = agentKeys.get(kid);
    if (!keyPair) {
      return res.status(404).json({ error: 'Keypair not found' });
    }
    
    const agentId = config.demoAgentId;
    const now = Math.floor(Date.now() / 1000);
    
    // Create JWT according to SSI-CID spec
    const jwt = await new jose.SignJWT({
      sub: agentId,
      iss: agentId,
      client_id: agentId,
      aud: [config.authorizationServer],
      iat: now,
      exp: now + 300, // 5 minutes
    })
      .setProtectedHeader({ 
        alg: 'ES256',
        typ: 'JWT',
        kid,
      })
      .sign(keyPair.privateKey);
    
    res.json({
      credential: jwt,
      tokenType: 'urn:ietf:params:oauth:token-type:jwt',
      agentId,
    });
  } catch (error) {
    console.error('Error creating credential:', error);
    res.status(500).json({ error: 'Failed to create credential' });
  }
});

// Validate a self-issued credential (for demonstration)
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({ error: 'Credential is required' });
    }
    
    // Decode without verification for demo
    const parts = credential.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid credential format' });
    }
    
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    // Verify the credential is self-issued (sub === iss === client_id)
    if (payload.sub !== payload.iss || payload.sub !== payload.client_id) {
      return res.status(400).json({ 
        error: 'Invalid self-issued credential: sub, iss, and client_id must match' 
      });
    }
    
    res.json({
      valid: true,
      header,
      payload,
      tokenType: 'urn:ietf:params:oauth:token-type:jwt',
    });
  } catch (error) {
    console.error('Error validating credential:', error);
    res.status(500).json({ error: 'Failed to validate credential' });
  }
});

// Get stored public key
router.get('/public-key/:kid', (req: Request, res: Response) => {
  const { kid } = req.params;
  const keyPair = agentKeys.get(kid);
  
  if (!keyPair) {
    return res.status(404).json({ error: 'Key not found' });
  }
  
  res.json({ publicKey: keyPair.publicKey });
});

export default router;
