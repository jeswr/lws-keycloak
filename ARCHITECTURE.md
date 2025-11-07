# Linked Web Storage - Keycloak Reference Implementation
## Architectural Specification

### Version 1.0
**Date:** November 7, 2025

---

## 1. Executive Summary

This document describes the architecture of a reference implementation for the Linked Web Storage (LWS) authentication and authorization specifications using Keycloak as the core identity and access management platform.

The implementation provides:
- Standards-compliant OAuth 2.0 token exchange flows
- Support for multiple authentication suites (OpenID Connect, SSI-CID, SSI-DID-Key, SAML)
- LWS-specific extensions to Keycloak
- A reference storage server implementation
- Complete end-to-end testing infrastructure

---

## 2. Architectural Overview

### 2.1 System Context

```
┌─────────────────┐
│   End Users     │
│   & Agents      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐       ┌──────────────────┐
│  Client Apps    │◄──────┤  Identity        │
│  (RP/Client)    │       │  Providers       │
└────────┬────────┘       │  (External)      │
         │                └──────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│         LWS Keycloak Implementation         │
│  ┌─────────────────────────────────────┐   │
│  │   Authorization Server (Keycloak)   │   │
│  │  - Token Exchange                   │   │
│  │  - Credential Validation            │   │
│  │  - Access Token Generation          │   │
│  └──────────┬──────────────────────────┘   │
│             │                               │
│  ┌──────────▼──────────────────────────┐   │
│  │   Authentication Suite Handlers     │   │
│  │  - OpenID Connect                   │   │
│  │  - SSI-CID                          │   │
│  │  - SSI-DID-Key                      │   │
│  │  - SAML 2.0                         │   │
│  └──────────┬──────────────────────────┘   │
│             │                               │
│  ┌──────────▼──────────────────────────┐   │
│  │   CID/DID Resolution Service        │   │
│  │  - Document Fetching                │   │
│  │  - Key Extraction                   │   │
│  │  - Caching                          │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│         Storage Server (Resource Server)    │
│  - Token Validation                         │
│  - Authorization Enforcement                │
│  - CRUD Operations                          │
│  - LWS Protocol Compliance                  │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│   Data Storage  │
│   (File System  │
│    or Database) │
└─────────────────┘
```

### 2.2 Component Architecture

The system is composed of five primary components:

1. **Keycloak Authorization Server** - Extended OAuth 2.0/OIDC server
2. **Authentication Suite Handlers** - Pluggable credential validators
3. **CID/DID Resolution Service** - Decentralized identifier resolver
4. **Storage Server** - LWS-compliant resource server
5. **Client Libraries** - Reference implementations for application developers

---

## 3. Component Specifications

### 3.1 Authorization Server (Keycloak Extensions)

**Technology Stack:**
- Keycloak 23.x or later
- Custom Service Provider Interface (SPI) implementations
- Java 17+

**Key Responsibilities:**
- Serve LWS configuration at `/.well-known/lws-configuration`
- Accept token exchange requests (`urn:ietf:params:oauth:grant-type:token-exchange`)
- Validate subject tokens (end-user credentials)
- Generate LWS-compliant access tokens (JWT with `at+jwt` type)
- Manage trusted storage server registry

**Custom SPIs Required:**

1. **LWS Token Exchange Provider**
   ```java
   interface LWSTokenExchangeProvider {
     AccessToken exchange(
       SubjectToken subjectToken,
       String resource,
       String subjectTokenType
     ) throws TokenValidationException;
   }
   ```

2. **Authentication Suite Registry**
   ```java
   interface AuthenticationSuiteRegistry {
     AuthenticationSuite getHandler(String tokenType);
     void registerSuite(AuthenticationSuite suite);
   }
   ```

3. **Storage Trust Manager**
   ```java
   interface StorageTrustManager {
     boolean isTrustedStorage(String storageUri);
     void addTrustedStorage(String storageUri);
   }
   ```

**Configuration Endpoints:**

- `GET /.well-known/lws-configuration` - Server metadata
  ```json
  {
    "issuer": "https://authorization.example",
    "grant_types_supported": ["urn:ietf:params:oauth:grant-type:token-exchange"],
    "token_endpoint": "https://authorization.example/token",
    "jwks_uri": "https://authorization.example/jwks",
    "subject_token_types_supported": [
      "urn:ietf:params:oauth:token-type:jwt",
      "urn:ietf:params:oauth:token-type:id_token",
      "urn:ietf:params:oauth:token-type:saml2"
    ]
  }
  ```

