// Deploy the latest build artifacts into the production Obsidian vault:
//   ~/Sync/Obsidian/Main/.obsidian/plugins/<plugin-id>/
// The old plugin folder is deleted first (no backup), so production only ever
// contains exactly what was just built.
//
// Usage:
//   npm run deploy          (build + deploy)
//   npm run deploy:copy     (deploy artifacts as-is)
//   node scripts/deploy.mjs [--vault <dir>]
//
// Vault defaults to ~/Sync/Obsidian/Main; override with --vault or the
// OBSIDIAN_VAULT env var.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACTS = ["main.js", "manifest.json", "styles.css"];

const fail = (msg) => {
  console.error(`deploy: ${msg}`);
  process.exit(1);
};

// --- resolve target vault ------------------------------------------------
let vaultArg = null;
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--vault") vaultArg = process.argv[++i];
  else if (a.startsWith("--vault=")) vaultArg = a.slice("--vault=".length);
  else fail(`unknown argument: ${a}`);
}
const vault = path.resolve(
  vaultArg ?? process.env.OBSIDIAN_VAULT ?? path.join(os.homedir(), "Sync", "Obsidian", "Main")
);
const vaultConfig = path.join(vault, ".obsidian");
if (!fs.existsSync(vaultConfig)) fail(`not an Obsidian vault: ${vault}`);

// --- verify artifacts exist before touching production -------------------
for (const f of ARTIFACTS) {
  if (!fs.existsSync(path.join(root, f)))
    fail(`missing artifact ${f} — run \`npm run build\` first`);
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
if (!manifest.id) fail("manifest.json has no id");

// --- delete old, copy new ------------------------------------------------
const dest = path.join(vaultConfig, "plugins", manifest.id);
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
for (const f of ARTIFACTS) {
  const src = path.join(root, f);
  fs.copyFileSync(src, path.join(dest, f));
  console.log(`deploy: ${f} -> ${dest} (${fs.statSync(src).size} bytes)`);
}
console.log(`deploy: done — ${ARTIFACTS.length} files, old plugin dir removed first`);
