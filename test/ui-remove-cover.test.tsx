// Cover-removal persistence: delta spec movie-data-storage "Removing a cover
// persists to disk" (all 7 scenarios) plus the D1 stale-cover diff unit tests.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App, staleCovers } from "../src/ui/App";
import { Notice } from "obsidian";
import { MovieStore, COVER_PREFIX, JSON_PATH, COVERS_DIR } from "../src/store";
import type { MovieStoreData } from "../src/types";
import { createMemoryApp, type MemoryApp } from "./memory-app";

let mem: MemoryApp;
let store: MovieStore;

beforeEach(() => {
	cleanup();
	mem = createMemoryApp();
	store = new MovieStore(mem.app);
	Notice.last = "";
});

afterEach(() => {
	vi.restoreAllMocks();
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 7, 7, 7, 7, 7]);
const pngFile = () => new File([PNG as unknown as BlobPart], "poster.png", { type: "image/png" });

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
const coverPath = (name: string) => `${COVERS_DIR}/${name}`;
const fileInput = () => form().querySelector('input[type="file"]') as HTMLInputElement;

/** Open the existing movie's edit form and click "Remove cover". */
async function openAndRemoveCover() {
	await renderApp();
	fireEvent.click(cells()[0]);
	expect(screen.getByText("Edit movie")).toBeTruthy();
	fireEvent.click(button("Remove cover"));
}

async function saveAndWaitBackToList() {
	fireEvent.click(button("Save"));
	await waitFor(() => expect(screen.queryByText("Edit movie")).toBeNull());
	await waitFor(() => expect(cells()).toHaveLength(1));
}

const MOVIE = { id: "m_1", title: "Heat", cover: "m_1.mcov", tags: ["crime"], actorIds: [], info: "", url: "" };

describe("staleCovers diff (design D1)", () => {
	const base = (): MovieStoreData => ({
		movies: [
			{ id: "m_1", title: "A", cover: "m_1.mcov", tags: [], actorIds: [], info: "", url: "" },
			{ id: "m_2", title: "B", cover: "m_2.mcov", tags: [], actorIds: [], info: "", url: "" },
		],
		actors: [{ id: "a_1", name: "Ana", cover: "a_1.mcov", info: "", url: "" }],
	});

	it("returns the old filename only when a cover is cleared", () => {
		const next = base();
		next.movies[0].cover = "";
		expect(staleCovers(base(), next)).toEqual(["m_1.mcov"]);
	});

	it("returns nothing when a cover is replaced (same filename, non-empty)", () => {
		const next = base();
		next.movies[0].cover = "m_1.mcov"; // staged replacement writes the same name
		expect(staleCovers(base(), next)).toEqual([]);
	});

	it("returns nothing when nothing changed", () => {
		expect(staleCovers(base(), base())).toEqual([]);
	});

	it("returns nothing for a brand-new entity with no cover", () => {
		const next = base();
		next.movies.push({ id: "m_9", title: "New", cover: "", tags: [], actorIds: [], info: "", url: "" });
		expect(staleCovers(base(), next)).toEqual([]);
	});

	it("diffs actors as well as movies", () => {
		const next = base();
		next.actors[0].cover = "";
		expect(staleCovers(base(), next)).toEqual(["a_1.mcov"]);
	});
});

