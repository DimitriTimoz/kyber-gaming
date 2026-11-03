// Project Kyber: renewal.js
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

// OIDC token refresh and renewal.
//
// AppAuth-JS does not schedule refreshes for us, so we run a timer
// 60s before access-token expiry, retry with a backoff, hand the new
// token to the wasm client, persist the rotated refresh token, and
// extend the controller session. Mode-agnostic: works for both popup
// and redirect logins.

import {
    AuthorizationServiceConfiguration,
    BaseTokenRequestHandler,
    TokenRequest,
    GRANT_TYPE_REFRESH_TOKEN,
} from "@openid/appauth";
import { AuthCredentials } from "./kyclient_wasm.js";
import { OIDC_SESSION_KEY, requestor } from "./core.js";

// Refresh retry backoff in seconds. Length = number of retries after the
// initial attempt (so 3 entries means up to 4 attempts total).
const RETRY_DELAYS_SEC = [30, 60, 120];

// Cap on the session/renew request so a hung controller does not stall the
// renewal timer indefinitely.
const RENEW_TIMEOUT_MS = 10000;

async function refreshOidcToken(clientId, refreshToken, providerMetadata) {
    const config = new AuthorizationServiceConfiguration({
        authorization_endpoint: providerMetadata.authorizationEndpoint,
        token_endpoint: providerMetadata.tokenEndpoint,
    });
    const tokenRequest = new TokenRequest({
        client_id: clientId,
        grant_type: GRANT_TYPE_REFRESH_TOKEN,
        refresh_token: refreshToken,
    });
    const handler = new BaseTokenRequestHandler(requestor);
    const tokens = await handler.performTokenRequest(config, tokenRequest);

    const exp = tokens.issuedAt + (tokens.expiresIn ?? 0);
    return {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken ?? null,
        refreshToken: tokens.refreshToken ?? refreshToken,
        exp,
    };
}

// Refreshes the OIDC token with exponential-ish backoff. Returns the new
// token bundle on success, or null once all retries are exhausted.
async function tryRefreshWithRetry(context) {
    const totalAttempts = RETRY_DELAYS_SEC.length + 1;
    for (const [attempt, delay] of [...RETRY_DELAYS_SEC, null].entries()) {
        try {
            return await refreshOidcToken(
                context.clientId,
                context.refreshToken,
                context.providerMetadata,
            );
        } catch (err) {
            if (delay !== null) {
                console.warn(`OIDC token refresh failed (attempt ${attempt + 1}/${totalAttempts}), retrying in ${delay}s:`, err);
                await new Promise((resolve) => setTimeout(resolve, delay * 1000));
            } else {
                console.error("OIDC token refresh failed after all retries, stopping renewal:", err);
                return null;
            }
        }
    }
}

// Applies a fresh access token to the wasm client and posts it to the
// controller session/renew endpoint. Returns {ok, status}.
export async function applyFreshToken(context, client, accessToken) {
    client.update_credentials(AuthCredentials.oidc(accessToken));
    // Bracket a bare IPv6 host; location.hostname already carries brackets.
    const hostPart = context.host.includes(":") && !context.host.startsWith("[")
        ? `[${context.host}]`
        : context.host;
    const resp = await fetch(
        `https://${hostPart}:${context.port}/session/renew?auth=oidc`,
        {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            credentials: "include",
            signal: AbortSignal.timeout(RENEW_TIMEOUT_MS),
        }
    );
    return { ok: resp.ok, status: resp.status };
}

// Schedules silent refresh 60s before expiry. Retries 3 times with 30/60/120s
// backoff before giving up. On success, updates the client's credentials and
// extends the controller session. onExhausted is called if all retries fail
// so callers can surface a user-visible warning.
export function scheduleTokenRenewal(context, client, onExhausted) {
    if (!context.refreshToken) {
        console.warn("No refresh token available, token renewal disabled");
        return null;
    }

    function scheduleNext() {
        const nowSec = Math.floor(Date.now() / 1000);
        const delaySec = Math.max(context.exp - nowSec - 60, 5);
        console.log(`OIDC token renewal scheduled in ${delaySec}s`);

        return setTimeout(async () => {
            const refreshed = await tryRefreshWithRetry(context);
            if (!refreshed) {
                context.timerId = null;
                onExhausted?.();
                return;
            }

            context.accessToken = refreshed.accessToken;
            context.refreshToken = refreshed.refreshToken;
            context.exp = refreshed.exp;

            // Persist the new refresh token immediately to ensure we can
            // always get a fresh token after a page reload.
            try {
                const stored = sessionStorage.getItem(OIDC_SESSION_KEY);
                if (stored) {
                    const session = JSON.parse(stored);
                    session.refreshToken = refreshed.refreshToken;
                    sessionStorage.setItem(OIDC_SESSION_KEY, JSON.stringify(session));
                }
            } catch (err) {
                console.error("OIDC session persistence failed:", err);
            }

            // Apply token and extend controller session. Warn on failure but
            // keep the timer running so the next refresh attempt can recover.
            try {
                const { ok, status } = await applyFreshToken(context, client, refreshed.accessToken);
                if (!ok) {
                    console.warn(`Session renewal failed (${status}), credentials updated for next reconnect`);
                }
            } catch (err) {
                console.error("OIDC session renewal failed:", err);
            }

            context.timerId = scheduleNext();
        }, delaySec * 1000);
    }

    context.timerId = scheduleNext();
    return context;
}

export function stopTokenRenewal(context) {
    if (context?.timerId) {
        clearTimeout(context.timerId);
        context.timerId = null;
    }
}
