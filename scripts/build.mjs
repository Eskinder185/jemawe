#!/usr/bin/env node
/**
 * Jemawe static site builder — zero dependencies.
 *
 * src/pages/**.html  (JSON front matter + HTML body)
 *   -> dist/<route>/index.html  (clean URLs, shared layout)
 *
 * Template features (deliberately small):
 *   {{site.name}} {{page.title}}           variables
 *   {{> partial-name key="value"}}          partial from src/partials (attrs available as {{key}})
 *   {{@list type="article" category="x" limit="3" template="article-card" exclude="self"}}
 *   {{icon:name}}                           inline SVG from src/icons/name.svg
 *   {{todo "What is missing"}}              visible placeholder, also logged to docs/content-todo.md
 *
 * Also: concatenates src/styles/*.css -> dist/css/main.css, copies assets,
 * writes robots.txt (+ sitemap.xml when site.siteUrl is set), and checks every
 * internal link and asset reference. Exits non-zero on broken links.
 *
 * TypeScript is compiled separately by `tsc` into dist/js (see package.json).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const site = JSON.parse(fs.readFileSync(path.join(SRC, "site.json"), "utf8"));

const todos = [];
const warnings = [];

// ---------------------------------------------------------------- helpers
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function copyDir(from, to) {
  for (const file of walk(from)) {
    const dest = path.join(to, path.relative(from, file));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file, dest);
  }
}

function get(obj, dotted) {
  return dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function parseAttrs(str = "") {
  const attrs = {};
  for (const m of str.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
  return attrs;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------- pages
function routeFor(file) {
  const rel = path.relative(path.join(SRC, "pages"), file).replace(/\\/g, "/");
  if (rel === "index.html") return "/";
  if (rel === "404.html") return "/404.html";
  if (rel.endsWith("/index.html")) return "/" + rel.slice(0, -"index.html".length);
  return "/" + rel.slice(0, -".html".length) + "/";
}

function outPathFor(route) {
  if (route === "/404.html") return path.join(DIST, "404.html");
  return path.join(DIST, route, "index.html");
}

function parsePage(file) {
  const raw = fs.readFileSync(file, "utf8");
  let meta = {};
  let body = raw;
  if (raw.startsWith("---")) {
    const end = raw.indexOf("\n---", 3);
    meta = JSON.parse(raw.slice(3, end));
    body = raw.slice(end + 4);
  }
  const route = routeFor(file);
  if (!meta.title) warnings.push(`${route}: missing title`);
  if (!meta.description) warnings.push(`${route}: missing description`);
  const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return { ...meta, route, file, body, readingTime: Math.max(1, Math.round(words / 220)) };
}

const pages = walk(path.join(SRC, "pages"))
  .filter((f) => f.endsWith(".html"))
  .map(parsePage);
const byRoute = new Map(pages.map((p) => [p.route, p]));

// ---------------------------------------------------------------- templating
const partialCache = new Map();
function partial(name) {
  if (!partialCache.has(name)) {
    const f = path.join(SRC, "partials", name + ".html");
    if (!fs.existsSync(f)) throw new Error(`Missing partial: ${name}`);
    partialCache.set(name, fs.readFileSync(f, "utf8"));
  }
  return partialCache.get(name);
}

const iconCache = new Map();
function icon(name, cls = "icon") {
  if (!iconCache.has(name)) {
    const f = path.join(SRC, "icons", name + ".svg");
    if (!fs.existsSync(f)) throw new Error(`Missing icon: ${name}`);
    iconCache.set(name, fs.readFileSync(f, "utf8").trim());
  }
  return iconCache
    .get(name)
    .replace("<svg", `<svg class="${cls}" aria-hidden="true" focusable="false"`);
}

function listItems(attrs, page) {
  let items = pages.filter((p) => p.type === attrs.type && !p.draft);
  if (attrs.category) items = items.filter((p) => p.category === attrs.category);
  if (attrs.tag) items = items.filter((p) => (p.tags || []).includes(attrs.tag));
  if (attrs.exclude === "self") items = items.filter((p) => p.route !== page.route);
  if (attrs.related === "true") {
    const same = items.filter((p) => p.category === page.category);
    items = [...same, ...items.filter((p) => p.category !== page.category)];
  } else {
    items.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || String(b.date || "").localeCompare(String(a.date || "")));
  }
  if (attrs.limit) items = items.slice(0, Number(attrs.limit));
  return items;
}

function render(tpl, ctx, depth = 0) {
  if (depth > 8) throw new Error("Partial nesting too deep");
  let out = tpl;

  // partials
  out = out.replace(/\{\{>\s*([\w-/]+)([^}]*)\}\}/g, (_, name, rest) => {
    const attrs = parseAttrs(rest);
    return render(partial(name), { ...ctx, ...attrs, attrs }, depth + 1);
  });

  // generated lists
  out = out.replace(/\{\{@list([^}]*)\}\}/g, (_, rest) => {
    const attrs = parseAttrs(rest);
    const items = listItems(attrs, ctx.page);
    if (!items.length) return attrs.empty ? `<p class="list-empty">${esc(attrs.empty)}</p>` : "";
    return items.map((item) => render(partial("cards/" + attrs.template), { ...ctx, item: decorate(item) }, depth + 1)).join("\n");
  });

  // conditionals {{#if path}}...{{/if}} (no nesting of the same block)
  out = out.replace(/\{\{#if ([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, p, inner) => {
    const v = get(ctx, p);
    return v && (!Array.isArray(v) || v.length) ? inner : "";
  });

  out = out.replace(/\{\{icon:([\w-]+)\}\}/g, (_, n) => icon(n));

  out = out.replace(/\{\{todo "([^"]+)"\}\}/g, (_, what) => {
    todos.push({ route: ctx.page?.route || "(layout)", what });
    return `<span class="placeholder" data-placeholder>${esc(what)}<span class="sr-only"> (placeholder, not yet confirmed)</span></span>`;
  });

  // raw (unescaped) variables {{{x}}} then escaped {{x}}
  out = out.replace(/\{\{\{([\w.]+)\}\}\}/g, (_, p) => String(get(ctx, p) ?? ""));
  out = out.replace(/\{\{([\w.]+)\}\}/g, (_, p) => esc(get(ctx, p) ?? ""));
  return out;
}

function decorate(p) {
  return {
    ...p,
    dateLabel: formatDate(p.date),
    stackLabel: (p.stack || []).join(", "),
    categoryLabel: p.categoryLabel || labelForCategory(p.category),
  };
}

function labelForCategory(c) {
  return (site.categories && site.categories[c]) || c || "";
}

// ---------------------------------------------------------------- layout pieces
function isActive(item, page) {
  return page.section && item.id === page.section;
}

function renderHeader(page) {
  const items = site.nav
    .map((item) => {
      if (!item.panel) {
        const cur = page.route === item.href ? ' aria-current="page"' : isActive(item, page) ? ' aria-current="true"' : "";
        return `<li class="main-nav__item"><a class="main-nav__link" href="${item.href}"${cur}>${esc(item.label)}</a></li>`;
      }
      const id = `panel-${item.id}`;
      const activeCls = isActive(item, page) ? " is-section" : "";
      const cols = item.panel.columns
        .map(
          (col) => `
            <div class="mega__col">
              ${col.heading ? `<p class="mega__heading">${esc(col.heading)}</p>` : ""}
              <ul class="mega__list">
                ${col.links.map((l) => megaLink(l, page)).join("")}
              </ul>
            </div>`
        )
        .join("");
      return `
        <li class="main-nav__item has-panel" data-nav-item>
          <button type="button" class="main-nav__link main-nav__trigger${activeCls}" aria-expanded="false" aria-controls="${id}" data-nav-trigger>
            ${esc(item.label)}${icon("chevron-down", "icon main-nav__chevron")}
          </button>
          <div class="mega" id="${id}" data-nav-panel hidden>
            <div class="container mega__inner mega__inner--${item.panel.columns.length}">
              <div class="mega__intro">
                <p class="mega__title">${esc(item.panel.title)}</p>
                <p class="mega__text">${esc(item.panel.text)}</p>
                ${item.href ? `<a class="text-link" href="${item.href}">${esc(item.panel.overview || "Overview")}</a>` : ""}
              </div>
              ${cols}
            </div>
          </div>
        </li>`;
    })
    .join("");

  return `
  <div class="utility-bar">
    <div class="container utility-bar__inner">
      <p class="utility-bar__tagline">${esc(site.tagline)}</p>
      <ul class="utility-bar__links">
        ${site.utility.map((u) => `<li><a href="${u.href}"${page.route === u.href ? ' aria-current="page"' : ""}>${esc(u.label)}${u.soon ? ' <span class="badge">Coming soon</span>' : ""}</a></li>`).join("")}
      </ul>
    </div>
  </div>
  <header class="site-header" data-site-header>
    <div class="container site-header__inner">
      <a class="brand" href="/" aria-label="${esc(site.name)} home">
        ${logoMark()}<span class="brand__name">${esc(site.name)}</span>
      </a>
      <nav class="main-nav" aria-label="Main">
        <ul class="main-nav__list">${items}</ul>
      </nav>
      <a class="btn btn--primary site-header__cta" href="/quote/">Get a quote</a>
      <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="mobile-nav" data-nav-toggle>
        <span class="nav-toggle__box" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="nav-toggle__label">Menu</span>
      </button>
    </div>
  </header>
  ${renderMobileNav(page)}`;
}

function megaLink(l, page) {
  const cur = page.route === l.href ? ' aria-current="page"' : "";
  return `<li><a class="mega__link" href="${l.href}"${cur}>
      <span class="mega__link-title">${esc(l.label)}${l.soon ? ' <span class="badge">Coming soon</span>' : ""}</span>
      ${l.desc ? `<span class="mega__link-desc">${esc(l.desc)}</span>` : ""}
    </a></li>`;
}

function renderMobileNav(page) {
  const groups = site.nav
    .map((item) => {
      if (!item.panel) {
        const cur = page.route === item.href ? ' aria-current="page"' : "";
        return `<li><a class="mobile-nav__link" href="${item.href}"${cur}>${esc(item.label)}</a></li>`;
      }
      const linkItem = (l) =>
        `<li><a href="${l.href}"${page.route === l.href ? ' aria-current="page"' : ""}>${esc(l.label)}${l.soon ? ' <span class="badge">Coming soon</span>' : ""}</a></li>`;
      const links = item.panel.columns
        .map((c) => (c.heading ? `<li class="mobile-nav__heading">${esc(c.heading)}</li>` : "") + c.links.map(linkItem).join(""))
        .join("");
      return `<li>
        <details class="mobile-nav__group"${isActive(item, page) ? " open" : ""}>
          <summary class="mobile-nav__link">${esc(item.label)}${icon("chevron-down", "icon mobile-nav__chevron")}</summary>
          <ul class="mobile-nav__sub">
            ${item.href ? `<li><a href="${item.href}"${page.route === item.href ? ' aria-current="page"' : ""}>${esc(item.panel.overview || "Overview")}</a></li>` : ""}
            ${links}
          </ul>
        </details>
      </li>`;
    })
    .join("");
  return `
    <div class="mobile-nav" id="mobile-nav" data-mobile-nav hidden>
      <nav class="mobile-nav__inner container" aria-label="Main">
        <ul class="mobile-nav__list">${groups}</ul>
        <div class="mobile-nav__actions">
          <a class="btn btn--primary btn--block" href="/quote/">Get a quote</a>
          <a class="btn btn--ghost btn--block" href="/consultation/">Schedule a consultation</a>
        </div>
        <ul class="mobile-nav__utility">
          ${site.utility.filter((u) => u.href !== "/consultation/").map((u) => `<li><a href="${u.href}">${esc(u.label)}${u.soon ? ' <span class="badge">Coming soon</span>' : ""}</a></li>`).join("")}
        </ul>
      </nav>
    </div>`;
}

function logoMark(size = 32) {
  return `<svg class="brand__mark" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <rect width="40" height="40" rx="9" fill="#2563EB"/>
    <path d="M24.5 9.5v14.2a6.8 6.8 0 0 1-12.6 3.6" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="24.5" cy="9.5" r="2.6" fill="#071226" stroke="#fff" stroke-width="1.6"/>
    <circle cx="11.9" cy="27.3" r="2.6" fill="#071226" stroke="#fff" stroke-width="1.6"/>
  </svg>`;
}

function renderFooter() {
  const cols = site.footer.columns
    .map(
      (c) => `
      <nav class="site-footer__col" aria-label="${esc(c.heading)}">
        <h2 class="site-footer__heading">${esc(c.heading)}</h2>
        <ul>${c.links.map((l) => `<li><a href="${l.href}">${esc(l.label)}</a></li>`).join("")}</ul>
      </nav>`
    )
    .join("");
  const contact = site.contact || {};
  const contactLines = [
    contact.email ? `<li><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></li>` : "",
    contact.phone ? `<li><a href="tel:${esc(contact.phone.replace(/[^+\d]/g, ""))}">${esc(contact.phone)}</a></li>` : "",
    contact.hours ? `<li>${esc(contact.hours)}</li>` : "",
    contact.serviceArea ? `<li>${esc(contact.serviceArea)}</li>` : "",
  ].join("");
  const social = (contact.social || [])
    .map((s) => `<li><a href="${esc(s.href)}" rel="noopener">${esc(s.label)}</a></li>`)
    .join("");
  return `
  <footer class="site-footer">
    <div class="container site-footer__top">
      <div class="site-footer__brand">
        <a class="brand brand--light" href="/">${logoMark(36)}<span class="brand__name">${esc(site.name)}</span></a>
        <p class="site-footer__tagline">${esc(site.tagline)}</p>
        <p class="site-footer__about">${esc(site.footer.about)}</p>
        <ul class="site-footer__contact">
          ${contactLines}
          <li><a href="/contact/">Send us a message</a></li>
          <li><a href="/support/new/">Request IT support</a></li>
        </ul>
        ${social ? `<ul class="site-footer__social">${social}</ul>` : ""}
      </div>
      ${cols}
    </div>
    <div class="container site-footer__bottom">
      <p>&copy; <span data-year>${new Date().getFullYear()}</span> ${esc(site.name)}. All rights reserved.</p>
      <ul>
        <li><a href="/privacy/">Privacy policy</a></li>
        <li><a href="/terms/">Terms of service</a></li>
        <li><a href="/faq/">FAQ</a></li>
      </ul>
    </div>
  </footer>`;
}

function crumbsFor(page) {
  if (page.route === "/" || page.route === "/404.html" || page.hideBreadcrumbs) return [];
  const parts = page.route.split("/").filter(Boolean);
  const trail = [{ label: "Home", href: "/" }];
  let acc = "/";
  parts.forEach((part, i) => {
    acc += part + "/";
    const p = byRoute.get(acc);
    if (i === parts.length - 1) trail.push({ label: page.breadcrumb || page.title, href: null });
    else if (p) trail.push({ label: p.breadcrumb || p.title, href: acc });
  });
  return trail;
}

function renderBreadcrumbs(page) {
  const trail = crumbsFor(page);
  if (!trail.length) return "";
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${trail
    .map((c) => (c.href ? `<li><a href="${c.href}">${esc(c.label)}</a></li>` : `<li><span aria-current="page">${esc(c.label)}</span></li>`))
    .join("")}</ol></nav>`;
}

function renderBanner(page) {
  if (page.layout === "home" || page.layout === "bare") return "";
  const actions = (page.actions || [])
    .map(([label, href, variant = "primary"]) => `<a class="btn btn--${variant}" href="${href}">${esc(label)}</a>`)
    .join("");
  let meta = "";
  if (page.type === "article" || page.type === "help") {
    meta = `<p class="banner__meta">
      <a href="${page.type === "help" ? "/help-center/" : "/insights/"}#${esc(page.category)}">${esc(labelForCategory(page.category))}</a>
      <span aria-hidden="true">/</span>
      ${page.date ? `<time datetime="${page.date}">Updated ${formatDate(page.date)}</time><span aria-hidden="true">/</span>` : ""}
      <span>${page.readingTime} min read</span>
    </p>`;
  }
  if (page.type === "project") {
    meta = `<p class="banner__meta"><span>${esc(labelForCategory(page.category))}</span><span aria-hidden="true">/</span><span>${esc(page.status || "")}</span></p>`;
  }
  const illo = page.illustration
    ? `<div class="banner__art" aria-hidden="true"><img src="/assets/illustrations/${page.illustration}.svg" alt="" width="560" height="420"></div>`
    : "";
  return `
  <section class="banner${page.illustration ? " banner--art" : ""}">
    <div class="container banner__inner">
      <div class="banner__copy">
        ${renderBreadcrumbs(page)}
        ${meta}
        <h1 class="banner__title">${esc(page.heading || page.title)}</h1>
        ${page.lead ? `<p class="banner__lead">${esc(page.lead)}</p>` : ""}
        ${actions ? `<div class="banner__actions">${actions}</div>` : ""}
      </div>
      ${illo}
    </div>
  </section>`;
}

function articleWrap(page, body) {
  if (page.type !== "article" && page.type !== "help") return body;
  // Long-form tables get the same scroll wrapper as tables elsewhere, so they never widen the page.
  body = body.replace(/<table>/g, '<div class="table-wrap"><table class="compare">').replace(/<\/table>/g, "</table></div>");
  const listType = page.type;
  const related = render(
    `{{@list type="${listType}" exclude="self" related="true" limit="3" template="${listType === "help" ? "help-card" : "article-card"}"}}`,
    { site, page }
  );
  return `
  <div class="container article-layout">
    <article class="prose">${body}</article>
    <aside class="article-aside" aria-label="Get help">
      <div class="aside-box">
        <p class="aside-box__title">${listType === "help" ? "Still stuck?" : "Planning a project?"}</p>
        <p>${listType === "help" ? "We can walk through the problem with you in a scheduled remote session." : "Tell us what you are working on and we will help you scope it."}</p>
        <a class="btn btn--primary btn--block" href="${listType === "help" ? "/support/new/" : "/quote/"}">${listType === "help" ? "Request IT support" : "Get a quote"}</a>
      </div>
      <div class="aside-box">
        <p class="aside-box__title">Share this ${listType === "help" ? "article" : "page"}</p>
        <div class="cluster">
          <button type="button" class="btn btn--secondary btn--sm" data-share>${icon("link", "icon")}Copy link</button>
          <a class="btn btn--secondary btn--sm" data-share-email href="mailto:?subject=${encodeURIComponent(page.title)}">${icon("mail", "icon")}Email</a>
        </div>
        <p class="field__hint" data-share-status role="status" aria-live="polite"></p>
      </div>
    </aside>
  </div>
  ${related ? `<section class="section section--soft"><div class="container"><h2 class="section-title">Related ${listType === "help" ? "help articles" : "reading"}</h2><div class="grid grid--3">${related}</div></div></section>` : ""}`;
}

function head(page) {
  const fullTitle = page.route === "/" ? `${site.name} | ${page.title}` : `${page.title} | ${site.name}`;
  const canonical = site.siteUrl ? site.siteUrl.replace(/\/$/, "") + (page.route === "/404.html" ? "/404.html" : page.route) : null;
  const ogImage = site.siteUrl ? site.siteUrl.replace(/\/$/, "") + (page.ogImage || "/assets/og/jemawe-og.png") : null;
  const jsonLd =
    site.siteUrl && page.route === "/"
      ? `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: site.name,
          url: site.siteUrl,
          logo: site.siteUrl.replace(/\/$/, "") + "/assets/logos/jemawe-mark.svg",
          ...(site.contact?.email ? { email: site.contact.email } : {}),
        })}</script>`
      : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(page.description || "")}">
  ${page.noindex || page.route === "/404.html" ? '<meta name="robots" content="noindex">' : ""}
  ${canonical ? `<link rel="canonical" href="${canonical}">` : ""}
  <meta property="og:type" content="${page.type === "article" ? "article" : "website"}">
  <meta property="og:site_name" content="${esc(site.name)}">
  <meta property="og:title" content="${esc(page.title)}">
  <meta property="og:description" content="${esc(page.description || "")}">
  ${canonical ? `<meta property="og:url" content="${canonical}">` : ""}
  ${ogImage ? `<meta property="og:image" content="${ogImage}"><meta name="twitter:card" content="summary_large_image">` : ""}
  <meta name="theme-color" content="#071226">
  <script>document.documentElement.classList.add("js")</script>
  <link rel="icon" href="/assets/logos/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="/assets/fonts/manrope-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/main.css">
  <script type="module" src="/js/main.js"></script>
  ${jsonLd}
</head>`;
}

function renderPage(page) {
  const ctx = { site, page: decorate(page) };
  let body = render(page.body, ctx);
  body = articleWrap(page, body);
  const announcement = site.announcement
    ? `<div class="announcement"><div class="container"><p>${esc(site.announcement.text)}${site.announcement.href ? ` <a href="${site.announcement.href}">${esc(site.announcement.link || "Learn more")}</a>` : ""}</p></div></div>`
    : "";
  // Scrollable table regions must be reachable and named for keyboard and screen reader users.
  body = body.replace(/<div class="table-wrap">/g, '<div class="table-wrap" tabindex="0" role="region" aria-label="Table (scrolls sideways on small screens)">');
  return `${head(page)}
<body class="page-${page.layout || "default"}${page.type ? " type-" + page.type : ""}">
  <a class="skip-link" href="#main">Skip to main content</a>
  ${announcement}
  ${renderHeader(page)}
  <main id="main" tabindex="-1">
    ${renderBanner(page)}
    ${body}
  </main>
  ${renderFooter()}
  <button type="button" class="back-to-top" data-back-to-top aria-label="Back to top" hidden>${icon("arrow-up")}</button>
</body>
</html>
`;
}

// ---------------------------------------------------------------- build
function clean() {
  // Keep dist/js (written by tsc) so `node build` and `tsc` can run in either order.
  if (!fs.existsSync(DIST)) return;
  for (const e of fs.readdirSync(DIST)) {
    if (e === "js") continue;
    fs.rmSync(path.join(DIST, e), { recursive: true, force: true });
  }
}

function buildCss() {
  const dir = path.join(SRC, "styles");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".css")).sort();
  const css = files.map((f) => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  fs.mkdirSync(path.join(DIST, "css"), { recursive: true });
  fs.writeFileSync(path.join(DIST, "css", "main.css"), css);
}

function buildMeta() {
  const lines = ["User-agent: *", "Allow: /"];
  if (site.siteUrl) {
    const base = site.siteUrl.replace(/\/$/, "");
    lines.push(`Sitemap: ${base}/sitemap.xml`);
    const urls = pages
      .filter((p) => !p.noindex && p.route !== "/404.html" && !p.draft)
      .map((p) => `  <url><loc>${base}${p.route}</loc>${p.date ? `<lastmod>${p.date}</lastmod>` : ""}</url>`)
      .join("\n");
    fs.writeFileSync(
      path.join(DIST, "sitemap.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
    );
  }
  fs.writeFileSync(path.join(DIST, "robots.txt"), lines.join("\n") + "\n");
}

function checkLinks() {
  const broken = [];
  for (const file of walk(DIST).filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(file, "utf8");
    const from = "/" + path.relative(DIST, file).replace(/\\/g, "/");
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
      const target = m[1];
      if (target.startsWith("//")) continue;
      let p = path.join(DIST, target);
      if (target.endsWith("/")) p = path.join(p, "index.html");
      if (!fs.existsSync(p)) broken.push(`${from} -> ${target}`);
    }
    for (const m of html.matchAll(/href="#([\w-]+)"/g)) {
      if (!html.includes(`id="${m[1]}"`)) broken.push(`${from} -> #${m[1]} (missing anchor)`);
    }
  }
  return [...new Set(broken)];
}

function writeTodoReport() {
  const grouped = {};
  for (const t of todos) (grouped[t.route] ||= new Set()).add(t.what);
  const body = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([route, set]) => `## ${route}\n\n${[...set].map((w) => `- [ ] ${w}`).join("\n")}`)
    .join("\n\n");
  fs.writeFileSync(
    path.join(ROOT, "docs", "content-todo.md"),
    `# Content still to confirm\n\nGenerated by \`npm run build\` from every \`{{todo "..."}}\` placeholder in \`src/\`.\nEach item renders on the site as a dashed "placeholder" badge until the real fact is supplied.\nAlso see \`src/site.json\` → \`contact\` (email, phone, hours, service area, social links are hidden until set).\n\nTotal: ${todos.length} placeholder(s) across ${Object.keys(grouped).length} page(s).\n\n${body}\n`
  );
}

clean();
fs.mkdirSync(DIST, { recursive: true });
for (const page of pages) {
  const out = outPathFor(page.route);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, renderPage(page));
}
copyDir(path.join(ROOT, "assets"), path.join(DIST, "assets"));
buildCss();
buildMeta();
writeTodoReport();

const jsBuilt = fs.existsSync(path.join(DIST, "js", "main.js"));
const broken = checkLinks().filter((b) => jsBuilt || !b.includes("/js/main.js"));

console.log(`Built ${pages.length} pages -> dist/`);
console.log(`Placeholders: ${todos.length} (see docs/content-todo.md)`);
if (warnings.length) console.log("Warnings:\n  " + warnings.join("\n  "));
if (broken.length) {
  console.error(`Broken internal links (${broken.length}):\n  ` + broken.join("\n  "));
  process.exit(1);
}
console.log("Internal links: all resolve");
