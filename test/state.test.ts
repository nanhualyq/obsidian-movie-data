// Unit tests for the pure helpers in src/ui/state.ts.
import { describe, expect, it } from "vitest";
import { computeResults, idTimestamp, tagHistory, type ListState } from "../src/ui/state";
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
	const list: ListState = { actorFilter: "", selectedTags: new Set<string>(), page: 1 };
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
