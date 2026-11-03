// Project Kyber: core.js
// Copyright © 2022-2026 Kyber SAS
// SPDX-License-Identifier: LicenseRef-Kyber-Commercial OR AGPL-3.0-or-later
//
// This file is both under dual license: AGPLv3 and a Commercial one.
//
// ----
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// OIDC core for Kyber Web Client.
//
// PKCE auth-request setup, token exchange with ID token nonce
// validation, and callback URL parsing. Pure helpers driving
// AppAuth-JS, no UI or transport coupling. Imported by the popup,
// redirect, and renewal layers.

import {
    AuthorizationRequest,
    AuthorizationServiceConfiguration,
    BaseTokenRequestHandler,
    FetchRequestor,
    RedirectRequestHandler,
    TokenRequest,
    GRANT_TYPE_AUTHORIZATION_CODE,
} from "@openid/appauth";

export const OIDC_SESSION_KEY = "kyber_oidc";

export const requestor = new FetchRequestor();

function buildRedirectUri() {
    const pathname = window.location.pathname.replace(/\/+/g, "/");
    return window.location.origin + pathname;
}

function generateNonce() {
    return crypto.getRandomValues(new Uint8Array(32)).toBase64({
        alphabet: "base64url",
        omitPadding: true,
    });
}

function decodeJwtPayload(jwt) {
    const parts = jwt.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT format");
    try {
        const bytes = Uint8Array.fromBase64(parts[1], { alphabet: "base64url" });
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        throw new Error("JWT payload is not valid base64-encoded JSON");
    }
}

// Builds an AppAuth AuthorizationRequest with PKCE and a nonce. Delegates URL
// construction to AppAuth's RedirectRequestHandler (including PKCE generation
// and standard OIDC encoding) by intercepting its locationLike.assign call.
// Returns only the scalars the caller needs so the internal AppAuth request
// object does not leak out of this module.
async function prepareAuthRequest(config, clientId, redirectUri) {
    const nonce = generateNonce();
    const request = new AuthorizationRequest({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "openid email offline_access",
        response_type: AuthorizationRequest.RESPONSE_TYPE_CODE,
        extras: { nonce },
    });

    const url = await Promise.race([
        new Promise((resolve) => {
            // Storage backend that drops everything. AppAuth's
            // RedirectRequestHandler writes the outgoing request + config to
            // storage so a later callback can read them back; we manage that
            // ourselves in OIDC_SESSION_KEY, so we pass this to avoid
            // polluting localStorage.
            const noopStorage = {
                getItem: () => Promise.resolve(null),
                setItem: () => Promise.resolve(),
                removeItem: () => Promise.resolve(),
                clear: () => Promise.resolve(),
            };
            const captureLocation = { assign: resolve, hash: "", href: "", origin: "" };
            new RedirectRequestHandler(noopStorage, undefined, captureLocation)
                .performAuthorizationRequest(config, request);
        }),
        new Promise((_, reject) => setTimeout(
            () => reject(new Error("AppAuth-JS did not produce an authorization URL")),
            5000,
        )),
    ]);

    return {
        state: request.state,
        codeVerifier: request.internal.code_verifier,
        url,
        nonce,
    };
}

// Common path for any OIDC flow: fetch the issuer config, build the PKCE
// authorization request, and assemble the session record the caller will
// reload after the IdP callback.
export async function buildAuthSession(host, port, issuer, clientId) {
    const config = await AuthorizationServiceConfiguration.fetchFromIssuer(issuer, requestor);
    const redirectUri = buildRedirectUri();
    const { state, codeVerifier, url, nonce } = await prepareAuthRequest(config, clientId, redirectUri);

    // We store codeVerifier and redirectUri explicitly instead of relying on
    // AppAuth's internal field: it is only exposed via AuthorizationRequest.toJson(),
    // which is async, returns a plain object, and does not round-trip reliably
    // through JSON.stringify across every AppAuth-JS version.
    const session = {
        host,
        port,
        clientId,
        issuer,
        state,
        nonce,
        codeVerifier,
        redirectUri,
        configJson: config.toJson(),
    };

    return { authUrl: url, session };
}

export function readCallbackParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        code: urlParams.get("code"),
        state: urlParams.get("state"),
        error: urlParams.get("error"),
        errorDescription: urlParams.get("error_description"),
    };
}

// Exchanges the authorization code for tokens, validates the ID token nonce,
// and assembles the result the application consumes. Throws on any token-side
// failure; the caller decides how to surface it.
export async function exchangeAuthCode(session, code) {
    // Sending the exact same redirectUri string we sent to /authorize matters:
    // Keycloak compares it byte-for-byte.
    const config = new AuthorizationServiceConfiguration(session.configJson);
    const tokenRequest = new TokenRequest({
        client_id: session.clientId,
        redirect_uri: session.redirectUri,
        grant_type: GRANT_TYPE_AUTHORIZATION_CODE,
        code,
        extras: { code_verifier: session.codeVerifier },
    });

    const tokenHandler = new BaseTokenRequestHandler(requestor);
    const tokens = await tokenHandler.performTokenRequest(config, tokenRequest);

    // We do not verify the ID token's JWS signature: the token came over TLS
    // straight from the IdP token endpoint and PKCE proves we initiated this
    // request, so transport security plus the nonce check below cover the
    // attack surface a browser-side client can reasonably defend against.
    if (!tokens.idToken) throw new Error("IdP did not return an ID token");
    const payload = decodeJwtPayload(tokens.idToken);
    if (payload.nonce !== session.nonce) throw new Error("ID token nonce mismatch");

    const exp = tokens.issuedAt + (tokens.expiresIn ?? 0);
    return {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken ?? null,
        host: session.host,
        port: parseInt(session.port, 10),
        exp,
        clientId: session.clientId,
        issuer: session.issuer,
        providerMetadata: {
            tokenEndpoint: config.tokenEndpoint,
            authorizationEndpoint: config.authorizationEndpoint,
        },
    };
}
