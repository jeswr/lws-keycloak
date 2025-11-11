package org.lws.keycloak.protocol.tokenexchange;

import org.keycloak.Config;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Default implementation of AuthenticationSuiteRegistry
 */
public class DefaultAuthenticationSuiteRegistry implements AuthenticationSuiteRegistry, AuthenticationSuiteRegistryFactory {

    private static final Map<String, SubjectTokenValidator> validators = new ConcurrentHashMap<>();

    @Override
    public void registerValidator(SubjectTokenValidator validator) {
        validators.put(validator.getTokenType(), validator);
    }

    @Override
    public SubjectTokenValidator getValidator(String tokenType) {
        return validators.get(tokenType);
    }

    @Override
    public List<SubjectTokenValidator> getAllValidators() {
        return new ArrayList<>(validators.values());
    }

    @Override
    public List<String> getSupportedTokenTypes() {
        return new ArrayList<>(validators.keySet());
    }

    @Override
    public boolean isSupported(String tokenType) {
        return validators.containsKey(tokenType);
    }

    @Override
    public void close() {
        // Nothing to close
    }

    // ProviderFactory methods

    @Override
    public AuthenticationSuiteRegistry create(KeycloakSession session) {
        return this;
    }

    @Override
    public void init(Config.Scope config) {
        // Register default validators
        registerValidator(new OpenIdSubjectTokenValidator());
        registerValidator(new SsiCidSubjectTokenValidator());
        registerValidator(new SsiDidKeySubjectTokenValidator());
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {
        // No post-initialization needed
    }

    @Override
    public String getId() {
        return "lws-auth-suite-registry";
    }
}
