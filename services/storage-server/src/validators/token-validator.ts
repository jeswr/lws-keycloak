import * as jose from 'jose';
import fetch from 'node-fetch';
import { JTICache } from '../utils/jti-cache.js';

export interface TokenValidatorOptions {
  issuer: string;
  clockSkew: number;
  jtiCache: JTICache;
}

export interface TokenClaims {
  sub: string;
  iss: string;
  client_id: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  nbf?: number;
}

export class TokenValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'TokenValidationError';
  }
}

export class TokenValidator {
  private jwks: jose.JWTVerifyGetKey | null = null;
  private options: TokenValidatorOptions;

  constructor(options: TokenValidatorOptions) {
    this.options = options;
    this.initJWKS();
  }

  private async initJWKS() {
    try {
      // Construct JWKS URI from issuer
      const jwksUri = `${this.options.issuer}/protocol/openid-connect/certs`;
      this.jwks = jose.createRemoteJWKSet(new URL(jwksUri));
      console.log(`Initialized JWKS from ${jwksUri}`);
    } catch (error) {
      console.error('Failed to initialize JWKS:', error);
      throw new TokenValidationError(
        'Failed to initialize token validator',
        'JWKS_INIT_FAILED',
        500
      );
    }
  }

  async validate(token: string, requestedResource: string): Promise<TokenClaims> {
    if (!this.jwks) {
      await this.initJWKS();
    }

    // Step 1: Verify JWT signature and decode
    let payload: jose.JWTPayload;
    try {
      const { payload: verifiedPayload } = await jose.jwtVerify(
        token,
        this.jwks!,
        {
          issuer: this.options.issuer,
          clockTolerance: this.options.clockSkew,
        }
      );
      payload = verifiedPayload;
    } catch (error) {
      throw new TokenValidationError(
        `Invalid token signature: ${(error as Error).message}`,
        'INVALID_SIGNATURE',
        401
      );
    }

    // Step 2: Validate required claims
    this.validateClaims(payload);

    const claims = payload as unknown as TokenClaims;

    // Step 3: Validate issuer
    if (claims.iss !== this.options.issuer) {
      throw new TokenValidationError(
        `Invalid issuer: expected ${this.options.issuer}, got ${claims.iss}`,
        'INVALID_ISSUER',
        401
      );
    }

    // Step 4: Validate audience (must contain the requested resource or its parent)
    if (!this.validateAudience(claims.aud, requestedResource)) {
      throw new TokenValidationError(
        `Invalid audience: token not valid for resource ${requestedResource}`,
        'INVALID_AUDIENCE',
        403
      );
    }

    // Step 5: Validate temporal claims
    const now = Math.floor(Date.now() / 1000);
    
    // Check expiration
    if (claims.exp <= now) {
      throw new TokenValidationError(
        'Token has expired',
        'TOKEN_EXPIRED',
        401
      );
    }

    // Check not-before if present
    if (claims.nbf && claims.nbf > now + this.options.clockSkew) {
      throw new TokenValidationError(
        'Token not yet valid',
        'TOKEN_NOT_YET_VALID',
        401
      );
    }

    // Check issued-at is not in the future
    if (claims.iat > now + this.options.clockSkew) {
      throw new TokenValidationError(
        'Token issued in the future',
        'INVALID_IAT',
        401
      );
    }

    // Step 6: Check JTI for replay prevention
    const isReplay = await this.options.jtiCache.isUsed(claims.jti);
    if (isReplay) {
      throw new TokenValidationError(
        'Token has already been used (replay attack detected)',
        'TOKEN_REPLAY',
        401
      );
    }

    // Mark JTI as used
    const ttl = claims.exp - now;
    await this.options.jtiCache.markUsed(claims.jti, ttl);

    return claims;
  }

  private validateClaims(payload: jose.JWTPayload): void {
    const required = ['sub', 'iss', 'client_id', 'aud', 'exp', 'iat', 'jti'];
    
    for (const claim of required) {
      if (!payload[claim]) {
        throw new TokenValidationError(
          `Missing required claim: ${claim}`,
          'MISSING_CLAIM',
          401
        );
      }
    }

    // Validate types
    if (typeof payload.sub !== 'string') {
      throw new TokenValidationError('Invalid sub claim type', 'INVALID_CLAIM', 401);
    }
    if (typeof payload.iss !== 'string') {
      throw new TokenValidationError('Invalid iss claim type', 'INVALID_CLAIM', 401);
    }
    if (typeof payload.client_id !== 'string') {
      throw new TokenValidationError('Invalid client_id claim type', 'INVALID_CLAIM', 401);
    }
    if (typeof payload.aud !== 'string') {
      throw new TokenValidationError('Invalid aud claim type', 'INVALID_CLAIM', 401);
    }
    if (typeof payload.exp !== 'number') {
      throw new TokenValidationError('Invalid exp claim type', 'INVALID_CLAIM', 401);
    }
    if (typeof payload.iat !== 'number') {
      throw new TokenValidationError('Invalid iat claim type', 'INVALID_CLAIM', 401);
    }
    if (typeof payload.jti !== 'string') {
      throw new TokenValidationError('Invalid jti claim type', 'INVALID_CLAIM', 401);
    }
  }

  private validateAudience(aud: string, requestedResource: string): boolean {
    try {
      const audUrl = new URL(aud);
      const resourceUrl = new URL(requestedResource);

      // Normalize URLs (remove trailing slashes)
      const audPath = audUrl.pathname.replace(/\/$/, '');
      const resourcePath = resourceUrl.pathname.replace(/\/$/, '');

      // Check if the audience logically contains the requested resource
      // The resource must be within the audience scope
      return (
        audUrl.origin === resourceUrl.origin &&
        (resourcePath === audPath || resourcePath.startsWith(audPath + '/'))
      );
    } catch (error) {
      return false;
    }
  }
}
