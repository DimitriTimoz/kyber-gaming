// Project Kyber: handoff.js
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

// Token-exchange web client handoff.
//
// The portal opens the web client in a new tab (with noopener) carrying a
// #kyber= fragment with a short-lived access token scoped to the machine client
// (handoff_parse.js documents the fragment forms). This module strips the
// fragment, connects, then drives the connection lifetime: for the envelope
// form it renews on its own by calling kyhub's :refresh-connection before the
// token expires, applies the fresh token to the controller, and reschedules.

import * as script from "./script.js";
import { applyFreshToken } from "./oidc/renewal.js";
import { parseHandoffFragment, jwtExp, jwtIdentity } from "./handoff_parse.js";

// Refresh fires this many seconds before token exp.
const REFRESH_LEAD_SEC = 30;
// Hard kill: session is dead at exp - KILL_WINDOW_SEC with no fresh token.
const KILL_WINDOW_SEC = 15;
// Backoff between refresh attempts, in seconds. Kept short: the token lives
// ~60s, so a stalled retry must not eat the whole margin before the kill window.
const REFRESH_RETRY_DELAYS_SEC = [5, 10];
// Per-attempt cap on the refresh-connection request. A hung fetch must not stall
// the whole margin; the expiry-notice timers still fire if the cap is exceeded.
const REFRESH_TIMEOUT_MS = 8000;
// Shown whenever the handoff cannot proceed and the user must restart from the
// portal (bad fragment, rejected token, refresh exhausted).
const REOPEN_PROMPT = "Reopen from the portal to connect";

// Reads the #kyber= fragment, strips it from the URL, and parses it. Returns a
// handoff object, { error }, or null if no handoff is present.
export function detectHandoff() {
    const rawHash = location.hash;
    if (!rawHash.startsWith("#kyber=")) return null;
    // Strip the fragment immediately, before any parse, so the token never
    // lingers. Other fragments pass through untouched; the OIDC redirect flow
    // preserves its own.
    history.replaceState(null, "", location.pathname + location.search);

    return parseHandoffFragment(rawHash, {
        hostname: location.hostname,
        port: location.port,
        protocol: location.protocol,
    });
}

// POSTs the refresh token to kyhub's :refresh-connection and returns the fresh
// { token, refreshToken, exp }. No cookies: the refresh token in the body is the
// only credential, so the request stays in non-credentials CORS mode. Throws on
// a non-2xx response or a malformed body.
async function refreshConnection(kyhubUrl, machineId, refreshToken) {
    const url = `${kyhubUrl}/machines/${encodeURIComponent(machineId)}:refresh-connection`;
    const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    if (!resp.ok) {
        const err = new Error(`refresh-connection returned ${resp.status}`);
        err.status = resp.status;
        throw err;
    }

    const data = await resp.json();
    const token = data.auth_token;
    if (typeof token !== "string" || token.length === 0) {
        throw new Error("refresh-connection response missing auth_token");
    }
    // Keycloak rotates the refresh token; keep the old one only if it declined to
    // issue a new one.
    const rotated =
        typeof data.auth_refresh_token === "string" && data.auth_refresh_token.length > 0
            ? data.auth_refresh_token
            : refreshToken;
    // The token's own exp claim wins; the response's auth_token_expires_at is
    // the fallback. No readable expiry is a fatal response, not a guess.
    const exp = jwtExp(token) ?? isoToUnix(data.auth_token_expires_at);
    if (exp === null) throw new Error("refresh-connection response has no readable expiry");
    return { token, refreshToken: rotated, exp };
}

