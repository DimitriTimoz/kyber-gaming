// Project Kyber: redirect.js
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

// OIDC redirect-mode wrapper.
//
// Drives the OIDC core by navigating the main window to the IdP. The
// session waits in sessionStorage across the redirect and the result
// is recovered on the next page load via handleRedirectCallback.

import {
    OIDC_SESSION_KEY,
    buildAuthSession,
    readCallbackParams,
    exchangeAuthCode,
} from "./core.js";

export async function startOidcFlow(host, port, issuer, clientId) {
    const { authUrl, session } = await buildAuthSession(host, port, issuer, clientId);
    // Stash the current URL search so handleRedirectCallback can restore it
    // after the IdP roundtrip. The redirect_uri does not include the query
    // string, so the IdP would otherwise come back with only the OIDC
    // params and the user's host/port/etc. would be lost.
    sessionStorage.setItem(OIDC_SESSION_KEY, JSON.stringify({
        ...session,
        urlSearch: window.location.search,
    }));
    window.location.href = authUrl;
}

// Strips the OIDC params (including session_state and iss from RFC 9207) but
// keeps any other query parameters the user set, so a refresh does not replay
// the callback while host/port/etc. survive.
function stripOidcParamsFromUrl() {
    const url = new URL(window.location.href);
    for (const k of ["code", "state", "error", "error_description", "session_state", "iss"]) {
        url.searchParams.delete(k);
    }
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

// Replaces the current URL search string with the one captured before the
// IdP roundtrip, so any host/port/etc. params the user had survive the
// callback. The captured search has no OIDC params (it was taken before
// the navigation), so no stripping is needed.
function restoreUrlSearch(session) {
    if (typeof session.urlSearch !== "string") {
        stripOidcParamsFromUrl();
        return;
    }
    window.history.replaceState(null, "", window.location.pathname + session.urlSearch + window.location.hash);
}

// Runs on the main window after returning from the IdP. Reads the session
// left in sessionStorage, exchanges the code, and returns the result to the
// caller.
export async function handleRedirectCallback() {
    const { code, state: returnedState, error, errorDescription } = readCallbackParams();
    if (!code && !error) return null;

    const stored = sessionStorage.getItem(OIDC_SESSION_KEY);
    if (!stored) {
        // Stale URL from a previous page load. Clean and ignore silently.
        stripOidcParamsFromUrl();
        return null;
    }
    const session = JSON.parse(stored);

    if (returnedState !== session.state) {
        stripOidcParamsFromUrl();
        return null;
    }
    sessionStorage.removeItem(OIDC_SESSION_KEY);
    restoreUrlSearch(session);

    if (error) throw new Error(`IdP denied login: ${errorDescription || error}`);
    return await exchangeAuthCode(session, code);
}
