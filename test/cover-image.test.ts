// Cover normalization tests (change: add-cover-normalization). Covers the
// spec scenarios in specs/movie-data-storage/spec.md: proportional downscale
// to longest side <= 800, byte-identical pass-through for already-small
// images, and fail-soft fallback that never blocks saving. The downscale path
// stubs the canvas globals; jsdom has no createImageBitmap, which exercises
// the fallback path natively (design D4).
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	normalizeCover,
	coverScaleFactor,
	COVER_MAX_DIMENSION,
	COVER_JPEG_QUALITY,
} from "../src/coverImage";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("coverScaleFactor (pure rule)", () => {
	it("caps the longest side at 800", () => {
		expect(COVER_MAX_DIMENSION).toBe(800);
		expect(coverScaleFactor(4000, 3000)).toBeCloseTo(0.2, 10);
		expect(coverScaleFactor(800, 800)).toBe(1);
		expect(coverScaleFactor(600, 400)).toBe(1);
	});

	it("never enlarges, even for tiny or degenerate inputs", () => {
		expect(coverScaleFactor(100, 150)).toBe(1);
		expect(coverScaleFactor(0, 0)).toBe(1);
		expect(coverScaleFactor(-5, 100)).toBe(1);
		expect(coverScaleFactor(Number.NaN, 100)).toBe(1);
	});

	it("scales proportionally (ratio preserved by construction)", () => {
		const s = coverScaleFactor(3000, 5000);
		expect(Math.round(3000 * s)).toBe(480);
		expect(Math.round(5000 * s)).toBe(800);
	});
});

describe("normalizeCover (downscale path)", () => {
	it("scales 4000x3000 to 800x600 with ratio preserved, smaller JPEG output", async () => {
		const ops: string[] = [];
		let fillStyleAtFill = "";
		const fakeCtx = {
			fillStyle: "",
			imageSmoothingEnabled: false,
			imageSmoothingQuality: "auto",
			fillRect() {
				fillStyleAtFill = String(this.fillStyle);
				ops.push("fillRect");
			},
			drawImage() {
				ops.push("drawImage");
			},
		};
		const bitmap = { width: 4000, height: 3000, close: vi.fn() };
		vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
			fakeCtx as unknown as CanvasRenderingContext2D
		);
		const outBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
		const toBlobCall: { type?: string; quality?: number; width?: number; height?: number } = {};
		vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
			this: HTMLCanvasElement,
			cb: BlobCallback,
			type?: string,
			quality?: number
		) {
			toBlobCall.type = type;
			toBlobCall.quality = quality;
			toBlobCall.width = this.width;
			toBlobCall.height = this.height;
			cb(new Blob([outBytes], { type: "image/jpeg" }));
		});

		const input = new Uint8Array(50_000).fill(0xab);
		const result = await normalizeCover(input);

		// Downscaled canvas: 4000x3000 -> 800x600 (longest side <= 800, ratio intact).
		expect(toBlobCall).toEqual({
			type: "image/jpeg",
			quality: COVER_JPEG_QUALITY,
			width: 800,
			height: 600,
		});
		// White background filled before drawing (no black JPEG backdrop).
		expect(fillStyleAtFill).toBe("#ffffff");
		expect(ops).toEqual(["fillRect", "drawImage"]);
		// Encoded bytes are returned and smaller than the source file.
		expect(Array.from(result)).toEqual(Array.from(outBytes));
		expect(result.length).toBeLessThan(input.length);
		expect(bitmap.close).toHaveBeenCalled();
	});

	it("passes an already-small image through byte-identical with no canvas work", async () => {
		const bitmap = { width: 700, height: 700, close: vi.fn() };
		vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
		const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
		const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, "toBlob");

		const input = new Uint8Array([1, 2, 3, 4]);
		const result = await normalizeCover(input);

		expect(result).toBe(input); // same bytes: no downscale, no enlargement, no re-encode
		expect(result).toHaveLength(4);
		expect(getContextSpy).not.toHaveBeenCalled();
		expect(toBlobSpy).not.toHaveBeenCalled();
		expect(bitmap.close).toHaveBeenCalled();
	});
});

describe("normalizeCover (fail-soft fallback)", () => {
	it("returns input unchanged when canvas APIs are unavailable (jsdom default)", async () => {
		// jsdom defines no createImageBitmap -> ReferenceError -> caught (D4).
		const input = new Uint8Array([9, 9, 9, 9]);
		const result = await normalizeCover(input);
		expect(result).toBe(input);
	});

	it("returns input unchanged when decoding throws", async () => {
		vi.stubGlobal(
			"createImageBitmap",
			vi.fn().mockRejectedValue(new Error("decode failed"))
		);
		const input = new Uint8Array([8, 8, 8]);
		expect(await normalizeCover(input)).toBe(input);
	});

	it("returns input unchanged when the 2d context is unavailable", async () => {
		const bitmap = { width: 4000, height: 3000, close: vi.fn() };
		vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
		const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, "toBlob");

		const input = new Uint8Array([7, 7, 7]);
		expect(await normalizeCover(input)).toBe(input);
		expect(toBlobSpy).not.toHaveBeenCalled();
	});

	it("returns input unchanged when encoding yields no blob", async () => {
		const bitmap = { width: 4000, height: 3000, close: vi.fn() };
		vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			fillStyle: "",
			fillRect: vi.fn(),
			drawImage: vi.fn(),
		} as unknown as CanvasRenderingContext2D);
		vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
			cb: BlobCallback
		) {
			cb(null);
		});

		const input = new Uint8Array([6, 6, 6]);
		expect(await normalizeCover(input)).toBe(input);
	});
});
