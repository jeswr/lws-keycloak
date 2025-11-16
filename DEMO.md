# LWS Demo Application - Quick Start

This document describes how to run the LWS authentication demo application.

## Overview

The demo application provides an interactive web interface that demonstrates both authentication suites defined in the LWS specification:

1. **OpenID Connect Authentication Suite** - Using Keycloak as the OpenID Provider
2. **SSI-CID Authentication Suite** - Using self-issued identity with Controlled Identifier Documents

## Quick Start

### 1. Start all services with Docker

```bash
# Start all services (Keycloak, Storage Server, CID Resolver, Demo App)
npm run docker:up

# Or start just the demo-related services
docker-compose up -d keycloak storage-server demo-app
```

### 2. Set up Keycloak

```bash
# Wait for Keycloak to be ready (about 30-60 seconds)
# Then run the setup script
npm run keycloak:setup
```

This script will:
- Create the `lws` realm
- Create a `demo-client` client configured for the demo app
- Install the LWS provider for token exchange

### 3. Access the demo

Open your browser to: **http://localhost:3002**

## Manual Setup (without Docker)

### 1. Install dependencies

```bash
# Install root dependencies
npm install

# Install demo app dependencies
npm run demo:install
```

### 2. Start services

In separate terminals:

```bash
# Terminal 1: Start Keycloak (or use Docker)
npm run docker:keycloak

# Terminal 2: Start Storage Server
npm run dev:storage

# Terminal 3: Start CID Resolver
npm run dev:cid

# Terminal 4: Start Demo App
npm run dev:demo
```

### 3. Set up Keycloak

```bash
npm run keycloak:setup
```

### 4. Access the demo

Open http://localhost:3002

## Using the Demo

### OpenID Connect Flow

1. Click **"Start OpenID Flow"**
2. You'll be redirected to Keycloak login
3. Create an account or log in (default admin: admin/admin)
4. After login, you'll be redirected back with an ID token
5. Click **"Exchange for Access Token"** to perform RFC 8693 token exchange
6. Click **"Make Authenticated Request"** to access the storage server

### SSI-CID Flow

1. Click **"Start SSI Flow"**
2. The app will:
   - Generate an ES256 keypair
   - Create a Controlled Identifier Document
   - Sign a self-issued JWT credential
3. Click **"Exchange for Access Token"** to perform RFC 8693 token exchange
4. Click **"Make Authenticated Request"** to access the storage server

## What the Demo Demonstrates

### 1. End-User Credentials
- **OpenID**: ID tokens from a trusted OpenID Provider
- **SSI-CID**: Self-signed JWTs with cryptographic proof

### 2. LWS Discovery
- Making unauthorized requests to discover the authorization server
- Parsing `WWW-Authenticate` headers
- Fetching `/.well-known/lws-configuration`

### 3. Token Exchange (RFC 8693)
- Exchanging end-user credentials for access tokens
- Using the correct token type URIs
- Specifying the resource (audience) parameter

### 4. Authenticated Requests
- Presenting access tokens using Bearer authentication
- Accessing protected resources on the storage server

## Architecture

```
┌──────────────┐
│   Browser    │ ← User interacts with demo UI
└──────┬───────┘
       │
       ├─ OpenID ────→ Keycloak (OpenID Provider)
       │               Returns ID Token
       │
       ├─ SSI ───────→ Demo App Backend
       │               Generates self-signed JWT
       │
       ├─ Exchange ──→ Keycloak + LWS Provider
       │               Returns Access Token
       │
       └─ Request ───→ Storage Server
                       Protected resource access
```

## Configuration

Demo app configuration is in `demo-app/.env`:

```env
PORT=3002
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=lws
KEYCLOAK_CLIENT_ID=demo-client
AUTHORIZATION_SERVER=http://localhost:8080/realms/lws
STORAGE_SERVER=http://localhost:3001
```

## Troubleshooting

### Keycloak not ready
Wait 30-60 seconds after starting for Keycloak to initialize.

### Token exchange fails
1. Ensure Keycloak setup script has run successfully
2. Check that the LWS provider JAR is in `keycloak/providers/`
3. Restart Keycloak: `docker-compose restart keycloak`

### Storage server returns 401
1. Verify the access token is valid
2. Check that the token hasn't expired (default: 5 minutes)
3. Ensure the `aud` claim matches the storage server realm

### Can't access demo at localhost:3002
1. Check that the demo app is running: `docker-compose ps`
2. Check logs: `docker-compose logs demo-app`

## API Documentation

See `demo-app/README.md` for detailed API documentation.

## Learn More

- **Specification**: See `/spec/authn.md` and `/spec/authz.md`
- **Architecture**: See `ARCHITECTURE.md`
- **Implementation**: See `IMPLEMENTATION.md`
