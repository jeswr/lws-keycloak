import fetch from 'node-fetch';
import { CacheManager } from '../cache/cache-manager.js';

export interface CIDDocument {
  '@context': string[];
  id: string;
  authentication?: VerificationMethod[];
  service?: ServiceEndpoint[];
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyJwk?: JsonWebKey;
}

export interface ServiceEndpoint {
  type: string;
  serviceEndpoint: string;
}

export interface JsonWebKey {
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
  kid?: string;
  alg?: string;
  use?: string;
}

export interface CIDResolverOptions {
  httpsOnly: boolean;
  maxSize: number;
  timeout: number;
}

export class CIDResolverError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'CIDResolverError';
  }
}

export class CIDResolver {
  constructor(
    private cache: CacheManager,
    private options: CIDResolverOptions
  ) {}

  async resolve(uri: string): Promise<CIDDocument> {
    this.validateUri(uri);

    // Check cache first
    const cached = await this.cache.get(uri);
    if (cached) {
      return JSON.parse(cached) as CIDDocument;
    }

    // Fetch document
    const document = await this.fetchDocument(uri);
    
    // Validate document
    this.validateDocument(document);

    // Cache the document
    await this.cache.set(uri, JSON.stringify(document));

    return document;
  }

  private validateUri(uri: string): void {
    let parsedUri: URL;
    try {
      parsedUri = new URL(uri);
    } catch {
      throw new CIDResolverError(
        'Invalid URI format',
        'INVALID_URI',
        400
      );
    }

    // Check HTTPS requirement
    if (this.options.httpsOnly && parsedUri.protocol !== 'https:') {
      // Allow http://localhost for development
      if (!parsedUri.hostname.includes('localhost') && parsedUri.hostname !== '127.0.0.1') {
        throw new CIDResolverError(
          'HTTPS is required for CID resolution',
          'HTTPS_REQUIRED',
          400
        );
      }
    }

    // Validate scheme
    if (parsedUri.protocol !== 'http:' && parsedUri.protocol !== 'https:') {
      throw new CIDResolverError(
        'Only HTTP(S) URIs are supported',
        'UNSUPPORTED_SCHEME',
        400
      );
    }
  }

  private async fetchDocument(uri: string): Promise<CIDDocument> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(uri, {
        headers: {
          'Accept': 'application/ld+json, application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new CIDResolverError(
          `Failed to fetch CID document: ${response.statusText}`,
          'FETCH_FAILED',
          response.status
        );
      }

      // Check content length
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > this.options.maxSize) {
        throw new CIDResolverError(
          `Document exceeds maximum size of ${this.options.maxSize} bytes`,
          'DOCUMENT_TOO_LARGE',
          413
        );
      }

      const text = await response.text();
      
      // Check actual size
      if (text.length > this.options.maxSize) {
        throw new CIDResolverError(
          `Document exceeds maximum size of ${this.options.maxSize} bytes`,
          'DOCUMENT_TOO_LARGE',
          413
        );
      }

      return JSON.parse(text);
    } catch (error) {
      if (error instanceof CIDResolverError) {
        throw error;
      }
      
      if ((error as Error).name === 'AbortError') {
        throw new CIDResolverError(
          'Request timeout',
          'TIMEOUT',
          504
        );
      }

      throw new CIDResolverError(
        `Failed to fetch CID document: ${(error as Error).message}`,
        'FETCH_ERROR',
        500
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private validateDocument(doc: any): asserts doc is CIDDocument {
    if (!doc || typeof doc !== 'object') {
      throw new CIDResolverError(
        'Invalid CID document: not an object',
        'INVALID_DOCUMENT',
        400
      );
    }

    if (!doc['@context'] || !Array.isArray(doc['@context'])) {
      throw new CIDResolverError(
        'Invalid CID document: missing or invalid @context',
        'INVALID_DOCUMENT',
        400
      );
    }

    if (!doc.id || typeof doc.id !== 'string') {
      throw new CIDResolverError(
        'Invalid CID document: missing or invalid id',
        'INVALID_DOCUMENT',
        400
      );
    }

    // Validate authentication methods if present
    if (doc.authentication) {
      if (!Array.isArray(doc.authentication)) {
        throw new CIDResolverError(
          'Invalid CID document: authentication must be an array',
          'INVALID_DOCUMENT',
          400
        );
      }

      for (const method of doc.authentication) {
        this.validateVerificationMethod(method);
      }
    }
  }

  private validateVerificationMethod(method: any): asserts method is VerificationMethod {
    if (!method || typeof method !== 'object') {
      throw new CIDResolverError(
        'Invalid verification method',
        'INVALID_VERIFICATION_METHOD',
        400
      );
    }

    if (!method.id || typeof method.id !== 'string') {
      throw new CIDResolverError(
        'Invalid verification method: missing or invalid id',
        'INVALID_VERIFICATION_METHOD',
        400
      );
    }

    if (!method.type || typeof method.type !== 'string') {
      throw new CIDResolverError(
        'Invalid verification method: missing or invalid type',
        'INVALID_VERIFICATION_METHOD',
        400
      );
    }

    if (!method.controller || typeof method.controller !== 'string') {
      throw new CIDResolverError(
        'Invalid verification method: missing or invalid controller',
        'INVALID_VERIFICATION_METHOD',
        400
      );
    }
  }

  getVerificationMethod(document: CIDDocument, kid: string): VerificationMethod | null {
    if (!document.authentication) {
      return null;
    }

    // Try to find by fragment match
    const fragmentId = kid.startsWith('#') ? kid : `#${kid}`;
    const fullId = document.id + fragmentId;

    for (const method of document.authentication) {
      if (method.id === fullId || method.id === kid) {
        return method;
      }
      
      // Also check if the kid matches the publicKeyJwk.kid
      if (method.publicKeyJwk?.kid === kid) {
        return method;
      }
    }

    return null;
  }

  extractPublicKey(method: VerificationMethod): JsonWebKey {
    if (!method.publicKeyJwk) {
      throw new CIDResolverError(
        'Verification method does not contain publicKeyJwk',
        'NO_PUBLIC_KEY',
        400
      );
    }

    return method.publicKeyJwk;
  }
}
