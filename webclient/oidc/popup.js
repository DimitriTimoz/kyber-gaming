// Project Kyber: popup.js
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

// OIDC popup-mode wrapper.
//
// Drives the OIDC core through a child window. The popup navigates to
// the IdP, comes back to a callback URL on our origin, and posts the
// result back to the opener via postMessage (with a localStorage key
// fallback when COOP severs window.opener).

import {
    OIDC_SESSION_KEY,
    buildAuthSession,
    readCallbackParams,
    exchangeAuthCode,
} from "./core.js";

const OIDC_RESULT_KEY = "kyber_oidc_result";

// Popup login deadline before we give up.
// Keycloak 17+ serves its login page with Cross-Origin-Opener-Policy: same-origin,
// which permanently severs window.opener. Polling popup.closed is therefore
// unreliable: the reference appears "closed" as soon as the popup navigates to
// Keycloak, producing an immediate false positive. We rely on postMessage (fast
// path, when opener is intact) and localStorage storage event (COOP fallback),
// with a timeout as the last resort.
const POPUP_LOGIN_TIMEOUT_MS = 2 * 60 * 1000;

const RESULT_TTL_MS = 5 * 60 * 1000;

// Picks popup dimensions from the available screen so the IdP login form
// fits on tiny laptops and does not stretch absurdly on large monitors.
// Centered on the available screen.
export function popupWindowFeatures() {
    const w = Math.min(Math.max(500, Math.floor(screen.availWidth * 0.4)), 800);
    const h = Math.min(Math.max(700, Math.floor(screen.availHeight * 0.7)), 900);
    const left = Math.max(0, Math.floor((screen.availWidth - w) / 2));
    const top = Math.max(0, Math.floor((screen.availHeight - h) / 2));
    return `width=${w},height=${h},left=${left},top=${top}`;
}

// preOpenedPopup: a window opened by the caller while a user gesture was still
// active (e.g. directly in the Connect button handler). Passing it here lets
// us skip the window.open call inside the async WASM callback chain, where
// Chrome's transient activation window has already expired.
export async function startOidcFlowPopup(host, port, issuer, clientId, preOpenedPopup = null) {
    let popup = preOpenedPopup;
    if (!popup) {
        // Fallback: try to open now (succeeds only if a user gesture is active).
        popup = window.open("about:blank", "kyber_oidc_login", popupWindowFeatures());
        if (!popup) {
            throw new Error("Popup blocked, allow popups for this site");
        }
    }
    try {
        const { authUrl, session } = await buildAuthSession(host, port, issuer, clientId);
        return await runPopupFlow(authUrl, session, popup);
    } catch (err) {
        if (!popup.closed) popup.close();
        throw err;
    }
}

// Popup mode stores session in localStorage (not sessionStorage) because the
// popup navigates through a cross-origin IdP page, leaving its sessionStorage
// for our origin empty when it lands back on our callback.
//
// The result comes back to the opener via two channels, in priority order:
//   1. postMessage from the callback page (window.opener.postMessage). Fast,
//      no shared storage needed.
//   2. Storage event on a per-state localStorage key. Fallback for IdPs that
//      send Cross-Origin-Opener-Policy headers, which sever window.opener
//      before the popup can call postMessage. We listen for the storage event
//      (fired by the browser when another window writes to localStorage) rather
//      than polling.
function runPopupFlow(authUrl, session, popup) {
    localStorage.setItem(OIDC_SESSION_KEY, JSON.stringify(session));
    popup.location.href = authUrl;

    const resultKey = `${OIDC_RESULT_KEY}_${session.state}`;
    return new Promise((resolve, reject) => {
        let settled = false;
        let timeoutId = null;

        function cleanup() {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            window.removeEventListener("message", onMessage);
            window.removeEventListener("storage", onStorage);
            try { if (!popup.closed) popup.close(); } catch { /* COOP severed reference */ }
        }

        function handleResult(data) {
            cleanup();
            if (data.error) reject(new Error(data.error));
            else resolve(data.result);
        }

        function onMessage(event) {
            if (event.origin !== window.location.origin) return;
            if (!event.data) return;
            if (event.data.type !== "oidc_result") return;
            if (event.data.state !== session.state) return;
            handleResult(event.data);
        }

        function onStorage(event) {
            if (event.key !== resultKey || event.newValue === null) return;
            localStorage.removeItem(resultKey);
            try {
                handleResult(JSON.parse(event.newValue));
            } catch (err) {
                cleanup();
                reject(new Error(`Corrupt OIDC result: ${err.message}`));
            }
        }

        window.addEventListener("message", onMessage);
        window.addEventListener("storage", onStorage);

        timeoutId = setTimeout(() => {
            cleanup();
            localStorage.removeItem(OIDC_SESSION_KEY);
            reject(new Error("OIDC login timed out"));
        }, POPUP_LOGIN_TIMEOUT_MS);
    });
}

// Runs in the popup window after the IdP redirect. Reads the session left in
// localStorage, exchanges the code, and posts the result back to the opener
// (postMessage, with a localStorage fallback when COOP severed window.opener).
// Always closes the popup.
export async function handleOidcCallback() {
    const { code, state: returnedState, error, errorDescription } = readCallbackParams();
    if (!code && !error) return null;

    const stored = localStorage.getItem(OIDC_SESSION_KEY);
    if (!stored) {
        // No session for this callback. Stale URL or wrong window. Close so
        // a stray popup does not stay open after a cancelled flow.
        window.close();
        return null;
    }
    const session = JSON.parse(stored);

    // Verify state BEFORE consuming the session. A stale popup from a cancelled
    // flow reads whatever session is in localStorage, which may belong to a new
    // in-progress flow. Checking first prevents it from removing that session
    // or writing an error to the new flow's result key.
    if (returnedState !== session.state) {
        window.close();
        return null;
    }
    localStorage.removeItem(OIDC_SESSION_KEY);

    const postBack = (payload) => {
        const message = { type: "oidc_result", state: session.state, ...payload };
        if (window.opener) {
            window.opener.postMessage(message, window.location.origin);
        } else {
            const resultKey = `${OIDC_RESULT_KEY}_${session.state}`;
            // Stamp the entry so purgeStaleOidcResults can drop it later if
            // the opener never read it (e.g. tab closed before postMessage).
            localStorage.setItem(resultKey, JSON.stringify({ ...payload, ts: Date.now() }));
        }
        window.close();
    };

    if (error) {
        postBack({ error: `IdP denied login: ${errorDescription ?? error}` });
        return null;
    }

    try {
        const result = await exchangeAuthCode(session, code);
        postBack({ result });
    } catch (err) {
        postBack({ error: err.message });
    }
    return null;
}

// Drops kyber_oidc_result_* entries the opener never consumed, e.g. when the
// user closed the main tab before the popup posted the result back. Called
// from the page bootstrap so stale tokens do not linger in localStorage.
export function purgeStaleOidcResults() {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(`${OIDC_RESULT_KEY}_`)) continue;
        try {
            const { ts } = JSON.parse(localStorage.getItem(key));
            if (typeof ts !== "number" || now - ts > RESULT_TTL_MS) {
                localStorage.removeItem(key);
            }
        } catch {
            localStorage.removeItem(key);
        }
    }
}
