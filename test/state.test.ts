// Unit tests for the pure helpers in src/ui/state.ts.
import { describe, expect, it } from "vitest";
import { computeResults, idTimestamp, shuffleSeeded, tagHistory, type ListState } from "../src/ui/state";
import type { Movie } from "../src/types";

const movie = (tags: string[]): Movie => ({
	id: "m_" + tags.join("-"),
	title: "t",
	cover: "",
	tags,
	actorIds: [],
	info: "",
	url: "",
});

/** Realistic newId shape: `<prefix>_<base36 time><4 random>`. */
const idAt = (ms: number, rand = "abcd") => `m_${ms.toString(36)}${rand}`;

describe("tagHistory", () => {
	it("counts overlapping tags across movies, ordered count desc", () => {
		const movies = [movie(["drama", "action"]), movie(["drama"]), movie(["drama", "action"])];
		expect(tagHistory(movies)).toEqual([
			{ tag: "drama", count: 3 },
			{ tag: "action", count: 2 },
		]);
	});

	it("breaks count ties alphabetically", () => {
		const movies = [movie(["comedy", "action", "sci-fi"])];
		expect(tagHistory(movies).map((e) => e.tag)).toEqual(["action", "comedy", "sci-fi"]);
	});

	it("returns each distinct tag once", () => {
		const movies = [movie(["a", "a", "b"])];
		expect(tagHistory(movies)).toEqual([
			{ tag: "a", count: 2 },
			{ tag: "b", count: 1 },
		]);
	});

	it("returns an empty list for no movies or no tags", () => {
		expect(tagHistory([])).toEqual([]);
		expect(tagHistory([movie([]), movie([])])).toEqual([]);
	});
});

describe("idTimestamp", () => {
	it("parses the base36 time prefix of a realistic id", () => {
		expect(idTimestamp(idAt(1_700_000_000_000))).toBe(1_700_000_000_000);
		expect(idTimestamp("a_" + (1_700_000_000_000).toString(36) + "zz99")).toBe(1_700_000_000_000);
	});

	it("returns null for ids not in newId shape (fixtures, fixed ids)", () => {
		expect(idTimestamp("m_1")).toBeNull();
		expect(idTimestamp("m_drama-action")).toBeNull();
		expect(idTimestamp("a_unknown")).toBeNull();
		expect(idTimestamp("no-underscore-id")).toBeNull();
	});

	it("compares numerically across digit-count boundaries (string compare would flip)", () => {
		const older = idAt(36 ** 7 - 1, "zzzz"); // 7-digit base36 time
		const newer = idAt(36 ** 7, "aaaa"); // 8-digit base36 time
		expect(idTimestamp(older)!).toBeLessThan(idTimestamp(newer)!);
		// the trap this guards: lexicographic "zzz..." > "1000000"
		expect(older.slice(2).slice(0, -4) > newer.slice(2).slice(0, -4)).toBe(true);
	});
});

describe("computeResults ordering", () => {
	const list: ListState = { actorFilter: "", selectedTags: new Set<string>(), page: 1, sortMode: "newest", shuffleSeed: 0 };
	const at = (ms: number, title: string): Movie => ({
		id: idAt(ms),
		title,
		cover: "",
		tags: [],
		actorIds: [],
		info: "",
		url: "",
	});

	it("orders movies newest-first regardless of file order", () => {
		const movies = [at(1_600_000_000_000, "old"), at(1_700_000_000_000, "mid"), at(1_800_000_000_000, "new")];
		expect(computeResults(movies, [], list, "movies").map((e) => e.title)).toEqual(["new", "mid", "old"]);
	});

	it("orders actors newest-first", () => {
		const actors = [
			{ id: "a_" + (1_600_000_000_000).toString(36) + "aaaa", name: "first", cover: "", info: "", url: "" },
			{ id: "a_" + (1_800_000_000_000).toString(36) + "bbbb", name: "second", cover: "", info: "", url: "" },
		];
		expect(computeResults([], actors, list, "actors").map((e) => e.title)).toEqual([
			"second",
			"first",
		]);
	});

	it("an edit (same id) does not reorder", () => {
		const movies = [at(1_600_000_000_000, "old"), at(1_800_000_000_000, "new")];
		const before = computeResults(movies, [], list, "movies").map((e) => e.id);
		// edit in place: title changes, id and file position do not
		const edited = movies.map((m) => (m.id === movies[0].id ? { ...m, title: "old renamed" } : m));
		expect(computeResults(edited, [], list, "movies").map((e) => e.id)).toEqual(before);
		expect(computeResults(edited, [], list, "movies")[0].title).toBe("new");
	});

	it("ids without a parseable timestamp keep their input order", () => {
		const movies = [movie(["x"]), movie(["y"]), movie(["z"])];
		expect(computeResults(movies, [], list, "movies").map((e) => e.id)).toEqual(["m_x", "m_y", "m_z"]);
	});

	it("same-millisecond ids keep their input order (stable tie)", () => {
		const movies = [at(1_800_000_000_000, "a"), at(1_800_000_000_000, "b")];
		expect(computeResults(movies, [], list, "movies").map((e) => e.title)).toEqual(["a", "b"]);
	});
});

