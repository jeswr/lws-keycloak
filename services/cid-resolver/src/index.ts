import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { CIDResolver } from './resolvers/cid-resolver.js';
import { DIDKeyResolver } from './resolvers/did-key-resolver.js';
import { CacheManager } from './cache/cache-manager.js';
import { errorHandler } from './middleware/error-handler.js';
import { rateLimiter } from './middleware/rate-limiter.js';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan(process.env.LOG_FORMAT || 'combined'));
app.use(express.json());

// Initialize services
const cacheManager = new CacheManager({
  ttl: parseInt(process.env.CID_CACHE_TTL || '3600', 10),
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
});

const cidResolver = new CIDResolver(cacheManager, {
  httpsOnly: process.env.CID_HTTPS_ONLY === 'true',
  maxSize: parseInt(process.env.CID_MAX_SIZE || '10240', 10),
  timeout: 5000,
});

const didKeyResolver = new DIDKeyResolver();

// Rate limiting
app.use('/resolve', rateLimiter({
  windowMs: 60000,
  max: parseInt(process.env.CID_RATE_LIMIT || '10', 10),
}));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Resolve CID document
app.get('/resolve', async (req, res, next) => {
  try {
    const { uri } = req.query;
    
    if (!uri || typeof uri !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid uri parameter' });
    }

    const document = await cidResolver.resolve(uri);
    res.json(document);
  } catch (error) {
    next(error);
  }
});

// Get verification method from CID
app.get('/verification-method', async (req, res, next) => {
  try {
    const { uri, kid } = req.query;
    
    if (!uri || typeof uri !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid uri parameter' });
    }
    if (!kid || typeof kid !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid kid parameter' });
    }

    const document = await cidResolver.resolve(uri);
    const method = cidResolver.getVerificationMethod(document, kid);
    
    if (!method) {
      return res.status(404).json({ error: 'Verification method not found' });
    }

    res.json(method);
  } catch (error) {
    next(error);
  }
});

// Resolve DID:Key
app.get('/resolve-did-key', async (req, res, next) => {
  try {
    const { did } = req.query;
    
    if (!did || typeof did !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid did parameter' });
    }

    if (!did.startsWith('did:key:')) {
      return res.status(400).json({ error: 'Invalid DID format, must start with did:key:' });
    }

    const publicKey = await didKeyResolver.resolve(did);
    res.json({ publicKey });
  } catch (error) {
    next(error);
  }
});

// Clear cache (admin endpoint - should be protected in production)
app.delete('/cache', async (req, res, next) => {
  try {
    const { uri } = req.query;
    
    if (uri && typeof uri === 'string') {
      await cacheManager.delete(uri);
      res.json({ message: 'Cache cleared for URI', uri });
    } else {
      await cacheManager.clear();
      res.json({ message: 'All cache cleared' });
    }
  } catch (error) {
    next(error);
  }
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`CID Resolver Service listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`HTTPS Only: ${process.env.CID_HTTPS_ONLY === 'true'}`);
  console.log(`Cache TTL: ${process.env.CID_CACHE_TTL || 3600}s`);
});

export default app;