describe("removing a cover persists to disk", () => {
	it("Remove cover and save: file deleted after the JSON write, placeholder shown", async () => {
		seed({ movies: [MOVIE], actors: [] }, { "m_1.mcov": PNG });
		await openAndRemoveCover();

		await saveAndWaitBackToList();

		expect(json().movies[0].cover).toBe("");
		expect(mem.files.has(coverPath("m_1.mcov"))).toBe(false);
		// ordering: movies.json written before the cover removal
		expect(mem.ops.indexOf(`write:${JSON_PATH}`)).toBeGreaterThanOrEqual(0);
		expect(mem.ops.indexOf(`remove:${coverPath("m_1.mcov")}`)).toBeGreaterThan(
			mem.ops.indexOf(`write:${JSON_PATH}`)
		);
		// placeholder, no thumbnail; cached object URL dropped too
		expect(cells()[0].querySelector(".movie-data-cover.is-placeholder")).not.toBeNull();
		expect(cells()[0].querySelector("img")).toBeNull();
		expect(await store.coverUrl("m_1.mcov")).toBeNull();
	});

	it("Remove cover then pick a replacement: no deletion, file overwritten with new bytes", async () => {
		seed({ movies: [MOVIE], actors: [] }, { "m_1.mcov": PNG });
		await openAndRemoveCover();

		fireEvent.change(fileInput(), { target: { files: [pngFile()] } });
		await waitFor(() => expect(form().querySelector(".movie-data-cover-preview img")).not.toBeNull());
		await saveAndWaitBackToList();

		expect(mem.removals).toHaveLength(0);
		expect(json().movies[0].cover).toBe("m_1.mcov");
		const bytes = mem.files.get(coverPath("m_1.mcov")) as Buffer;
		expect(bytes.slice(0, COVER_PREFIX.length).equals(Buffer.from(COVER_PREFIX))).toBe(true);
		expect([...bytes.slice(COVER_PREFIX.length)]).toEqual([...PNG]);
	});

	it("Cancel after removing a cover: nothing written", async () => {
		seed({ movies: [MOVIE], actors: [] }, { "m_1.mcov": PNG });
		const jsonBefore = mem.files.get(JSON_PATH);
		const fileBefore = mem.files.get(coverPath("m_1.mcov"));
		await openAndRemoveCover();

		fireEvent.click(button("Cancel"));

		expect(screen.queryByText("Edit movie")).toBeNull();
		expect(mem.files.get(JSON_PATH)).toBe(jsonBefore);
		expect(mem.files.get(coverPath("m_1.mcov"))).toEqual(fileBefore);
		expect(mem.removals).toHaveLength(0);
		expect(json().movies[0].cover).toBe("m_1.mcov");
	});

	it("JSON write fails: Notice shown, cover file left in place, form stays open", async () => {
		seed({ movies: [MOVIE], actors: [] }, { "m_1.mcov": PNG });
		const adapter = mem.app.vault.adapter;
		const origWrite = adapter.write.bind(adapter);
		adapter.write = async (p: string, c: string) => {
			if (p === JSON_PATH) throw new Error("disk full");
			return origWrite(p, c);
		};

		await openAndRemoveCover();
		fireEvent.click(button("Save"));

		await waitFor(() => expect(Notice.last).toContain("Failed to save movie data"));
		expect(json().movies[0].cover).toBe("m_1.mcov"); // unchanged on disk
		expect(mem.files.has(coverPath("m_1.mcov"))).toBe(true); // cover left in place
		expect(mem.removals).toHaveLength(0);
		expect(screen.getByText("Edit movie")).toBeTruthy(); // form stays open
	});

	it("Cover file already missing: save completes without error", async () => {
		seed({ movies: [MOVIE], actors: [] }); // cover field set, no file on disk
		await openAndRemoveCover();

		await saveAndWaitBackToList();

		expect(Notice.last).toBe("");
		expect(json().movies[0].cover).toBe("");
		expect(mem.removals).toHaveLength(0); // nothing to remove, no error
	});

	it("Removal failure does not roll back: save succeeds, failure logged", async () => {
		seed({ movies: [MOVIE], actors: [] }, { "m_1.mcov": PNG });
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		mem.app.vault.adapter.remove = async () => {
			throw new Error("EACCES");
		};

		await openAndRemoveCover();
		await saveAndWaitBackToList();

		expect(json().movies[0].cover).toBe(""); // persisted despite the failure
		expect(mem.files.has(coverPath("m_1.mcov"))).toBe(true); // leftover is inert
		expect(cells()[0].querySelector(".movie-data-cover.is-placeholder")).not.toBeNull();
		expect(
			errSpy.mock.calls.some((c) => String(c[0]).includes("failed to delete removed cover"))
		).toBe(true);
	});

	it("Add form with a cover removed before saving: no cover file created", async () => {
		seed({ movies: [], actors: [] });
		await renderApp();
		fireEvent.click(button("+ Add movie"));
		fireEvent.change(form().querySelector('input[type="text"]')!, { target: { value: "Heat" } });

		fireEvent.change(fileInput(), { target: { files: [pngFile()] } });
		await waitFor(() => expect(form().querySelector(".movie-data-cover-preview img")).not.toBeNull());
		fireEvent.click(button("Remove cover"));

		fireEvent.click(button("Save"));
		await waitFor(() => expect(cells()).toHaveLength(1));

		expect(json().movies[0].cover).toBe("");
		expect([...mem.files.keys()].some((k) => k.endsWith(".mcov"))).toBe(false);
		expect(mem.removals).toHaveLength(0);
	});
});
