# LWS Authentication Demo - Quick Reference

## 🚀 One-Line Start

```bash
npm run demo:setup
```

Then open: http://localhost:3002

---

## Authentication Suites

### OpenID Connect
- **What**: Login with Keycloak (OAuth/OIDC)
- **Token**: ID Token from trusted provider
- **Type**: `urn:ietf:params:oauth:token-type:id_token`
- **Claims**: `sub`, `iss`, `azp`, `aud`

### SSI-CID
- **What**: Self-signed with your own keys
- **Token**: Self-issued JWT
- **Type**: `urn:ietf:params:oauth:token-type:jwt`
- **Claims**: `sub` = `iss` = `client_id`

---

## The Flow (4 Steps)

```
1️⃣  Get Credential
    ├─ OpenID: Login to Keycloak → ID Token
    └─ SSI: Generate keys → Sign JWT

2️⃣  Discover AS
    └─ Storage server tells you where the AS is

3️⃣  Exchange Token (RFC 8693)
    └─ Trade credential for access token

4️⃣  Make Request
    └─ Use access token on storage server
```

---

## Services & Ports

| Service | Port | Purpose |
|---------|------|---------|
| Demo App | 3002 | Interactive UI |
| Keycloak | 8080 | Auth server + OpenID provider |
| Storage | 3001 | Protected resource |
| CID Resolver | 3000 | Identity document lookup |

---

## Common Commands

```bash
# Start everything
npm run demo:setup

# View logs
docker-compose logs -f demo-app

# Restart Keycloak
docker-compose restart keycloak

# Stop all
docker-compose down

# Fresh start
docker-compose down && npm run demo:setup
```

---

## URLs

- **Demo**: http://localhost:3002
- **Keycloak Admin**: http://localhost:8080 (admin/admin)
- **Storage API**: http://localhost:3001
- **CID Resolver**: http://localhost:3000

---

## Troubleshooting

**"Token exchange failed"**
→ Run: `npm run keycloak:setup`

**"Keycloak not responding"**
→ Wait 60s after starting, or restart:
```bash
docker-compose restart keycloak
```

**"Can't access localhost:3002"**
→ Check if running:
```bash
docker-compose ps
docker-compose logs demo-app
```

---

## What You'll See

1. Choose OpenID or SSI-CID
2. Get your credential
3. Watch the token exchange
4. See the claims in your tokens
5. Make an authenticated request
6. Success! 🎉

---

## Learn More

📖 Detailed docs: See `/demo-app/README.md`
🏗️ Implementation: See `/demo-app/IMPLEMENTATION.md`
📋 Specification: See `/spec/authn.md` and `/spec/authz.md`
