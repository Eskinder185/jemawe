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

type EcoModule = { mountEcosystem: (root: HTMLElement, options: EcoOptions) => Promise<() => void> };
export type EcoOptions = { lite: boolean; reducedMotion: boolean; force: boolean };

const BUNDLE_URL = "/js/hero3d.js";

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function deviceTooConstrained(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
  if (nav.connection?.saveData) return true;
  if (nav.connection?.effectiveType && /(^|-)2g$/.test(nav.connection.effectiveType)) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return true;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency < 4) return true;
  return false;
}

export function initEcosystem(): void {
  const root = document.querySelector<HTMLElement>("[data-eco]");
  if (!root) return;
  const mode = new URLSearchParams(window.location.search).get("eco");
  const setState = (state: string): void => {
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

  const options: EcoOptions = {
    lite: window.matchMedia("(max-width: 767px), (pointer: coarse)").matches,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    force,
  };

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    setState("loading");
    performance.mark("eco:import-start");
    import(/* webpackIgnore: true */ BUNDLE_URL as string)
      .then((mod: EcoModule) => mod.mountEcosystem(root, options))
      .then((cleanup) => {
        // Explicit teardown hook (used by tests; also handy if the hero is ever removed dynamically).
        (root as HTMLElement & { ecoUnmount?: () => void }).ecoUnmount = cleanup;
        if (root.dataset.ecoState === "loading") setState("mounted"); // "ready" is set by the first rendered frame
      })
      .catch(() => setState("fallback:error"));
  };

  // Wait until the hero is on screen and the main thread is idle, so the page
  // itself is never delayed by the 3D bundle.
  const whenIdle = (cb: () => void): void => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 1500 });
    else window.setTimeout(cb, 300);
  };

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      whenIdle(start);
    }
  });
  io.observe(root);
}