### 3.2 Authentication Suite Handlers

Each authentication suite is implemented as a pluggable handler that validates specific credential types.

#### 3.2.1 OpenID Connect Handler

**Responsibilities:**
- Validate ID Token JWT signatures
- Perform OpenID Connect Discovery for unknown issuers
- Validate subject's Controlled Identifier Document
- Extract required claims (sub, iss, azp, aud)

**Dependencies:**
- HTTP client for OpenID Discovery
- JWT validation library
- CID resolution service

**Validation Flow:**
```
ID Token → Check signature algorithm != "none"
         → Validate JWT signature with OIDC provider's JWK
         → If no trust relationship:
            → Fetch subject's CID
            → Verify service endpoint matches issuer
            → Validate OpenID Provider reference
         → Extract claims → Return validated subject
```

#### 3.2.2 SSI-CID Handler

**Responsibilities:**
- Validate self-issued JWT credentials
- Resolve Controlled Identifier Documents
- Extract verification methods
- Validate JWT signatures using CID keys

**Validation Flow:**
```
Self-Issued JWT → Validate required claims (sub, iss, client_id)
                → Verify sub == iss == client_id
                → Fetch CID document from subject URI
                → Extract verification method by kid
                → Validate JWT signature
                → Check expiration
                → Return validated subject
```

**CID Document Example:**
```json
{
  "@context": ["https://www.w3.org/ns/cid/v1"],
  "id": "https://id.example/agent",
  "authentication": [{
    "id": "https://id.example/agent#c1f52577",
    "type": "JsonWebKey",
    "controller": "https://id.example/agent",
    "publicKeyJwk": {
      "kid": "c1f52577",
      "kty": "EC",
      "crv": "P-256",
      "alg": "ES256",
      "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
      "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"
    }
  }]
}
```

#### 3.2.3 SSI-DID-Key Handler

**Responsibilities:**
- Extract public keys from `did:key` URIs
- Validate JWT signatures using extracted keys
- Verify self-issued claims

**Validation Flow:**
```
DID:Key JWT → Validate required claims
            → Verify sub == iss == client_id
            → Extract public key from did:key URI
            → Validate JWT signature
            → Check expiration
            → Return validated subject
```

#### 3.2.4 SAML 2.0 Handler

**Responsibilities:**
- Validate SAML assertion signatures
- Extract required assertions (NameID, Issuer, Recipient, Audience)
- Verify trust relationship with Identity Provider

**Configuration Requirements:**
- Pre-configured trusted IdP metadata
- IdP certificate management
- SAML assertion replay prevention

---

### 3.3 CID/DID Resolution Service

**Technology Stack:**
- Node.js/TypeScript or Java
- HTTP client with caching
- Redis or in-memory cache for public keys

**Key Features:**

1. **Document Resolution**
   - HTTP(S) content negotiation for CIDs
   - DID:Key method resolver
   - Configurable timeout and retry policies

2. **Caching Strategy**
   - Cache CID documents based on HTTP `Cache-Control` headers
   - Default TTL: as specified by `max-age`
   - Recommended minimum: 300 seconds
   - Recommended maximum: 3600 seconds

3. **Security Controls**
   - HTTPS-only for CID resolution (except localhost)
   - Maximum document size limits (10KB recommended)
   - Domain allowlisting (optional)
   - Rate limiting per domain

**API Interface:**
```typescript
interface CIDResolver {
  resolveCID(uri: string): Promise<CIDDocument>;
  getVerificationMethod(cidDoc: CIDDocument, keyId: string): VerificationMethod;
  extractPublicKey(method: VerificationMethod): PublicKey;
}

interface DIDResolver {
  resolveDIDKey(did: string): Promise<PublicKey>;
}
```

---

### 3.4 Storage Server (Resource Server)

**Technology Stack:**
- Node.js/Express or Java/Spring Boot
- JWT validation library
- Storage backend (filesystem, S3, or database)

**Core Components:**

1. **WWW-Authenticate Challenge Generator**
   ```typescript
   interface ChallengeGenerator {
     generate(resource: string): WWWAuthenticateChallenge;
   }
   
   interface WWWAuthenticateChallenge {
     as_uri: string;        // Authorization server URI
     realm: string;         // Storage root/realm
     storage_metadata?: string;
   }
   ```

