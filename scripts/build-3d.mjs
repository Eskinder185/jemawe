#!/usr/bin/env node
/**
 * Bundles the home page 3D hero (src/ts/hero3d) with a tree-shaken, minified
 * copy of Three.js into dist/js/hero3d.js. The rest of the site is compiled by
 * tsc as plain ES modules; only this lazy-loaded bundle needs a bundler.
 */
import { build } from "esbuild";
import { statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

const out = "dist/js/hero3d.js";
await build({
  entryPoints: ["src/ts/hero3d/index.ts"],
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2020",
  sourcemap: false,
  legalComments: "eof",
  outfile: out,
  logLevel: "warning",
});
const raw = statSync(out).size;
const gz = gzipSync(readFileSync(out)).length;
console.log(`3D hero bundle: ${(raw / 1024).toFixed(0)} KB minified, ${(gz / 1024).toFixed(0)} KB gzipped -> ${out}`);
