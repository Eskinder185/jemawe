# Jemawe website

The public website for Jemawe, a technology solutions company: digital solutions, IT services, and computer services.

Plain HTML, CSS, and TypeScript, generated into `dist/` by a small zero-dependency Node script. Dev dependencies: TypeScript, plus Three.js and esbuild for the lazy-loaded 3D home page hero only (see `docs/hero-3d.md`).

## Quick start (Windows, PowerShell)

```powershell
cd C:\Users\eskew\github\jemawe
npm install          # TypeScript, Three.js, esbuild (dev only)
npm run build        # HTML/CSS into dist/, TypeScript into dist/js, and the 3D hero bundle
npm run serve        # http://127.0.0.1:5500/
```

While editing:

```powershell
npm run dev          # serves dist/ and rebuilds HTML/CSS when src/ or assets/ change
npx tsc --watch      # in a second terminal, recompiles TypeScript on save
```

**VS Code Live Server** also works: `.vscode/settings.json` points Live Server at `dist/`, so opening the folder and choosing "Go Live" serves the built site on port 5500. Run `npm run build` first.

`dist/` is committed, so the site can be previewed without a build.

## How the site is organized

```
src/
  site.json        Navigation, footer, tagline, and company facts (contact details stay hidden until set)
  pages/           One file per page: JSON front matter + HTML body. Path = URL.
                   pages/services/web-development.html -> /services/web-development/
  partials/        Reusable fragments: CTA band, form fields, cards for generated lists
  styles/          CSS in numbered files, concatenated into dist/css/main.css
  ts/              TypeScript: navigation, forms, filters, reveal, tabs, 3D hero loader
  ts/hero3d/       Three.js "Digital Ecosystem" home hero (bundled by esbuild, lazy-loaded)
  icons/           SVG icons, inserted with {{icon:name}}
assets/            Fonts (self-hosted Manrope), logos, illustrations, portfolio screenshots, OG image
scripts/
  build.mjs        Static site generator (layout, mega menu, breadcrumbs, lists, link checker, sitemap)
  serve.mjs        Local server with clean URLs and the custom 404
  build-3d.mjs     esbuild bundle for the 3D hero (dist/js/hero3d.js)
  make-illustrations.py  Regenerates the banner illustrations
tests/qa_site.py   Playwright QA: every page at 6 widths, links, accessibility, interactions
tests/qa_eco.py    Playwright QA for the 3D hero (WebGL, pointer, touch, keyboard, fallbacks, performance)
docs/              Design system, asset manifest, roadmap, testing report, deployment, portal architecture
dist/              Generated output. Do not edit by hand.
```

### Page front matter

```html
---
{
  "title": "Website development",
  "description": "Used for the meta description and social previews.",
  "section": "services",
  "heading": "Optional H1 (defaults to the title)",
  "lead": "Banner intro paragraph",
  "actions": [["Get a quote", "/quote/", "light"]],
  "illustration": "web"
}
---
<section class="section">…</section>
```

Optional keys: `breadcrumb` (short label), `type` (`article`, `help`, or `project`), `category`, `tags`, `date`, `summary`, `noindex`, `layout` (`home` or `bare`).

### Template helpers

| Syntax | Does |
|---|---|
| `{{> cta-band heading="…" primary="…" primaryHref="/…/"}}` | Insert a partial |
| `{{@list type="article" tag="guide" template="article-card"}}` | Generate cards from pages with matching front matter |
| `{{icon:check}}` | Inline SVG icon |
| `{{todo "What is missing"}}` | Visible placeholder badge, logged to `docs/content-todo.md` |
| `{{site.formEndpoint}}` | Values from `src/site.json` |

The build fails if any internal link or asset is missing.

## Things only the founder can supply

Run `npm run build` and open **`docs/content-todo.md`**: it lists every unconfirmed fact (39 at the time of writing), grouped by page. The big ones:

- Founder and co-founder names, roles, bios, photos
- Business email, hours, service area (set them in `src/site.json` → `contact` and they appear in the footer)
- Study EOTC project details, and ECAA engagement and live URL
- Pricing, support plan scopes, and response times
- Legal review of the privacy policy and terms (both are clearly marked drafts)

## Forms

Forms validate in the browser but **are not connected to any service yet**. On a valid submit they say so plainly instead of faking success. To connect them, set `formEndpoint` in `src/site.json` to an endpoint that accepts a JSON `POST` (for example a form service or your own serverless function) and rebuild. A 2xx response sends the visitor to `/thank-you/`. Anything else shows an error and keeps their answers.

## Testing

```powershell
pip install playwright
python -m playwright install chromium
npm run serve                      # terminal 1
python tests/qa_site.py --axe path\to\axe.min.js   # terminal 2 (axe-core from npm: npm pack axe-core)
```

For the 3D hero: `python tests/qa_eco.py --axe path\to\axe.min.js`.

The latest results are in `docs/testing-report.md`.

## Rules for contributors and AI agents

See `AGENTS.md`. In short: never invent company facts, never fake a working feature, edit `src/` (not `dist/`), and do not commit, push, or deploy without approval.
