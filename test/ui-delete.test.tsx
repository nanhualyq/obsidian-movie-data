// Delete scenarios: delta specs movie-data-ui ("Delete an entity from the
// edit form", "Deleting a referenced actor is blocked") and movie-data-storage
// ("Deleting an entity persists to disk").
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "../src/ui/App";
import { Notice } from "obsidian";
import { MovieStore, COVER_PREFIX, JSON_PATH, COVERS_DIR } from "../src/store";
import { createMemoryApp, type MemoryApp } from "./memory-app";

let mem: MemoryApp;
let store: MovieStore;

beforeEach(() => {
	cleanup();
	mem = createMemoryApp();
	store = new MovieStore(mem.app);
	Notice.last = "";
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 7, 7, 7, 7, 7]);

function seed(data: { movies: any[]; actors: any[] }, coverFiles: Record<string, Uint8Array> = {}): void {
	mem.files.set(JSON_PATH, JSON.stringify(data, null, 2));
	for (const [name, bytes] of Object.entries(coverFiles)) {
		mem.files.set(`${COVERS_DIR}/${name}`, Buffer.concat([Buffer.from(COVER_PREFIX), Buffer.from(bytes)]));
	}
}

async function renderApp() {
	render(<App store={store} />);
	await waitFor(() => {
		expect(document.querySelector(".movie-data-grid, .movie-data-load-error")).not.toBeNull();
	});
}

const buttons = () => screen.queryAllByRole("button");
const button = (text: string) => buttons().find((b) => b.textContent === text)!;
const cells = () => Array.from(document.querySelectorAll(".movie-data-cell"));
const form = () => document.querySelector(".movie-data-form") as HTMLElement;
const json = () => JSON.parse(mem.files.get(JSON_PATH) as string);
/** Buttons inside the delete block only (form also has its own Cancel). */
const deleteBlock = () => within(document.querySelector(".movie-data-delete") as HTMLElement);
const deleteBtn = () => screen.getByRole("button", { name: "Delete" });

const MOVIE = { id: "m_1", title: "Heat", cover: "m_1.mcov", tags: ["crime"], actorIds: [], info: "", url: "" };
const ACTOR = { id: "a_1", name: "Ana de Armas", cover: "", info: "", url: "" };

