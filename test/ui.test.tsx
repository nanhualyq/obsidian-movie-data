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
const actorSelect = () => document.querySelector(".movie-data-actor-select") as HTMLSelectElement;
function chooseActor(id: string) {
	fireEvent.change(actorSelect(), { target: { value: id } });
}

const ACTOR = { id: "a_1", name: "Keanu Reeves", cover: "", info: "bio", url: "" };
const ACTOR_NO_MOVIES = { id: "a_2", name: "Zoe Missing", cover: "", info: "", url: "" };
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

describe("list: selection filter", () => {
	it("no text search input is present; toolbar still renders", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		expect(document.querySelector(".movie-data-search")).toBeNull();
		expect(document.querySelector('input[type="search"]')).toBeNull();
		expect(document.querySelector(".movie-data-toolbar")).not.toBeNull();
		expect(button("Movies")).toBeTruthy();
		expect(button("Actors")).toBeTruthy();
	});

	it("actor dropdown: 'All actors' first, sorted actors, Unknown always present; narrows and resets", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		// Unknown option is listed even though no unknown record exists yet,
		// so movies with unknown cast stay filterable
		expect(Array.from(actorSelect().options).map((o) => o.textContent)).toEqual([
			"All actors",
			"Keanu Reeves",
			"Unknown",
		]);
		chooseActor("a_1");
		expect(cells()).toHaveLength(1);
		expect(cells()[0].textContent).toContain("The Matrix");
		chooseActor(""); // All actors resets the actor filter
		expect(cells()).toHaveLength(2);
	});

	it("combined tag + actor filter intersects; no match shows empty state", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		chooseActor("a_1");
		fireEvent.click(button("comedy")); // Amelie has comedy, not a_1
		expect(screen.getByText("No results")).toBeTruthy();
		fireEvent.click(button("comedy")); // untoggle widens again
		expect(cells()).toHaveLength(1);
		fireEvent.click(button("sci-fi")); // a_1 + sci-fi: both groups satisfied
		expect(cells()).toHaveLength(1);
		expect(cells()[0].textContent).toContain("The Matrix");
	});

	it("tag chips are the sorted union of movie tags; filter narrows and deselect widens", async () => {
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

	it("entity switch shows actors; add button follows filter; filters hidden in actors view", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		fireEvent.click(button("Actors"));
		expect(cells()).toHaveLength(1);
		expect(cells()[0].textContent).toContain("Keanu Reeves");
		expect(button("+ Add actor")).toBeTruthy();
		expect(document.querySelector(".movie-data-tags")!.className).toContain("is-hidden");
		expect(document.querySelector(".movie-data-actor-select")).toBeNull(); // dropdown hidden
		fireEvent.click(button("Movies"));
		expect(button("+ Add movie")).toBeTruthy();
		expect(document.querySelector(".movie-data-tags")!.className).not.toContain("is-hidden");
		expect(document.querySelector(".movie-data-actor-select")).not.toBeNull();
	});

	it("filter selection survives an open-and-cancel form round-trip", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		chooseActor("a_1");
		expect(cells()).toHaveLength(1);
		fireEvent.click(button("+ Add movie"));
		expect(screen.getByText("Add movie")).toBeTruthy();
		fireEvent.click(button("Cancel"));
		expect(actorSelect().value).toBe("a_1");
		expect(cells()).toHaveLength(1);
	});
});

describe("list: actor jump", () => {
	it("jump shows only that actor's movies, selects it in the dropdown, clears tags, opens no form", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR, ACTOR_NO_MOVIES] });
		await renderApp();
		fireEvent.click(button("sci-fi")); // pre-selected to prove the jump clears tags
		fireEvent.click(button("Actors"));
		expect(cells()).toHaveLength(2);

		const keanuCell = cells().find((c) => c.textContent!.includes("Keanu Reeves"))!;
		fireEvent.click(keanuCell.querySelector(".movie-data-jump")!);

		expect(document.querySelector(".movie-data-form")).toBeNull(); // edit form did NOT open
		expect(document.querySelector(".movie-data-actor-select")).not.toBeNull(); // movies view
		expect(actorSelect().value).toBe("a_1");
		expect(cells()).toHaveLength(1); // Amelie excluded by the actor filter
		expect(cells()[0].textContent).toContain("The Matrix");
		// tag chips cleared by the jump
		expect(button("sci-fi").className).not.toContain("is-active");
	});

	it("jump for an actor with no movies shows the empty state", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR, ACTOR_NO_MOVIES] });
		await renderApp();
		fireEvent.click(button("Actors"));
		const zoeCell = cells().find((c) => c.textContent!.includes("Zoe Missing"))!;
		fireEvent.click(zoeCell.querySelector(".movie-data-jump")!);

		expect(actorSelect().value).toBe("a_2");
		expect(cells()).toHaveLength(0);
		expect(screen.getByText("No results")).toBeTruthy();
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
