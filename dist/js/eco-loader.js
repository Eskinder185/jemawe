/**
 * Decides whether the home page 3D "Digital Ecosystem" should load, then
 * lazy-loads it. Nothing about Three.js is downloaded unless every check passes.
 *
 * The SVG diagram and the HTML service links are always present, so if this
 * module bails out at any point the hero stays complete and usable.
 *
 * Opt-outs (for testing or support):  ?eco=off   forces the fallback
 *                                     ?eco=force skips the device heuristics
 */
const BUNDLE_URL = "/js/hero3d.js";
function webglAvailable() {
    try {
        const canvas = document.createElement("canvas");
        const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl"));
        if (!gl)
            return false;
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return true;
    }
    catch {
        return false;
    }
}
function deviceTooConstrained() {
    const nav = navigator;
    if (nav.connection?.saveData)
        return true;
    if (nav.connection?.effectiveType && /(^|-)2g$/.test(nav.connection.effectiveType))
        return true;
    if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4)
        return true;
    if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency < 4)
        return true;
    return false;
}
export function initEcosystem() {
    const root = document.querySelector("[data-eco]");
    if (!root)
        return;
    const mode = new URLSearchParams(window.location.search).get("eco");
    const setState = (state) => {
        root.dataset.ecoState = state;
    };
    if (mode === "off") {
        setState("fallback:disabled");
        return;
    }
    const force = mode === "force";
    if (!webglAvailable()) {
        setState("fallback:no-webgl");
        return;
    }
    if (!force && deviceTooConstrained()) {
        setState("fallback:constrained-device");
        return;
    }
    const options = {
        lite: window.matchMedia("(max-width: 767px), (pointer: coarse)").matches,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        force,
    };
    let started = false;
    const start = () => {
        if (started)
            return;
        started = true;
        setState("loading");
        performance.mark("eco:import-start");
        import(/* webpackIgnore: true */ BUNDLE_URL)
            .then((mod) => mod.mountEcosystem(root, options))
            .then((cleanup) => {
            // Explicit teardown hook (used by tests; also handy if the hero is ever removed dynamically).
            root.ecoUnmount = cleanup;
            if (root.dataset.ecoState === "loading")
                setState("mounted"); // "ready" is set by the first rendered frame
        })
            .catch(() => setState("fallback:error"));
    };
    // Wait until the hero is on screen and the main thread is idle, so the page
    // itself is never delayed by the 3D bundle.
    const whenIdle = (cb) => {
        const w = window;
        if (w.requestIdleCallback)
            w.requestIdleCallback(cb, { timeout: 1500 });
        else
            window.setTimeout(cb, 300);
    };
    const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
            io.disconnect();
            whenIdle(start);
        }
    });
    io.observe(root);
}
//# sourceMappingURL=eco-loader.js.map