#!/usr/bin/env node
/** Build the public artifact. Bundle the hero first so a bundle failure leaves dist intact. */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseArg = process.argv.find((arg) => arg.startsWith("--base="));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jemawe-build-"));
const bundle = path.join(tempDir, "hero3d.js");

function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status ?? "unknown"}`);
}

try {
  run("scripts/build-3d.mjs", [`--outfile=${bundle}`]);
  run("scripts/build.mjs", ["--clean", ...(baseArg ? [baseArg] : [])]);
  run("node_modules/typescript/bin/tsc", ["--sourceMap", "false"]);
  fs.copyFileSync(bundle, path.join(root, "dist", "js", "hero3d.js"));
  run("scripts/check-dist.mjs", baseArg ? [baseArg] : []);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (fs.existsSync(bundle)) fs.unlinkSync(bundle);
  fs.rmdirSync(tempDir);
}
