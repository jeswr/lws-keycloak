# LWS Demo Application

A minimal web application demonstrating authentication using LWS authentication suites.

## Features

This demo application showcases two authentication suites defined in the LWS specification:

### 1. OpenID Connect Authentication Suite
- Uses ID tokens issued by an OpenID Provider (Keycloak)
- Token type: `urn:ietf:params:oauth:token-type:id_token`
- Demonstrates authorization code flow
- Required claims: `sub`, `iss`, `azp`, `aud`

### 2. SSI-CID Authentication Suite (Self-Issued Identity)
- Uses self-signed JWTs with Controlled Identifier Documents
- Token type: `urn:ietf:params:oauth:token-type:jwt`
- Demonstrates self-issued credentials
- Required claims: `sub`, `iss`, `client_id` (all must be equal)

## Authentication Flow

The demo follows the complete LWS authentication flow:

1. **Get End-User Credential**
   - OpenID: Redirect to Keycloak, obtain ID token
   - SSI-CID: Generate keypair, create self-signed JWT

2. **Discover Authorization Server**
   - Make unauthorized request to storage server
   - Parse `WWW-Authenticate` header for `as_uri` and `realm`

3. **Token Exchange (RFC 8693)**
   - Exchange end-user credential for access token
   - Use grant type: `urn:ietf:params:oauth:grant-type:token-exchange`
   - Receive JWT access token (RFC 9068)

4. **Make Authenticated Request**
   - Present access token to storage server
   - Use Bearer authentication scheme

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment configuration:
```bash
cp .env.example .env
```

3. Start the demo app:
```bash
npm run dev
```

4. Open browser to http://localhost:3002

## Prerequisites

Before running the demo, ensure the following services are running:

- **Keycloak** (http://localhost:8080)
  - Realm: `lws`
  - Client: `demo-client` configured for authorization code flow
  
- **Storage Server** (http://localhost:3001)
  - Must return `WWW-Authenticate` header with LWS parameters
  
- **Authorization Server** (Keycloak realm with LWS provider)
  - Must support token exchange grant type
  - Must provide `/.well-known/lws-configuration` endpoint

## API Endpoints

### OpenID Connect
- `GET /api/oidc/config` - Get OpenID configuration
- `GET /api/oidc/auth-url` - Get authorization URL
- `POST /api/oidc/token` - Exchange code for ID token
- `POST /api/oidc/validate` - Validate ID token

### SSI-CID
- `POST /api/ssi/generate-keypair` - Generate EC keypair
- `POST /api/ssi/create-credential` - Create self-issued JWT
- `POST /api/ssi/validate` - Validate self-issued credential
- `GET /api/ssi/public-key/:kid` - Get public key by ID

### Storage & Token Exchange
- `GET /api/storage/discover` - Discover authorization server
- `GET /api/storage/lws-config` - Get LWS configuration
- `POST /api/storage/token-exchange` - Exchange token (RFC 8693)
- `POST /api/storage/authenticated-request` - Make authenticated request

### Agent (CID)
- `GET /agents/demo-agent` - Get Controlled Identifier Document
- `POST /agents/demo-agent/register-key` - Register public key
- `GET /agents/demo-agent/key/:kid` - Get CID with specific key

## Architecture

```
┌─────────────┐
│   Browser   │
│   (Client)  │
└──────┬──────┘
       │
       ├─ OpenID Flow ──────────┐
       │                        ▼
       │              ┌──────────────────┐
       │              │    Keycloak      │
       │              │  (OpenID Provider)│
       │              └──────────────────┘
       │
       ├─ SSI Flow ────────────┐
       │                       ▼
       │              ┌──────────────────┐
       │              │   Demo App       │
       │              │ (Self-signs JWT) │
       │              └──────────────────┘
       │
       ├─ Token Exchange ──────┐
       │                       ▼
       │              ┌──────────────────────┐
       │              │ Authorization Server │
       │              │  (Keycloak + LWS)    │
       │              └──────────────────────┘
       │
       └─ Authenticated Request ──┐
                                  ▼
                         ┌─────────────────┐
                         │ Storage Server  │
                         │   (Protected)   │
                         └─────────────────┘
```

## Security Considerations

This is a **demo application** for educational purposes. In production:

- Never store private keys in memory without proper security
- Use HTTPS for all communications
- Implement proper session management
- Validate all tokens cryptographically
- Use secure key storage (HSM, key vaults)
- Implement rate limiting and CSRF protection
- Follow OIDC security best practices

## Specification References

- [LWS Authentication](../../spec/authn.md)
- [LWS Authorization](../../spec/authz.md)
- [RFC 8693: OAuth 2.0 Token Exchange](https://www.rfc-editor.org/rfc/rfc8693)
- [RFC 9068: JWT Profile for OAuth 2.0 Access Tokens](https://www.rfc-editor.org/rfc/rfc9068)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
