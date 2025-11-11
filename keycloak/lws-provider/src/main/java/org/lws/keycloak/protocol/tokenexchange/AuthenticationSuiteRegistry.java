package org.lws.keycloak.protocol.tokenexchange;

import org.keycloak.provider.Provider;

import java.util.List;

/**
 * Registry for LWS Authentication Suite handlers
 * 
 * Manages the available authentication suites and their validators
 */
public interface AuthenticationSuiteRegistry extends Provider {

    /**
     * Register a subject token validator
     */
    void registerValidator(SubjectTokenValidator validator);

    /**
     * Get validator for a specific token type
     */
    SubjectTokenValidator getValidator(String tokenType);

    /**
     * Get all registered validators
     */
    List<SubjectTokenValidator> getAllValidators();

    /**
     * Get all supported token types
     */
    List<String> getSupportedTokenTypes();

    /**
     * Check if a token type is supported
     */
    boolean isSupported(String tokenType);
}
