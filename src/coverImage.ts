/**
 * Cover normalization: downscale oversized images to an on-screen-appropriate
 * size before staging, so covers stay small for sync/backup (spec: "Covers are
 * size-normalized before storage"). All canvas/format knowledge lives here so
 * the store stays format-agnostic and synchronous (design D1/D2).
 *
 * Fail-soft by contract (design D4): any failure - missing APIs, decode or
 * encode errors - returns the input bytes unchanged, so normalization can
 * never block staging, preview, or saving.
 */

/** Longest-side cap for normalized covers (spec: at most 800 px). */
export const COVER_MAX_DIMENSION = 800;

/** Re-encode quality for normalized covers (design D3). */
export const COVER_JPEG_QUALITY = 0.82;

/**
 * Pure scale rule (design D3): s = min(1, CAP / max(w, h)).
 * Returns 1 (pass-through, no scaling) for invalid dimensions, so an image is
 * never enlarged and degenerate inputs cannot yield NaN/Infinity.
 */
export function coverScaleFactor(width: number, height: number): number {
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return 1;
	}
	return Math.min(1, COVER_MAX_DIMENSION / Math.max(width, height));
}

/** Copy bytes into a standalone ArrayBuffer acceptable as a BlobPart. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Normalize image bytes for storage: decode, downscale proportionally so the
 * longest side is <= COVER_MAX_DIMENSION (never enlarge), and re-encode as
 * JPEG on a white-filled canvas (transparent sources flatten to white, not
 * black). An image already within the cap passes through byte-identical -
 * no downscaling, no enlargement, no re-encoding (spec: "Already-small image
 * passes through unchanged").
 */
export async function normalizeCover(bytes: Uint8Array): Promise<Uint8Array> {
	try {
		const bitmap = await createImageBitmap(new Blob([toArrayBuffer(bytes)]));
		try {
			const s = coverScaleFactor(bitmap.width, bitmap.height);
			// Pass-through: already small enough -> original bytes, no re-encode.
			if (s === 1) return bytes;

			// Canvas is sized to the scaled dimensions; a fixed box would distort.
			const w = Math.max(1, Math.round(bitmap.width * s));
			const h = Math.max(1, Math.round(bitmap.height * s));

			const canvas = document.createElement("canvas");
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext("2d");
			if (!ctx) return bytes;

			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, w, h);
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = "high";
			ctx.drawImage(bitmap, 0, 0, w, h);

			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, "image/jpeg", COVER_JPEG_QUALITY)
			);
			if (!blob) return bytes;
			return new Uint8Array(await blob.arrayBuffer());
		} finally {
			bitmap.close();
		}
	} catch {
		// Fail-soft (spec: "Normalization failure never blocks saving").
		return bytes;
	}
}
