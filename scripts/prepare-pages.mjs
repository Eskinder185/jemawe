#!/usr/bin/env node
/** Legacy entry point kept for callers of the old Pages preparation command. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseArg = `--base=${process.env.BASE_PATH ?? "/jemawe"}`;
const result = spawnSync(process.execPath, ["scripts/build-production.mjs", baseArg], {
  cwd: root,
  stdio: "inherit",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