2. **Access Token Validator**
   ```typescript
   interface TokenValidator {
     validate(token: string, resource: string): Promise<TokenClaims>;
   }
   
   // Validation steps:
   // 1. Verify JWT signature (using AS's JWKS)
   // 2. Validate issuer (iss)
   // 3. Validate audience (aud contains resource)
   // 4. Validate temporal claims (exp, nbf, iat)
   // 5. Check JTI for replay prevention
   ```

3. **Authorization Enforcer**
   ```typescript
   interface AuthorizationEnforcer {
     canAccess(claims: TokenClaims, method: HttpMethod, resource: string): boolean;
   }
   ```

4. **CRUD Operations Handler**
   - GET/HEAD → Read operations
   - PUT → Create (if not exists) or Update
   - PATCH → Append or Update
   - POST → Create in container
   - DELETE → Delete operation

**Security Features:**

1. **JTI Replay Prevention**
   - Cache used JTI values until token expiration
   - Reject duplicate JTI within validity period
   - Distributed cache for multi-instance deployments

2. **Audience Validation**
   - Strict URI containment checking
   - Prevent path traversal attacks
   - Validate realm containment

3. **Clock Skew Tolerance**
   - Maximum 60 seconds recommended
   - Configurable per deployment

**Storage Metadata Endpoint:**
```
GET /.well-known/lws-storage-server
Response:
{
  "as_uri": "https://authorization.example",
  "notifications_endpoint": "https://storage.example/notifications",
  "cid": "/.well-known/lws-storage-cid"
}
```

---

## 4. Protocol Flows

### 4.1 OpenID Connect Authentication Flow

```
┌──────┐                ┌────────────┐         ┌──────────┐         ┌─────────┐
│Client│                │External    │         │Keycloak  │         │Storage  │
│ App  │                │OIDC Provider│         │Auth Server│        │Server   │
└──┬───┘                └─────┬──────┘         └────┬─────┘         └────┬────┘
   │                           │                     │                    │
   │1. Access Protected Resource                     │                    │
   ├────────────────────────────────────────────────────────────────────►│
   │                           │                     │                    │
   │                           │                     │  2. Return 401     │
   │                           │                     │    WWW-Authenticate│
   │◄────────────────────────────────────────────────────────────────────┤
   │                           │                     │                    │
   │3. Request ID Token        │                     │                    │
   ├──────────────────────────►│                     │                    │
   │                           │                     │                    │
   │4. Return ID Token         │                     │                    │
   │◄──────────────────────────┤                     │                    │
   │                           │                     │                    │
   │5. Token Exchange (ID Token for Access Token)    │                    │
   ├────────────────────────────────────────────────►│                    │
   │                           │                     │                    │
   │                           │   6. Validate ID Token                   │
   │                           │      (OpenID Discovery, CID check)       │
   │                           │                     │                    │
   │7. Return Access Token     │                     │                    │
   │◄────────────────────────────────────────────────┤                    │
   │                           │                     │                    │
   │8. Access Resource with Access Token             │                    │
   ├────────────────────────────────────────────────────────────────────►│
   │                           │                     │                    │
   │                           │                     │  9. Validate Token │
   │                           │                     │     Return Resource│
   │◄────────────────────────────────────────────────────────────────────┤
   │                           │                     │                    │
```

### 4.2 Self-Issued (SSI-CID) Authentication Flow

```
┌──────┐                ┌────────────┐         ┌─────────┐
│Client│                │Keycloak    │         │Storage  │
│Agent │                │Auth Server │         │Server   │
└──┬───┘                └─────┬──────┘         └────┬────┘
   │                           │                     │
   │1. Generate Self-Signed JWT (with agent's private key)
   │                           │                     │
   │2. Token Exchange Request  │                     │
   │   (subject_token = JWT)   │                     │
   ├──────────────────────────►│                     │
   │                           │                     │
   │                           │3. Fetch CID from    │
   │                           │   subject URI       │
   │                           │                     │
   │                           │4. Extract public key│
   │                           │   from CID          │
   │                           │                     │
   │                           │5. Validate JWT      │
   │                           │   signature         │
   │                           │                     │
   │6. Return Access Token     │                     │
   │◄──────────────────────────┤                     │
   │                           │                     │
   │7. Access Resource         │                     │
   ├───────────────────────────────────────────────►│
   │                           │                     │
   │8. Return Resource         │                     │
   │◄───────────────────────────────────────────────┤
   │                           │                     │
```

