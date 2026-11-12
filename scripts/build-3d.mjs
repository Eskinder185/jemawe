#!/usr/bin/env node
/**
 * Bundles the home page 3D hero (src/ts/hero3d) with a tree-shaken, minified
 * copy of Three.js into dist/js/hero3d.js. The rest of the site is compiled by
 * tsc as plain ES modules; only this lazy-loaded bundle needs a bundler.
 */
import { build } from "esbuild";
import { mkdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputFlag = process.argv.find((arg) => arg.startsWith("--outfile="))?.slice("--outfile=".length);
const out = resolve(root, outputFlag || "dist/js/hero3d.js");
mkdirSync(dirname(out), { recursive: true });
try {
  await build({
    absWorkingDir: root,
    entryPoints: [resolve(root, "src/ts/hero3d/index.ts")],
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2020",
    sourcemap: false,
    legalComments: "eof",
    outfile: out,
    logLevel: "warning",
  });
} catch {
  console.error("3D hero bundling failed. Check that esbuild can read src/ts/hero3d and node_modules in this environment.");
  process.exit(1);
}
const raw = statSync(out).size;
const gz = gzipSync(readFileSync(out)).length;
console.log(`3D hero bundle: ${(raw / 1024).toFixed(0)} KB minified, ${(gz / 1024).toFixed(0)} KB gzipped -> ${out}`);
