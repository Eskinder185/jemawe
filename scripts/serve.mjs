#!/usr/bin/env node
/**
 * Zero-dependency local server for dist/ with clean URLs and the custom 404 page.
 *   node scripts/serve.mjs            -> http://127.0.0.1:5500
 *   node scripts/serve.mjs --watch    -> also rebuilds HTML/CSS on changes in src/ and assets/
 *                                        (run `npx tsc --watch` alongside for TypeScript)
 * PORT=5600 node scripts/serve.mjs   -> different port
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT || 5500);
const HOST = process.env.HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
};

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const target = path.normalize(path.join(DIST, clean));
  if (!target.startsWith(DIST)) return null; // block path traversal
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  const asIndex = path.join(target, "index.html");
  if (fs.existsSync(asIndex)) return asIndex;
  return null;
}

const server = http.createServer((req, res) => {
  const urlPath = req.url || "/";
  // Redirect /about -> /about/ so relative behaviour matches production hosts.
  if (!path.extname(urlPath.split("?")[0]) && !urlPath.split("?")[0].endsWith("/")) {
    const withSlash = urlPath.split("?")[0] + "/";
    if (resolveFile(withSlash)) {
      res.writeHead(301, { Location: withSlash });
      return res.end();
    }
  }
  const file = resolveFile(urlPath);
  if (!file) {
    const notFound = path.join(DIST, "404.html");
    res.writeHead(404, { "Content-Type": TYPES[".html"] });
    return res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : "Not found");
  }
  res.writeHead(200, {
    "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => console.log(`Jemawe dev server: http://${HOST}:${PORT}/`));

if (process.argv.includes("--watch")) {
  let timer = null;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const p = spawn(process.execPath, [path.join(ROOT, "scripts", "build.mjs")], { stdio: "inherit" });
      p.on("exit", (code) => console.log(code === 0 ? "Rebuilt." : "Build failed — see above."));
    }, 150);
  };
  for (const dir of ["src", "assets"]) {
    fs.watch(path.join(ROOT, dir), { recursive: true }, (_, file) => {
      if (file && !String(file).endsWith(".ts")) rebuild();
    });
  }
  console.log("Watching src/ and assets/ for changes (TypeScript: run `npx tsc --watch` in another terminal).");
}