describe("computeResults random mode", () => {
	const seeded = (shuffleSeed: number, over: Partial<ListState> = {}): ListState => ({
		actorFilter: "",
		selectedTags: new Set<string>(),
		page: 1,
		sortMode: "random",
		shuffleSeed,
		...over,
	});
	const at = (ms: number, title: string, tags: string[] = []): Movie => ({
		id: idAt(ms),
		title,
		cover: "",
		tags,
		actorIds: [],
		info: "",
		url: "",
	});

	it("shuffleSeeded is deterministic per seed, seed-sensitive, a true permutation, and pure", () => {
		const items = [1, 2, 3, 4, 5, 6, 7, 8];
		const s42 = shuffleSeeded(items, 42);
		expect(s42).toEqual(shuffleSeeded(items, 42)); // same seed -> same order
		expect(s42).not.toEqual(shuffleSeeded(items, 43)); // different seed -> different order
		expect([...s42].sort((a, b) => a - b)).toEqual(items); // a permutation, no drops/dupes
		expect(s42).not.toEqual(items); // actually shuffled, not the identity
		expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // pure: input untouched
	});

	it("a pinned seed yields a stable random order across calls", () => {
		const movies = [at(1_600_000_000_000, "a"), at(1_650_000_000_000, "b"), at(1_700_000_000_000, "c"), at(1_750_000_000_000, "d")];
		const a = computeResults(movies, [], seeded(12345), "movies").map((e) => e.id);
		const b = computeResults(movies, [], seeded(12345), "movies").map((e) => e.id);
		expect(a).toEqual(b);
	});

	it("random mode returns the same movies as newest-first (a reordering, no drops/dupes)", () => {
		const movies = [at(1_600_000_000_000, "a"), at(1_650_000_000_000, "b"), at(1_700_000_000_000, "c"), at(1_750_000_000_000, "d"), at(1_800_000_000_000, "e")];
		const newest = computeResults(movies, [], seeded(0, { sortMode: "newest" }), "movies").map((e) => e.id);
		const random = computeResults(movies, [], seeded(12345), "movies").map((e) => e.id);
		expect([...random].sort()).toEqual([...newest].sort());
	});

	it("filtering in random mode reveals a stable subset (no reshuffle)", () => {
		const movies = [
			at(1_600_000_000_000, "a", ["drama"]),
			at(1_650_000_000_000, "b", ["action"]),
			at(1_700_000_000_000, "c", ["drama"]),
			at(1_750_000_000_000, "d", ["action"]),
			at(1_800_000_000_000, "e", ["drama", "action"]),
		];
		const base = seeded(999);
		const full = computeResults(movies, [], base, "movies").map((e) => e.id);
		const drama = computeResults(movies, [], { ...base, selectedTags: new Set(["drama"]) }, "movies").map((e) => e.id);
		expect(drama).toHaveLength(3);
		// the filtered list is a subsequence of the full random order: order is
		// preserved, not reshuffled (a filter-then-shuffle impl would fail here).
		let cursor = 0;
		for (const id of drama) {
			cursor = full.indexOf(id, cursor) + 1;
			expect(cursor).toBeGreaterThan(0);
		}
	});

	it("actors branch is newest-first regardless of sortMode", () => {
		const actors = [
			{ id: "a_" + (1_600_000_000_000).toString(36) + "aaaa", name: "first", cover: "", info: "", url: "" },
			{ id: "a_" + (1_800_000_000_000).toString(36) + "bbbb", name: "second", cover: "", info: "", url: "" },
		];
		const randomList = seeded(4242); // sortMode: "random"
		expect(computeResults([], actors, randomList, "actors").map((e) => e.title)).toEqual(["second", "first"]);
	});
});
