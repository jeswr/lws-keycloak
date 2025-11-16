import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TokenValidator } from '../../services/storage-server/src/validators/token-validator';
import { JTICache } from '../../services/storage-server/src/utils/jti-cache';
import { createMockToken } from '../helpers/token-factory';

describe('TokenValidator', () => {
  let validator: TokenValidator;
  let jtiCache: JTICache;

  beforeAll(() => {
    jtiCache = new JTICache({
      redisHost: process.env.REDIS_HOST || 'localhost',
      redisPort: parseInt(process.env.REDIS_PORT || '6379')
    });

    validator = new TokenValidator({
      asUri: 'http://localhost:8080/realms/lws',
      realm: 'http://localhost:3001/storage',
      jtiCache,
      clockSkewTolerance: 60
    });
  });

  afterAll(async () => {
    await jtiCache.close();
  });

  describe('JWT Signature Validation', () => {
    it('should validate a properly signed JWT', async () => {
      const token = await createMockToken({
        issuer: 'http://localhost:8080/realms/lws',
        audience: 'http://localhost:3001/storage',
        expiresIn: 300
      });

      const result = await validator.validate(token);
      expect(result.valid).toBe(true);
    });

    it('should reject a JWT with invalid signature', async () => {
      const token = await createMockToken({ invalidSignature: true });
      
      const result = await validator.validate(token);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('signature');
    });

    it('should reject a JWT with no signature', async () => {
      const token = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.';
      
      const result = await validator.validate(token);
      expect(result.valid).toBe(false);
    });
  });

  describe('Temporal Claims Validation', () => {
    it('should reject an expired token', async () => {
      const token = await createMockToken({
        expiresIn: -100 // Expired 100 seconds ago
      });

      const result = await validator.validate(token);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject a token issued in the future', async () => {
      const token = await createMockToken({
        issuedAt: Math.floor(Date.now() / 1000) + 3600 // 1 hour in future
      });

      const result = await validator.validate(token);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('future');
    });

    it('should accept tokens within clock skew tolerance', async () => {
      const token = await createMockToken({
        expiresIn: -30, // Expired 30 seconds ago, within 60s tolerance
      });

      const result = await validator.validate(token);
      expect(result.valid).toBe(true);
    });

    it('should enforce token lifetime ≤ 300s', async () => {
      const token = await createMockToken({
        expiresIn: 400 // 400 second lifetime
      });

      const result = await validator.validate(token);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lifetime');
    });
  });

  describe('Audience Validation', () => {
    it('should validate matching audience', async () => {
      const token = await createMockToken({
        audience: 'http://localhost:3001/storage'
      });

      const result = await validator.validate(token);
      expect(result.valid).toBe(true);
    });

    it('should reject mismatched audience', async () => {
      const token = await createMockToken({
        audience: 'http://other-server:3001/storage'
      });

      const result = await validator.validate(token);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('audience');
    });

    it('should accept realm-prefix audience', async () => {
      const token = await createMockToken({
        audience: 'http://localhost:3001/storage/subfolder'
      });

      const result = await validator.validate(token);
      expect(result.valid).toBe(true);
    });
  });

  describe('JTI Replay Prevention', () => {
    it('should accept first use of JTI', async () => {
      const jti = `test-jti-${Date.now()}`;
      const token = await createMockToken({ jti });

      const result = await validator.validate(token);
      expect(result.valid).toBe(true);
    });

    it('should reject reused JTI', async () => {
      const jti = `test-jti-reuse-${Date.now()}`;
      const token = await createMockToken({ jti });

      // First use
      const result1 = await validator.validate(token);
      expect(result1.valid).toBe(true);

      // Second use (replay)
      const result2 = await validator.validate(token);
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain('replay');
    });
  });

  describe('Issuer Validation', () => {
    it('should validate correct issuer', async () => {
      const token = await createMockToken({
        issuer: 'http://localhost:8080/realms/lws'
      });

      const result = await validator.validate(token);
      expect(result.valid).toBe(true);
    });

    it('should reject incorrect issuer', async () => {
      const token = await createMockToken({
        issuer: 'http://malicious-server:8080/realms/lws'
      });

      const result = await validator.validate(token);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('issuer');
    });
  });
});
