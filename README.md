# LWS-Keycloak: Linked Web Storage Reference Implementation

A reference implementation of the Linked Web Storage (LWS) authentication and authorization specifications using Keycloak.

## Overview

This project provides a complete, production-ready implementation of the LWS protocol, demonstrating how to:

- Authenticate users and agents using multiple authentication suites (OpenID Connect, SSI-CID, SSI-DID-Key, SAML)
- Exchange end-user credentials for LWS access tokens
- Validate and enforce access tokens on a storage server
- Resolve Controlled Identifier Documents (CIDs) and DIDs
- Handle token exchange flows compliant with OAuth 2.0

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed architectural specification.

### Components

1. **Keycloak Authorization Server** - Extended OAuth 2.0/OIDC server with LWS token exchange
2. **CID Resolver Service** - Resolves and caches Controlled Identifier Documents
3. **Storage Server** - LWS-compliant resource server with authorization enforcement
4. **Authentication Suite Handlers** - Pluggable credential validators for different authentication methods

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/jeswr/lws-keycloak.git
cd lws-keycloak
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Start services with Docker Compose:
```bash
npm run docker:up
```

This will start:
- Keycloak on http://localhost:8080
- CID Resolver on http://localhost:3000
- Storage Server on http://localhost:3001
- PostgreSQL and Redis databases

5. Set up Keycloak realm and clients:
```bash
npm run keycloak:setup
```

### Development

Build the project:
```bash
npm run build
```

Run in development mode with hot reload:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

## Usage

### 1. OpenID Connect Authentication Flow

```typescript
import { LWSClient } from 'lws-keycloak-client';

const client = new LWSClient({
  authServer: 'http://localhost:8080/realms/lws',
  storage: 'http://localhost:3001/storage'
});

// Get ID token from your OIDC provider
const idToken = await getIdTokenFromProvider();

// Exchange for LWS access token
const accessToken = await client.exchangeToken({
  subjectToken: idToken,
  subjectTokenType: 'urn:ietf:params:oauth:token-type:id_token',
  resource: 'http://localhost:3001/storage'
});

// Access protected resource
const response = await client.fetch('http://localhost:3001/storage/data.txt', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### 2. Self-Issued Credential (SSI-CID) Flow

```typescript
import { generateKeyPair, signJWT } from 'lws-keycloak-client';

// Generate a keypair for your agent
const { publicKey, privateKey } = await generateKeyPair('ES256');

// Create a Controlled Identifier Document
const cidDocument = {
  '@context': ['https://www.w3.org/ns/cid/v1'],
  id: 'https://id.example/agent',
  authentication: [{
    id: 'https://id.example/agent#key1',
    type: 'JsonWebKey',
    controller: 'https://id.example/agent',
    publicKeyJwk: publicKey
  }]
};

// Host the CID document at https://id.example/agent

// Generate self-issued JWT
const subjectToken = await signJWT({
  sub: 'https://id.example/agent',
  iss: 'https://id.example/agent',
  client_id: 'https://id.example/agent',
  aud: ['http://localhost:8080/realms/lws'],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 300
}, privateKey, { kid: 'key1' });

// Exchange for access token
const accessToken = await client.exchangeToken({
  subjectToken,
  subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
  resource: 'http://localhost:3001/storage'
});
```

### 3. Storage Operations

```typescript
// Create a resource
await client.put('http://localhost:3001/storage/photo.jpg', photoData, {
  contentType: 'image/jpeg'
});

// Read a resource
const data = await client.get('http://localhost:3001/storage/photo.jpg');

// Update a resource
await client.patch('http://localhost:3001/storage/notes.txt', 'Additional notes');

// Delete a resource
await client.delete('http://localhost:3001/storage/old-file.txt');
```

## Configuration

### Environment Variables

See `.env.example` for all configuration options.

Key variables:
- `KEYCLOAK_URL` - Keycloak server URL
- `STORAGE_REALM` - Storage server realm URI
- `TOKEN_LIFETIME` - Access token lifetime in seconds (default: 300)
- `CID_CACHE_TTL` - CID document cache TTL in seconds (default: 3600)

### Keycloak Configuration

The Keycloak realm is automatically configured by the setup script. To manually configure:

1. Access Keycloak admin at http://localhost:8080
2. Login with admin/admin
3. Import realm from `keycloak/lws-realm.json`

## Testing

Run the full test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run integration tests:
```bash
npm run test:integration
```

## Deployment

### Production Checklist

- [ ] Use TLS/HTTPS for all services
- [ ] Set strong admin passwords
- [ ] Configure proper CORS origins
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging
- [ ] Configure Redis for distributed caching
- [ ] Use external PostgreSQL database
- [ ] Set CID_HTTPS_ONLY=true
- [ ] Review and configure trusted storage list

### Docker Deployment

For production deployment with Docker:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Kubernetes

See `k8s/` directory for Kubernetes manifests.

## API Documentation

### Authorization Server

#### Metadata Endpoint
```
GET /.well-known/lws-configuration
```

Returns server metadata including supported token types and endpoints.

#### Token Exchange Endpoint
```
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
&resource=<storage-realm-uri>
&subject_token=<end-user-credential>
&subject_token_type=<token-type-uri>
```

### Storage Server

#### Protected Resource Access
```
GET /storage/path/to/resource
Authorization: Bearer <access-token>
```

#### Storage Metadata
```
GET /.well-known/lws-storage-server
```

### CID Resolver

#### Resolve CID
```
GET /resolve?uri=<cid-uri>
Accept: application/ld+json
```

## Security Considerations

This implementation follows security best practices:

- TLS-only for production (configurable)
- Token lifetime limited to 300 seconds
- JTI replay prevention
- Strict audience validation
- Input validation and sanitization
- Rate limiting
- CORS configuration
- Secure headers (Helmet.js)

See [SECURITY.md](./SECURITY.md) for detailed security documentation.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run the test suite
5. Submit a pull request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Specifications

This implementation conforms to:

- LWS Authentication Specification (see `spec/authn.md`)
- LWS Authorization Specification (see `spec/authz.md`)
- OAuth 2.0 Token Exchange (RFC 8693)
- OAuth 2.0 Authorization Framework (RFC 6749)
- OpenID Connect Core 1.0
- JSON Web Token (RFC 7519)

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Support

- Issues: https://github.com/jeswr/lws-keycloak/issues
- Discussions: https://github.com/jeswr/lws-keycloak/discussions
- Email: [your-email]

## Acknowledgments

Based on the Linked Web Storage Working Group specifications:
- https://www.w3.org/groups/wg/lws/
- Built on the foundations of the Solid Project

## Related Projects

- [Solid Project](https://solidproject.org/)
- [Keycloak](https://www.keycloak.org/)
- [W3C LWS Working Group](https://www.w3.org/groups/wg/lws/)
