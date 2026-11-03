// Project Kyber: manager.js
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

// OidcManager owns the OIDC state for the page bootstrap and exposes
// high-level methods for the UI to call. ui.js never reads or mutates
// these fields directly; it only routes events into the manager.

import { OIDC_SESSION_KEY } from "./core.js";
import {
    startOidcFlowPopup,
    handleOidcCallback,
    purgeStaleOidcResults,
    popupWindowFeatures,
} from "./popup.js";
import { startOidcFlow, handleRedirectCallback } from "./redirect.js";
import { scheduleTokenRenewal, stopTokenRenewal } from "./renewal.js";
import * as script from "../script.js";

export class OidcManager {
    #updateStatus;
    #updateConfig;
    #getConfigValue;
    #renewalContext = null;
    #flowInProgress = false;
    // Incremented each time the client stops or Connect cancels. Async
    // handlers capture the value at entry; if it changes while they are
    // awaiting, they abort without touching shared state.
    #generation = 0;
    // Cached result for the current session. After the first popup login,
    // subsequent authentication_required events reuse this token instead
    // of opening another popup. Cleared on disconnect.
    #storedResult = null;
    // Popup opened synchronously in the Connect button handler while the
    // user gesture is still active. Consumed once by the
    // authentication_required handler.
    #pendingPopup = null;
    // When Connect cancels a live client, the async stopped event fires
    // shortly after. This flag tells the stopped handler to skip the
    // generation reset so it does not clobber the new connection.
    #suppressNextStopped = false;

    constructor({ updateStatus, updateConfig, getConfigValue }) {
        this.#updateStatus = updateStatus;
        this.#updateConfig = updateConfig;
        this.#getConfigValue = getConfigValue;
    }

    purgeStaleResults() {
        purgeStaleOidcResults();
    }

    // Called from the Connect button handler before doConnect runs, regardless
    // of which auth method the user picked. Resets state left over from any
    // previous connect (OIDC or not) and asks script.cancelAndDisconnect to
    // tear down the live client without the stopped event triggering OIDC
    // cleanup on the new generation.
    cancelInFlight() {
        this.#generation++;
        this.#flowInProgress = false;
        this.#storedResult = null;
        this.#stopRenewal();
        this.#closePendingPopup();
        if (script.isClientActive()) {
            // Tell the stopped handler to skip the generation reset; the new
            // connection incremented it above and owns the current generation.
            this.#suppressNextStopped = true;
            script.cancelAndDisconnect();
        }
    }

