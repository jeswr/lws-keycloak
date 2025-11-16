import { Request, Response, NextFunction } from 'express';
import { TokenValidator, TokenValidationError } from '../validators/token-validator.js';
import { AuthorizationEnforcer, AuthorizationError } from '../validators/authorization-enforcer.js';

interface AuthMiddlewareConfig {
  realm: string;
  asUri: string;
}

export function authMiddleware(
  tokenValidator: TokenValidator,
  authEnforcer: AuthorizationEnforcer,
  config: AuthMiddlewareConfig
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return sendUnauthorized(res, config);
    }

    // Parse Bearer token
    const match = authHeader.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      return sendUnauthorized(res, config, 'invalid_token');
    }

    const token = match[1];
    const requestedResource = `${req.protocol}://${req.get('host')}${req.path}`;

    try {
      // Validate token
      const result = await tokenValidator.validate(token);
      
      if (!result.valid || !result.claims) {
        return sendUnauthorized(res, config, 'invalid_token');
      }

      const claims = result.claims as import('../validators/token-validator.js').TokenClaims;

      // Check authorization
      const allowed = authEnforcer.canAccess(claims, req.method, requestedResource);

      if (!allowed) {
        throw new AuthorizationError(
          'Access denied',
          'ACCESS_DENIED',
          403
        );
      }

      // Attach claims to request for handlers
      (req as any).tokenClaims = claims;
      
      next();
    } catch (error) {
      const err = error as Error;
      if (err.name === 'TokenValidationError') {
        return sendUnauthorized(res, config, 'invalid_token');
      }
      
      if (err.name === 'AuthorizationError') {
        return res.status((err as any).statusCode || 403).json({
          error: (err as any).code || 'FORBIDDEN',
          message: err.message,
        });
      }

      next(error);
    }
  };
}

function sendUnauthorized(
  res: Response,
  config: AuthMiddlewareConfig,
  error?: string
) {
  let challenge = `Bearer as_uri="${config.asUri}", realm="${config.realm}"`;
  
  if (error) {
    challenge += `, error="${error}"`;
  }

  res.setHeader('WWW-Authenticate', challenge);
  res.status(401).json({
    error: error || 'unauthorized',
    message: 'Authentication required',
  });
}