// Unix seconds from an RFC 3339 timestamp, or null when absent or unreadable.
function isoToUnix(value) {
    if (typeof value !== "string") return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

// Drives the handoff connection lifetime. updateStatus is ui.js's function
// passed in by the caller. uiClientListener routes wasm events to the UI.
// Returns a function that ends the renewal, for the UI's disconnect paths: a
// session the user ended must not come back at the next refresh.
export async function startHandoff(handoff, uiClientListener, updateStatus) {
    if (handoff.error) {
        updateStatus(REOPEN_PROMPT);
        return () => {};
    }

    const { host, port, kyhubUrl, machineId } = handoff;
    let currentRefreshToken = handoff.refreshToken;

    // The envelope carries the web-direct refresh material; the raw-token
    // fallback does not, so it connects once and ends when the token expires.
    const refreshEnabled = Boolean(kyhubUrl && machineId && currentRefreshToken);

    let timers = [];
    // True once an expiry notice reached the UI; a late renewal must correct
    // the status it left behind.
    let expiryNoticeShown = false;
    let stopped = false;
    // Stops this handoff caused itself: cancelAndDisconnect makes the stale
    // client emit a stopped event, which reaches stop() through the UI. A
    // counter, not a flag, so a user stop during a reconnect still lands.
    let selfStops = 0;

    function clearTimers() {
        for (const t of timers) clearTimeout(t);
        timers = [];
    }

    function stop() {
        if (selfStops > 0) {
            selfStops--;
            return;
        }
        stopped = true;
        clearTimers();
    }

    const exp = jwtExp(handoff.token) ?? handoff.exp;
    if (exp === null) {
        updateStatus(REOPEN_PROMPT);
        return stop;
    }
    await connect(handoff.token, exp);
    return stop;

    async function connect(token, exp) {
        const identity = jwtIdentity(token);

        // Forward to the UI listener first: it writes generic statuses
        // ("Connected", "Unauthorized"), and the handoff-specific ones below
        // must land last so they are not overwritten.
        const handoffListener = async (name, event) => {
            await uiClientListener(name, event);
            if (name === "reconnection_failed") {
                clearTimers();
                return;
            }
            if (name === "controlplane_connect_failed" && event === "unauthorized") {
                clearTimers();
                updateStatus(REOPEN_PROMPT);
                return;
            }
            if (name === "controlplane_connected") {
                if (identity) {
                    updateStatus(`Connected as ${identity} to ${host}:${port}`);
                }
                scheduleRefresh(exp);
            }
        };

        try {
            await script.doConnect(handoffListener, host, port, { type: "oidc", token });
        } catch (err) {
            console.error("Handoff connect failed:", err);
            updateStatus(`Connection error: ${err.message}`);
        }
    }

    // Fetches a fresh token from kyhub, retrying with a short backoff. Returns
    // the fresh { token, refreshToken, exp } or null once all attempts fail.
    async function tryRefreshWithRetry() {
        for (const [attempt, delay] of [...REFRESH_RETRY_DELAYS_SEC, null].entries()) {
            try {
                return await refreshConnection(kyhubUrl, machineId, currentRefreshToken);
            } catch (err) {
                // A 4xx means kyhub rejected this refresh token or machine id;
                // the same request will not do better. Retry transport errors
                // and 5xx only.
                const rejected = typeof err.status === "number" && err.status < 500;
                if (rejected || delay === null) {
                    console.error("Token refresh failed:", err);
                    return null;
                }
                console.warn(`Token refresh failed (attempt ${attempt + 1}), retrying in ${delay}s:`, err);
                await new Promise((resolve) => setTimeout(resolve, delay * 1000));
            }
        }
    }

    // Renews the token: fetch a fresh one from kyhub, hand it to the controller,
    // rotate the stored refresh token, and reschedule the next renewal.
    async function doRefresh() {
        const refreshed = await tryRefreshWithRetry();
        if (stopped) return;
        if (!refreshed) {
            updateStatus(REOPEN_PROMPT);
            return;
        }

        currentRefreshToken = refreshed.refreshToken;
        const exp = refreshed.exp;

        let renewed = false;
        const wasmClient = script.getWasmClient();
        if (wasmClient) {
            try {
                const { ok, status } = await applyFreshToken({ host, port }, wasmClient, refreshed.token);
                renewed = ok;
                if (!ok) console.warn(`Session renew returned ${status}, reconnecting`);
            } catch (err) {
                console.warn("Session renew request failed, reconnecting:", err);
            }
        } else {
            console.warn("No wasm client, reconnecting with the fresh token");
        }

        if (stopped) return;
        if (renewed) {
            // A late renewal can land after an expiry notice fired (the retry
            // chain may outlast the refresh lead); correct the status so the
            // user does not reopen a live session.
            if (expiryNoticeShown) updateStatus("Session renewed");
            scheduleRefresh(exp);
            return;
        }

        // The wasm client is gone, the renew request failed, or the controller
        // rejected the cookie (e.g. a restart). A full reconnect re-logs in.
        if (script.isClientActive()) selfStops++;
        script.cancelAndDisconnect();
        await connect(refreshed.token, exp);
    }

    function scheduleRefresh(exp) {
        if (stopped) return;
        // Drop timers from the previous token so they do not stack up across
        // renewals and reconnects.
        clearTimers();
        expiryNoticeShown = false;

        if (!refreshEnabled) {
            scheduleExpiryNotice(exp);
            return;
        }

        const nowSec = Math.floor(Date.now() / 1000);
        const refreshIn = Math.max(exp - nowSec - REFRESH_LEAD_SEC, 1);
        timers.push(setTimeout(() => {
            doRefresh().catch((err) => console.error("doRefresh failed:", err));
        }, refreshIn * 1000));

        scheduleExpiryNotice(exp);
    }

    // Fallback UI: if no fresh token lands in time, warn near the kill window and
    // prompt to reopen once the session is dead.
    function scheduleExpiryNotice(exp) {
        const nowSec = Math.floor(Date.now() / 1000);
        const notice = refreshEnabled ? "Session expiring, renewing" : "Session expiring";
        timers.push(setTimeout(() => {
            expiryNoticeShown = true;
            updateStatus(notice);
        }, Math.max(exp - nowSec - KILL_WINDOW_SEC, 1) * 1000));
        timers.push(setTimeout(() => {
            expiryNoticeShown = true;
            updateStatus(REOPEN_PROMPT);
        }, Math.max(exp - nowSec, 1) * 1000));
    }
}