### 4.3 Token Exchange Request Detail

**Request:**
```http
POST /token HTTP/1.1
Host: authorization.example
Content-Type: application/x-www-form-urlencoded

grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange
&resource=https%3A%2F%2Fstorage.example%2Fstorage_1
&subject_token=eyJ0eXAiOiJhcytqd3QiLCJhbGciO...
&subject_token_type=urn%3Aietf%3Aparams%3Aoauth%3Atoken-type%3Aid_token
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "eyJ0eXAiOiJhdCtqd3QiLCJhbGciOiJFUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 300
}
```

**Access Token Payload:**
```json
{
  "sub": "https://id.example/agent",
  "iss": "https://authorization.example",
  "client_id": "https://app.example/id",
  "aud": "https://storage.example/storage_1",
  "exp": 1735686300,
  "iat": 1735686000,
  "jti": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 5. Data Models

### 5.1 End-User Credential Data Model

```typescript
interface EndUserCredential {
  subject: string;        // REQUIRED: absolute URI
  issuer: string;         // REQUIRED: absolute URI
  client: string;         // REQUIRED: should be absolute URI
  audience?: string[];    // RECOMMENDED: authorization server identifiers
}
```

### 5.2 Access Token Data Model

```typescript
interface LWSAccessToken {
  sub: string;           // REQUIRED: subject URI
  iss: string;           // REQUIRED: issuer URI (authorization server)
  client_id: string;     // REQUIRED: client identifier URI
  aud: string;           // REQUIRED: audience (storage realm)
  exp: number;           // REQUIRED: expiration timestamp
  iat: number;           // REQUIRED: issued at timestamp
  jti: string;           // REQUIRED: unique token identifier
  nbf?: number;          // OPTIONAL: not before timestamp
}
```

### 5.3 Controlled Identifier Document

```typescript
interface CIDDocument {
  "@context": string[];
  id: string;
  authentication?: VerificationMethod[];
  service?: ServiceEndpoint[];
}

interface VerificationMethod {
  id: string;
  type: string;           // e.g., "JsonWebKey"
  controller: string;
  publicKeyJwk?: JWK;
}

interface ServiceEndpoint {
  type: string;           // e.g., "https://www.w3.org/ns/lws#OpenIdProvider"
  serviceEndpoint: string;
}
```

---

## 6. Security Architecture

### 6.1 Threat Model

**Key Threats:**
1. Token theft and replay
2. Malicious authorization servers
3. CID document poisoning
4. Path traversal attacks
5. Audience confusion
6. Clock skew exploitation

**Mitigations:**

| Threat | Mitigation |
|--------|-----------|
| Token theft | Short token lifetimes (≤300s), TLS-only, secure storage |
| Token replay | JTI tracking, nonce validation |
| Malicious AS | Storage server AS allowlisting, trusted issuer registry |
| CID poisoning | HTTPS-only resolution, document size limits, caching |
| Path traversal | URI normalization, containment validation |
| Audience confusion | Strict aud validation, single-value aud claims |
| Clock skew | Maximum 60s tolerance, NTP synchronization |

### 6.2 Security Controls

**Transport Security:**
- TLS 1.3 required for all external communications
- Certificate pinning for critical services (optional)
- HSTS headers on all HTTPS endpoints

**Token Security:**
- ES256/RS256 signatures required (no "none" algorithm)
- Token lifetime: 300 seconds recommended maximum
- Audience binding to specific storage realms
- In-memory token storage on clients

**Input Validation:**
- URI format and scheme validation
- String length limits
- Content-type validation
- Path traversal prevention

**Rate Limiting:**
- CID resolution: 10 requests/second per domain
- Token exchange: 100 requests/minute per client
- Storage operations: configurable per deployment

---

## 7. Deployment Architecture

### 7.1 Single-Tenant Deployment

```
┌─────────────────────────────────────────┐
│           Docker Compose Stack          │
│  ┌────────────────────────────────────┐ │
│  │  Keycloak Container                │ │
│  │  - PostgreSQL database             │ │
│  │  - Custom LWS SPIs                 │ │
│  │  - Port: 8080                      │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │  CID Resolver Service              │ │
│  │  - Redis cache                     │ │
│  │  - Port: 3000                      │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │  Storage Server                    │ │
│  │  - Filesystem storage              │ │
│  │  - Port: 3001                      │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │  Nginx Reverse Proxy               │ │
│  │  - TLS termination                 │ │
│  │  - Port: 443                       │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 7.2 Multi-Tenant Deployment

