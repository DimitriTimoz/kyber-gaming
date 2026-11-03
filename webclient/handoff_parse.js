// Project Kyber: handoff_parse.js
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

// Pure parsing and validation for the #kyber= URL fragment.
// Everything here must be runnable outside a browser (for testing).

import * as v from "valibot";

export const HASH_MAX_LEN = 8192;

// Host shape shared by both handoff forms: a hostname, an IPv4 address or a
// bracketed IPv6 address. Rejects URL-special characters to prevent URL
// injection in applyFreshToken.
const HOST_RE = /^(?:[a-zA-Z0-9.-]+|\[[0-9a-fA-F:.]+\])$/;

// Machine id allowed characters. It goes straight into the :refresh-connection
// URL path, so it must not carry slashes or other URL-special characters. A
// short name or a UUID both fit.
const MACHINE_ID_RE = /^[a-zA-Z0-9._-]+$/;

// Decodes base64url input as UTF-8. The portal strips the padding and JWT
// segments carry none; fromBase64 accepts a missing final padding. Needs
// Chrome/Edge 140, Firefox 133 or Safari 18.2 (Baseline September 2025);
// older browsers throw here and the callers report a parse error.
function b64urlDecode(value) {
    const bytes = Uint8Array.fromBase64(value, { alphabet: "base64url" });
    return new TextDecoder().decode(bytes);
}

// Parses a location.hash value into a handoff object. Returns null if the
// fragment is not a kyber handoff, or { error } if it is malformed. origin is
// { hostname, port, protocol } from the page, used only by the raw-token form.
// A bare JWT ("<h>.<p>.<s>") always has dots and a base64 envelope never does,
// which is how the two forms are told apart.
export function parseHandoffFragment(rawHash, origin) {
    if (!rawHash.startsWith("#kyber=")) return null;
    if (rawHash.length > HASH_MAX_LEN) return { error: "invalid" };

    const value = rawHash.slice("#kyber=".length);
    return value.includes(".") ? parseRawTokenHandoff(value, origin) : parseEnvelopeHandoff(value);
}

// True for loopback hosts, where plaintext http carries no exposure because the
// request never leaves the machine. Covers localhost and the reserved .localhost
// TLD (both resolve to loopback) plus the IPv4 127/8 range and IPv6 ::1.
function isLoopbackHost(hostname) {
    const h = hostname.replace(/^\[|\]$/g, "");
    return (
        h === "localhost" ||
        h.endsWith(".localhost") ||
        h === "::1" ||
        /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)
    );
}

// kyhub base URL: https, or http on a loopback host so a local dev kyhub works
// (that request never leaves the machine). Rebuilt from origin and path, so
// user info, query, fragment and a trailing slash are dropped.
const KyhubUrl = v.pipe(
    v.string(),
    v.check((raw) => {
        if (!URL.canParse(raw)) return false;
        const { protocol, hostname } = new URL(raw);
        return protocol === "https:" || (protocol === "http:" && isLoopbackHost(hostname));
    }, "must be an https URL, or http on a loopback host"),
    v.transform((raw) => {
        const url = new URL(raw);
        return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
    }),
);

// The portal omits the port of an https endpoint on the default port.
const Endpoint = v.object({
    host: v.pipe(v.string(), v.regex(HOST_RE)),
    port: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535)), 443),
});

// Only the first endpoint is used. exp is optional: the token's own claim is
// preferred and checked at start. The refresh fields are all-or-nothing: a
// refresh_token without a valid kyhub_url and kyhub_machine_id is a malformed
// envelope, not a session without renewal.
const Envelope = v.intersect([
    v.object({
        v: v.literal(1),
        token: v.pipe(v.string(), v.nonEmpty()),
        exp: v.optional(v.pipe(v.number(), v.gtValue(0))),
        endpoints: v.tupleWithRest([Endpoint], v.unknown()),
    }),
    v.variant("refresh_token", [
        v.object({
            refresh_token: v.pipe(v.string(), v.nonEmpty()),
            kyhub_url: KyhubUrl,
            kyhub_machine_id: v.pipe(v.string(), v.regex(MACHINE_ID_RE)),
        }),
        v.object({ refresh_token: v.optional(v.undefined()) }),
    ]),
]);

// Raw-token fallback for direct links: the fragment is a bare access token.
// The web client is served by the controller it connects to, so host/port
// come from the page origin and exp from the token's own claim. It carries no
// refresh material, so the session ends when the token expires. Safe only
// against a controller that enforces audience validation, which scopes the
// token to this controller.
export function parseRawTokenHandoff(token, origin) {
    if (token.length === 0) return { error: "invalid" };

    const exp = jwtExp(token);
    if (typeof exp !== "number" || exp <= 0) return { error: "parse" };

    const host = origin.hostname;
    const port = origin.port
        ? Number(origin.port)
        : origin.protocol === "https:" ? 443 : 80;
    if (
        host.length === 0 || !HOST_RE.test(host) ||
        !Number.isInteger(port) || port < 1 || port > 65535
    ) {
        return { error: "invalid" };
    }

    return { token, exp, host, port, kyhubUrl: null, machineId: null, refreshToken: null };
}

// Full form: base64(JSON) envelope carrying the token and endpoint plus the
// material for the web-direct refresh (kyhub_url, kyhub_machine_id,
// refresh_token). The web client renews on its own by calling kyhub's
// :refresh-connection before the token expires; there is no opener, the portal
// opens the tab with noopener.
export function parseEnvelopeHandoff(value) {
    let payload;
    try {
        payload = JSON.parse(b64urlDecode(value));
    } catch (err) {
        console.warn("Handoff envelope is not base64 JSON:", err);
        return { error: "parse" };
    }

    const result = v.safeParse(Envelope, payload);
    if (!result.success) {
        console.warn("Handoff envelope rejected:", v.summarize(result.issues));
        return { error: "invalid" };
    }
    const {
        token, exp = null, endpoints: [ep],
        kyhub_url = null, kyhub_machine_id = null, refresh_token = null,
    } = result.output;
    return {
        token,
        exp,
        host: ep.host,
        port: ep.port,
        kyhubUrl: kyhub_url,
        machineId: kyhub_machine_id,
        refreshToken: refresh_token,
    };
}

export function jwtClaims(token) {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        return JSON.parse(b64urlDecode(parts[1]));
    } catch (err) {
        console.warn("JWT payload is not base64 JSON:", err);
        return null;
    }
}

// Decodes the exp claim directly from the JWT payload. Does not rely on the
// top-level convenience exp field alone.
export function jwtExp(token) {
    const c = jwtClaims(token);
    return c && typeof c.exp === "number" ? c.exp : null;
}

// Reads the identity from the JWT payload (preferred_username, falling back to sub).
export function jwtIdentity(token) {
    const c = jwtClaims(token);
    return c ? (c.preferred_username ?? c.sub ?? null) : null;
}
