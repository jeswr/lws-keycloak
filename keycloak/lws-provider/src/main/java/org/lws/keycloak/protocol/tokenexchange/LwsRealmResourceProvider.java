package org.lws.keycloak.protocol.tokenexchange;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.FormParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import org.keycloak.events.EventBuilder;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.services.resource.RealmResourceProvider;

import java.util.HashMap;
import java.util.Map;

/**
 * Realm resource provider exposing LWS token exchange endpoint
 */
@Path("lws")
public class LwsRealmResourceProvider implements RealmResourceProvider {
    private final KeycloakSession session;

    public LwsRealmResourceProvider(KeycloakSession session) {
        this.session = session;
    }

    @POST
    @Path("token")
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    public Response tokenExchange(
        @FormParam("subject_token") String subjectToken,
        @FormParam("subject_token_type") String subjectTokenType,
        @FormParam("requested_token_type") String requestedTokenType,
        @FormParam("audience") String audience,
        @FormParam("scope") String scope,
        @Context UriInfo uriInfo
    ) {
        RealmModel realm = session.getContext().getRealm();
        EventBuilder event = new EventBuilder(realm, session, session.getContext().getConnection());

        LwsTokenExchangeGrantType handler = new LwsTokenExchangeGrantType(session, realm, event);

        Map<String, String> form = new HashMap<>();
        form.put("subject_token", subjectToken);
        form.put("subject_token_type", subjectTokenType);
        form.put("requested_token_type", requestedTokenType);
        if (audience != null) form.put("audience", audience);
        if (scope != null) form.put("scope", scope);

        Response resp = handler.exchange(form, null, null);
        return resp;
    }

    @Override
    public Object getResource() {
        return this;
    }

    @Override
    public void close() {
        // no-op
    }
}
