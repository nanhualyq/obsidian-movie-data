// UI tests: React app rendered in jsdom via Testing Library. Ports the
// scenario coverage of the old test/verify.ts + test/e2e.ts view tests.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "../src/ui/App";
import { MovieStore, stampCover, COVER_PREFIX, JSON_PATH, COVERS_DIR } from "../src/store";
import { createMemoryApp, type MemoryApp } from "./memory-app";

let mem: MemoryApp;
let store: MovieStore;

beforeEach(() => {
	cleanup();
	mem = createMemoryApp();
	store = new MovieStore(mem.app);
});

/** Seed movies.json directly (bypasses the store) so App.load() reads it. */
function seedJson(data: unknown): void {
	mem.files.set(JSON_PATH, JSON.stringify(data, null, 2));
}

async function renderApp() {
	const view = render(<App store={store} />);
	// App loads async; wait until list or error screen is up
	await waitFor(() => {
		expect(
			document.querySelector(".movie-data-grid, .movie-data-load-error")
		).not.toBeNull();
	});
	return view;
}

const cells = () => Array.from(document.querySelectorAll(".movie-data-cell"));
const buttons = () => screen.queryAllByRole("button");
const button = (text: string) => buttons().find((b) => b.textContent === text)!;
const searchInput = () => screen.getByPlaceholderText("Search title or actor...") as HTMLInputElement;
function typeSearch(value: string) {
	fireEvent.change(searchInput(), { target: { value } });
}

const ACTOR = { id: "a_1", name: "Keanu Reeves", cover: "", info: "bio", url: "" };
const MOVIES = [
	{ id: "m_1", title: "The Matrix", cover: "", tags: ["sci-fi", "action"], actorIds: ["a_1"], info: "free text\nkept verbatim", url: "http://x" },
	{ id: "m_2", title: "Amelie", cover: "", tags: ["comedy"], actorIds: [], info: "", url: "" },
];

describe("list: grid render", () => {
	it("renders one cell per movie with the title", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		expect(cells()).toHaveLength(2);
		expect(document.querySelector(".movie-data-cell-title")?.textContent).toBe("The Matrix");
	});

	it("corrupt cover shows placeholder (no crash)", async () => {
		seedJson({ movies: [{ ...MOVIES[0], cover: "bad.mcov" }], actors: [ACTOR] });
		mem.files.set(`${COVERS_DIR}/bad.mcov`, Buffer.from([1, 2]));
		await renderApp();
		await waitFor(() => {
			expect(document.querySelector(".movie-data-cover.is-placeholder")).not.toBeNull();
		});
		expect(document.querySelector(".movie-data-cover img")).toBeNull();
	});

	it("valid cover renders as <img> after lazy decode", async () => {
		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
		mem.files.set(`${COVERS_DIR}/m_2.mcov`, Buffer.from(stampCover(png)));
		seedJson({ movies: [{ ...MOVIES[1], cover: "m_2.mcov" }], actors: [] });
		await renderApp();
		await waitFor(() => {
			expect(document.querySelector(".movie-data-cover img")).not.toBeNull();
		});
	});

	it("empty store shows add prompt, not a broken list", async () => {
		seedJson({ movies: [], actors: [] });
		await renderApp();
		expect(screen.getByText("No movies yet. Add one!")).toBeTruthy();
	});
});

describe("list: search / filter", () => {
	it("search by actor name returns referencing movie", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		typeSearch("keanu");
		expect(cells()).toHaveLength(1);
		expect(cells()[0].textContent).toContain("The Matrix");
	});

	it("no results shows empty state", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		typeSearch("zzz-no-match");
		expect(screen.getByText("No results")).toBeTruthy();
	});

	it("tag chips are the sorted union of movie tags; filter narrows", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		const chips = Array.from(document.querySelectorAll(".movie-data-tag")).map((c) => c.textContent);
		expect(chips).toEqual(["action", "comedy", "sci-fi"]);
		fireEvent.click(button("comedy"));
		expect(cells()).toHaveLength(1);
		expect(cells()[0].textContent).toContain("Amelie");
		fireEvent.click(button("comedy")); // untoggle
		expect(cells()).toHaveLength(2);
	});

	it("entity switch shows actors; add button follows filter; tags hidden", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		fireEvent.click(button("Actors"));
		expect(cells()).toHaveLength(1);
		expect(cells()[0].textContent).toContain("Keanu Reeves");
		expect(button("+ Add actor")).toBeTruthy();
		expect(document.querySelector(".movie-data-tags")!.className).toContain("is-hidden");
		fireEvent.click(button("Movies"));
		expect(button("+ Add movie")).toBeTruthy();
		expect(document.querySelector(".movie-data-tags")!.className).not.toContain("is-hidden");
	});

	it("search text survives an open-and-cancel form round-trip", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		typeSearch("keanu");
		expect(cells()).toHaveLength(1);
		fireEvent.click(button("+ Add movie"));
		expect(screen.getByText("Add movie")).toBeTruthy();
		fireEvent.click(button("Cancel"));
		expect(searchInput().value).toBe("keanu");
		expect(cells()).toHaveLength(1);
	});
});

describe("load error screen", () => {
	it("corrupt movies.json renders the load-error state, no crash", async () => {
		mem.files.set(JSON_PATH, "{broken");
		await renderApp();
		expect(screen.getByText("Could not load movie data")).toBeTruthy();
		expect(document.querySelector(".movie-data-load-error")).not.toBeNull();
		// editing is disabled: no toolbar rendered
		expect(document.querySelector(".movie-data-toolbar")).toBeNull();
	});
});
