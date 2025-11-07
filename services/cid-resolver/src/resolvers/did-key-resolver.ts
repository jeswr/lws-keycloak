import { base58btc } from 'multiformats/bases/base58';
import { CIDResolverError } from './cid-resolver.js';

export interface DIDKeyPublicKey {
  kty: string;
  crv: string;
  x: string;
  y?: string;
  alg?: string;
}

/**
 * DID Key Resolver for did:key method
 * Implements resolution as per https://w3c-ccg.github.io/did-method-key/
 */
export class DIDKeyResolver {
  /**
   * Resolve a did:key URI to a public key
   */
  async resolve(did: string): Promise<DIDKeyPublicKey> {
    if (!did.startsWith('did:key:')) {
      throw new CIDResolverError(
        'Invalid DID format, must start with did:key:',
        'INVALID_DID',
        400
      );
    }

    // Extract the multibase encoded public key
    const multibaseKey = did.substring(8); // Remove 'did:key:' prefix

    try {
      // Decode the multibase string
      const decoded = base58btc.decode(multibaseKey);
      
      // The first two bytes are the multicodec prefix
      const multicodecPrefix = decoded.slice(0, 2);
      const keyBytes = decoded.slice(2);

      // Determine key type from multicodec prefix
      // 0xed01 = Ed25519 public key
      // 0xec01 = secp256k1 public key  
      // 0x1200 = P-256 public key
      // 0x1201 = P-384 public key
      // 0x1202 = P-521 public key

      const prefix = (multicodecPrefix[0] << 8) | multicodecPrefix[1];

      switch (prefix) {
        case 0xed01:
          return this.ed25519ToJWK(keyBytes);
        case 0x1200:
          return this.p256ToJWK(keyBytes);
        case 0xec01:
          return this.secp256k1ToJWK(keyBytes);
        default:
          throw new CIDResolverError(
            `Unsupported key type with prefix: 0x${prefix.toString(16)}`,
            'UNSUPPORTED_KEY_TYPE',
            400
          );
      }
    } catch (error) {
      if (error instanceof CIDResolverError) {
        throw error;
      }
      throw new CIDResolverError(
        `Failed to decode did:key: ${(error as Error).message}`,
        'DECODE_ERROR',
        400
      );
    }
  }

  /**
   * Convert Ed25519 public key bytes to JWK
   */
  private ed25519ToJWK(keyBytes: Uint8Array): DIDKeyPublicKey {
    if (keyBytes.length !== 32) {
      throw new CIDResolverError(
        'Invalid Ed25519 key length',
        'INVALID_KEY',
        400
      );
    }

    return {
      kty: 'OKP',
      crv: 'Ed25519',
      x: this.base64UrlEncode(keyBytes),
      alg: 'EdDSA',
    };
  }

  /**
   * Convert P-256 (secp256r1) public key bytes to JWK
   */
  private p256ToJWK(keyBytes: Uint8Array): DIDKeyPublicKey {
    // P-256 uncompressed key is 65 bytes (0x04 + 32 bytes X + 32 bytes Y)
    // P-256 compressed key is 33 bytes (0x02/0x03 + 32 bytes X)
    
    if (keyBytes.length === 65 && keyBytes[0] === 0x04) {
      // Uncompressed format
      const x = keyBytes.slice(1, 33);
      const y = keyBytes.slice(33, 65);

      return {
        kty: 'EC',
        crv: 'P-256',
        x: this.base64UrlEncode(x),
        y: this.base64UrlEncode(y),
        alg: 'ES256',
      };
    } else if (keyBytes.length === 33 && (keyBytes[0] === 0x02 || keyBytes[0] === 0x03)) {
      // Compressed format - we need to decompress
      const x = keyBytes.slice(1, 33);
      const y = this.decompressP256Point(x, keyBytes[0] === 0x03);

      return {
        kty: 'EC',
        crv: 'P-256',
        x: this.base64UrlEncode(x),
        y: this.base64UrlEncode(y),
        alg: 'ES256',
      };
    } else {
      throw new CIDResolverError(
        'Invalid P-256 key format',
        'INVALID_KEY',
        400
      );
    }
  }

  /**
   * Convert secp256k1 public key bytes to JWK
   */
  private secp256k1ToJWK(keyBytes: Uint8Array): DIDKeyPublicKey {
    if (keyBytes.length === 65 && keyBytes[0] === 0x04) {
      // Uncompressed format
      const x = keyBytes.slice(1, 33);
      const y = keyBytes.slice(33, 65);

      return {
        kty: 'EC',
        crv: 'secp256k1',
        x: this.base64UrlEncode(x),
        y: this.base64UrlEncode(y),
        alg: 'ES256K',
      };
    } else if (keyBytes.length === 33 && (keyBytes[0] === 0x02 || keyBytes[0] === 0x03)) {
      // Compressed format
      const x = keyBytes.slice(1, 33);
      // Note: Full decompression would require secp256k1 curve math
      // For now, throw an error as this is complex
      throw new CIDResolverError(
        'Compressed secp256k1 keys not yet supported',
        'UNSUPPORTED_KEY_FORMAT',
        400
      );
    } else {
      throw new CIDResolverError(
        'Invalid secp256k1 key format',
        'INVALID_KEY',
        400
      );
    }
  }

  /**
   * Decompress a P-256 point (simplified - for full implementation use crypto library)
   */
  private decompressP256Point(x: Uint8Array, isOdd: boolean): Uint8Array {
    // This is a simplified implementation
    // In production, use a proper elliptic curve library like @noble/curves
    throw new CIDResolverError(
      'Compressed P-256 keys require additional dependencies',
      'UNSUPPORTED_KEY_FORMAT',
      400
    );
  }

  /**
   * Base64 URL encode without padding
   */
  private base64UrlEncode(bytes: Uint8Array): string {
    const base64 = Buffer.from(bytes).toString('base64');
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
