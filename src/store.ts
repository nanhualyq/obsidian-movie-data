import type { App } from "obsidian";
import type { MovieStoreData } from "./types";

export const DATA_DIR = ".movie-data";
export const JSON_PATH = `${DATA_DIR}/movies.json`;
export const COVERS_DIR = `${DATA_DIR}/covers`;

// Fixed 16-byte prefix. First byte 'M' (0x4D) matches no known image
// signature (PNG 0x89, JPEG 0xFF, GIF 'G', BMP 'B', WebP 'RIFF'), and the
// .mcov extension defeats extension-based scanners (spec: "Other applications
// do not recognize covers").
export const COVER_PREFIX = new TextEncoder().encode("MOVIEMOVIECOVER!");

/** Prepend the fixed prefix to original image bytes. Format-agnostic. */
export function stampCover(original: Uint8Array): Uint8Array {
	const out = new Uint8Array(COVER_PREFIX.length + original.length);
	out.set(COVER_PREFIX, 0);
	out.set(original, COVER_PREFIX.length);
	return out;
}

/** Strip the fixed prefix by offset. No parsing, no format knowledge. */
export function decodeCover(stamped: Uint8Array): Uint8Array {
	return stamped.slice(COVER_PREFIX.length);
}

/** Copy bytes into a standalone ArrayBuffer acceptable as a BlobPart. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** D7: Date.now-based short id with random suffix, m_/a_ prefixed. */
export function newId(prefix: "m" | "a"): string {
	return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export type LoadResult = { ok: true; data: MovieStoreData } | { ok: false };

/**
 * Pure I/O layer: reads/writes movies.json and cover files. Holds no
 * business data - the React app owns that; the only state kept here is
 * resource lifecycle (staged covers awaiting save, cached blob URLs).
 */
export class MovieStore {
	private pendingCovers = new Map<string, Uint8Array>();
	private coverCache = new Map<string, string>();
	private stagedPreviewUrls = new Set<string>();

	constructor(private app: App) {}

	private get adapter() {
		return this.app.vault.adapter;
	}

	/** Spec: Fresh install creates ./.movie-data/covers/ and an empty movies.json. */
	async ensure(): Promise<void> {
		if (!(await this.adapter.exists(DATA_DIR))) {
			await this.adapter.mkdir(DATA_DIR);
		}
		if (!(await this.adapter.exists(COVERS_DIR))) {
			await this.adapter.mkdir(COVERS_DIR);
		}
		if (!(await this.adapter.exists(JSON_PATH))) {
			await this.adapter.write(JSON_PATH, JSON.stringify({ movies: [], actors: [] }, null, 2));
		}
	}

	/** Load movies.json. On any failure, returns { ok: false } without throwing. */
	async load(): Promise<LoadResult> {
		try {
			if (!(await this.adapter.exists(JSON_PATH))) {
				await this.ensure();
			}
			const raw = await this.adapter.read(JSON_PATH);
			const parsed = JSON.parse(raw);
			if (!parsed || !Array.isArray(parsed.movies) || !Array.isArray(parsed.actors)) {
				throw new Error("movies.json has unexpected shape");
			}
			return { ok: true, data: { movies: parsed.movies, actors: parsed.actors } };
		} catch (e) {
			console.error("movie-data: failed to load movies.json", e);
			return { ok: false };
		}
	}

	/**
	 * Stage a cover for a pending edit. Nothing touches disk until save().
	 * Returns the cover filename and a preview URL of the deformed-then-decoded bytes.
	 */
	stageCover(entityId: string, original: Uint8Array): { filename: string; previewUrl: string } {
		const filename = `${entityId}.mcov`;
		const stamped = stampCover(original);
		this.pendingCovers.set(filename, stamped);
		const previewUrl = URL.createObjectURL(new Blob([toArrayBuffer(decodeCover(stamped))]));
		this.stagedPreviewUrls.add(previewUrl);
		return { filename, previewUrl };
	}

	/** Drop all staged covers (cancel path: nothing was written). */
	discardStaged(): void {
		this.pendingCovers.clear();
		for (const url of this.stagedPreviewUrls) URL.revokeObjectURL(url);
		this.stagedPreviewUrls.clear();
	}

	/**
	 * Spec: Explicit persistence. Writes staged covers first, then the whole
	 * movies.json. Nothing is written unless this is called (save path only).
	 */
	async save(data: MovieStoreData): Promise<void> {
		for (const [filename, bytes] of this.pendingCovers) {
			await this.adapter.writeBinary(`${COVERS_DIR}/${filename}`, toArrayBuffer(bytes));
			this.invalidateCover(filename);
		}
		this.discardStaged();
		await this.adapter.write(JSON_PATH, JSON.stringify(data, null, 2));
	}

	/**
	 * Lazy decode with in-memory cache (D3). Returns an object URL for the
	 * decoded image, or null on missing/corrupt file (placeholder path).
	 */
	async coverUrl(filename: string): Promise<string | null> {
		if (!filename) return null;
		const cached = this.coverCache.get(filename);
		if (cached) return cached;
		try {
			const raw = await this.adapter.readBinary(`${COVERS_DIR}/${filename}`);
			const bytes = new Uint8Array(raw);
			if (bytes.length <= COVER_PREFIX.length) throw new Error("cover too short");
			const url = URL.createObjectURL(new Blob([toArrayBuffer(decodeCover(bytes))]));
			this.coverCache.set(filename, url);
			return url;
		} catch (e) {
			console.error(`movie-data: failed to decode cover ${filename}`, e);
			return null;
		}
	}

	/**
	 * Delete a cover file and drop its cached object URL so it can no longer
	 * be rendered. A missing file is not an error (entities may have no
	 * cover, or a prior write may have failed); real removal failures propagate.
	 */
	async deleteCover(filename: string): Promise<void> {
		if (!filename) return;
		this.invalidateCover(filename);
		if (await this.adapter.exists(`${COVERS_DIR}/${filename}`)) {
			await this.adapter.remove(`${COVERS_DIR}/${filename}`);
		}
	}

	private invalidateCover(filename: string): void {
		const url = this.coverCache.get(filename);
		if (url) {
			URL.revokeObjectURL(url);
			this.coverCache.delete(filename);
		}
	}

	/** Revoke all object URLs on plugin unload. */
	unload(): void {
		for (const url of this.coverCache.values()) URL.revokeObjectURL(url);
		this.coverCache.clear();
		this.discardStaged();
	}
}
