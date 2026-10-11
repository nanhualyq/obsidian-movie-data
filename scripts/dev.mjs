// One-command dev environment for manually reviewing local changes:
//   build (watch) -> sync artifacts into .dev/vault -> open Obsidian with the
//   dedicated .dev/profile -> reload the plugin over CDP after every rebuild.
//
// Production (~/Sync/Obsidian/Main) is never touched — see scripts/deploy.mjs.
//
// Usage:
//   npm run dev:open
//   node scripts/dev.mjs [--no-open] [--port 9333] [--exe <path>]
//
//   --no-open   build + sync only, do not launch Obsidian
//   --port      CDP port passed to Obsidian (default 9333, same as live-e2e)
//   --exe       Obsidian executable (default: auto-detect, or $OBSIDIAN_EXE)
//
// If the CDP reload is not reachable (e.g. Obsidian was already running
// without --remote-debugging-port), rebuilds still sync to disk — reload the
// plugin manually with Ctrl+P -> "Reload app without saving".

import esbuild from "esbuild";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { makeOptions } from "./esbuild-options.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const devVault = path.join(root, ".dev", "vault");
const profileDir = path.join(root, ".dev", "profile");
const ARTIFACTS = ["main.js", "manifest.json", "styles.css"];

const fail = (msg) => {
  console.error(`dev: ${msg}`);
  process.exit(1);
};

// --- arguments ------------------------------------------------------------
let port = 9333;
let open = true;
let exeOverride = null;
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--no-open") open = false;
  else if (a === "--port") port = Number(process.argv[++i]);
  else if (a.startsWith("--port=")) port = Number(a.slice("--port=".length));
  else if (a === "--exe") exeOverride = process.argv[++i];
  else if (a.startsWith("--exe=")) exeOverride = a.slice("--exe=".length);
  else fail(`unknown argument: ${a}`);
}
if (!Number.isInteger(port) || port <= 0) fail(`invalid --port: ${port}`);

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
if (!manifest.id) fail("manifest.json has no id");
const pluginId = manifest.id;

// --- bootstrap the dev vault (both dirs are gitignored) -------------------
const obsidianDir = path.join(devVault, ".obsidian");
fs.mkdirSync(path.join(obsidianDir, "plugins"), { recursive: true });
fs.mkdirSync(profileDir, { recursive: true });

const communityPluginsFile = path.join(obsidianDir, "community-plugins.json");
let enabled = [];
if (fs.existsSync(communityPluginsFile)) {
  try {
    enabled = JSON.parse(fs.readFileSync(communityPluginsFile, "utf8"));
  } catch {
    enabled = [];
  }
}
if (!enabled.includes(pluginId)) {
  enabled.push(pluginId);
  fs.writeFileSync(communityPluginsFile, JSON.stringify(enabled, null, 2));
  console.log(`dev: enabled plugin "${pluginId}" in dev vault`);
}

// Register the dev vault in the dev profile so Obsidian opens it directly.
const obsidianJson = path.join(profileDir, "obsidian.json");
let profileConfig = { vaults: {} };
if (fs.existsSync(obsidianJson)) {
  try {
    profileConfig = JSON.parse(fs.readFileSync(obsidianJson, "utf8"));
  } catch {
    profileConfig = { vaults: {} };
  }
}
if (!profileConfig.vaults) profileConfig.vaults = {};
const samePath = (p) => path.resolve(p).toLowerCase() === devVault.toLowerCase();
let entry = Object.values(profileConfig.vaults).find((v) => samePath(v.path));
if (!entry) {
  const id = Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  entry = { path: devVault, ts: Date.now() };
  profileConfig.vaults[id] = entry;
}
for (const v of Object.values(profileConfig.vaults)) v.open = v === entry;
fs.writeFileSync(obsidianJson, JSON.stringify(profileConfig));

// --- artifact sync ---------------------------------------------------------
const dest = path.join(obsidianDir, "plugins", pluginId);
const copyArtifacts = () => {
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ARTIFACTS) fs.copyFileSync(path.join(root, f), path.join(dest, f));
};

// --- Obsidian instance -----------------------------------------------------
const findExe = () => {
  const candidates = [
    exeOverride,
    process.env.OBSIDIAN_EXE,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "Obsidian", "Obsidian.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Obsidian", "Obsidian.exe"),
    "C:\\Program Files\\Obsidian\\Obsidian.exe",
    "/Applications/Obsidian.app/Contents/MacOS/Obsidian",
  ].filter(Boolean);
  return candidates.find((c) => fs.existsSync(c)) ?? null;
};

const launchObsidian = () => {
  const exe = findExe();
  if (!exe)
    fail("Obsidian executable not found — pass --exe <path> or set OBSIDIAN_EXE");
  spawn(exe, [`--user-data-dir=${profileDir}`, `--remote-debugging-port=${port}`], {
    detached: true,
    stdio: "ignore",
  }).unref();
  console.log(`dev: opened Obsidian — vault ${devVault}`);
  console.log(`dev: profile ${profileDir}, CDP port ${port}`);
};

// Best-effort hot reload: toggle the plugin inside the running instance.
// Requires Obsidian to have been launched with --remote-debugging-port.
let hintShown = false;
const reloadHint = () => {
  if (hintShown) return;
  hintShown = true;
  console.log(
    `dev: CDP not reachable on :${port} — rebuilds still sync to disk; ` +
      `reload manually via Ctrl+P -> "Reload app without saving"` +
      (open ? " (or close Obsidian and re-run so it starts with the debug port)" : "")
  );
};

const cdpEvaluate = async (expression) => {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  const targets = await res.json();
  const page = targets.find((t) => t.type === "page");
  if (!page) return false;
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  const done = new Promise((resolve) => {
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === 1) resolve(m);
    };
  });
  ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
  const msg = await Promise.race([done, new Promise((r) => setTimeout(() => r(null), 5000))]);
  ws.close();
  return msg?.result?.result?.value === true;
};

const reloadPlugin = async () => {
  const expr = `(async () => {
    if (!window.app?.plugins) return false;
    const id = ${JSON.stringify(pluginId)};
    try { await app.plugins.disablePlugin(id); } catch (e) {}
    try { await app.plugins.enablePlugin(id); } catch (e) { return false; }
    return true;
  })()`;
  try {
    if (await cdpEvaluate(expr)) {
      console.log("dev: plugin reloaded");
      return;
    }
  } catch {
    /* fall through to hint */
  }
  reloadHint();
};

// Serialize reloads so overlapping rebuilds never toggle the plugin twice.
let queue = Promise.resolve();

// --- build (watch) ---------------------------------------------------------
let firstBuild = true;
const ctx = await esbuild.context({
  ...makeOptions(false),
  absWorkingDir: root,
  plugins: [
    {
      name: "dev-vault-sync",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length) {
            console.error("dev: build failed — dev vault left as-is");
            return;
          }
          copyArtifacts();
          console.log(`dev: built + synced -> ${dest}`);
          if (firstBuild) {
            firstBuild = false;
            if (open) launchObsidian();
          } else {
            queue = queue.then(reloadPlugin);
          }
        });
      },
    },
  ],
});

process.on("SIGINT", async () => {
  console.log("\ndev: stopping watcher (Obsidian stays open)");
  await ctx.dispose();
  process.exit(0);
});

await ctx.watch();
console.log(`dev: watching src/ — press Ctrl+C to stop`);
