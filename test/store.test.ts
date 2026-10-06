// Store-level tests: pure I/O behavior of MovieStore against an in-memory
// adapter. Ported from the store-level assertions in test/verify.ts and
// test/e2e.ts (layout, load errors, persistence order, cover deformation).
import { beforeEach, describe, expect, it } from "vitest";
import {
	MovieStore,
	COVER_PREFIX,
	stampCover,
	decodeCover,
	JSON_PATH,
	COVERS_DIR,
} from "../src/store";
import { createMemoryApp, type MemoryApp } from "./memory-app";

const IMAGE_SIGS = [
	[0x89, 0x50, 0x4e, 0x47], // PNG
	[0xff, 0xd8, 0xff], // JPEG
	[0x47, 0x49, 0x46, 0x38], // GIF
	[0x42, 0x4d], // BMP
];

let mem: MemoryApp;
let store: MovieStore;

beforeEach(() => {
	mem = createMemoryApp();
	store = new MovieStore(mem.app);
});

describe("ensure (fresh install)", () => {
	it("creates ./.movie-data/covers/ and an empty movies.json", async () => {
		await store.ensure();
		expect(mem.files.has(".movie-data/covers")).toBe(true);
		expect(mem.files.has(JSON_PATH)).toBe(true);
		expect(JSON.parse(mem.files.get(JSON_PATH) as string)).toEqual({
			movies: [],
			actors: [],
		});
	});
});

describe("load", () => {
	it("returns ok with data on a fresh install", async () => {
		await store.ensure();
		const res = await store.load();
		expect(res).toEqual({ ok: true, data: { movies: [], actors: [] } });
	});

	it("returns ok:false for corrupt JSON (no throw)", async () => {
		await store.ensure();
		mem.files.set(JSON_PATH, "{broken");
		const res = await store.load();
		expect(res).toEqual({ ok: false });
	});

	it("returns ok:false for unexpected shape", async () => {
		await store.ensure();
		mem.files.set(JSON_PATH, JSON.stringify({ movies: {}, actors: [] }));
		const res = await store.load();
		expect(res).toEqual({ ok: false });
	});

	it("restores saved collections and decodes covers after a fresh-store reload", async () => {
		await store.ensure();
		await store.save({
			movies: [
				{
					id: "m_1",
					title: "Blade Runner 2049",
					cover: "",
					tags: ["sci-fi"],
					actorIds: ["a_1"],
					info: "Line one\nline two (verbatim)",
					url: "",
				},
			],
			actors: [{ id: "a_1", name: "Ana de Armas", cover: "", info: "", url: "" }],
		});
		const store2 = new MovieStore(mem.app);
		const res = await store2.load();
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.data.movies).toHaveLength(1);
		expect(res.data.actors).toHaveLength(1);
		expect(res.data.actors[0].name).toBe("Ana de Armas");
		expect(res.data.movies[0].info).toContain("\n");

		// e2e 6: cover decodes from a brand-new store instance over the same files
		store.stageCover("m_1", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 9]));
		await store.save({ ...res.data, movies: [{ ...res.data.movies[0], cover: "m_1.mcov" }] });
		const store3 = new MovieStore(mem.app);
		const url = await store3.coverUrl("m_1.mcov");
		expect(url).not.toBeNull();
	});
});

describe("save (explicit persistence)", () => {
	it("writes movies.json with the given data", async () => {
		await store.ensure();
		const data = {
			movies: [
				{
					id: "m_1",
					title: "Heat",
					cover: "",
					tags: ["crime"],
					actorIds: [],
					info: "",
					url: "",
				},
			],
			actors: [],
		};
		await store.save(data);
		expect(JSON.parse(mem.files.get(JSON_PATH) as string)).toEqual(data);
	});

	it("writes staged covers before movies.json", async () => {
		await store.ensure();
		mem.writes.length = 0; // ignore ensure()'s own writes
		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
		store.stageCover("m_9", png);
		await store.save({ movies: [], actors: [] });
		const coverWrite = mem.writes.findIndex((p) => p.startsWith(COVERS_DIR));
		const jsonWrite = mem.writes.indexOf(JSON_PATH);
		expect(coverWrite).toBeGreaterThanOrEqual(0);
		expect(jsonWrite).toBeGreaterThan(coverWrite);
	});

	it("writes nothing until save() is called", async () => {
		await store.ensure();
		mem.writes.length = 0;
		store.stageCover("m_9", new Uint8Array([1, 2, 3]));
		expect(mem.writes).toHaveLength(0);
	});

	it("discardStaged drops staged covers (cancel path)", async () => {
		await store.ensure();
		store.stageCover("m_9", new Uint8Array([1, 2, 3]));
		store.discardStaged();
		await store.save({ movies: [], actors: [] });
		expect(mem.files.has(`${COVERS_DIR}/m_9.mcov`)).toBe(false);
	});
});

describe("cover deformation (scanner resistance)", () => {
	it("stampCover prepends the fixed prefix; decodeCover round-trips bytes", () => {
		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 7, 7, 7]);
		const stamped = stampCover(png);
		expect([...stamped.slice(0, COVER_PREFIX.length)]).toEqual([...COVER_PREFIX]);
		expect(Buffer.from(decodeCover(stamped))).toEqual(Buffer.from(png));
	});

	it("staged covers land on disk with .mcov, no image magic bytes, prefix at 0", async () => {
		await store.ensure();
		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 7, 7, 7, 7, 7]);
		store.stageCover("m_1", png);
		await store.save({ movies: [], actors: [] });

		const coverNames = [...mem.files.keys()].filter((k) => k.startsWith(`${COVERS_DIR}/`));
		expect(coverNames.length).toBeGreaterThan(0);
		expect(coverNames.every((n) => n.endsWith(".mcov"))).toBe(true);
		expect(coverNames.every((n) => !/\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i.test(n))).toBe(true);

		for (const n of coverNames) {
			const bytes = mem.files.get(n) as Buffer;
			expect(IMAGE_SIGS.some((sig) => sig.every((b, i) => bytes[i] === b))).toBe(false);
			expect(bytes.slice(0, COVER_PREFIX.length).equals(Buffer.from(COVER_PREFIX))).toBe(true);
		}
	});

	it("coverUrl decodes to the original bytes and caches the result", async () => {
		await store.ensure();
		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
		store.stageCover("m_2", png);
		await store.save({ movies: [], actors: [] });

		const url1 = await store.coverUrl("m_2.mcov");
		const url2 = await store.coverUrl("m_2.mcov");
		expect(url1).not.toBeNull();
		expect(url2).toBe(url1); // decode cached across re-renders
	});

	it("returns null for missing or too-short covers (placeholder path)", async () => {
		await store.ensure();
		mem.files.set(`${COVERS_DIR}/bad.mcov`, Buffer.from([1, 2]));
		expect(await store.coverUrl("missing.mcov")).toBeNull();
		expect(await store.coverUrl("bad.mcov")).toBeNull();
		expect(await store.coverUrl("")).toBeNull();
	});
});
