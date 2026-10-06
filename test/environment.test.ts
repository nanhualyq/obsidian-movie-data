import { describe, expect, it } from "vitest";

describe("test environment", () => {
	it("runs in jsdom with object URL polyfills", () => {
		expect(typeof document).toBe("object");
		expect(typeof URL.createObjectURL).toBe("function");
		expect(typeof URL.revokeObjectURL).toBe("function");
	});
});
