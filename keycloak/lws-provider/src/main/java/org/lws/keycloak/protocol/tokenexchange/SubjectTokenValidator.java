package org.lws.keycloak.protocol.tokenexchange;

import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;

/**
 * Interface for validating subject tokens in token exchange requests
 */
public interface SubjectTokenValidator {

    /**
     * Get the token type URN this validator handles
     */
    String getTokenType();

    /**
     * Validate a subject token
     * 
     * @param token The subject token to validate
     * @param session Keycloak session
     * @param realm Current realm
     * @return Validation result with user info or error
     */
    ValidationResult validate(String token, KeycloakSession session, RealmModel realm);

    /**
     * Result of subject token validation
     */
    class ValidationResult {
        private final boolean valid;
        private final String subject;
        private final String authSuite;
        private final String subjectTokenId;
        private final UserModel user;
        private final String email;
        private final String name;
        private final String errorDescription;

        private ValidationResult(Builder builder) {
            this.valid = builder.valid;
            this.subject = builder.subject;
            this.authSuite = builder.authSuite;
            this.subjectTokenId = builder.subjectTokenId;
            this.user = builder.user;
            this.email = builder.email;
            this.name = builder.name;
            this.errorDescription = builder.errorDescription;
        }

        public boolean isValid() { return valid; }
        public String getSubject() { return subject; }
        public String getAuthSuite() { return authSuite; }
        public String getSubjectTokenId() { return subjectTokenId; }
        public UserModel getUser() { return user; }
        public String getEmail() { return email; }
        public String getName() { return name; }
        public String getErrorDescription() { return errorDescription; }

        public static Builder success(String subject, String authSuite) {
            return new Builder().valid(true).subject(subject).authSuite(authSuite);
        }

        public static ValidationResult failure(String errorDescription) {
            return new Builder().valid(false).errorDescription(errorDescription).build();
        }

        public static class Builder {
            private boolean valid;
            private String subject;
            private String authSuite;
            private String subjectTokenId;
            private UserModel user;
            private String email;
            private String name;
            private String errorDescription;

            public Builder valid(boolean valid) {
                this.valid = valid;
                return this;
            }

            public Builder subject(String subject) {
                this.subject = subject;
                return this;
            }

            public Builder authSuite(String authSuite) {
                this.authSuite = authSuite;
                return this;
            }

            public Builder subjectTokenId(String id) {
                this.subjectTokenId = id;
                return this;
            }

            public Builder user(UserModel user) {
                this.user = user;
                return this;
            }

            public Builder email(String email) {
                this.email = email;
                return this;
            }

            public Builder name(String name) {
                this.name = name;
                return this;
            }

            public Builder errorDescription(String error) {
                this.errorDescription = error;
                return this;
            }

            public ValidationResult build() {
                return new ValidationResult(this);
            }
        }
    }
}
