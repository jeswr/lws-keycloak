package org.lws.keycloak.protocol.tokenexchange;

import org.keycloak.events.EventBuilder;
import org.keycloak.models.ClientModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.protocol.oidc.TokenManager;
import org.keycloak.representations.AccessToken;
import org.keycloak.services.managers.AuthenticationManager;
import org.keycloak.services.resources.Cors;

import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import java.util.Map;

/**
 * LWS Token Exchange Grant Type Handler
 * 
 * Implements RFC 8693 Token Exchange for LWS authentication suites.
 * Validates subject tokens (OpenID, SSI-CID, SSI-DID-Key) and issues
 * LWS-compliant access tokens.
 */
public class LwsTokenExchangeGrantType {

    private final KeycloakSession session;
    private final RealmModel realm;
    private final EventBuilder event;

    public LwsTokenExchangeGrantType(KeycloakSession session, RealmModel realm, EventBuilder event) {
        this.session = session;
        this.realm = realm;
        this.event = event;
    }

    /**
     * Process token exchange request
     * 
     * @param formParams Request parameters
     * @param headers HTTP headers
     * @param client Authenticated client
     * @return Token response or error
     */
    public Response exchange(Map<String, String> formParams, HttpHeaders headers, ClientModel client) {
        // Extract parameters
        String subjectToken = formParams.get("subject_token");
        String subjectTokenType = formParams.get("subject_token_type");
        String requestedTokenType = formParams.get("requested_token_type");
        String audience = formParams.get("audience");
        String scope = formParams.get("scope");

        // Validate required parameters
        if (subjectToken == null || subjectToken.isEmpty()) {
            return errorResponse("invalid_request", "subject_token is required");
        }
        if (subjectTokenType == null || subjectTokenType.isEmpty()) {
            return errorResponse("invalid_request", "subject_token_type is required");
        }

        // Validate requested token type
        if (requestedTokenType != null && 
            !requestedTokenType.equals("urn:ietf:params:oauth:token-type:access_token")) {
            return errorResponse("invalid_request", "Only access_token type is supported");
        }

        // Get appropriate subject token validator
        SubjectTokenValidator validator = getValidator(subjectTokenType);
        if (validator == null) {
            return errorResponse("invalid_request", "Unsupported subject_token_type: " + subjectTokenType);
        }

        // Validate subject token
        ValidationResult result = validator.validate(subjectToken, session, realm);
        if (!result.isValid()) {
            return errorResponse("invalid_grant", result.getErrorDescription());
        }

        // Get or create user from subject token
        UserModel user = result.getUser();
        if (user == null) {
            user = createUserFromSubjectToken(result);
        }

        // Create access token
        AccessToken token = createAccessToken(user, client, audience, scope, result);

        // Build token response
        TokenManager tokenManager = new TokenManager();
        AccessToken.AccessTokenResponse response = tokenManager.responseBuilder(
            realm, 
            client, 
            event, 
            session, 
            user, 
            null
        )
        .accessToken(token)
        .build();

        // Add CORS headers
        return Cors.add(headers, Response.ok(response))
            .auth()
            .allowedOrigins(client)
            .build();
    }

    /**
     * Get validator for subject token type
     */
    private SubjectTokenValidator getValidator(String tokenType) {
        AuthenticationSuiteRegistry registry = session.getProvider(AuthenticationSuiteRegistry.class);
        return registry.getValidator(tokenType);
    }

    /**
     * Create user from validated subject token
     */
    private UserModel createUserFromSubjectToken(ValidationResult result) {
        UserModel user = session.users().addUser(realm, result.getSubject());
        
        // Set user attributes from subject token
        if (result.getEmail() != null) {
            user.setEmail(result.getEmail());
            user.setEmailVerified(true);
        }
        if (result.getName() != null) {
            user.setFirstName(result.getName());
        }
        
        // Store authentication suite identifier
        user.setSingleAttribute("lws.auth_suite", result.getAuthSuite());
        user.setSingleAttribute("lws.subject", result.getSubject());
        
        return user;
    }

    /**
     * Create LWS-compliant access token
     */
    private AccessToken createAccessToken(
        UserModel user,
        ClientModel client,
        String audience,
        String scope,
        ValidationResult validationResult
    ) {
        AccessToken token = new AccessToken();
        
        // Standard claims
        token.subject(user.getId());
        token.issuedFor(client.getClientId());
        token.issuer(realm.getIssuer());
        
        // LWS-specific claims
        token.audience(audience != null ? audience : client.getClientId());
        
        // Enforce token lifetime ≤ 300s per LWS spec
        int lifespanSeconds = Math.min(300, realm.getAccessTokenLifespan());
        token.expiration((int)(System.currentTimeMillis() / 1000) + lifespanSeconds);
        
        // Add authentication suite metadata
        token.setOtherClaims("auth_suite", validationResult.getAuthSuite());
        token.setOtherClaims("subject_token_id", validationResult.getSubjectTokenId());
        
        // Add scope if requested
        if (scope != null && !scope.isEmpty()) {
            token.scope(scope);
        }
        
        return token;
    }

    /**
     * Build error response
     */
    private Response errorResponse(String error, String description) {
        Map<String, String> errorResponse = Map.of(
            "error", error,
            "error_description", description
        );
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(errorResponse)
            .build();
    }
}
