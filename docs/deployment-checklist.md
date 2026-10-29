# Production deployment checklist

Nothing here has been done. Every item needs the founder's approval. No deployment, domain purchase, or service connection was made during development.

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

## Hosting (static)
Any static host works: Cloudflare Pages, Netlify, Vercel, or GitHub Pages.
- [ ] Build command `npm run build`, output directory `dist`
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
