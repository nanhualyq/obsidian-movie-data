// Single source of truth for the esbuild options.
// Imported by esbuild.config.mjs (npm run dev / npm run build) and by
// scripts/dev.mjs (dev vault), so the dev vault always receives exactly what
// the normal local build produces.
import builtins from "builtin-modules";

export const makeOptions = (prod) => ({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", ...builtins],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  minify: prod,
  treeShaking: true,
  outfile: "main.js",
});