    // Called only when the active auth method is OIDC, after cancelInFlight.
    // Pre-opens the popup synchronously while the user gesture is still active
    // and primes Chrome's sticky-activation flag for AudioContext. Returns
    // false if the popup was blocked (caller should not proceed with doConnect).
    prepareOidcConnect() {
        // Create and immediately close a dummy AudioContext. This sets
        // Chrome's sticky-activation flag for the page permanently, so the
        // AudioContext the Wasm creates after the async OIDC flow + reconnect
        // starts in "running" state without needing a second gesture.
        new AudioContext().close();

        if (!this.#getConfigValue("oidc_popup")) return true;

        // Open the popup now, inside the click handler, while transient
        // activation is guaranteed active. Chrome blocks window.open called
        // later from inside the async WASM event callback chain.
        const popup = window.open("about:blank", "kyber_oidc_login", popupWindowFeatures());
        if (!popup) {
            this.#updateStatus("Popup blocked. Allow popups for this site.");
            return false;
        }
        try {
            // The script sets a sessionStorage flag that survives cross-site
            // redirects (Keycloak -> back to us), even after COOP clears
            // window.opener and window.name.
            popup.document.write("<!DOCTYPE html><html><head><title>Authenticating...</title></head>"
                + "<body style='font-family:sans-serif;padding:2em'><p>Connecting to identity provider...</p>"
                + "<script>sessionStorage.setItem('kyber_oidc_popup','1');<\/script></body></html>");
            popup.document.close();
        } catch { /* ignore if popup document is not writable */ }
        this.#pendingPopup = popup;
        return true;
    }

    onConnectFailed() {
        this.#closePendingPopup();
    }

    onDisconnect() {
        this.#stopRenewal();
    }

    async onAuthenticationRequired(event, uiClientListener) {
        if (this.#flowInProgress) return;

        // The server fires authentication_required for every reconnect attempt.
        // If we already logged in this session, reuse the stored token rather
        // than opening a new popup for each retry.
        if (this.#storedResult) {
            this.#stopRenewal();
            const client = script.updateCredentials({ type: "oidc", token: this.#storedResult.accessToken });
            if (client) this.#renewalContext = scheduleTokenRenewal(this.#storedResult, client, () => this.#onRenewalExhausted());
            return;
        }

        this.#stopRenewal();
        this.#flowInProgress = true;
        const gen = this.#generation;
        const popup = this.#pendingPopup;
        this.#pendingPopup = null;
        const usePopup = this.#getConfigValue("oidc_popup");

        let result = null;
        try {
            result = usePopup
                ? await startOidcFlowPopup(
                    this.#getConfigValue("host"),
                    this.#getConfigValue("port"),
                    event.issuer,
                    event.clientId,
                    popup,
                  )
                : await startOidcFlow(
                    this.#getConfigValue("host"),
                    this.#getConfigValue("port"),
                    event.issuer,
                    event.clientId,
                  );
        } catch (err) {
            console.error("OIDC flow failed:", err);
            this.#updateStatus("OIDC error: " + err.message);
            if (gen === this.#generation) {
                this.#flowInProgress = false;
                await script.doDisconnect();
            }
            return;
        }

        // Abort if the client stopped while we were waiting for the popup.
        // The stopped handler already reset #flowInProgress; touching it
        // here would clobber the new generation's flow.
        if (gen !== this.#generation) return;
        if (!result) {
            this.#flowInProgress = false;
            return;
        }

        await this.#completeLogin(result, uiClientListener, gen);
    }

    async #completeLogin(result, uiClientListener, gen) {
        this.#stopRenewal();
        this.#persistRefreshToken(result);
        this.#storedResult = result;
        this.#updateStatus("Logged in");
        try {
            await this.#updateConfig();
            const credentials = { type: "oidc", token: result.accessToken };
            const client = script.updateCredentials(credentials);
            if (client) {
                this.#renewalContext = scheduleTokenRenewal(result, client, () => this.#onRenewalExhausted());
            } else {
                const connected = await script.doConnect(uiClientListener, result.host, result.port, credentials);
                if (connected) this.#renewalContext = scheduleTokenRenewal(result, connected, () => this.#onRenewalExhausted());
            }
        } finally {
            if (gen === this.#generation) this.#flowInProgress = false;
        }
    }

    #onRenewalExhausted() {
        this.#updateStatus("OIDC token refresh failed; reconnect to re-authenticate");
    }

    onReconnectionFailed() {
        this.#stopRenewal();
        this.#flowInProgress = false;
        this.#generation++;
    }

    onStreamingStartFailed() {
        this.#stopRenewal();
    }

    onClientStopped(reason) {
        if (reason !== "requested" && reason !== "decode_error") return;
        if (this.#suppressNextStopped) {
            // This stop was triggered by Connect cancelling the previous client.
            // The new connection has already reset all OIDC state; skip here.
            this.#suppressNextStopped = false;
            return;
        }
        this.#closePendingPopup();
        this.#stopRenewal();
        this.#storedResult = null;
        this.#flowInProgress = false;
        this.#generation++;
    }

    // Called from the page load handler when ?code= or ?error= is in the URL.
    // Returns one of:
    //   { kind: "popup" }                   - popup is closing, ui should return
    //   { kind: "popup-error", err }        - popup callback threw, ui should render error
    //   { kind: "redirect", result }        - redirect callback returned a result, ui should build sidebar
    //   { kind: "redirect-error", err }     - redirect callback threw, ui should show error
    //   { kind: "stale" }                   - not a recognized callback, continue normal init
    async handleCallback() {
        // Detect popup context using three signals: window.opener (same-origin
        // openers), window.name (set on open, but Chrome clears it on cross-site
        // nav under COOP), and sessionStorage (written by our loading-page script
        // before the popup navigates to Keycloak, persists across the redirect).
        const inPopup = window.opener !== null
            || window.name === "kyber_oidc_login"
            || sessionStorage.getItem("kyber_oidc_popup") === "1";
        if (inPopup) {
            try {
                await handleOidcCallback();
                return { kind: "popup" };
            } catch (err) {
                return { kind: "popup-error", err };
            }
        }
        try {
            const result = await handleRedirectCallback();
            if (result) return { kind: "redirect", result };
            return { kind: "stale" };
        } catch (err) {
            return { kind: "redirect-error", err };
        }
    }

    // Called from the page bootstrap when handleCallback returned a redirect
    // result. Persists the refresh token, caches the result, and connects.
    // Runs inside a click-to-start gesture provided by the caller.
    async finalizeRedirectLogin(result, uiClientListener) {
        const gen = this.#generation;
        await this.#completeLogin(result, uiClientListener, gen);
    }

    #stopRenewal() {
        if (this.#renewalContext) stopTokenRenewal(this.#renewalContext);
        this.#renewalContext = null;
    }

    #closePendingPopup() {
        if (this.#pendingPopup) {
            try { this.#pendingPopup.close(); } catch { /* ignore */ }
            this.#pendingPopup = null;
        }
    }

    #persistRefreshToken(result) {
        if (!result.refreshToken) return;
        sessionStorage.setItem(OIDC_SESSION_KEY, JSON.stringify({
            host: result.host,
            port: result.port,
            clientId: result.clientId,
            issuer: result.issuer,
            refreshToken: result.refreshToken,
            providerMetadata: result.providerMetadata,
        }));
    }
}
