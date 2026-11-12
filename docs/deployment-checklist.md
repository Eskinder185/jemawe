# Production deployment checklist

The existing GitHub Pages site is public. Use this checklist for future releases and owner-provided business details. A passing local build does not authorize deployment, domain purchases, or service connections.

## Before deploying
- [ ] All items in `docs/content-todo.md` resolved, or the pages holding them hidden
- [ ] Privacy policy and terms reviewed by a lawyer; "draft" notices removed
- [ ] Business email set up and added to `src/site.json` → `contact.email`
- [ ] Domain chosen and registered in Jemawe's name, with auto-renew on
- [ ] `siteUrl` set in `src/site.json`, then `npm run build` (generates canonical URLs, `sitemap.xml`, OG URLs, Organization JSON-LD)
- [ ] Form endpoint chosen, `formEndpoint` set, and real submissions tested end to end for every form: contact, quote, consultation, support ticket, repair booking, web inquiry
- [ ] Spam protection on the form endpoint (the honeypot is built in; add rate limiting or a challenge on the server)
- [ ] `python tests/qa_site.py` passes on the final build
- [ ] Manual check in Edge, Firefox, Safari (macOS and iOS), and Chrome on Android

## GitHub Pages release
The workflow `.github/workflows/deploy.yml` builds with `npm run build:pages` and publishes only `dist/` to
**https://eskinder185.github.io/jemawe/**. It runs on every push to `main` (and manually from the Actions tab).
`.github/workflows/static.yml` validates pull requests with typechecking, enquiry tests, and a Pages-path build; it has no deployment job or Pages write permission.

One-time repository settings (github.com/Eskinder185/jemawe → Settings):
- [ ] **Pages** → Build and deployment → Source: **GitHub Actions**
- [ ] **Environments** → `github-pages` (created on the first run, or create it now) → Deployment branches and tags: **Selected branches and tags** → `main`
- [ ] Optional: same environment → **Required reviewers** → add yourself, so each deployment waits for your approval
- [ ] **Actions** → General → Workflow permissions: **Read repository contents** (the workflow asks for the extra Pages permissions it needs per job)

How the build adapts to the host:
- `BASE_PATH` (e.g. `/jemawe`) prefixes every root-relative `href`, `src`, and `srcset`. CSS uses relative font URLs and the JS resolves its own paths from `import.meta.url`, so neither needs rebuilding per host.
- `SITE_URL` overrides `siteUrl` and turns on canonical URLs, Open Graph URLs, JSON-LD, and `sitemap.xml`.
- In CI both come from `actions/configure-pages`. If a custom domain is added later, `BASE_PATH` becomes empty and `SITE_URL` the domain automatically, with no workflow change.
- `scripts/check-dist.mjs` fails the build if `dist/` lacks `index.html` or `404.html`, contains anything other than public web files (source maps, `.ts`, `.env`, dotfiles, docs, archives, backups), holds a secret-looking token, or has a URL that escapes the base path.
- `robots.txt` is published at `/jemawe/robots.txt`, but crawlers only read it at a domain root, so it has no effect on a project site. It starts working with a custom domain.

Preview the Pages build locally: `npm run preview:pages`, then open http://127.0.0.1:5500/jemawe/

## Hosting (static)
Any static host works: Cloudflare Pages, Netlify, Vercel, or GitHub Pages.
- [ ] Build command `npm run build:pages` (no source maps, with the `dist/` safety check), output directory `dist`. Set `BASE_PATH` only when hosting under a sub-path
- [ ] Custom 404: `dist/404.html` (supported natively by Cloudflare Pages, Netlify, and GitHub Pages; Vercel needs it configured)
- [ ] HTTPS enforced, `www` redirected to the bare domain (or the reverse)
- [ ] Security headers set at the host:
  - `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self' 'sha256-…'` (hash of the one inline script that adds the `js` class), plus `form-action` and `connect-src` for the form endpoint
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] Cache: long cache on `/assets/*`; `no-cache` or a short cache on HTML

## After deploying
- [ ] Submit `sitemap.xml` to Google Search Console and Bing Webmaster Tools
- [ ] Check Open Graph previews with a link-preview tool
- [ ] Run Lighthouse on home, a service page, and the quote page; record the scores
- [ ] Set up uptime monitoring; only then add real data to `/status/`
- [ ] Back up the repository and record who holds the domain, hosting, and email credentials
