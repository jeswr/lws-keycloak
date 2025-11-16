# Demo Application - Feature Addition

## Summary

Added a complete, interactive web application that demonstrates both LWS authentication suites (OpenID Connect and SSI-CID) with a full end-to-end authentication flow.

## What Was Added

### New Directory: `/demo-app`

A complete Node.js/Express web application with:

- **Backend API** (TypeScript)
  - OpenID Connect authentication flow
  - SSI-CID self-issued identity flow  
  - RFC 8693 token exchange
  - LWS discovery and configuration
  - Authenticated requests to storage server

- **Frontend UI** (HTML/JavaScript)
  - Interactive suite selection
  - Step-by-step flow visualization
  - Real-time logging and output
  - Token inspection and claims display

### New Documentation

- `/demo-app/README.md` - Comprehensive API documentation
- `/demo-app/IMPLEMENTATION.md` - Technical implementation details
- `/demo-app/QUICKSTART.md` - Quick reference card
- `/DEMO.md` - User guide for running the demo

### Configuration Files

- `demo-app/package.json` - Demo app dependencies
- `demo-app/tsconfig.json` - TypeScript configuration
- `demo-app/Dockerfile` - Container configuration
- `demo-app/.env` - Environment variables
- `demo-app/.env.example` - Environment template

### Scripts

- `scripts/setup-demo.sh` - Automated demo setup script
- `npm run demo:install` - Install demo dependencies
- `npm run demo:setup` - Complete automated setup
- `npm run dev:demo` - Run demo in development mode

### Docker Integration

- Added `demo-app` service to `docker-compose.yml`
- Configured networking between demo and other services
- Environment variables for containerized deployment

## Files Created

### Backend (TypeScript)
- `demo-app/src/server.ts` - Express server
- `demo-app/src/config.ts` - Configuration management
- `demo-app/src/routes/oidc.ts` - OpenID Connect endpoints
- `demo-app/src/routes/ssi.ts` - SSI-CID endpoints
- `demo-app/src/routes/storage.ts` - Token exchange & storage API
- `demo-app/src/routes/agent.ts` - CID document endpoints

### Frontend
- `demo-app/public/index.html` - Main UI
- `demo-app/public/app.js` - Client-side logic
- `demo-app/public/oidc-callback.html` - OIDC callback page

## Key Features

### OpenID Connect Flow
1. Generate authorization URL with PKCE parameters
2. Redirect to Keycloak for authentication
3. Handle callback with authorization code
4. Exchange code for ID token
5. Display token claims

### SSI-CID Flow
1. Generate ES256 keypair
2. Create Controlled Identifier Document
3. Self-sign JWT credential
4. Register public key for verification
5. Display self-issued credential

### Token Exchange & Requests
1. Discover authorization server via WWW-Authenticate
2. Fetch LWS configuration
3. Perform RFC 8693 token exchange
4. Receive JWT access token
5. Make authenticated requests to storage server

## Technical Details

### Dependencies Added
- `express` - Web server
- `cors` - CORS middleware
- `helmet` - Security headers
- `morgan` - Request logging
- `jose` - JWT/JWK operations
- `node-fetch` - HTTP client
- `dotenv` - Environment configuration

### Authentication Suites Implemented

#### 1. OpenID Connect
- Token type: `urn:ietf:params:oauth:token-type:id_token`
- Required claims: `sub`, `iss`, `azp`, `aud`
- Uses Keycloak as OpenID Provider
- Follows authorization code flow

#### 2. SSI-CID (Self-Issued Identity)
- Token type: `urn:ietf:params:oauth:token-type:jwt`
- Required claims: `sub` = `iss` = `client_id`
- Uses ES256 signatures
- Controlled Identifier Documents for verification

## Usage

### Quick Start
```bash
npm run demo:setup
# Open http://localhost:3002
```

### Manual Start
```bash
# Install dependencies
npm run demo:install

# Start services
docker-compose up -d demo-app

# Or run locally
cd demo-app && npm run dev
```

## Integration Points

The demo integrates with:
1. **Keycloak** - OpenID Provider and Authorization Server
2. **Storage Server** - Protected resource server  
3. **CID Resolver** - Identity document resolution

## Documentation Updates

- Updated root `README.md` with demo section
- Added `DEMO.md` with comprehensive setup guide
- Created quick reference in `demo-app/QUICKSTART.md`
- Technical details in `demo-app/IMPLEMENTATION.md`

## Testing

The demo allows users to:
- ✅ Test OpenID Connect authentication
- ✅ Test SSI-CID self-issued credentials
- ✅ Perform token exchange (RFC 8693)
- ✅ Make authenticated requests
- ✅ Inspect all token claims
- ✅ See complete protocol flow

## Security Considerations

The demo includes:
- CORS configuration
- Security headers (Helmet)
- Environment-based configuration
- Token validation
- Error handling

**Note**: This is a demonstration application. Production deployments should add:
- HTTPS enforcement
- Secure key storage
- CSRF protection
- Rate limiting
- Enhanced session management

## Next Steps for Users

1. Run the demo to understand LWS authentication
2. Examine the code for implementation patterns
3. Use as reference for their own LWS applications
4. Extend with additional authentication suites

## Maintenance

The demo app:
- Uses TypeScript for type safety
- Follows Express best practices
- Includes comprehensive error handling
- Provides detailed logging
- Is containerized for easy deployment
