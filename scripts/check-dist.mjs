#!/usr/bin/env node
/**
 * Deployment safety check for dist/ (run after a production build, before publishing).
 *
 *   node scripts/check-dist.mjs                 -> root hosting
 *   node scripts/check-dist.mjs --base=/jemawe  -> GitHub Pages project site (or BASE_PATH env)
 *
 * Fails if dist/ is missing its entry pages, contains anything that is not a public web
 * file (source maps, TypeScript, env files, dotfiles, docs, scripts, archives, backups),
 * looks like it holds a secret, or has root-relative URLs that escape the base path.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const flag = process.argv.find((a) => a.startsWith("--base="))?.slice(7);
const raw = String(flag ?? process.env.BASE_PATH ?? "").replace(/^\/+|\/+$/g, "");
const BASE = raw ? "/" + raw : "";

const ALLOWED = new Set([".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".ico", ".woff2", ".txt", ".xml", ".pdf"]);
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, // GitHub tokens
  /\bsk_live_[A-Za-z0-9]{16,}\b/, // Stripe live keys
  /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/, // Slack tokens
  /\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/, // JWTs (e.g. service-role keys)
];

const problems = [];
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? [p, ...walk(p)] : [p];
  });

if (!fs.existsSync(path.join(DIST, "index.html"))) problems.push("dist/index.html is missing");
if (!fs.existsSync(path.join(DIST, "404.html"))) problems.push("dist/404.html is missing");

let files = 0;
let bytes = 0;
for (const p of fs.existsSync(DIST) ? walk(DIST) : []) {
  const rel = path.relative(DIST, p).replace(/\\/g, "/");
  if (path.basename(p).startsWith(".")) problems.push(`hidden file or folder: ${rel}`);
  if (fs.statSync(p).isDirectory()) continue;
  files++;
  bytes += fs.statSync(p).size;
  const ext = path.extname(p).toLowerCase();
  if (!ALLOWED.has(ext)) {
    problems.push(`not a public web file: ${rel}`);
    continue;
  }
  if (/\.(bak|orig|old|tmp)$|~$/i.test(rel)) problems.push(`backup file: ${rel}`);
  if (![".html", ".css", ".js", ".txt", ".xml", ".svg"].includes(ext)) continue;
  const text = fs.readFileSync(p, "utf8");
  for (const re of SECRET_PATTERNS) if (re.test(text)) problems.push(`possible secret (${re.source.slice(0, 24)}…) in ${rel}`);
  if (/sourceMappingURL=/.test(text) && ext === ".js") problems.push(`source map reference in ${rel}`);
  if (BASE && ext === ".html") {
    for (const m of text.matchAll(/(?:href|src)="(\/(?!\/)[^"]*)"/g)) {
      if (!m[1].startsWith(BASE + "/") && m[1] !== BASE) problems.push(`${rel}: "${m[1]}" is outside ${BASE}/`);
    }
    for (const m of text.matchAll(/srcset="([^"]*)"/g)) {
      for (const u of m[1].split(",").map((x) => x.trim().split(/\s+/)[0])) {
        if (u.startsWith("/") && !u.startsWith("//") && !u.startsWith(BASE + "/")) problems.push(`${rel}: srcset "${u}" is outside ${BASE}/`);
      }
    }
  }
  if (ext === ".css") {
    for (const m of text.matchAll(/url\(\s*["']?(\/(?!\/)[^"')]*)/g)) problems.push(`${rel}: root-relative url(${m[1]}) breaks under a sub-path`);
  }
}

const unique = [...new Set(problems)];
console.log(`dist check (${BASE ? `base path ${BASE}/` : "root hosting"}): ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
if (unique.length) {
  console.error(`Problems (${unique.length}):\n  ` + unique.slice(0, 50).join("\n  "));
  process.exit(1);
}
console.log("dist check: OK (entry pages present, only public web files, no secrets, no base-path leaks)");
