# Development roadmap and implementation checklist

## Status by milestone

| # | Milestone | Status |
|---|---|---|
| 1 | Project audit | Done. The previous stub and v1 build were replaced; portfolio repos were inspected for facts |
| 2 | Brand and design system | Done (`docs/design-system.md`) |
| 3 | Shared layout | Done: utility bar, mega menu, mobile menu, breadcrumbs, footer, generated from `src/site.json` |
| 4 | Homepage | Done: all brief sections except testimonials (none exist) and the announcement banner (none to announce) |
| 5 | Service pages | Done: 10 service pages, services overview, solutions, pricing, support plans |
| 6 | Industry pages | Done: overview plus 6 |
| 7 | Corporate pages | Done: about, our story, leadership, team, careers. Names and photos are placeholders |
| 8 | Portfolio | Done: listing with filters, case studies, 3 project pages with real screenshots. Study EOTC is listed by name only |
| 9 | Sales | Done: quote (multi-step), consultation (multi-step), contact, thank-you. **Forms are not connected** |
| 10 | Support | Done: support center, ticket form, repair booking, repair status (future), help center with 6 articles, FAQ, system status (no data) |
| 11 | Resources | Done: insights with 8 articles, guides, 4 printable checklists |
| 12 | Animation and refinement | Done: interactive 3D "Digital Ecosystem" home hero (Three.js, lazy-loaded, with fallbacks), scroll reveal, hover states, reduced-motion support |
| 13 | Quality assurance | Done in Chromium (`docs/testing-report.md`). Firefox, Safari, and screen readers still to check |
| 14 | Production preparation | Checklist ready (`docs/deployment-checklist.md`). Needs domain, host, and approvals |
| 15 | Customer portal | Architecture only (`docs/portal-architecture.md`) |
| 16 | Internal administration | Architecture only |

## Page inventory (64 built pages)
- **Corporate:** `/`, `/about/`, `/our-story/`, `/leadership/`, `/team/`, `/careers/`
- **Services:** `/services/`, `/services/web-development/`, `/services/software-development/`, `/services/restaurant-solutions/`, `/services/website-maintenance/`, `/services/remote-it-support/`, `/services/business-it-support/`, `/services/operating-system-support/`, `/services/computer-repair/`, `/services/hardware-upgrades/`, `/support-plans/`, `/solutions/`, `/pricing/`
- **Industries:** `/industries/` plus restaurants, small-businesses, education, nonprofits, startups, professional-services
- **Work:** `/portfolio/`, `/portfolio/ecaa/`, `/portfolio/roadmap-to-role/`, `/portfolio/tewahedo-daily/`, `/case-studies/`, `/technologies/`
- **Sales:** `/quote/`, `/consultation/`, `/contact/`, `/thank-you/`
- **Support:** `/support/`, `/support/new/`, `/book-repair/`, `/repair-status/`, `/help-center/` plus 6 articles, `/faq/`, `/status/`, `/client-portal/`
- **Resources:** `/insights/` plus 8 articles, `/guides/`, `/resources/`
- **Legal:** `/privacy/`, `/terms/` (drafts), `/404.html`

## Next steps, in order
1. **Fill the content gaps** in `docs/content-todo.md`, especially names, contact details, and Study EOTC.
2. **Choose a domain**, then set `siteUrl` in `src/site.json`. Canonical URLs, Open Graph URLs and images, `sitemap.xml`, the robots sitemap line, and Organization structured data switch on automatically.
3. **Connect forms.** Pick a form service or serverless function, set `formEndpoint`, add spam protection, and test real delivery.
4. **Legal review** of privacy and terms.
5. **Cross-browser pass** in Firefox and Safari, plus an NVDA or VoiceOver check.
6. **Deploy** following `docs/deployment-checklist.md`, after approval.

## Future architecture: Next.js and Supabase

Migrate only when portals are approved. The public site works well as static HTML, so it does not need a framework on its own.

**Recommended path**
1. Create a Next.js (App Router, TypeScript) app *alongside* this project, or in a `web/` folder.
2. Port the design tokens and CSS as-is (CSS Modules or a global stylesheet). Tailwind is optional and not required.
3. Recreate the generated pieces as components: `SiteHeader` and `MegaMenu` (from the same `site.json`), `Footer`, `Banner`, `CtaBand`, `Card`, `FormField`, `MultiStepForm`.
4. Move `src/pages/**` content into route files or MDX, keeping **identical URLs**.
5. Keep the public pages statically generated. Add authenticated routes under `/portal` (customers) and `/admin` (staff) only.
6. Replace `formEndpoint` with Next.js route handlers that validate input on the server, rate-limit, and write to Supabase.
7. Keep this static build deployable until the Next.js version passes the same `tests/qa_site.py` suite.

**What carries over unchanged:** URLs, copy, design tokens, icons, illustrations, screenshots, the QA script, and the content-todo process.
