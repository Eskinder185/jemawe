# Home page 3D hero: "Jemawe Digital Ecosystem"

An interactive Three.js scene in the home page hero. A floating Jemawe core is surrounded by the three divisions:

| Object | Service | Hover | Click / tap | Goes to |
|---|---|---|---|---|
| Laptop showing a business website | Digital Solutions | Turns toward the cursor, screen brightens, glow rises | Brief camera focus, then navigates | `/services/#digital` |
| Monitor with a remote-session screen and a network of nodes | IT Services | Signal pulses speed up, connections brighten | same | `/services/remote-it-support/` |
| Exploded computer: motherboard, RAM, M.2 SSD, CPU cooler with fan, PSU | Computer Repair & Upgrades | Parts float apart, RAM and SSD glow | same | `/services/computer-repair/` |

## Progressive enhancement (the most important rule)

The hero is complete **without** the 3D scene:

- The headline, text, CTAs, and a semantic `<ul>` of the three service links are plain HTML.
- The decorative SVG system map is the default visual (`.eco__fallback`).
- The 3D canvas only replaces that SVG, and only after its first frame has actually rendered.
- The canvas is `aria-hidden`. The HTML links are the accessible equivalent, and they drive the scene: hovering or focusing a link highlights its object.
- Labels are DOM text copied from the links, never drawn in WebGL.

| Situation | What visitors get |
|---|---|
| JavaScript off | Headline, CTAs, SVG diagram, service links |
| No WebGL | Same (state `fallback:no-webgl`), and the 3D bundle is never downloaded |
| Save-Data, 2G, under 4 GB memory, or under 4 CPU cores | Same (state `fallback:constrained-device`) |
| Scene running slowly (90-frame average over 90 ms after one quality step) | Scene removes itself and the SVG returns (`fallback:slow`) |
| WebGL context lost | SVG returns (`fallback:context-lost`) |
| `prefers-reduced-motion` | Scene renders on demand only: no idle animation, intro, parallax, or scroll drift. Hover still highlights; click navigates immediately |
| Phones and touch screens | Lighter scene (fewer parts, no floating shapes, pixel ratio capped at 1.5). First tap previews with a label ("Tap again to open"), second tap opens |

Testing overrides: `/?eco=off` forces the fallback; `/?eco=force` skips only the device heuristics.

## Files

```
src/ts/eco-loader.ts      Part of the normal site JS (tsc). Capability checks, then lazy-loads the bundle when the
                          hero is on screen and the browser is idle. Downloads nothing if a check fails.
src/ts/hero3d/index.ts    mountEcosystem(root, options) -> cleanup(). Renderer, camera fit, intro, render loop,
                          picking, link sync, labels, scroll drift, adaptive quality, pause, disposal.
src/ts/hero3d/builders.ts Procedural geometry and materials for the core, the three modules, and ambient shapes.
src/ts/hero3d/textures.ts Canvas-drawn textures (website UI, remote session, PCB, chips, grille, glow). No image files.
src/styles/16-eco.css     Hero layout, stage, fallback/canvas swap, label, link list.
scripts/build-3d.mjs      esbuild: bundles hero3d + tree-shaken Three.js into dist/js/hero3d.js.
tests/qa_eco.py           Playwright tests for the hero.
```

`src/pages/index.html` holds the hero markup (`[data-eco]`). Nothing else on the site changed except shared JS init (`main.ts` calls `initEcosystem()`, which does nothing on other pages) and the stylesheet bundle.

## Why esbuild was added
Three.js r186 ships only unminified ES modules (about 2.1 MB). esbuild tree-shakes and minifies just this lazy-loaded bundle to **596 KB minified, 155 KB gzipped**. The rest of the site is still compiled by `tsc` alone, and esbuild is a dev dependency only.

```powershell
npm install
npm run build        # pages + tsc + 3D bundle
npm run build:3d     # only the 3D bundle
npm run typecheck    # site TS and hero3d TS (strict)
```

## Runtime safeguards
- **Lazy:** loads only when the hero is on screen, inside `requestIdleCallback`.
- **Chunked setup:** yields to the main thread between steps (renderer, environment, each module, shader compile per group with forced linking, texture uploads), so no single task is long.
- **Shader compile:** uses `compileAsync` (`KHR_parallel_shader_compile`) where the browser supports it.
- **Pixel ratio:** capped at 1.75 on desktop and 1.5 on phones; drops to 1 if measured frames are slow.
- **Pausing:** the render loop stops when the hero is offscreen (IntersectionObserver) or the tab is hidden.
- **Lean drawing:** no shadows or post-processing. Glow is a few additive sprites, and reflections come from a tiny generated environment (no HDR download). Repeated parts (fins, fan blades, network nodes, pulses, floating shapes) are instanced.
- **Cleanup:** `cleanup()` (also exposed as `root.ecoUnmount()`) cancels the loop, removes listeners and observers, and disposes every geometry, material, and texture plus the renderer, then restores the SVG.
- **Diagnostics:** `root.ecoDebug.stats()` reports draw calls, triangles, textures, pixel ratio, and frame time. `performance.mark("eco:*")` marks each setup step for profiling.

## Measured (2026-10-29, Playwright, headless Chromium 153)

Rendering used **SwiftShader, a software GPU**. These numbers are a worst case and do **not** predict frame rates on real GPUs. No frame rate is claimed for real devices; measure on target hardware with `tests/qa_eco.py` or browser dev tools.

| | Desktop 1440×900 | Phone 390×844 (lite) |
|---|---|---|
| Page `load` event | 260 ms | 158 ms |
| Largest Contentful Paint | 104 ms (hero text, unaffected by 3D) | 96 ms |
| Scene ready (first frame) | 709 ms after navigation | 542 ms |
| Longest main-thread task during load | 142 ms | 67 ms |
| Median / p95 frame time (software GPU) | 66.7 / 100.1 ms | 16.7 / 50 ms |
| Draw calls | 64 | 61 |
| Triangles | 9,908 | 9,068 |
| Geometries / textures in GPU memory | 37 / 12 | 34 / 10 |
| Canvas size | 750×563 CSS px | 358×269 CSS px |

Before setup was chunked, a single 874 ms task blocked the main thread, mostly the first frame's shader linking and texture uploads. Chunked compilation, forced per-group linking, and pre-uploaded textures removed it.

## Changing the scene
- Positions, sizes, and per-module hover behavior: `builders.ts` (`buildDigital`, `buildIt`, `buildHardware`).
- Composition bounds used to fit the camera: `halfW` and `halfH` in `index.ts` → `fit()`.
- Label side per module: `labelSide` in each builder (`"above"`, `"left"`, or `"right"`).
- Link destinations and text: the HTML list in `src/pages/index.html`. The scene reads them from there.