```
┌──────────────────────────────────────────────────┐
│              Load Balancer / CDN                 │
└────────────┬─────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼────────┐   ┌───▼────────┐
│ Keycloak   │   │ Keycloak   │
│ Cluster    │   │ Cluster    │
│ (HA)       │   │ (HA)       │
└───┬────────┘   └───┬────────┘
    │                │
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  Shared Services │
    │  - Redis Cluster │
    │  - PostgreSQL    │
    └────────┬─────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼────────┐   ┌───▼────────┐
│ Storage    │   │ Storage    │
│ Server     │   │ Server     │
│ Instance 1 │   │ Instance N │
└────────────┘   └────────────┘
```

### 7.3 Configuration Management

**Environment Variables:**
```bash
# Keycloak Configuration
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=<secure-password>
KC_DB=postgres
KC_DB_URL=jdbc:postgresql://db:5432/keycloak
KC_HOSTNAME=authorization.example

# LWS Extensions
LWS_TRUSTED_STORAGES=https://storage.example
LWS_CID_RESOLVER_URL=http://cid-resolver:3000
LWS_TOKEN_LIFETIME=300

# Storage Server
STORAGE_AS_URI=https://authorization.example
STORAGE_REALM=https://storage.example/storage_1
STORAGE_BACKEND=filesystem
STORAGE_PATH=/data/storage

# CID Resolver
CID_CACHE_TTL=3600
CID_HTTPS_ONLY=true
CID_MAX_SIZE=10240
```

---

## 8. Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Set up Keycloak with PostgreSQL
- [ ] Implement basic token exchange SPI
- [ ] Create project structure and build system
- [ ] Set up development environment

### Phase 2: Authentication Suites (Week 3-4)
- [ ] Implement OpenID Connect handler
- [ ] Implement SSI-CID handler
- [ ] Implement SSI-DID-Key handler
- [ ] Implement SAML handler (optional)

### Phase 3: CID Resolution (Week 5)
- [ ] Build CID/DID resolver service
- [ ] Implement caching layer
- [ ] Add security controls

### Phase 4: Storage Server (Week 6-7)
- [ ] Implement token validation
- [ ] Build CRUD operation handlers
- [ ] Add authorization enforcement
- [ ] Implement JTI replay prevention

### Phase 5: Testing & Documentation (Week 8)
- [ ] Create integration tests
- [ ] Write API documentation
- [ ] Create deployment guides
- [ ] Develop example client applications

---

## 9. Testing Strategy

### 9.1 Unit Tests
- Authentication suite handlers
- Token validators
- CID/DID resolvers
- Individual SPIs

### 9.2 Integration Tests
- End-to-end authentication flows
- Token exchange scenarios
- Storage operations with various token types
- Error handling and edge cases

### 9.3 Security Tests
- Token replay attacks
- Invalid signature handling
- Audience confusion scenarios
- Path traversal attempts
- Clock skew edge cases

### 9.4 Interoperability Tests
- Multiple client implementations
- Different authentication suites
- Various storage backends
- Cross-domain scenarios

---

## 10. Performance Considerations

### 10.1 Caching Strategy

**CID Documents:**
- TTL based on HTTP Cache-Control headers
- Default: 1 hour
- Invalidation on HTTP error responses

**JWKS:**
- Cache authorization server public keys
- TTL: 24 hours
- Refresh on signature validation failures

**JTI Blacklist:**
- In-memory cache with TTL = token lifetime
- Distributed cache for multi-instance deployments
- Automatic cleanup on expiration

### 10.2 Scalability

**Horizontal Scaling:**
- Stateless service design
- Shared Redis for distributed state
- Database connection pooling
- Load balancer with session affinity for Keycloak admin

**Performance Targets:**
- Token exchange: < 200ms (p95)
- CID resolution: < 500ms (p95) including cache misses
- Storage operations: < 100ms (p95) for cached tokens
- Support: 1000 req/s per instance

