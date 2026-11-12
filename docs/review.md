# Website improvement review — 2026-11-12

## What changed

The home page now leads from services to five selected projects, the project process, support options, and an enquiry action. The main navigation has five customer-facing entries. ECAA remains prominent and retains its original images. CodeRush, Tewahedo Daily, NetShield, and AstraFocus have current live-site screenshots and case-study pages. Project image, case-study, and live-site links work independently. Full-size screenshots open in an accessible dialog when JavaScript runs and remain direct image links without it.

Six thinner service pages now explain cost factors, timing, preparation, and handover. Unconnected form notices appear before input fields, including on mobile. No endpoint was configured and no submission is represented as delivered.

## Review screenshots

- [Desktop home](review-assets/home-desktop.png)
- [Mobile home](review-assets/home-mobile.png)
- [Desktop portfolio](review-assets/portfolio-desktop.png)
- [Mobile portfolio](review-assets/portfolio-mobile.png)
- [Mobile quote form](review-assets/quote-mobile.png)

Chromium screenshots were taken with reduced motion after scrolling lazy images into view. Project screenshot URLs, dimensions, and capture notes are in [the asset manifest](asset-manifest.md).

## Featured work

| Project | Case study | Verified public site |
|---|---|---|
| ECAA | `/portfolio/ecaa/` | Public deployment not confirmed |
| CodeRush | `/portfolio/coderush/` | https://eskinder185.github.io/CodeRush/ |
| Tewahedo Daily | `/portfolio/tewahedo-daily/` | https://tewahedodaily.pages.dev/ |
| NetShield | `/portfolio/netshield/` | https://eskinder185.github.io/NetShield/ (synthetic-data preview) |
| AstraFocus | `/portfolio/astrafocus/` | https://eskinder185.github.io/AstraFocusNexus/ |

Tewahedo Daily's repository separates documented local work from deployed capabilities; the case study makes that distinction. AstraFocus screenshots use a fictional task in isolated browser contexts.

## Validation

- `npm run typecheck`: passed.
- `node --test tests/enquiries.test.mjs`: 8 of 8 passed, including six form routes and rejection/retry cases.
- `npm run build`, `npm run build:pages`, and the legacy `node scripts/prepare-pages.mjs`: passed. The Pages artifact has 67 generated HTML files, 122 public files, zero content placeholders, all generated internal links resolved, and no base-path leaks. The exact `BASE_PATH=/jemawe` production command used by pull-request CI also passed.
- `tests/qa_site.py` at `/` and `/jemawe/`: each checked 66 routes at seven widths (462 loads), with zero page issues, 74 internal links checked with zero broken, and 13 of 13 interactions passed. Reports: `qa-results/bugfix-root/results.json` and `qa-results/bugfix-pages/results.json`.
- `tests/qa_eco.py` at `/jemawe/`: 13 of 13 checks passed, including no-JavaScript, no-WebGL, reduced-motion, input, resize, and cleanup paths. SwiftShader reported a software GPU ReadPixels stall at 375px; it is retained in `softwareDriverWarnings` and no site console errors or failed requests were observed. Report: `qa-results/bugfix-eco-final/results.json`.
- A deliberately sandboxed esbuild failure left the previous `dist/index.html` and `dist/js/hero3d.js` SHA-256 hashes unchanged, verifying the production build's preflight protection. The same build passed with normal filesystem access afterward.
- Axe was not available; these checks are not a WCAG audit. The Three.js hero bundle is 155 KB gzipped. Headless SwiftShader LCP measurements were 64 ms at 1440px and 68 ms at 390px; they are local lab values, not real-device performance.

## Unresolved owner details

- ECAA production URL, the nature of the engagement, and publication permission are unconfirmed; the page does not claim a paid client relationship.
- Live enquiry delivery remains disabled. See [enquiry setup](enquiries.md) for the Cloudflare Worker, Resend, destination inbox, and retention decisions needed before setting `formEndpoint`. A configured test endpoint was exercised only through Playwright interception.
- Business email, phone, hours, service area, rates, team details, and response commitments remain unset; no values were invented.
- No live production performance audit was run. Bundle output reports the Three.js hero at 155 KB gzipped; this is a build size, not a page-speed measurement.

## Branch and rollback

Work is in the local `improve-customer-journey` branch. The duplicate Pages workflow has been changed to pull-request checks only, and the production builder now bundles the hero before cleaning `dist/`. The existing draft pull request is https://github.com/Eskinder185/jemawe/pull/3; this update is not yet committed or pushed. No deployment was made. `AGENTS.md` requires approval before commit or push. Existing unrelated working-tree changes are left intact.

After an approved commit, rollback by reverting that commit on the branch and rebuilding `dist/`; do not reset the whole working tree because it contains unrelated changes. Before a commit, review the changed source and asset files and restore only the selected changes. Never hand-edit `dist/`.
