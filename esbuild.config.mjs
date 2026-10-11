import esbuild from "esbuild";
import process from "process";
import { makeOptions } from "./scripts/esbuild-options.mjs";

const prod = process.argv[2] === "production";

const context = await esbuild.context(makeOptions(prod));

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