---

## 11. Monitoring and Observability

### 11.1 Metrics

**Application Metrics:**
- Token exchange request rate and latency
- Authentication suite usage distribution
- CID cache hit/miss ratio
- Storage operation latency
- Error rates by type

**System Metrics:**
- CPU and memory utilization
- Database connection pool status
- Cache memory usage
- Network I/O

### 11.2 Logging

**Required Log Events:**
- Token exchange requests (with truncated tokens)
- Authentication failures with reasons
- CID resolution failures
- Authorization denials
- Security violations (replay attempts, invalid signatures)

**Log Levels:**
- ERROR: Security violations, system failures
- WARN: Validation failures, unusual patterns
- INFO: Successful operations, configuration changes
- DEBUG: Detailed flow tracing (development only)

### 11.3 Alerting

**Critical Alerts:**
- High authentication failure rate (>10%)
- Token signature validation failures
- CID resolution service unavailable
- Database connection failures

**Warning Alerts:**
- Elevated error rates
- High cache miss rates
- Slow response times
- Approaching rate limits

---

## 12. Migration and Compatibility

### 12.1 Solid-OIDC Migration

For existing Solid deployments using Solid-OIDC:

1. **WebID Compatibility:**
   - CID documents support content negotiation to text/turtle
   - WebID URIs can resolve to both WebID and CID formats
   - `owl:sameAs` relationships supported

2. **Token Format:**
   - ID tokens remain compatible
   - Access token format aligns with LWS requirements
   - Existing OIDC providers work with OpenID authentication suite

3. **Migration Path:**
   - Phase 1: Deploy LWS alongside existing Solid server
   - Phase 2: Update client apps to use token exchange
   - Phase 3: Migrate user profiles to support CID format
   - Phase 4: Retire legacy endpoints

---

## 13. Future Enhancements

### 13.1 Planned Features
- Verifiable Credentials support
- Advanced authorization policies (beyond simple containment)
- Notifications protocol integration
- Multi-authorization server federation
- Enhanced privacy features (pseudonymous identifiers)

### 13.2 Research Areas
- Zero-knowledge proofs for privacy-preserving authentication
- Decentralized authorization policy management
- Cross-realm resource sharing
- Offline-first synchronization

---

## 14. References

### 14.1 Specifications
- OAuth 2.0 Authorization Framework (RFC 6749)
- OAuth 2.0 Token Exchange (RFC 8693)
- OpenID Connect Core 1.0
- JSON Web Token (RFC 7519)
- JSON Web Key (RFC 7517)
- W3C Controlled Identifiers 1.0
- LWS Authentication Specification (this project)
- LWS Authorization Specification (this project)

### 14.2 Related Standards
- SAML 2.0
- DID Core 1.0
- Verifiable Credentials Data Model
- Linked Data Platform 1.0

---

## Appendix A: API Reference

### A.1 Keycloak Token Endpoint

**Endpoint:** `POST /token`

**Request Parameters:**
- `grant_type`: `urn:ietf:params:oauth:grant-type:token-exchange`
- `resource`: Target storage realm (URI)
- `subject_token`: End-user credential
- `subject_token_type`: Token type identifier

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 300
}
```

### A.2 Storage Server Endpoints

**Challenge Endpoint:** Any protected resource returns:
```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer as_uri="https://auth.example",
                         realm="https://storage.example/storage_1",
                         storage_metadata="https://storage.example/.well-known/lws-storage-server"
```

**Metadata Endpoint:** `GET /.well-known/lws-storage-server`

### A.3 CID Resolver Service API

**Resolve CID:**
```http
GET /resolve?uri=https://id.example/agent
Accept: application/ld+json

Response: CID Document
```

**Get Verification Method:**
```http
GET /verification-method?uri=https://id.example/agent&kid=c1f52577

Response: Public Key JWK
```

---

## Appendix B: Configuration Examples

### B.1 Docker Compose

See `docker-compose.yml` in implementation repository.

### B.2 Keycloak Realm Configuration

See `keycloak-realm.json` in implementation repository.

### B.3 Storage Server Configuration

See `storage-config.yaml` in implementation repository.

---

**Document Version:** 1.0  
**Last Updated:** November 7, 2025  
**Status:** Draft for Implementation  
**License:** MIT
