#!/usr/bin/env node
/**
 * Zero-dependency local server for dist/ with clean URLs and the custom 404 page.
 *   node scripts/serve.mjs            -> http://127.0.0.1:5500
 *   node scripts/serve.mjs --watch    -> also rebuilds HTML/CSS on changes in src/ and assets/
 *                                        (run `npx tsc --watch` alongside for TypeScript)
 * PORT=5600 node scripts/serve.mjs   -> different port
 * BASE_PATH=/jemawe node scripts/serve.mjs -> serve dist/ under /jemawe/ to preview a
 *                                        GitHub Pages build (npm run build:pages first)
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
const WATCH = process.argv.includes("--watch");
const AUTO_PORT = WATCH && !process.env.PORT;
let activePort = PORT;
const BASE = (() => {
  const flag = process.argv.find((a) => a.startsWith("--base="))?.slice(7);
  const v = String(flag ?? process.env.BASE_PATH ?? "").replace(/^\/+|\/+$/g, "");
  return v ? "/" + v : "";
})();

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
  let urlPath = req.url || "/";
  if (BASE) {
    // Mirror GitHub Pages project hosting: only BASE/... exists.
    if (urlPath === "/" || urlPath === BASE) {
      res.writeHead(301, { Location: BASE + "/" });
      return res.end();
    }
    if (!urlPath.startsWith(BASE + "/")) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(`Not found (this server only serves ${BASE}/)`);
    }
    urlPath = urlPath.slice(BASE.length);
  }
  // Redirect /about -> /about/ so relative behaviour matches production hosts.
  if (!path.extname(urlPath.split("?")[0]) && !urlPath.split("?")[0].endsWith("/")) {
    const withSlash = urlPath.split("?")[0] + "/";
    if (resolveFile(withSlash)) {
      res.writeHead(301, { Location: BASE + withSlash });
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

server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && AUTO_PORT && activePort < PORT + 20) {
    activePort++;
    server.listen(activePort, HOST);
    return;
  }
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${activePort} is already in use. Stop the other server or set $env:PORT="5600" before starting Jemawe.`);
  } else {
    console.error(`Jemawe dev server failed: ${error.message}`);
  }
  process.exit(1);
});
server.on("listening", () => {
  console.log(`Jemawe dev server: http://${HOST}:${activePort}${BASE}/`);
  if (WATCH) startWatch();
});
server.listen(activePort, HOST);

function startWatch() {
  let timer = null;
  let building = false;
  let pending = false;
  const runBuild = () => {
    if (building) { pending = true; return; }
    building = true;
    const p = spawn(process.execPath, [path.join(ROOT, "scripts", "build.mjs"), `--base=${BASE}`], { stdio: "inherit" });
    const finish = (code) => {
      if (!building) return;
      building = false;
      console.log(code === 0 ? "Rebuilt." : "Build failed — see above.");
      if (pending) { pending = false; runBuild(); }
    };
    p.once("error", (error) => { console.error(`Rebuild could not start: ${error.message}`); finish(1); });
    p.once("exit", finish);
  };
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(runBuild, 150);
  };
  for (const dir of ["src", "assets"]) {
    fs.watch(path.join(ROOT, dir), { recursive: true }, (_, file) => {
      if (file && !String(file).endsWith(".ts")) rebuild();
    });
  }
  console.log("Watching src/ and assets/ for changes (TypeScript: run `npx tsc --watch` in another terminal).");
}
