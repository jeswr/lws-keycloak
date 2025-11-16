# Development Setup Guide

This guide explains how to run the LWS-Keycloak project in development mode.

## Architecture Overview

The project consists of three main services:

1. **Keycloak** (Authorization Server) - Java application on port 8080
2. **CID Resolver** - Node.js service on port 3000  
3. **Storage Server** - Node.js service on port 3001

Plus supporting infrastructure:
- **PostgreSQL** - Database for Keycloak
- **Redis** - Cache for Node.js services

## Development Workflows

### Option 1: Full Docker Stack (Recommended for Testing)

Start everything with Docker Compose:

```bash
npm run docker:up
```

This starts all services in containers. Access them at:
- Keycloak: http://localhost:8080
- CID Resolver: http://localhost:3000
- Storage Server: http://localhost:3001

Stop all services:
```bash
npm run docker:down
```

View logs:
```bash
npm run docker:logs
```

### Option 2: Hybrid Mode (Recommended for Development)

Run Keycloak in Docker while developing Node.js services locally with hot-reload:

**Terminal 1 - Start Keycloak + Infrastructure:**
```bash
npm run docker:keycloak
```

This starts:
- PostgreSQL
- Redis  
- Keycloak

**Terminal 2 - Run Node.js Services Locally:**
```bash
npm run dev:all
```

Or run services individually:
```bash
# Terminal 2
npm run dev:storage

# Terminal 3
npm run dev:cid
```

**Benefits:**
- ✅ Keycloak runs in Docker (requires Java/complex setup)
- ✅ Node.js services run locally with hot-reload
- ✅ Make changes and see them immediately
- ✅ Easier debugging with local processes

### Option 3: Individual Service Development

Run only the service you're working on:

```bash
# Start infrastructure
npm run docker:keycloak

# In another terminal, run the specific service
cd services/storage-server
npm run dev

# Or
cd services/cid-resolver  
npm run dev
```

## Available Scripts

### Main Scripts
- `npm run dev` - Run storage server only
- `npm run dev:all` - Run both Node.js services (CID + Storage)
- `npm run dev:storage` - Run storage server only
- `npm run dev:cid` - Run CID resolver only

### Docker Scripts
- `npm run docker:up` - Start full stack
- `npm run docker:down` - Stop all containers
- `npm run docker:keycloak` - Start Keycloak + dependencies only
- `npm run docker:services` - Start Node.js services only
- `npm run docker:logs` - View container logs

### Other Scripts
- `npm run build` - Build TypeScript
- `npm test` - Run tests
- `npm run keycloak:setup` - Configure Keycloak realm

## Service Endpoints

### Keycloak (Authorization Server)
- Web UI: http://localhost:8080
- Admin credentials: `admin` / `admin`
- Realm endpoint: http://localhost:8080/realms/lws

### CID Resolver
- Base URL: http://localhost:3000
- Health: http://localhost:3000/health
- Resolve CID: `GET /resolve?uri=<cid-uri>`

### Storage Server  
- Base URL: http://localhost:3001
- Storage realm: http://localhost:3001/storage

## Troubleshooting

### "Port already in use" errors

Stop running services:
```bash
npm run docker:down
pkill -f "tsx watch"
```

### Redis connection errors

The Node.js services will show Redis connection errors if Redis isn't running. This is expected when running without Docker. The services will continue to function but without caching.

To fix:
```bash
npm run docker:keycloak  # This also starts Redis
```

### Keycloak not accessible

Ensure Keycloak is running:
```bash
docker ps | grep keycloak
```

If not running:
```bash
npm run docker:keycloak
```

Wait for Keycloak to start (can take 30-60 seconds):
```bash
curl http://localhost:8080/health/ready
```

## Next Steps

After starting services:

1. **Setup Keycloak realm:**
   ```bash
   npm run keycloak:setup
   ```

2. **Run tests:**
   ```bash
   npm test
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

## Environment Variables

Services can be configured via environment variables. See `.env.example` for available options.

Key variables:
- `PORT` - Service port
- `REDIS_HOST` - Redis host
- `REDIS_PORT` - Redis port  
- `STORAGE_AS_URI` - Keycloak authorization server URI
- `NODE_ENV` - Environment (development/production)
