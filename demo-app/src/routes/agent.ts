import { Router, Request, Response } from 'express';
import { config } from '../config.js';

const router = Router();

// Serve Controlled Identifier Document for demo agent
router.get('/demo-agent', (_req: Request, res: Response) => {
  // This would typically be served by a CID resolver service
  // For demo purposes, we're serving it directly
  
  const agentId = config.demoAgentId;
  
  // Get kid from query parameter (in production, this would be looked up)
  const kid = _req.query.kid as string;
  
  if (!kid) {
    return res.status(400).json({ 
      error: 'kid query parameter is required to generate CID document' 
    });
  }
  
  const cidDocument = {
    '@context': [
      'https://www.w3.org/ns/cid/v1'
    ],
    id: agentId,
    authentication: [{
      id: `${agentId}#${kid}`,
      type: 'JsonWebKey',
      controller: agentId,
      // In production, this would reference the actual public key
      // For demo, the client will need to provide this
      publicKeyJwk: {
        kid,
        kty: 'EC',
        crv: 'P-256',
        alg: 'ES256',
        // These would be the actual public key coordinates
        // The demo app will need to register the public key separately
      }
    }]
  };
  
  res.json(cidDocument);
});

// Update CID document with public key (for demo purposes)
const publicKeys = new Map<string, any>();

router.post('/demo-agent/register-key', (req: Request, res: Response) => {
  const { kid, publicKey } = req.body;
  
  if (!kid || !publicKey) {
    return res.status(400).json({ error: 'kid and publicKey are required' });
  }
  
  publicKeys.set(kid, publicKey);
  
  res.json({ success: true, message: 'Public key registered' });
});

router.get('/demo-agent/key/:kid', (req: Request, res: Response) => {
  const { kid } = req.params;
  const publicKey = publicKeys.get(kid);
  
  if (!publicKey) {
    return res.status(404).json({ error: 'Public key not found' });
  }
  
  const agentId = config.demoAgentId;
  
  const cidDocument = {
    '@context': [
      'https://www.w3.org/ns/cid/v1'
    ],
    id: agentId,
    authentication: [{
      id: `${agentId}#${kid}`,
      type: 'JsonWebKey',
      controller: agentId,
      publicKeyJwk: publicKey
    }]
  };
  
  res.json(cidDocument);
});

export default router;
