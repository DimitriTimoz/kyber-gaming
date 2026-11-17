/**
 * Client Auto-Resizer for Kyber Cloud Gaming Web Client
 * Automatically reports browser window / screen viewport dimensions to the
 * container Kyber Control Plane service (port 8081) to adjust the X11 resolution on the fly.
 */
(() => {
    let resizeTimer = null;
    let lastSent = "";

    function reportResolution() {
        // Use devicePixelRatio for high-DPI (Retina/4K) displays or standard dimensions
        const dpr = window.devicePixelRatio || 1;
        // Take viewport or screen dimensions
        let width = Math.round(window.innerWidth * (dpr > 1.25 ? 1.5 : 1));
        let height = Math.round(window.innerHeight * (dpr > 1.25 ? 1.5 : 1));

        // Round to even numbers
        width = Math.floor(width / 2) * 2;
        height = Math.floor(height / 2) * 2;

        const key = `${width}x${height}`;
        if (key === lastSent) return;

        const port = window.location.port;
        const isProxyPort = !port || port === "80" || port === "443";
        const url = isProxyPort
            ? "/api/resize"
            : `${window.location.protocol}//${window.location.hostname}:8081/api/resize`;

        const headers = { "Content-Type": "application/json" };
        try {
            const u = localStorage.getItem("kyber_auth_user");
            const p = localStorage.getItem("kyber_auth_pass");
            if (u && p) {
                headers["Authorization"] = "Basic " + btoa(`${u}:${p}`);
            }
        } catch (_) {}

        console.log(`[Kyber AutoResize] Requesting server display change to ${width}x${height}...`);

        fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ width: width, height: height, rate: 60 })
        })
        .then(res => res.json())
        .then(data => {
            console.log("[Kyber AutoResize] Server display resolution adapted successfully:", data);
            lastSent = key;
        })
        .catch(err => {
            // Non-blocking log if control plane port 8081 is not reached
            console.warn("[Kyber AutoResize] Could not contact Kyber control service:", err.message);
        });
    }

    // Report resolution on initial connection
    window.addEventListener("load", () => {
        setTimeout(reportResolution, 1500);
    });

    // Report resolution on window resize with 600ms debounce
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(reportResolution, 600);
    });
})();
