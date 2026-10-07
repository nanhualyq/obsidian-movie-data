// Unit tests for the pure helpers in src/ui/state.ts.
import { describe, expect, it } from "vitest";
import { tagHistory } from "../src/ui/state";
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
