import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { TokenValidator } from './validators/token-validator.js';
import { AuthorizationEnforcer } from './validators/authorization-enforcer.js';
import { CRUDHandlers } from './handlers/crud-handlers.js';
import { FilesystemStorage } from './storage/filesystem-storage.js';
import { JTICache } from './utils/jti-cache.js';
import { errorHandler } from './middleware/error-handler.js';
import { authMiddleware } from './middleware/auth-middleware.js';

const app = express();
const port = process.env.PORT || 3001;

// Configuration
const config = {
  realm: process.env.STORAGE_REALM || 'http://localhost:3001/storage',
  asUri: process.env.STORAGE_AS_URI || 'http://localhost:8080/realms/lws',
  storagePath: process.env.STORAGE_PATH || './data/storage',
  tokenLifetime: parseInt(process.env.TOKEN_LIFETIME || '300', 10),
  clockSkew: parseInt(process.env.CLOCK_SKEW_TOLERANCE || '60', 10),
};

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true,
  exposedHeaders: ['WWW-Authenticate', 'Link'],
}));
app.use(morgan(process.env.LOG_FORMAT || 'combined'));

// Don't parse body for all routes - let handlers decide
app.use(express.raw({ type: '*/*', limit: '50mb' }));

// Initialize services
const jtiCache = new JTICache({
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
});

const tokenValidator = new TokenValidator({
  issuer: config.asUri,
  clockSkew: config.clockSkew,
  jtiCache,
});

const authEnforcer = new AuthorizationEnforcer(config.realm);

const storage = new FilesystemStorage(config.storagePath);

const crudHandlers = new CRUDHandlers(storage);

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    realm: config.realm,
  });
});

// Storage metadata endpoint
app.get('/.well-known/lws-storage-server', (req, res) => {
  res.json({
    as_uri: config.asUri,
    realm: config.realm,
  });
});

// Protected storage routes
const storageRouter = express.Router();

// Apply authentication middleware to all storage routes
storageRouter.use(authMiddleware(tokenValidator, authEnforcer, config));

// CRUD operations
storageRouter.get('/*', crudHandlers.handleGet.bind(crudHandlers));
storageRouter.head('/*', crudHandlers.handleHead.bind(crudHandlers));
storageRouter.put('/*', crudHandlers.handlePut.bind(crudHandlers));
storageRouter.post('/*', crudHandlers.handlePost.bind(crudHandlers));
storageRouter.patch('/*', crudHandlers.handlePatch.bind(crudHandlers));
storageRouter.delete('/*', crudHandlers.handleDelete.bind(crudHandlers));
storageRouter.options('/*', crudHandlers.handleOptions.bind(crudHandlers));

// Mount storage router
app.use('/storage', storageRouter);

// Error handler
app.use(errorHandler);

// Start server
const server = app.listen(port, () => {
  console.log(`Storage Server listening on port ${port}`);
  console.log(`Realm: ${config.realm}`);
  console.log(`Authorization Server: ${config.asUri}`);
  console.log(`Storage Path: ${config.storagePath}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await jtiCache.close();
    process.exit(0);
  });
});

export default app;
