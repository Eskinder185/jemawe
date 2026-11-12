# Website improvement review

## Screenshots

- [Mobile home](review-assets/home-mobile.png)
- [Desktop home](review-assets/home-desktop.png)
- [Desktop portfolio](review-assets/portfolio-desktop.png)
- [Mobile quote form](review-assets/quote-mobile.png)

Screenshots were captured in Chromium with reduced motion and images fully loaded.

## Validation

- Production build: 64 pages, zero visible content placeholders, all generated internal links resolved, 107 public output files, 3.76 MB in the `/jemawe/` build.
- Controlled backend tests: 8 passed, covering six enquiry routes, invalid data, cross-origin rejection, spam rejection, missing mail receipts, and retry idempotency keys.
- `tests/qa_site.py` root build: 63 pages across seven widths (441 page loads), zero page issues, 59 internal links checked with zero broken, and 12 of 12 interactions passed. Axe was unavailable, so this is not a WCAG audit.
- `tests/qa_eco.py`: 12 of 13 checks passed. The one failure is a SwiftShader software WebGL GPU stall warning at 375px; no broken requests or layout overflow were observed. The measured LCP in this headless run was 56 ms at 1440px and 104 ms at 390px. These are local software-rendering measurements, not production field data.
- GitHub Pages subpath build: passed with zero broken links or base-path leaks. Browser QA: 63 pages × seven widths, zero page issues, 59 links with zero broken, and 12 of 12 interactions passed. The generated report is at `qa-results/subpath-final/results.json` in the local workspace.

## Activation blockers

Live enquiry delivery is not enabled. The owner must provide a Cloudflare Worker account, a Resend API key, a verified sender, destination inboxes for general, projects, support, and repairs, and a privacy/retention decision. Then the six form flows must be tested against an authorized inbox before setting `formEndpoint`. See [enquiry setup](enquiries.md) and [owner checklist](owner-checklist.md). A provider acceptance receipt is distinct from inbox delivery.

The branch does not deploy or purchase a domain. A custom domain and branded email require owner-controlled DNS and mailbox setup.
