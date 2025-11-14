package org.lws.keycloak.protocol.tokenexchange;

import org.keycloak.OAuth2Constants;
import org.keycloak.events.EventBuilder;
import org.keycloak.models.ClientModel;
import org.keycloak.models.ClientSessionContext;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.UserSessionModel;
import org.keycloak.protocol.oidc.TokenManager;
import org.keycloak.representations.AccessToken;
import org.keycloak.representations.AccessTokenResponse;
import org.keycloak.services.managers.AuthenticationManager;
import org.keycloak.services.managers.AuthenticationSessionManager;
import org.keycloak.sessions.AuthenticationSessionModel;
import org.keycloak.protocol.oidc.TokenManager.AccessTokenResponseBuilder;

import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import java.util.HashMap;
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
        SubjectTokenValidator.ValidationResult result = validator.validate(subjectToken, session, realm);
        if (!result.isValid()) {
            return errorResponse("invalid_grant", result.getErrorDescription());
        }

        // Get or create user from subject token
        UserModel user = result.getUser();
        if (user == null) {
            user = createUserFromSubjectToken(result);
        }

        // Create user session for token generation
        UserSessionModel userSession = session.sessions().createUserSession(
            realm,
            user,
            user.getUsername(),
            null, // clientConnection
            "lws-token-exchange", // authMethod
            false, // rememberMe
            null, // brokerSessionId
            null  // brokerUserId
        );

        // Create access token with LWS-specific claims
        AccessToken token = createAccessToken(user, client, audience, scope, result, userSession);

        // Generate signed token using TokenManager
        TokenManager tokenManager = new TokenManager();
        String encodedToken;
        try {
            // Use the session's keys to encode the token
            encodedToken = session.tokens().encode(token);
        } catch (Exception e) {
            return errorResponse("server_error", "Failed to generate access token");
        }

        // Build response
        AccessTokenResponse response = new AccessTokenResponse();
        response.setToken(encodedToken);
        response.setTokenType("Bearer");
        response.setExpiresIn((long)(token.getExpiration() - (System.currentTimeMillis() / 1000)));
        
        if (scope != null && !scope.isEmpty()) {
            response.setScope(scope);
        }

        return Response.ok(response).build();
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
    private UserModel createUserFromSubjectToken(SubjectTokenValidator.ValidationResult result) {
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
        SubjectTokenValidator.ValidationResult validationResult,
        UserSessionModel userSession
    ) {
        AccessToken token = new AccessToken();
        
        // Standard claims
        token.subject(user.getId());
        token.issuedFor(client != null ? client.getClientId() : "lws-exchange");
        token.issuer(realm.getName());
        token.issuedNow();
        
        // LWS-specific: audience claim
        if (audience != null && !audience.isEmpty()) {
            token.addAudience(audience);
        } else if (client != null) {
            token.addAudience(client.getClientId());
        }
        
        // Enforce token lifetime ≤ 300s per LWS spec
        int lifespanSeconds = Math.min(300, realm.getAccessTokenLifespan());
        token.expiration((int)(token.getIat() + lifespanSeconds));
        
        // Add authentication suite metadata
        token.setOtherClaims("auth_suite", validationResult.getAuthSuite());
        if (validationResult.getSubjectTokenId() != null) {
            token.setOtherClaims("subject_token_id", validationResult.getSubjectTokenId());
        }
        
        // Session binding
        token.setSessionState(userSession.getId());
        
        // Add scope if requested
        if (scope != null && !scope.isEmpty()) {
            String[] scopes = scope.split(" ");
            for (String s : scopes) {
                token.addAccess(s);
            }
        }
        
        return token;
    }

    /**
     * Build error response
     */
    private Response errorResponse(String error, String description) {
        Map<String, String> errorResponse = new HashMap<>();
        errorResponse.put("error", error);
        errorResponse.put("error_description", description);
        
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(errorResponse)
            .build();
    }
}
