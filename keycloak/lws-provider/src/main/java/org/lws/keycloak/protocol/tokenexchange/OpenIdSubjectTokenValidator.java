package org.lws.keycloak.protocol.tokenexchange;

import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWT;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Date;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * Validator for OpenID Connect ID tokens
 * 
 * Token Type: urn:ietf:params:oauth:token-type:id_token
 */
public class OpenIdSubjectTokenValidator implements SubjectTokenValidator {

    private static final String TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";
    private static final HttpClient httpClient = HttpClient.newBuilder().build();
    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String getTokenType() {
        return TOKEN_TYPE;
    }

    @Override
    public ValidationResult validate(String token, KeycloakSession session, RealmModel realm) {
        try {
            // Parse JWT
            SignedJWT jwt = SignedJWT.parse(token);
            JWTClaimsSet claims = jwt.getJWTClaimsSet();

            // Validate temporal claims
            Date now = new Date();
            Date exp = claims.getExpirationTime();
            Date iat = claims.getIssueTime();
            
            if (exp == null || exp.before(now)) {
                return ValidationResult.failure("Token has expired");
            }
            
            if (iat != null && iat.after(new Date(now.getTime() + 60000))) {
                return ValidationResult.failure("Token issued in the future");
            }

            // Get issuer and fetch JWKS
            String issuer = claims.getIssuer();
            if (issuer == null || issuer.isEmpty()) {
                return ValidationResult.failure("Missing issuer claim");
            }

            // Discover JWKS endpoint
            String jwksUri = discoverJwksUri(issuer);
            if (jwksUri == null) {
                return ValidationResult.failure("Could not discover JWKS endpoint for issuer: " + issuer);
            }

            // Verify signature
            if (!verifySignature(jwt, jwksUri)) {
                return ValidationResult.failure("Invalid signature");
            }

            // Extract subject and other claims
            String subject = claims.getSubject();
            if (subject == null || subject.isEmpty()) {
                return ValidationResult.failure("Missing subject claim");
            }

            // Try to find existing user
            UserModel user = findUserByOpenIdSubject(session, realm, issuer, subject);

            // Build successful result
            return ValidationResult.success(subject, "openid")
                .subjectTokenId(claims.getJWTID())
                .email(claims.getStringClaim("email"))
                .name(claims.getStringClaim("name"))
                .user(user)
                .build();

        } catch (Exception e) {
            return ValidationResult.failure("Token validation failed: " + e.getMessage());
        }
    }

    /**
     * Discover JWKS URI from OpenID Connect discovery endpoint
     */
    private String discoverJwksUri(String issuer) {
        try {
            String discoveryUrl = issuer + "/.well-known/openid-configuration";
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(discoveryUrl))
                .GET()
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() != 200) {
                return null;
            }

            JsonNode config = objectMapper.readTree(response.body());
            return config.get("jwks_uri").asText();

        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Verify JWT signature using JWKS
     */
    private boolean verifySignature(SignedJWT jwt, String jwksUri) {
        try {
            // Fetch JWKS
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(jwksUri))
                .GET()
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() != 200) {
                return false;
            }

            JsonNode jwks = objectMapper.readTree(response.body());
            JsonNode keys = jwks.get("keys");
            
            // Find matching key
            String kid = jwt.getHeader().getKeyID();
            for (JsonNode keyNode : keys) {
                if (kid == null || kid.equals(keyNode.get("kid").asText())) {
                    RSAKey rsaKey = RSAKey.parse(keyNode.toString());
                    JWSVerifier verifier = new RSASSAVerifier(rsaKey);
                    return jwt.verify(verifier);
                }
            }

            return false;

        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Find user by OpenID subject and issuer
     */
    private UserModel findUserByOpenIdSubject(KeycloakSession session, RealmModel realm, String issuer, String subject) {
        return session.users().searchForUserByUserAttributeStream(
            realm,
            "lws.openid.issuer",
            issuer
        )
        .filter(u -> subject.equals(u.getFirstAttribute("lws.openid.subject")))
        .findFirst()
        .orElse(null);
    }
}
