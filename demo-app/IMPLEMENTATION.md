# LWS Demo Application - Implementation Summary

## Overview

A complete web application demonstrating the LWS authentication specification has been implemented in the `/demo-app` directory.

## What Was Implemented

### 1. Authentication Suites

#### OpenID Connect Suite
- **Token Type**: `urn:ietf:params:oauth:token-type:id_token`
- **Flow**: Authorization Code Flow with Keycloak
- **Implementation**:
  - Redirect to Keycloak for authentication
  - Exchange authorization code for ID token
  - ID token contains: `sub`, `iss`, `azp`, `aud`

#### SSI-CID Suite (Self-Issued Identity)
- **Token Type**: `urn:ietf:params:oauth:token-type:jwt`
- **Flow**: Self-signed JWT with Controlled Identifier Document
- **Implementation**:
  - Generate ES256 keypair
  - Create Controlled Identifier Document
  - Self-sign JWT with: `sub === iss === client_id`

### 2. LWS Protocol Flow

The demo implements the complete LWS flow as specified:

```
1. Authentication
   └─> Get end-user credential (ID token or self-signed JWT)

2. Discovery
   └─> Parse WWW-Authenticate header from storage server
   └─> Fetch /.well-known/lws-configuration

3. Token Exchange (RFC 8693)
   └─> Exchange end-user credential for access token
   └─> Receive JWT access token (RFC 9068)

4. Authenticated Request
   └─> Present access token to storage server
   └─> Access protected resource
```

## File Structure

```
demo-app/
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── Dockerfile                   # Container configuration
├── .env                         # Environment configuration
├── README.md                    # Demo documentation
├── src/
│   ├── server.ts                # Express server setup
│   ├── config.ts                # Configuration management
│   └── routes/
│       ├── oidc.ts              # OpenID Connect endpoints
│       ├── ssi.ts               # SSI-CID endpoints
│       ├── storage.ts           # Token exchange & requests
│       └── agent.ts             # CID document serving
└── public/
    ├── index.html               # Main UI
    ├── app.js                   # Frontend logic
    └── oidc-callback.html       # OIDC redirect handler
```

## API Endpoints

### OpenID Connect (`/api/oidc`)
- `GET /config` - Get OpenID configuration
- `GET /auth-url` - Generate authorization URL
- `POST /token` - Exchange code for ID token
- `POST /validate` - Validate ID token

### SSI-CID (`/api/ssi`)
- `POST /generate-keypair` - Generate ES256 keypair
- `POST /create-credential` - Create self-signed JWT
- `POST /validate` - Validate self-signed credential
- `GET /public-key/:kid` - Get public key

### Storage & Token Exchange (`/api/storage`)
- `GET /discover` - Discover authorization server
- `GET /lws-config` - Get LWS configuration
- `POST /token-exchange` - Perform RFC 8693 token exchange
- `POST /authenticated-request` - Make authenticated request

### Agent/CID (`/agents`)
- `GET /demo-agent` - Get Controlled Identifier Document
- `POST /demo-agent/register-key` - Register public key
- `GET /demo-agent/key/:kid` - Get CID with key

## User Interface

The web interface provides:

1. **Visual Step Indicator** - Shows current step in authentication flow
2. **Suite Selection Cards** - Choose between OpenID and SSI-CID
3. **Real-time Output Log** - Shows all protocol exchanges
4. **Token Display** - Shows credentials and claims
5. **Interactive Flow** - Step-by-step authentication process

## How to Run

### Quick Start
```bash
# Automated setup
npm run demo:setup

# Access at http://localhost:3002
```

### Manual Start
```bash
# Install dependencies
npm run demo:install

# Start with Docker
docker-compose up -d demo-app

# Or run locally
cd demo-app && npm run dev
```

## Key Features

### ✅ Specification Compliance
- Implements both authentication suites from spec/authn.md
- Follows RFC 8693 token exchange protocol
- Adheres to RFC 9068 for access tokens
- Implements LWS discovery via WWW-Authenticate

### ✅ Educational Value
- Clear separation between authentication suites
- Visual flow showing each protocol step
- Detailed logging of all operations
- Token claim inspection

### ✅ Production-Ready Patterns
- Proper error handling
- Security headers (Helmet)
- CORS configuration
- Environment-based configuration
- Docker containerization

## Technical Stack

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: Vanilla JavaScript (no framework needed)
- **Crypto**: jose (JWT/JWK operations)
- **Authentication**: OAuth 2.0, OIDC, self-signed JWTs
- **Containerization**: Docker, Docker Compose

## Integration with Services

The demo integrates with all LWS services:

1. **Keycloak** - OpenID Provider and Authorization Server
2. **Storage Server** - Protected resource server
3. **CID Resolver** - Resolves Controlled Identifier Documents

## Documentation

- `/demo-app/README.md` - Detailed API documentation
- `/DEMO.md` - Quick start guide
- `/spec/authn.md` - Authentication specification
- `/spec/authz.md` - Authorization specification

## Next Steps

Users can:
1. Run the demo to see both authentication suites in action
2. Examine the code to understand implementation details
3. Use as a reference for their own LWS implementations
4. Extend with additional authentication suites

## Security Notes

⚠️ This is a **demonstration application**. For production use:
- Use proper key storage (HSM, key vaults)
- Implement HTTPS everywhere
- Add CSRF protection
- Use secure session management
- Validate all tokens cryptographically
- Implement rate limiting
- Follow OIDC security best practices
