package org.lws.keycloak.protocol.tokenexchange;

import org.keycloak.Config;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.services.resource.RealmResourceProvider;
import org.keycloak.services.resource.RealmResourceProviderFactory;

/**
 * Factory that creates LWS realm resource provider instances.
 */
public class LwsRealmResourceProviderFactory implements RealmResourceProviderFactory {

    @Override
    public RealmResourceProvider create(KeycloakSession session) {
        return new LwsRealmResourceProvider(session);
    }

    @Override
    public void init(Config.Scope config) {
        // No initialization
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {
        // No post init
    }

    @Override
    public void close() {
        // Nothing to close
    }

    @Override
    public String getId() {
        return "lws-realm-resource";
    }
}
