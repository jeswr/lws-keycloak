# LWS Keycloak Provider

Custom Keycloak SPI providers for Linked Web Storage (LWS) authentication.

## Overview

This provider extends Keycloak with LWS-specific authentication capabilities:

- **Token Exchange Grant Type**: RFC 8693 token exchange for LWS authentication suites
- **Authentication Suite Registry**: Manages validators for different authentication methods
- **Subject Token Validators**: Validates tokens from OpenID, SSI-CID, and SSI-DID-Key authentication suites

## Architecture

### Components

1. **LwsTokenExchangeGrantType**: Handles OAuth 2.0 token exchange requests
2. **AuthenticationSuiteRegistry**: Registry for authentication suite handlers
3. **SubjectTokenValidator Interface**: Common interface for token validators
4. **OpenIdSubjectTokenValidator**: Validates OpenID Connect ID tokens
5. **SsiCidSubjectTokenValidator**: Validates SSI-CID tokens with Controlled Identifier Documents
6. **SsiDidKeySubjectTokenValidator**: Validates SSI-DID-Key tokens with did:key URIs

### Token Exchange Flow

```
Client → Keycloak Token Exchange Endpoint
  ↓
  subject_token (OpenID/SSI-CID/SSI-DID-Key)
  subject_token_type (URN)
  requested_token_type (access_token)
  audience (resource server URI)
  ↓
AuthenticationSuiteRegistry → SubjectTokenValidator
  ↓
Validate token signature, claims, temporal properties
  ↓
Get or create Keycloak user
  ↓
Issue LWS-compliant access token
  - Lifetime ≤ 300s
  - Audience claim
  - auth_suite metadata
```

## Building

### Prerequisites

- Java 17 or higher
- Maven 3.8+
- Keycloak 23.0

### Build Command

```bash
cd keycloak/lws-provider
mvn clean package
```

The JAR will be created at: `target/lws-provider-1.0.0.jar`

### Using Build Script

```bash
chmod +x keycloak/build-provider.sh
./keycloak/build-provider.sh
```

This will build the provider and copy it to the Keycloak providers directory.

## Installation

1. Build the provider (see above)
2. Copy JAR to Keycloak providers directory:
   ```bash
   cp target/lws-provider-1.0.0.jar /opt/keycloak/providers/
   ```
3. Restart Keycloak (in production) or rebuild (in development):
   ```bash
   docker-compose restart keycloak
   ```

## Configuration

### Environment Variables

- `CID_RESOLVER_URL`: URL of the CID/DID resolver service (default: `http://cid-resolver:3000`)

### Keycloak Realm Configuration

1. Create a realm (e.g., `lws`)
2. Create a client for the resource server
3. Enable token exchange for the client
4. Configure audience mapper for the client

## Usage

### Token Exchange Request

```http
POST /realms/lws/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
&subject_token=<subject_token>
&subject_token_type=<token_type_urn>
&requested_token_type=urn:ietf:params:oauth:token-type:access_token
&audience=http://localhost:3001/storage
&client_id=storage-client
&client_secret=<client_secret>
```

### Supported Subject Token Types

1. **OpenID Connect**:
   - URN: `urn:ietf:params:oauth:token-type:id_token`
   - Token: Standard OpenID Connect ID token (JWT)
   - Validation: Signature verification via JWKS discovery, temporal claims

2. **SSI-CID**:
   - URN: `urn:lws:params:oauth:token-type:cid`
   - Token: JWT signed with CID verification method
   - Validation: Resolve CID document, verify signature with public key

3. **SSI-DID-Key**:
   - URN: `urn:lws:params:oauth:token-type:did-key`
   - Token: JWT signed with did:key
   - Validation: Resolve did:key public key, verify signature

### Response

```json
{
  "access_token": "<jwt_access_token>",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "openid"
}
```

## Token Structure

### Access Token Claims

```json
{
  "iss": "http://keycloak:8080/realms/lws",
  "sub": "user-id",
  "aud": "http://localhost:3001/storage",
  "exp": 1234567890,
  "iat": 1234567590,
  "jti": "unique-token-id",
  "azp": "storage-client",
  "auth_suite": "openid|ssi-cid|ssi-did-key",
  "subject_token_id": "<original_token_jti>"
}
```

## Security Considerations

1. **Token Lifetime**: All access tokens have a maximum lifetime of 300 seconds per LWS spec
2. **Signature Verification**: All subject tokens must have valid signatures
3. **Temporal Validation**: Checks exp, iat claims with clock skew tolerance
4. **HTTPS Only**: Production deployments must use TLS/HTTPS
5. **JTI Replay Prevention**: Resource servers must track JTI to prevent replay attacks

## Development

### Project Structure

```
lws-provider/
├── pom.xml
├── src/
│   └── main/
│       ├── java/org/lws/keycloak/
│       │   └── protocol/tokenexchange/
│       │       ├── LwsTokenExchangeGrantType.java
│       │       ├── SubjectTokenValidator.java
│       │       ├── AuthenticationSuiteRegistry.java
│       │       ├── AuthenticationSuiteRegistryFactory.java
│       │       ├── DefaultAuthenticationSuiteRegistry.java
│       │       ├── OpenIdSubjectTokenValidator.java
│       │       ├── SsiCidSubjectTokenValidator.java
│       │       └── SsiDidKeySubjectTokenValidator.java
│       └── resources/
│           └── META-INF/services/
│               └── org.lws.keycloak.protocol.tokenexchange.AuthenticationSuiteRegistryFactory
```

### Adding New Authentication Suites

1. Implement `SubjectTokenValidator` interface
2. Add validator to `DefaultAuthenticationSuiteRegistry.init()`
3. Rebuild and redeploy

## Testing

### Unit Tests

```bash
mvn test
```

### Integration Testing

See the main project's test suite for end-to-end integration tests.

## License

Same as parent project.
