import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		setupFiles: ["test/setup.ts"],
		include: ["test/**/*.test.{ts,tsx}"],
	},
	resolve: {
		alias: {
			obsidian: import.meta.dirname + "/test/obsidian-stub.ts",
		},
	},
});
