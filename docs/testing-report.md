# Testing report

**Date:** 2026-10-29
**Tool:** Playwright with Chromium 153 (`tests/qa_site.py`), axe-core 4.10.3
**Build tested:** `dist/` from `npm run build`, served by `scripts/serve.mjs` on 127.0.0.1:5500
**Environment:** a cloud Linux workspace. The site was not tested on your Windows machine or in Edge, Firefox, or Safari (see Limitations).

Every result below was observed in a real browser run. Nothing is estimated.

## Summary

| Check | Result |
|---|---|
| Pages tested | 63 pages (plus the 404 page, tested separately) |
| Widths | 375, 390, 768, 1024, 1440, 1920 px: 378 page loads |
| HTTP status | All 200 |
| Console errors or page exceptions | 0 |
| Failed network requests | 0 (fonts are self-hosted, nothing external loads) |
| Horizontal overflow | 0 (element-edge check, not just `scrollWidth`) |
| Broken images | 0 |
| Images without `alt` | 0 |
| Exactly one `h1` per page | Yes, all pages |
| Duplicate `id`s | 0 |
| Titles and meta descriptions | Present on every page |
| Internal links (unique targets) | 62 checked, 0 broken; the build also fails on any missing link or asset |
| Automated accessibility (axe, WCAG 2 A/AA, 2.1 AA, 2.2 AA) | 0 violations at 1440 and 375 px on all pages |
| Interaction tests | 12 of 12 passed |

## Interaction tests

| Test | Observed |
|---|---|
| Mega menu | Enter opens, ArrowDown moves into the panel, Escape closes and returns focus to the trigger, hover opens, clicking outside closes |
| Mobile menu | Hidden when closed (links not focusable), opens full height (771px at 390×844), background `inert`, focus moves in and stays trapped over 60 Tab presses, Escape closes and returns focus to the toggle |
| Quote form (multi-step) | Blocks an empty step, advances when valid, hides and disables irrelevant fields, flags an invalid email ("Enter an email address in the format name@example.com."), review step lists answers, consent required, and on valid submit shows the honest "not connected" status with no redirect |
| Form endpoint paths (fake endpoint intercepted) | A 200 response redirects to `/thank-you/`; a 500 response stays on the page with an error and keeps the answers |
| URL prefill | `/quote/?service=repair` and `/book-repair/?service=upgrade` preselect correctly |
| FAQ search | "password" matches 1 of 24; nonsense shows the empty message |
| Filters | Portfolio "Websites" shows 1 project with `aria-pressed`; `/insights/#computer-maintenance` preselects the filter |
| Restaurant menu demo tabs | Click switches panels; arrow keys move between tabs |
| Reduced motion | Hero and revealed content render at full opacity immediately |
| JavaScript disabled | Content visible; FAQ works (native `details`); all form steps shown |
| 404 | Unknown URL returns HTTP 404 with the branded page |
| Back to top | Appears after scrolling; click returns to the top |

## 3D home hero (`tests/qa_eco.py`)

Run with `/?eco=force` (skips only the low-power heuristic, because the test container has 2 CPU cores) and SwiftShader software WebGL. **13 of 13 checks passed:**

| Check | Result |
|---|---|
| Init and layout at 375, 390, 768, 1024, 1440, 1920 | Scene mounts, canvas fits the stage, no overflow, headline and CTAs visible, 0 console errors |
| Resize | Canvas and camera refit with no distortion |
| Mouse hover and click | Each of the 3 objects shows its label and highlights its link card; click focuses the camera and opens the right page |
| Touch | First tap previews ("Tap again to open"), second tap opens |
| Keyboard | Tab through the 3 service links highlights each object; Enter opens it. The canvas is never a tab stop |
| CTAs and navigation | Explore services → `/services/`, Get a quote → `/quote/` |
| Reduced motion | No idle animation; renders only on interaction; click navigates immediately |
| JavaScript off | Headline, CTAs, SVG diagram, and links all present |
| No WebGL | SVG fallback, and `hero3d.js` is never requested |
| Unforced heuristics | Low-power device falls back without downloading the bundle |
| Pause and cleanup | Rendering stops offscreen; `ecoUnmount()` disposes everything and restores the SVG |
| Performance | See `docs/hero-3d.md` (software GPU, worst case: scene ready 709 ms desktop / 542 ms phone, longest task 142 / 67 ms) |
| axe with the 3D scene running | 0 violations |

After the 3D work, the full site suite above was re-run with no regressions.

**Not verified for 3D:** a real GPU, Firefox, Safari, and the hidden-tab pause (headless Chromium cannot hide a tab; the code path uses `visibilitychange`).

## Defects found and fixed during testing

1. **Mobile menu invisible.** The header's `backdrop-filter` made it the containing block for the fixed-position menu, so the panel had zero height. Moved the menu outside the header.
2. **Contrast.** The brief's secondary text `#64748B` measured 4.48:1 on the soft-gray sections (AA needs 4.5:1), and electric-blue links on dark panels measured 3.61:1. Muted text is now `#5F6F86` (4.81:1 on soft gray, 4.64:1 on hover backgrounds). Links on dark surfaces use `#93B4FD` (9.07:1).
3. **Scrollable tables** were not keyboard reachable. They now have `tabindex="0"`, `role="region"`, and a label.
4. **Overflow at 375 and 390px** on two articles with tables: the grid column stretched to fit the table. Fixed with `min-width: 0`.
5. **Hidden overflow masked by the `overflow-x: clip` safety net.** The test was tightened to measure element edges. It found the honeypot spam field positioned at `left: -9999px`, which now uses clip-based hiding.
6. **Unverified claim removed.** "Free consultation" appeared in several places without confirmation and was replaced with neutral wording plus a placeholder.

## Limitations (not verified)

- **Other browsers:** only Chromium was tested. Edge (Chromium-based) should match; Firefox and Safari still need a manual check, especially the mega menu hover and form date inputs.
- **Your local setup:** not run from `C:\Users\eskew\github\jemawe` on Windows. Run `npm run build` and `npm run serve` there and spot-check.
- **External links:** two project links (`eskinder185.github.io/professionaldev/`, `tewahedodaily.pages.dev`) come from the projects' own documentation but could not be opened from the test environment.
- **Form delivery:** no form service is connected, so real delivery cannot be tested yet. Only the success and failure handling was verified, against an intercepted endpoint.
- **Screen readers:** axe and keyboard tests passed, but no manual NVDA or VoiceOver pass was done.
- **Performance:** no Lighthouse run. Pages are static, with one CSS file (about 60 KB uncompressed), about 30 KB of uncompressed JS modules (plus the lazy 3D bundle: 155 KB gzipped, home page only), self-hosted fonts, and lazy-loaded WebP images, but no scores were measured.
