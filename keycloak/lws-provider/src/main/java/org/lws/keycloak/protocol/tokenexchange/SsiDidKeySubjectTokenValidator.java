package org.lws.keycloak.protocol.tokenexchange;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.Ed25519Verifier;
import com.nimbusds.jose.jwk.OctetKeyPair;
import com.nimbusds.jwt.SignedJWT;
import com.nimbusds.jwt.JWTClaimsSet;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Date;

/**
 * Validator for SSI-DID-Key subject tokens
 * 
 * Token Type: urn:lws:params:oauth:token-type:did-key
 */
public class SsiDidKeySubjectTokenValidator implements SubjectTokenValidator {

    private static final String TOKEN_TYPE = "urn:lws:params:oauth:token-type:did-key";
    private static final HttpClient httpClient = HttpClient.newBuilder().build();
    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final String CID_RESOLVER_URL = System.getenv().getOrDefault(
        "CID_RESOLVER_URL",
        "http://cid-resolver:3000"
    );

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
            if (exp == null || exp.before(now)) {
                return ValidationResult.failure("Token has expired");
            }

            // Extract DID from issuer
            String didKey = claims.getIssuer();
            if (didKey == null || !didKey.startsWith("did:key:")) {
                return ValidationResult.failure("Invalid or missing did:key URI in issuer claim");
            }

            // Resolve public key from did:key
            OctetKeyPair publicKey = resolveDidKey(didKey);
            if (publicKey == null) {
                return ValidationResult.failure("Could not resolve did:key");
            }

            // Verify signature
            JWSVerifier verifier = new Ed25519Verifier(publicKey);
            if (!jwt.verify(verifier)) {
                return ValidationResult.failure("Invalid signature");
            }

            // Extract subject
            String subject = claims.getSubject();
            if (subject == null || subject.isEmpty()) {
                return ValidationResult.failure("Missing subject claim");
            }

            // Validate subject matches DID
            if (!subject.equals(didKey)) {
                return ValidationResult.failure("Subject does not match issuer DID");
            }

            // Try to find existing user
            UserModel user = findUserByDidKey(session, realm, didKey);

            // Build successful result
            return ValidationResult.success(subject, "ssi-did-key")
                .subjectTokenId(claims.getJWTID())
                .user(user)
                .build();

        } catch (Exception e) {
            return ValidationResult.failure("Token validation failed: " + e.getMessage());
        }
    }

    /**
     * Resolve public key from did:key URI
     */
    private OctetKeyPair resolveDidKey(String didKey) {
        try {
            String url = CID_RESOLVER_URL + "/resolve-did-key?did=" + 
                java.net.URLEncoder.encode(didKey, "UTF-8");

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() != 200) {
                return null;
            }

            JsonNode result = objectMapper.readTree(response.body());
            JsonNode publicKeyJwk = result.get("publicKeyJwk");
            
            if (publicKeyJwk == null) {
                return null;
            }

            return OctetKeyPair.parse(publicKeyJwk.toString());

        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Find user by did:key URI
     */
    private UserModel findUserByDidKey(KeycloakSession session, RealmModel realm, String didKey) {
        return session.users().searchForUserByUserAttributeStream(
            realm,
            "lws.did_key",
            didKey
        )
        .findFirst()
        .orElse(null);
    }
}