describe("delete movie from edit form", () => {
	it("requires confirmation: single click does not delete; confirm removes entity and cover, JSON written first", async () => {
		seed({ movies: [MOVIE], actors: [] }, { "m_1.mcov": PNG });
		await renderApp();

		fireEvent.click(cells()[0]);
		expect(screen.getByText("Edit movie")).toBeTruthy();

		// arm only - nothing written yet (spec: confirmation before anything is written)
		fireEvent.click(deleteBtn());
		expect(screen.getByText("Confirm delete?")).toBeTruthy();
		expect(json().movies).toHaveLength(1);
		expect(mem.files.has(`${COVERS_DIR}/m_1.mcov`)).toBe(true);
		expect(mem.removals).toHaveLength(0);

		// confirm
		fireEvent.click(screen.getByRole("button", { name: "Confirm delete?" }));
		await waitFor(() => expect(screen.queryByText("Edit movie")).toBeNull());

		// back on list, no reload, movie gone from list + disk, cover removed
		expect(json().movies).toHaveLength(0);
		expect(mem.files.has(`${COVERS_DIR}/m_1.mcov`)).toBe(false);
		await waitFor(() => expect(cells()).toHaveLength(0));

		// ordering: movies.json written before cover deletion
		expect(mem.ops.indexOf(`write:${JSON_PATH}`)).toBeGreaterThanOrEqual(0);
		expect(mem.ops.indexOf(`remove:${COVERS_DIR}/m_1.mcov`)).toBeGreaterThan(
			mem.ops.indexOf(`write:${JSON_PATH}`)
		);
	});

	it("declining the confirmation writes nothing and keeps the form open", async () => {
		seed({ movies: [MOVIE], actors: [] }, { "m_1.mcov": PNG });
		await renderApp();
		const jsonBefore = mem.files.get(JSON_PATH);

		fireEvent.click(cells()[0]);
		fireEvent.click(deleteBtn());
		fireEvent.click(deleteBlock().getByRole("button", { name: "Cancel" }));

		expect(screen.getByText("Edit movie")).toBeTruthy(); // form stays open
		expect(mem.files.get(JSON_PATH)).toBe(jsonBefore); // nothing written
		expect(mem.removals).toHaveLength(0);
		expect(json().movies).toHaveLength(1);
	});

	it("add form offers no delete action", async () => {
		seed({ movies: [], actors: [] });
		await renderApp();

		fireEvent.click(button("+ Add movie"));
		expect(screen.getByText("Add movie")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
		expect(document.querySelector(".movie-data-delete")).toBeNull();
	});

	it("JSON write failure: Notice shown, entity and cover remain, form stays open", async () => {
		seed({ movies: [MOVIE], actors: [] }, { "m_1.mcov": PNG });
		// fail the JSON write only
		const adapter = mem.app.vault.adapter;
		const origWrite = adapter.write.bind(adapter);
		adapter.write = async (p: string, c: string) => {
			if (p === JSON_PATH) throw new Error("disk full");
			return origWrite(p, c);
		};

		await renderApp();
		fireEvent.click(cells()[0]);
		fireEvent.click(deleteBtn());
		fireEvent.click(screen.getByRole("button", { name: "Confirm delete?" }));

		await waitFor(() => expect(Notice.last).toContain("Failed to save movie data"));
		expect(json().movies).toHaveLength(1); // unchanged on disk
		expect(mem.files.has(`${COVERS_DIR}/m_1.mcov`)).toBe(true); // cover left in place
		expect(mem.removals).toHaveLength(0);
		expect(screen.getByText("Edit movie")).toBeTruthy(); // list/form state unchanged
	});

	it("movie without a cover deletes without error", async () => {
		seed({ movies: [{ ...MOVIE, cover: "" }], actors: [] });
		await renderApp();

		fireEvent.click(cells()[0]);
		fireEvent.click(deleteBtn());
		fireEvent.click(screen.getByRole("button", { name: "Confirm delete?" }));

		await waitFor(() => expect(screen.queryByText("Edit movie")).toBeNull());
		expect(json().movies).toHaveLength(0);
		expect(mem.removals).toHaveLength(0); // no cover to remove
	});
});

describe("delete actor from edit form", () => {
	it("confirmed delete removes the actor and returns to the list", async () => {
		seed({ movies: [], actors: [ACTOR] });
		await renderApp();

		fireEvent.click(button("Actors"));
		fireEvent.click(cells()[0]);
		expect(screen.getByText("Edit actor")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();

		fireEvent.click(deleteBtn());
		fireEvent.click(screen.getByRole("button", { name: "Confirm delete?" }));

		await waitFor(() => expect(screen.queryByText("Edit actor")).toBeNull());
		expect(json().actors).toHaveLength(0);
		await waitFor(() => expect(cells()).toHaveLength(0));
	});

	it("add-actor form offers no delete action", async () => {
		seed({ movies: [], actors: [] });
		await renderApp();

		fireEvent.click(button("Actors"));
		fireEvent.click(button("+ Add actor"));
		expect(screen.getByText("Add actor")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
	});

	it("blocks deleting a referenced actor with a warning naming the count", async () => {
		seed({
			movies: [{ ...MOVIE, cover: "", actorIds: ["a_1"] }],
			actors: [ACTOR],
		});
		await renderApp();
		const jsonBefore = mem.files.get(JSON_PATH);

		fireEvent.click(button("Actors"));
		fireEvent.click(cells()[0]);

		fireEvent.click(deleteBtn()); // attempt is enough - no confirmation offered

		expect(screen.getByText(/Referenced by 1 movie/)).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Confirm delete?" })).toBeNull();
		expect(mem.files.get(JSON_PATH)).toBe(jsonBefore); // nothing written
		expect(mem.removals).toHaveLength(0);
		expect(json().actors).toHaveLength(1);
		expect(json().movies[0].actorIds).toEqual(["a_1"]); // unchanged

		// form still open; declining leaves everything intact
		expect(screen.getByText("Edit actor")).toBeTruthy();
	});
});
