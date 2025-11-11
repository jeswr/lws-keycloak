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
 * Validator for SSI-CID subject tokens
 * 
 * Token Type: urn:lws:params:oauth:token-type:cid
 */
public class SsiCidSubjectTokenValidator implements SubjectTokenValidator {

    private static final String TOKEN_TYPE = "urn:lws:params:oauth:token-type:cid";
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

            // Extract CID URI from issuer
            String cidUri = claims.getIssuer();
            if (cidUri == null || !cidUri.startsWith("cid:")) {
                return ValidationResult.failure("Invalid or missing CID URI in issuer claim");
            }

            // Get key ID from header
            String kid = jwt.getHeader().getKeyID();
            if (kid == null) {
                return ValidationResult.failure("Missing kid in JWT header");
            }

            // Resolve verification method from CID document
            OctetKeyPair publicKey = resolveVerificationMethod(cidUri, kid);
            if (publicKey == null) {
                return ValidationResult.failure("Could not resolve verification method");
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

            // Validate subject matches CID
            if (!subject.equals(cidUri)) {
                return ValidationResult.failure("Subject does not match issuer CID");
            }

            // Try to find existing user
            UserModel user = findUserByCid(session, realm, cidUri);

            // Build successful result
            return ValidationResult.success(subject, "ssi-cid")
                .subjectTokenId(claims.getJWTID())
                .user(user)
                .build();

        } catch (Exception e) {
            return ValidationResult.failure("Token validation failed: " + e.getMessage());
        }
    }

    /**
     * Resolve verification method from CID document
     */
    private OctetKeyPair resolveVerificationMethod(String cidUri, String kid) {
        try {
            String url = CID_RESOLVER_URL + "/verification-method?uri=" + 
                java.net.URLEncoder.encode(cidUri, "UTF-8") + 
                "&kid=" + java.net.URLEncoder.encode(kid, "UTF-8");

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
     * Find user by CID URI
     */
    private UserModel findUserByCid(KeycloakSession session, RealmModel realm, String cidUri) {
        return session.users().searchForUserByUserAttributeStream(
            realm,
            "lws.cid",
            cidUri
        )
        .findFirst()
        .orElse(null);
    }
}
