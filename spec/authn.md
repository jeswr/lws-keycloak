# LWS: Authentication

# Linked Web Storage (LWS): Authentication

## Abstract

This document defines how to identify and validate end-user agents, enabling authorization claims to be enforced by Linked Web Storage Authorisation Servers.

## Status of the Document

*This section describes the status of this document at the time of its publication. A list of current W3C publications and the latest revision of this technical report can be found in the [W3C standards and drafts index](https://www.w3.org/TR/).*

This is an unofficial proposal.

This document was published by the [Linked Web Storage Working Group](https://www.w3.org/groups/wg/lws) as an Editors Draft.

Publication as an Editor's Draft does not imply endorsement by W3C and its Members.

This is a draft document and may be updated, replaced, or obsoleted by other documents at any time. It is inappropriate to cite this document as other than a work in progress.

This document was produced by a group operating under the [W3C Patent Policy](https://www.w3.org/policies/patent-policy/). W3C maintains a [public list of any patent disclosures](https://www.w3.org/groups/wg/lws/ipr) made in connection with the deliverables of the group; that page also includes instructions for disclosing a patent. An individual who has actual knowledge of a patent that the individual believes contains [Essential Claim(s)](https://www.w3.org/policies/patent-policy/#def-essential) must disclose the information in accordance with [section 6 of the W3C Patent Policy](https://www.w3.org/policies/patent-policy/#sec-Disclosure).

This document is governed by the [18 August 2025 W3C Process Document](https://www.w3.org/policies/process/20250818/).

## 1\. Introduction

\[non-normative\]

This document defines a mechanism for identifying agents and end users that plan to interact with a linked web storage server. This specification does not mandate a particular format for end-user credentials, though it does describe how existing identity systems can be used in conjunction with the linked web storage authorization framework.

This document also covers a variety of security, privacy, internationalization, and accessibility considerations for ecosystems that use the technologies described in this specification.

## 2\. Terminology

The terms "authorization server" and "client" are defined by The OAuth 2.0 Authorization Framework \[RFC6749\].

The terms "end-user", and "issuer" are defined by OpenID Connect Core 1.0 \[OpenID Core\]

This specification defines the following terms:

**end-user credential** – a security token that asserts claims about an end-user. This token is secured with a cryptographic proof.

**authentication suite** \- a defined validation mechanism for a concrete serialization of an end-user credential.

## 3\. End-User Credential Data Model

The data model described in this section outlines the requirements for any concrete serialization of an end-user credential.

An end-user credential MUST include tamper evident claims about a subject, including:

**subject REQUIRED** \- an identifier for an end user. This MUST be an absolute URI.

**issuer REQUIRED** \- an identifier for the entity that issued the end-user credential. This MUST be an absolute URI.

**client REQUIRED** \- an identifier for a client application. This SHOULD be an absolute URI.

**audience restriction RECOMMENDED** \- a list of values that SHOULD include an authorization server identifier.

## 4\. End-User Credential Validation

Validation of an end-user credential requires a trust relationship between the verifier and issuer of the credential. This trust relationship MAY be established through an out-of-band mechanism. Any additional mechanisms for establishing trust between a verifier and an issuer are outlined in specific authentication suites.

An end-user credential MUST be signed. It is RECOMMENDED that the signature uses asymmetric cryptography.

## 5\. End-User Credential Type Identifiers

Each authentication suite MUST be associated with a token type URI. An authentication suite SHOULD use a URI defined in the IANA "OAuth URI" registry.

## 6\. Privacy Considerations

\[non-normative\]

End-user credentials carry information about users. While digital signatures can protect end-user credentials against tampering, it is possible for clients or other third parties to read the values inside an unencrypted credential.

As a result, issuers should create end-user credentials that contain only the information necessary for authentication. Avoid including sensitive attributes unless required.

Implementations should not log the full contents of an end-user credential. If logging is necessary, tokens should be truncated or hashed.

## 7\. Security Considerations

\[non-normative\]

All communications related to requesting, retrieving and presenting end-user credentials between clients and servers must use TLS-protected connections.

End-user credentials are vulnerable to theft and replay. Tokens should have a reasonably short lifetime, such as 3600 seconds (1 hour).

Clients that persist end-user credentials must take great care to store these tokens securely. Tokens should never be stored unencrypted in a browser's localStorage, in URLs or in logs.

# LWS: OpenID Authentication Suite

# OpenID Authentication Suite

### 1\. Introduction

OpenID Connect is a widely used mechanism for web-based authentication. This authentication suite describes how an OpenID provider can be used with LWS-conforming applications.

### 2\. Terminology

The terms "authorization server" and "client" are defined by The OAuth 2.0 Authorization Framework \[RFC6749\].

The terms "OpenID provider", "id token", "end-user", and "issuer" are defined by OpenID Connect Core 1.0 \[OpenID Core\]

The term "openid connect discovery" is defined by OpenID Connect Discovery 1.0 \[OpenID Discovery\]

The term "controlled identifier document" is defined by W3C Controlled Identifiers 1.0 \[CID\]

The terms "JSON Web Token (JWT)" and "claim" are defined by JSON Web Token \[RFC7519\]

The term "JSON Web Key (JWK)" is defined by JSON Web Key \[RFC7517\]

The terms "end-user credential" and "authentication suite" are defined by LWS Authentication \[LWS-AuthN\]

### 3\. End-User Credential Serialization

OpenID Connect defines a protocol for producing signed ID Tokens which are used to describe an end-user. An ID Token is serialized as a signed JSON Web Token (JWT). In order to use an ID Token as an LWS end-user credential, the following additional requirements apply.

The ID Token MUST NOT use "none" as the signing algorithm.

The ID Token MUST use the `sub` (subject) claim for the LWS subject identifier.

The ID Token MUST use the `iss` (issuer) claim for the LWS issuer identifier.

The ID Token MUST use the `azp` (authorized party) claim for the LWS client identifier.

Any audience restriction in the ID Token MUST use the `aud` (audience) claim. The `aud` claim SHOULD include the client identifier and any additional target audience such as an authorization server.

Example ID Token that is also a valid LWS end-user credential is below:

```
{
  "typ": "JWT",
  "kid": "12dbe73a",
  "kty": "EC",
  "alg": "ES256",
  "crv": "P-256"
}
.
{
  "sub": "https://id.example/end-user",
  "iss": "https://openid.example",
  "azp": "https://client.example/17da1b",
  "aud": ["https://client.example/17da1b", "https://as.example"],
  "iat": 1761313600,
  "exp": 1761313900
}
.
signature
```

### 4\. End-User Credential Validation

In order to validate an ID Token as an LWS end-user credential, there must be a trust relationship between the verifier and the issuing party.

In the absence of a pre-existing trust relation, the validator MUST dereference the `sub` (subject) claim in the end-user credential. The resulting resource MUST be formatted as a valid controlled identifier document \[CID\] with an `id` value equal to the subject identifier.

The verifier MUST use the subject's controlled identifier document to locate a `service` object whose `serviceEndpoint` value equals the `iss` claim from the end-user credential and whose `type` value equals `https://www.w3.org/ns/lws#OpenIdProvider`. The verifier MUST perform OpenID Connect Discovery to locate the public portion of the JSON Web Key (JWK) used to sign the end-user credential. The JWT MUST be validated as described by OpenID Connect Core Section 3.1.3.7.

Example Controlled Identifier Document for an agent using OpenID Connect is below:

```
{
    "@context": [
        "https://www.w3.org/ns/cid/v1"
    ],
    "id": "https://id.example/end-user",
    "service": [{
        "type": "https://www.w3.org/ns/lws#OpenIdProvider",
        "serviceEndpoint": "https://openid.example"
    }]
}
```

### 5\. Token Type Identifier

An ID Token used as an end-user credential MUST use the `urn:ietf:params:oauth:token-type:id_token` URI when interacting with an authorization server.

### 6\. Security Considerations

\[non-normative\]

All security considerations described in "Best Current Practice for OAuth 2.0 Security" and "OpenID Core" Section 16 apply to this specification.

An OpenID provider should support a mechanism to restrict the audience of an end-user credential to a limited set of entities, including an authorization server. One mechanism for achieving this is to use Resource Indicators for OAuth 2.0 \[RFC8707\]. A client in possession of an end-user credential with no audience restrictions should exchange this token for an equivalent audience-restricted token by using, for example, OAuth 2.0 Token Exchange.

An OpenID provider should provide support for "OAuth 2.0 Authorization Server Issuer Identification" by including an `iss` parameter in the authorization response of an OAuth flow.

An OpenID provider should provide support for end-user logout, such as RP-Initiated Logout 1.0.

The issuer of an end-user credential is responsible for validating the client identifier. The issuer may use mechanisms such as OAuth Client Metadata Document, OAuth 2.0 Client Id Prefix, or OpenID Federation.

It is recommended that OpenID providers support WebAuthn as a mechanism for authenticating users.

# LWS: SSI-CID Authentication Suite

# Self-Issued Identity with Controlled Identifier Documents

### 1\. Introduction

Self-issued identity is important for cases where applications act on their own behalf. This includes autonomous bots as well as server-side scripts, among others. In these cases, the agent is able to securely manage the private portion of a keypair, which it uses to generate signed JSON Web Tokens (JWT). This specification describes how this class of agents can generate end-user credentials that can be used with a Linked Web Storage.

### 2\. Terminology

The terms "authorization server" and "client" are defined by The OAuth 2.0 Authorization Framework \[RFC6749\].

The terms "controlled identifier document" and "verification method" are defined by W3C Controlled Identifiers 1.0 \[CID\]

The terms "JSON Web Token (JWT)" and "claim" are defined by JSON Web Token \[RFC7519\]

The terms "end-user credential" and "authentication suite" are defined by LWS Authentication \[LWS-AuthN\]

### 3\. End-User Credential Serialization

A self-issued end-user credential is serialized as a signed JSON Web Token (JWT). In order to use a JWT as an LWS end-user credential, the following additional requirements apply.

The JWT MUST NOT use "none" as the signing algorithm.

The JWT MUST use the `sub` (subject) claim for the LWS subject identifier.

The JWT MUST use the `iss` (issuer) claim for the LWS issuer identifier.

The JWT MUST use the `client_id` (client ID) claim for the LWS client identifier.

The claims `sub`, `iss`, and `client_id` MUST all use the same URI value.

Any audience restriction in the ID Token MUST use the `aud` (audience) claim. The `aud` claim MUST include the target authorization server.

The JWT MUST include an `exp` (expiration) claim, indicating the time the token expires

The JWT MUST include an `iat` (issued at) claim, indicating the time the token was issued.

Example JWT that is also a valid LWS end-user credential is below:

```
{
  "kid": "c1f52577",
  "kty": "EC",
  "alg": "ES256",
  "typ": "JWT",
  "crv": "P-256"
}
.
{
  "sub": "https://id.example/agent",
  "iss": "https://id.example/agent",
  "client_id": "https://id.example/agent",
  "aud": ["https://as.example"],
  "iat": 1761313600,
  "exp": 1761313900
}
.
signature
```

### 4\. End-User Credential Validation

In order to validate a JWT as an LWS end-user credential, there must be a trust relationship between the verifier and the issuing party.

In the absence of a pre-existing trust relation, the verifier MUST dereference the `sub` (subject) claim in the end-user credential. The resulting resource MUST be formatted as a valid controlled identifier document \[CID\] with an `id` value equal to the subject identifier.

A verifier MUST reject any tokens using an `alg` header parameter that equals "none".

A verifier MUST validate all claims described by the end-user credential data model.

The verifier MUST use the `kid` value from the signed JWT header to identify a verification method from the subject's controlled identifier document. This process is described in CID Section 3.3. Using the selected verification method from the controlled identifier document, the signature of the JWT MUST be validated as described in RFC7515, Section 5.2.

A verifier MUST ensure that the current time is before the time represented by the `exp` claim. Implementers MAY provide for some small leeway to account for clock skew.

An example Controlled Identifier Document is below:

```javascript
{
    "@context": [
        "https://www.w3.org/ns/cid/v1" ],
    "id": "https://id.example/agent",
    "authentication": [{
        "id": "https://id.example/agent#c1f52577",
        "type": "JsonWebKey",
        "controller": "https://id.example/agent",
        "publicKeyJwk": {
            "kid": "c1f52577",
            "kty": "EC",
            "crv": "P-256",
            "alg": "ES256",
            "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
            "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"
        }
    }]
}
```

### 5\. Token Type Identifier

A self-issued JSON Web Token used as an end-user credential MUST use the `urn:ietf:params:oauth:token-type:jwt` URI when interacting with an authorization server.

### 6\. Security Considerations

\[non-normative\]

All security considerations described in "Best Current Practice for OAuth 2.0 Security" and "OpenID Core" Section 16 apply to this specification.

## 7\. Implementation Guidance

Authorisation servers should maintain a cache of public keys obtained from CIDs, along with the expiry of those public keys as determined by the max-age header in the HTTP(S) response of the CID document. 

The issuing party SHOULD ensure that the max-age header is set to a value that enables effective caching by the authorisation server.

In the case of an existing trust relationship between the authorisation server and the issuing party, the authorisation server may use a back-channel request to obtain and update public keys in bulk.

# LWS: SSI-DID-Key Authentication Suite

# Self-Issued Identity with Controlled Identifier Documents

### 1\. Introduction

Self-issued identity is important for cases where applications act on their own behalf. This includes autonomous bots as well as server-side scripts, among others. In these cases, the agent is able to securely manage the private portion of a keypair, which it uses to generate signed JSON Web Tokens (JWT). This specification describes how this class of agents can generate end-user credentials that can be used with a Linked Web Storage.

### 2\. Terminology

The terms "authorization server" and "client" are defined by The OAuth 2.0 Authorization Framework \[RFC6749\].

The terms "JSON Web Token (JWT)" and "claim" are defined by JSON Web Token \[RFC7519\]

The terms "end-user credential" and "authentication suite" are defined by LWS Authentication \[LWS-AuthN\]

### 3\. End-User Credential Serialization

A self-issued end-user credential is serialized as a signed JSON Web Token (JWT). In order to use a JWT as an LWS end-user credential, the following additional requirements apply.

The JWT MUST NOT use "none" as the signing algorithm.

The JWT MUST use the `sub` (subject) claim for the LWS subject identifier. The subject identifier MUST use a `did:key` URI.

The JWT MUST use the `iss` (issuer) claim for the LWS issuer identifier.

The JWT MUST use the `client_id` (client ID) claim for the LWS client identifier.

The claims `sub`, `iss`, and `client_id` MUST all use the same URI value.

Any audience restriction in the ID Token MUST use the `aud` (audience) claim. The `aud` claim MUST include the target authorization server.

The JWT MUST include an `exp` (expiration) claim, indicating the time the token expires

The JWT MUST include an `iat` (issued at) claim, indicating the time the token was issued.

Example JWT that is also a valid LWS end-user credential is below:

```
{
  "kid": "c1f52577",
  "kty": "EC",
  "alg": "ES256",
  "typ": "JWT",
  "crv": "P-256"
}
.
{
  "sub": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "iss": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "client_id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "aud": ["https://as.example"],
  "iat": 1761313600,
  "exp": 1761313900
}
```

### 4\. End-User Credential Validation

For subject identifiers that use `did:key`, a verifier will extract a public key from the identifier itself, as described in Section 3.1.3 of "The did:key Method". Using this public key, the signature of the JWT MUST be validated as described in RFC7515, Section 5.2.

A verifier MUST validate all claims described by the end-user credential data model.

A verifier MUST ensure that the current time is before the time represented by the `exp` claim. Implementers MAY provide for some small leeway to account for clock skew.

### 5\. Token Type Identifier

A self-issued JSON Web Token used as an end-user credential MUST use the `urn:ietf:params:oauth:token-type:jwt` URI when interacting with an authorization server.

### 6\. Security Considerations

\[non-normative\]

All security considerations described in "Best Current Practice for OAuth 2.0 Security" and "OpenID Core" Section 16 apply to this specification.

# LWS: SAML Authentication Suite

# SAML 2.0 Authentication Suite

### 1\. Introduction

The Security Assertion Markup Language (SAML) is an open standard for exchanging authentication and authorization assertions between parties, typically between web-based service providers (i.e., an application) and identity providers. These assertions are encoded in an XML format containing a digital signature. This specification describes how SAML-based identity tokens can be used to authenticate end users in a Linked Web Storage environment.

### 2\. Terminology

The terms "authorization server" and "client" are defined by The OAuth 2.0 Authorization Framework \[RFC6749\].

The terms "identity provider" and "assertion" are defined by The Security Assertion Markup Language (SAML) 2.0 \[OASIS.saml-core-2.0-os\]

The terms "end-user credential" and "authentication suite" are defined by LWS Authentication \[LWS-AuthN\]

### 3\. End-User Credential Serialization

SAML tokens used as end-user credentials MUST be signed. In addition, a valid SAML token MUST include the following assertions:

The SAML token MUST use the `saml:NameID` assertion for the LWS subject identifier.

The SAML token MUST use the `saml:Issuer` assertion for the LWS issuer identifier.

The SAML token MUST use the `Recipient` parameter within a `saml:SubjectConfirmationData` assertion for the LWS client identifier.

Any audience restriction in the SAML token MUST use the `saml:Audience` assertion. The `saml:Audience` assertion SHOULD include a client identifier and any additional target audience such as an authorization server.

Example SAML End-User Credential is below:

```xml
<samlp:Response
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
    Version="2.0"
    IssueInstant="2025-10-25T01:01:16Z">

  <saml:Issuer>https://idp.example</saml:Issuer>

  <ds:Signature>
    <ds:SignedInfo>
      ...
    </ds:SignedInfo>
  </ds:SignedInfo>

  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>

  <saml:Assertion Version="2.0" IssueInstant="2025-10-25T01:01:16Z">
    <saml:Issuer>https://idp.example</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">
          https://id.example/end-user
      </saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="2025-10-25T02:01:16Z"
                                      Recipient="https://app.example/SAML"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="2025-10-25T01:01:16Z" 
                     NotOnOrAfter="2025-10-25T02:01:16Z">
      <saml:AudienceRestriction>
        <saml:Audience>https://app.example/SAML</saml:Audience>
        <saml:Audience>https://as.example</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
  </saml:Assertion>
</samlp:Response>
```

### 4\. End-User Credential Validation

In order to validate a SAML end-user credential, there must be a trust relationship with the issuing identity provider. This specification does not define how a validating entity establishes a trust relationship with an identity provider, expecting these relationships to be established out-of-band.

Using a trust relationship with an issuer, the signature of the credential MUST be validated as described in SAML Core, section 5 \[SAML20-CORE\].

### 5\. Token Type Identifier

A SAML 2.0 assertion used as an end-user credential MUST use the `urn:ietf:params:oauth:token-type:saml2` URI when interacting with an authorization server.

### 6\. Security Considerations

\[non-normative\]

All security considerations described in "Security and Privacy Considerations for the OASIS Security Assertion Markup Language (SAML) V2.0" apply to this specification.

A SAML identity provider should support a mechanism to restrict the audience of an end-user credential to a limited set of entities, including an authorization server. A client in possession of an end-user credential with no audience restrictions should exchange this token for an equivalent audience-restricted token by using, for example, OAuth 2.0 Token Exchange.

# LWS: Migration path from Solid

### (Solid) WebIDs and the SSI-CID Authentication Suite

The URI of a (Solid) WebID SHOULD be the same URI used to identify and locate an end user-agent CID as defined in the Authentication Suite.

To support Solid WebIds this document MUST content negotiate to a text/turtle document. To support the SSI-CID authentication suite this document must content negotiate to an application/cid document.

The application/ld+json response SHOULD contain content required to complete the SSI-CID authentication flow.

### Writing to WebIDs / Profile Documents

In Solid today WebIDs *may* be writable and live in Solid. CIDs are not designed to be written to by users. We RECOMMEND that extended profile documents become the canonical location that client applications write data to. These extended profile documents should be linked to from the CID.

### sameAs in the Authorisation system \[unlikely to include in final version\]

TODO

If the existing WebID lives in user-storage, and cannot easily become server-managed; then the statement \`\<webid\> owl:sameAs \<cid\>\` should be added to the original WebID document.

If an end-user is authenticated with a \<cid\>, and access control policies are defined with reference to a \<webid\>

Migration from Solid-OIDC to OpenID Authentication Suite

For users:

- An existing WebID document should be able to content-negotiate to a CID (application/cid or application/ld+json)  
- CID documents should be able to content-negotiate to turtle  
- Expected WebID profile claims such as `rdfs:seeAlso` (for extended profile documents), `solid:oidcIssuer` (for Solid-WebID authentication) and `pim:storage` (for Storage discovery) can be included via the use of a JSON-LD context:

```
{
    "@context": {
        "seeAlso": {
            "@id": "http://www.w3.org/2000/01/rdf-schema#seeAlso",
            "@type": "@id"
        },
        "oidcIssuer" {
            "@id": "http://www.w3.org/ns/solid/terms#oidcIssuer",
            "@type": "@id"
        },
        "storage": {
            "@id": "http://www.w3.org/ns/pim/space#storage",
            "@type": "@id"
        }
    }
}
```

For developers of client applications and libraries

- The only required `scope` value at a conforming OpenID provider's authorization endpoint is `openid`.  
- The use of DPoP is no longer required  
- Clients should request audience-scoped ID tokens either via Resource Indicators (e.g., by providing a `resource=<authorization server>` parameter at the authorization endpoint or by exchanging the ID token at a trusted server that implements OAuth 2.0 Token Exchange  
- The `webid` claim is no longer included in the ID Token; instead, the `sub` claim is used for user identity

For implementers of OpenID Providers

- The value `solid` should no longer be included in the `aud` claim  
- The `webid` claim is no longer used; instead, the `sub` claim is used for user identity  
- DPoP is no longer required  
- Servers that previously supported Solid-OIDC Client Identifier Documents should now support the requirements listed in the draft OAuth Client ID Metadata Document specification. That is, the client identifier document will respond with the content type `application/json` and without the need for JSON-LD support (i.e., no `@context` field is required)  
- OpenID Providers should support Resource Indicators for OAuth 2.0 by populating the `aud` claim in the ID token with the value from the `resource` query parameter at the authorization endpoint.  
-  

For implementers of authorisation servers (for AuthZ section)

- An authorization server must implement OAuth token exchange  
- An authorization server must implement OAuth rich authorization requests  
- Any rich authorization request must be evaluated in terms of the server's existing access control policies  
- The resulting authorization decision must be encoded in a JWT as described in the LWS Authorization specification  
- An authorization server must validate the signature of an end-user credential  
- An authorization server must ensure that the `sub` claim of the end-user credential is an absolute URI

For implementers of storage servers

- A storage server must reject credentials that are not issued by the trusted authorization server  
- For AuthZ section  
  - Any token from the authorization server must verified as per normal JWT validation  
  - The values encoded in the rich authorization request must be evaluated against the HTTP request. For example, a request to a given URL is valid only if that URL is included (or parent thereof) in the `locations` array of an authorization request object. In addition an access token that allows only `Read` access must not allow a client to perform any write operations.

# Notes / Considerations

TimBL:

* Convenience of reauthentication on timeout  
* Convenience of authentication  
* Get team contact to register W3C NS for lws  
* If you have a writable CID and an unwritable profile document; and SolidOS is only given write access to the main profile, then it can create as many profile documents as it likes and write them from the CID.  
* OpenID federations might be overcomplicating things for certification of apps. Could just have separate app stores that e.g. the ODI maintains.

Problem types:

* Encourage the use of problem types and for people to register new problem types as they go. (likely for the storage server, rather than Identity provider/Authorization server, which already have a mechanism for handling errors)

Bikeshed:

* Policies entry metadata  
  * Policies are URLs hosted by the AuthZs server that can be dereference by clients. Extensions of LWS could have the dereferenced URLs return ODRL policy documents which clients can then use to perform client-side DRM.  
* 

# Copied from other sections

Copied from other sections

## Introduction

 end-user credential data model, used to assert claims about an end-user. It also outlines the requirements for an authentication suite, which provides a concrete serialisation and validation flow for specific authentication protocols, including OpenID, OAuth 2.0, SAML, and SSI.

This document also covers a variety of security, privacy, internationalization, and accessibility considerations for ecosystems that use the technologies described in this specification.

Consistent mechanism to identify agents and end users  
Alignment with standard practices / specifications  
Clarifies how this works for delegated authentication flows as well as self-signed mechanisms  
Clarifies trust model  
This is part of the overall authorization model within LWS  
Builds primarily on OAuth but is not exclusive  
Point to the “LWS Authentication Suites” section with subspecifications 

TODO

## Terminology

The term "openid connect discovery" is defined by OpenID Connect Discovery 1.0 \[OpenID Discovery\]

The terms "controlled identifier document", "subject", "verification method", and "authentication" are defined by W3C Controlled Identifiers 1.0 \[CID\]

The terms "JSON Web Token (JWT)" and "claim" are defined by JSON Web Token \[JWT\]

The term "JOSE Header" is defined by JSON Web Signature \[JWS\]

The term "JSON Web Key (JWK)" is defined by JSON Web Key \[JWK\]

The terms "identity provider" and "assertion" are defined by The Security Assertion Markup Language (SAML) 2.0 \[OASIS.saml-core-2.0-os\]

TODO: Extract key concepts from OpenId federation

The terms “Trust Chain”, “Trust Anchor”, “Leaf”, and “Intermediate” are as defined in OpenID Federation 1.0 \- draft 44 \[\]

## 5\. Discovery of Authentication Suites supported by an Authorisation Server

\[move to AuthZ section\]

An authorization server MUST advertise the supported Authentication Suites by including a `subject_token_types_supported` entry in the server metadata document. This value is a JSON array containing a list of the `subject_token_type` values supported by an authorization server.

### 4.1. Identity Credential as a signed JWT

An identity credential that is serialized as a JWT MUST be signed. Although JWTs can use any signing algorithm, use of asymmetric cryptography is RECOMMENDED. JWT identity credentials MUST NOT use "none" as the signing algorithm.

The subject identifier MUST use the `sub` (subject) claim and be expressed as an absolute URI.

The issuer identifier MUST use the `iss` (issuer) claim and be expressed as an absolute URI.

Any audience restriction MUST use the `aud` (audience) claim. The `aud` claim SHOULD include a client identifier and any additional target audience such as an authorization server.

Certain identity providers may be unable to produce identity tokens using the `client_id` claim. In this case, the `azp` claim MAY be used. The client identifier MUST use either the `client_id` claim or the `azp` claim. If a client is acting on behalf of itself, the `client_id` MUST be used and MUST be the same as the `sub` claim.

Example Serializations

```
# OpenID ID Token
{
  "kid": "12dbe73a",
  "kty": "EC",
  "alg": "ES256",
  "typ": "JWT",
  "crv": "P-256"
}
.
{
  "sub": "https://id.example/end-user",
  "iss": "https://openid.example",
  "azp": "https://app.example/17da1b668b7b",
  "aud": ["https://app.example/17da1b668b7b", "https://as.example"],
  "iat": 1761313600,
  "exp": 1761313900
}
.
signature


# Self-issued JWT
[Content to be fetched from https://docs.google.com/document/d/1NCTYQicGjtRgP39D_m5rShJtH4Tj9Pn47UCWE_WKpX8/edit?tab=t.pc3lb09eea89 ]
.
signature# SAML
TODO: Pull in from SAML suite

```

#### 4.1.1 JWT Validation

In order to validate this identity credential, there must be a trust relationship with the issuing party.

In the absence of a pre-existing trust relation, the validator MUST use a verification method found by dereferencing the `sub` (subject) claim. The resulting resource MUST be formatted as a valid controlled identifier document with an id value equal to the subject identifier.

##### 4.1.1.1 Validating self-issued identity credentials

\[CONTENT MOVED TO [LWS: Authentication](https://docs.google.com/document/d/1NCTYQicGjtRgP39D_m5rShJtH4Tj9Pn47UCWE_WKpX8/edit?tab=t.pc3lb09eea89)\]

##### 4.1.1.2 Validating delegated identity credentials

Delegated identity credentials will contain a `sub` claim that is different from the `iss` claim. For delegated identity credentials, a validator MUST use the subject's controlled identifier document to locate a `service` object whose `serviceEndpoint` value equals the `iss` claim from the identity credential. For a matching `service` object, if the `type` value equals `https://www.w3.org/ns/lws#OpenIdProvider` the verifier MUST perform OpenID Connect Discovery to locate the public portion of the JSON Web Key used to sign the identity credential. The JWT MUST be validated as described by OpenID Connect Core Section 3.1.3.7.

A Controlled Identifier Document for an agent using OpenID Connect  is below:

```
{
    "@context": [
        "https://www.w3.org/ns/cid/v1" ],
    "id": "https://id.example/end-user",
    "service": [{
        "type": "https://www.w3.org/ns/lws#OpenIdProvider",
        "serviceEndpoint": "https://openid.example"
    }]
}
```

##### 4.1.1.3 Validating client metadata

The issuer of an identity credential is responsible for validating the client identifier. The issuer may use mechanisms such as OAuth Client Metadata Document, OAuth 2.0 Client Id Prefix, OpenID Federation.

The 

- Client Prefixes [https://www.ietf.org/archive/id/draft-parecki-oauth-client-id-prefix-00.html](https://www.ietf.org/archive/id/draft-parecki-oauth-client-id-prefix-00.html)  
- 

## 5\. Trust Modelling

TODO: Define the trust model of operators as a non-normative part of this document.  
TODO: Move most of trust modelling to the authorisation document

We define a “

**Operator Level Cryptographic Trust**

Within a federation, operators must decide the cryptographic guarantees they require to have assurance that claims are authoritative.

**Operator Level Social Trust**

Within a federation, operators must define their trust assumptions for other service level-entities. Typically, this is defined in a course-grained manner using allow-lists \- such as an authorisation server defining an allow-list of IDPs it will consider authoritative for attesting user-identities.

Allow-lists are now proving limited for many deployment scenarios. Trust frameworks such as eIDAS and the UK DIATF provide regulatory mechanisms for certifying services such as IDPs \- and specifications including OpenID federation offer mechanisms for trusted certification bodies to issue verifiable trust marks on such services.

How operators define their trust

Whilst out-of-scope for this specification, we provide a mechanism for 

**User Level Social Trust**

User-level social trust 

Todo:

* Define key terms to use  
* Distinguish between having trust established within an existing federation (e.g. SAML) and needing to be defined here  
* Distinguish between what is done at  
  * The operator level  
  * User level (e.g. in ACP)  
* Distinguish between  
  * Cryptographic trust  
  * Social trust

- Storage \- (trusts) \-\> AuthZ server for all claims  
  - There is at most one AuthZ that a storage can trust (for OpenID backwards compat)  
  - AuthZ determines which IDPs \+ SSI \+ other issues it trusts for

Kinds of statements we want to make

\<athuz\> ex:trusts \<fed:idp1\>, \<fed:idp2\> .

\<fed:idp1\> a ex:openid ; ex:isAuthorotativeFor \<sub\>, \<ess\>, \<exp\> .

ALT

turtle  
\<fed:idp1\> a ex:openid ; ex:authorotativeOnDataMatchingShape ex:identityCredentialShape .

shaclc  
shape ex:identityCredentialShape {  
	ex:sub \[0..1\] .  
ex:ess \[0..1\] .  
ex:exp \[0..1\] .  
}

Claims that the identity credential is "authoritative over”:

- Claims  
  - “sub”  
  - “Iss”  
  - “client\_id”  
  - “aud”: \[RP, AS, …\], by default 

Security Vocabularies:

- [https://w3id.org/security](https://w3id.org/security)

Prior art on trust:

* [https://www.w3.org/2001/sw/Europe/reports/trust/11.2/d11.2\_trust\_vocabularies.html](https://www.w3.org/2001/sw/Europe/reports/trust/11.2/d11.2_trust_vocabularies.html)  
* [http://xmlns.com/wot/0.1/](http://xmlns.com/wot/0.1/)  
* 

Related \- unlikely to be required:

* [https://www.w3.org/ns/auth/cert\#](https://www.w3.org/ns/auth/cert#)

Note:

- CIDs \- which we depend on are JSONLD documents with the following context  
  - [https://www.w3.org/2025/credentials/cid/context/v1.jsonld](https://www.w3.org/2025/credentials/cid/context/v1.jsonld)  
- ZKAPs define [https://www.w3.org/2025/credentials/vcdi/vocab/v2/vocabulary.html\#allowedAction](https://www.w3.org/2025/credentials/vcdi/vocab/v2/vocabulary.html#allowedAction) which can be used for describing crud operations  
- Academic work to reference:  
  - [https://hal.science/hal-04663453v1/file/eIDAS\_ToIP.pdf](https://hal.science/hal-04663453v1/file/eIDAS_ToIP.pdf)  
- Best ways to identify RPs as legitimate things might be  
  - [https://openid.net/specs/openid-federation-1\_0.html](https://openid.net/specs/openid-federation-1_0.html)  
  - 

https://www.w3.org/2025/credentials/vcdi/vocab/v2/vocabulary.html\#authentication

## 6\. Privacy Considerations

\[non-normative\]

TODO

## 7\. Security Considerations

\[non-normative\]

All security considerations described in "Best Current Practice for OAuth 2.0 Security", "OpenID Core" Section 16, and "Security and Privacy Considerations for the OASIS Security Assertion Markup Language (SAML) V2.0" apply to this specification.

In particular, implementations should take care to constrain the audience of an identity credential as described in RFC 9700 Section 4.10.2. An audience restriction associates the identity credential with a particular client and authorization server. The mechanism in \[RFC8707\] can be used for this. If the issuer of an identity credential is unable to constrain the audience, the client should use a mechanism such as OAuth 2.0 Token Exchange.

An OpenID provider should provide support for end-user logout, such as RP-Initiated Logout 1.0.

## 8\. Authentication Suites

- This specification is designed to enable authentication using a range of existing authentication mechanisms.   
- Specific authentication mechanisms are defined as a suite   
- Point to currently defined suites  
  - OAuth  
  - SAML  
  - SSI  
- How servers advertise the authentication suites that they support.  
- Vocabulary for how to advertise identity services they have WebID (services in CID?)  
  - What mechanisms the user can use to authenticate  
  - What the preferred mode of authentication is  
- What Authentications suites must define  
  - The identifer for the suite to include in server metadata (we should attempt to register subject\_token\_type\_supported)  
  - The serialisation of the identity credential  
  - How the identity credential must be validated

Notes:

- OpenID federation is still a draft. So we can’t do anything normatively with it.  
- Concepts to use from OpenID federation in the (social) trust section are:  
  - Trust\_marks (https://openid.net/specs/openid-federation-1\_0.html\#name-trust-marks)  
  - trust\_mark\_issuers  
  - trust\_mark\_owners  
- 

VCDM: A verifiable credential is a specific way to express a set of claims made by an issuer, such as a driver's license or an education certificate. This specification describes the extensible data model for verifiable credentials, how they can be secured from tampering, and a three-party ecosystem for the exchange of these credentials that is composed of issuers, holders, and verifiers. This document also covers a variety of security, privacy, internationalization, and accessibility considerations for ecosystems that use the technologies described in this specification.

TODO: See if we can design this to work with WebAuthN ([https://www.w3.org/TR/webauthn-2/\#attestation](https://www.w3.org/TR/webauthn-2/#attestation)) 

## WebAuthn

*Non-normative note*: This is the preferred use of WebAuthn with Linked Web Storage \- as compared to using the OAuth Authentication Suite and having an IDP server authenticate users using WebAuthn. This is because it removes the need to trust an additional IDP server.

User CID document

```
{
    "@context": [
        "https://www.w3.org/ns/cid/v1"
    ],
    "id": "https://id.example/end-user",
    "service": [{
        "type": "https://www.w3.org/ns/lws#OpenIdProvider",
        "serviceEndpoint": "https://openid.example"
    },{
        "type": "https://www.w3.org/ns/lws#Storage",
        "serviceEndpoint": "https://storage.example"
   }]
}
```

