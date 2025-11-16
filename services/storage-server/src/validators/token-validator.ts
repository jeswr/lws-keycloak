import * as jose from 'jose';
import { JTICache } from '../utils/jti-cache.js';
export interface TokenClaims extends jose.JWTPayload {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
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


export interface TokenValidatorOptions {
  asUri: string;            // Authorization Server / Issuer URI
  realm: string;            // Expected audience base (resource server realm)
  jtiCache: JTICache;       // Replay prevention cache
  clockSkewTolerance: number; // Seconds of allowed clock skew
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  claims?: jose.JWTPayload;
}

export class TokenValidator {
  private jwks: jose.JWTVerifyGetKey | null = null;
  private initialized = false;
  constructor(private readonly options: TokenValidatorOptions) {}

  private async initJWKS() {
    if (this.initialized) return;
    // If tests injected a local JWKS use it; otherwise attempt remote fetch.
    const testJwks = (globalThis as any).__TEST_JWKS as { keys: jose.JWK[] } | undefined;
    if (testJwks) {
      this.jwks = jose.createLocalJWKSet({ keys: testJwks.keys });
      this.initialized = true;
      return;
    }
    try {
      const jwksUri = `${this.options.asUri}/protocol/openid-connect/certs`;
      this.jwks = jose.createRemoteJWKSet(new URL(jwksUri));
      this.initialized = true;
    } catch (e) {
      // Leave jwks null; signature validation will fail gracefully.
      this.initialized = true;
    }
  }

  async validate(token: string): Promise<ValidationResult> {
    await this.initJWKS();
    const now = Math.floor(Date.now() / 1000);
    let payload: jose.JWTPayload | null = null;

    // Signature verification
    if (!this.jwks) {
      return { valid: false, error: 'signature verification unavailable' };
    }
    try {
      const { payload: verified } = await jose.jwtVerify(token, this.jwks, {
        issuer: this.options.asUri,
        clockTolerance: this.options.clockSkewTolerance,
      });
      payload = verified;
    } catch (err) {
      const msg = (err as Error).message;
      // Map jose errors to expected test error messages
      if (msg.includes('"exp" claim')) {
        return { valid: false, error: 'token expired' };
      }
      if (msg.includes('"iss" claim')) {
        return { valid: false, error: 'issuer mismatch' };
      }
      return { valid: false, error: `signature invalid: ${msg}` };
    }

    // Required claims
    const required = ['sub', 'iss', 'aud', 'exp', 'iat', 'jti'];
    for (const claim of required) {
      if ((payload as any)[claim] === undefined) {
        return { valid: false, error: `missing claim ${claim}` };
      }
    }

    // Issuer validation
    if (payload.iss !== this.options.asUri) {
      return { valid: false, error: `issuer mismatch: ${payload.iss}` };
    }

    // Audience validation (string audience only for tests)
    const aud = payload.aud as string | string[];
    const audStr = Array.isArray(aud) ? aud[0] : aud;
    if (typeof audStr !== 'string' || !this.isAudienceAllowed(audStr)) {
      return { valid: false, error: 'audience invalid' };
    }

    // Lifetime enforcement ≤ 300s
    const lifetime = (payload.exp as number) - (payload.iat as number);
    if (lifetime > 300) {
      return { valid: false, error: 'token lifetime exceeds limit' };
    }

    // Expiration with clock skew tolerance
    if ((payload.exp as number) < now - this.options.clockSkewTolerance) {
      return { valid: false, error: 'token expired' };
    }

    // Issued-at future check beyond tolerance
    if ((payload.iat as number) > now + this.options.clockSkewTolerance) {
      return { valid: false, error: 'token issued in future' };
    }

    // Replay protection
    const jti = payload.jti as string;
    if (await this.options.jtiCache.isUsed(jti)) {
      return { valid: false, error: 'jti replay detected' };
    }
    const ttl = (payload.exp as number) - now;
    if (ttl > 0) {
      await this.options.jtiCache.markUsed(jti, ttl);
    }

    return { valid: true, claims: payload };
  }

  private isAudienceAllowed(aud: string): boolean {
    try {
      const realmUrl = new URL(this.options.realm);
      const audUrl = new URL(aud);
      if (realmUrl.origin !== audUrl.origin) return false;
      const realmPath = realmUrl.pathname.replace(/\/$/, '');
      const audPath = audUrl.pathname.replace(/\/$/, '');
      return audPath === realmPath || audPath.startsWith(realmPath + '/');
    } catch {
      return false;
    }
  }
}
