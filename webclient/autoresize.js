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

        const port = 8081;
        const protocol = window.location.protocol;
        const url = `${protocol}//${window.location.hostname}:${port}/api/resize`;

        console.log(`[Kyber AutoResize] Requesting server display change to ${width}x${height}...`);

        fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
