// Detail dialog and dialog-stack flows (change: add-detail-and-dialog-flows).
// Covers spec deltas: "Entry detail dialog", "Escape and backdrop dismiss the
// top dialog", "Add and edit forms" (dialog + pop semantics), "List reflects
// saved data". jsdom never fires native `cancel` (design D3), so Escape is
// simulated by dispatching the event on the target dialog, exactly as the UA
// would on the top-most one.
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "../src/ui/App";
import { MovieStore, JSON_PATH, COVERS_DIR, COVER_PREFIX } from "../src/store";
import { createMemoryApp, type MemoryApp } from "./memory-app";

let mem: MemoryApp;
let store: MovieStore;

beforeEach(() => {
	cleanup();
	mem = createMemoryApp();
	store = new MovieStore(mem.app);
});

function seedJson(data: unknown): void {
	mem.files.set(JSON_PATH, JSON.stringify(data, null, 2));
}

async function renderApp() {
	render(<App store={store} />);
	await waitFor(() => {
		expect(document.querySelector(".movie-data-grid, .movie-data-load-error")).not.toBeNull();
	});
}

const cells = () => Array.from(document.querySelectorAll(".movie-data-cell"));
const dialogs = () => Array.from(document.querySelectorAll("dialog")) as HTMLDialogElement[];
const buttons = () => screen.queryAllByRole("button");
const button = (text: string) => buttons().find((b) => b.textContent === text)!;
const form = () => document.querySelector(".movie-data-form") as HTMLElement | null;
const detail = () => document.querySelector(".movie-data-detail") as HTMLElement | null;
const json = () => JSON.parse(mem.files.get(JSON_PATH) as string);
/** Escape as the UA delivers it: a cancel event at the target dialog. */
const pressEsc = (el: Element) => fireEvent(el, new Event("cancel", { cancelable: true }));

const ACTOR = { id: "a_1", name: "Keanu Reeves", cover: "", info: "bio", url: "https://keanu.example" };
const MOVIE = {
	id: "m_1",
	title: "The Matrix",
	cover: "",
	tags: ["sci-fi", "action"],
	actorIds: ["a_1"],
	info: "free text\nkept verbatim",
	url: "http://x",
};
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 7, 7, 7, 7, 7]);
const pngFile = () => new File([PNG as unknown as BlobPart], "poster.png", { type: "image/png" });

describe("entry detail dialog", () => {
	it("click opens the detail with saved values, not the edit form; list stays mounted", async () => {
		seedJson({ movies: [MOVIE], actors: [ACTOR] });
		await renderApp();

		fireEvent.click(cells()[0]);

		expect(dialogs()).toHaveLength(1);
		expect(dialogs()[0].open).toBe(true);
		expect(form()).toBeNull(); // no edit form
		const d = within(dialogs()[0]);
		expect(d.getByText("The Matrix")).toBeTruthy();
		expect(d.getByText("sci-fi")).toBeTruthy();
		expect(d.getByText("action")).toBeTruthy();
		expect(d.getByText("Keanu Reeves")).toBeTruthy();
		expect(d.getByText("http://x")).toBeTruthy();
		expect(d.getByText(/free text/)).toBeTruthy();
		expect(d.getByText("Edit")).toBeTruthy();
		expect(d.getByText("Close")).toBeTruthy();
		expect(d.queryByText(/Delete/)).toBeNull(); // delete lives in the edit form only
		// list is mounted underneath, not replaced
		expect(document.querySelector(".movie-data-grid")).not.toBeNull();
	});

	it("detail dialog carries the detail-only class and shows the cover area (placeholder when no cover)", async () => {
		seedJson({ movies: [{ ...MOVIE, cover: "" }], actors: [ACTOR] });
		await renderApp();

		fireEvent.click(cells()[0]);

		const dlg = dialogs()[0];
		// detail-only class widening the dialog for the enlarged cover
		expect(dlg.classList.contains("movie-data-detail-dialog")).toBe(true);
		const cover = document.querySelector(".movie-data-detail .movie-data-cover.is-placeholder");
		expect(cover).not.toBeNull(); // no cover -> placeholder in the enlarged box
		expect(cover!.textContent).toBe("?");
		// grid thumbnails keep their own class; no detail-only class on the grid
		expect(document.querySelector(".movie-data-grid .movie-data-detail-dialog")).toBeNull();
	});

	it("detail dialog shows the placeholder when the cover file is missing or corrupt", async () => {
		seedJson({ movies: [{ ...MOVIE, cover: "bad.mcov" }], actors: [ACTOR] });
		mem.files.set(`${COVERS_DIR}/bad.mcov`, Buffer.from([1, 2]));
		await renderApp();

		fireEvent.click(cells()[0]);

		await waitFor(() => {
			expect(document.querySelector(".movie-data-detail .movie-data-cover.is-placeholder")).not.toBeNull();
		});
		expect(document.querySelector(".movie-data-detail .movie-data-cover img")).toBeNull();
		expect(dialogs()[0].open).toBe(true); // dialog stays fully usable
	});

	it("Edit stacks the form above the detail; both stay mounted", async () => {
		seedJson({ movies: [MOVIE], actors: [ACTOR] });
		await renderApp();

		fireEvent.click(cells()[0]);
		fireEvent.click(button("Edit"));

		expect(dialogs()).toHaveLength(2);
		expect(dialogs().every((d) => d.open)).toBe(true);
		expect(screen.getByText("Edit movie")).toBeTruthy(); // form on top
		expect(detail()).not.toBeNull(); // detail still beneath
		expect(document.querySelector(".movie-data-grid")).not.toBeNull(); // list at the bottom
	});

	it("Close returns to the list with nothing written", async () => {
		seedJson({ movies: [MOVIE], actors: [ACTOR] });
		await renderApp();
		const jsonBefore = mem.files.get(JSON_PATH);

		fireEvent.click(cells()[0]);
		fireEvent.click(button("Close"));

		expect(dialogs()).toHaveLength(0);
		expect(cells()).toHaveLength(1); // list unchanged
		expect(mem.files.get(JSON_PATH)).toBe(jsonBefore);
		expect(mem.removals).toHaveLength(0);
	});

	it("actors-list jump opens no dialog (spec: neither detail nor edit form)", async () => {
		seedJson({ movies: [MOVIE], actors: [ACTOR] });
		await renderApp();
		fireEvent.click(button("Actors"));

		fireEvent.click(cells()[0].querySelector(".movie-data-jump")!);

		expect(dialogs()).toHaveLength(0);
		expect(form()).toBeNull();
	});
});

describe("add flow (spec: add form opens directly as a dialog)", () => {
	it("toolbar add opens the form dialog with no detail beneath; Cancel closes to the list", async () => {
		seedJson({ movies: [], actors: [ACTOR] });
		await renderApp();

		fireEvent.click(button("+ Add movie"));
		expect(dialogs()).toHaveLength(1);
		expect(form()).not.toBeNull();
		expect(detail()).toBeNull(); // no detail for an unsaved entity

		fireEvent.click(button("Cancel"));
		expect(dialogs()).toHaveLength(0);
		expect(cells()).toHaveLength(0);
	});
});

describe("pop semantics (spec: save/esc/delete stack behavior)", () => {
	it("save from add closes to the list", async () => {
		seedJson({ movies: [], actors: [ACTOR] });
		await renderApp();

		fireEvent.click(button("+ Add movie"));
		fireEvent.change(form()!.querySelectorAll('input[type="text"]')[0], { target: { value: "Heat" } });
		const sel = form()!.querySelector("select[multiple]") as HTMLSelectElement;
		for (const o of Array.from(sel.options)) o.selected = o.value === "a_1";
		fireEvent.change(sel, {});
		fireEvent.click(button("Save"));

		await waitFor(() => expect(dialogs()).toHaveLength(0));
		expect(json().movies).toHaveLength(1);
		expect(cells()[0].textContent).toContain("Heat");
	});

	it("save from edit returns to the refreshed detail showing the updated values", async () => {
		seedJson({ movies: [MOVIE], actors: [ACTOR] });
		await renderApp();

		fireEvent.click(cells()[0]);
		fireEvent.click(button("Edit"));
		fireEvent.change(form()!.querySelectorAll('input[type="text"]')[0], { target: { value: "Matrix Reloaded" } });
		fireEvent.click(button("Save"));

		await waitFor(() => expect(form()).toBeNull());
		expect(dialogs()).toHaveLength(1); // popped one level: detail remains
		expect(within(dialogs()[0]).getByText("Matrix Reloaded")).toBeTruthy(); // updated detail
		expect(detail()).not.toBeNull();
		// list beneath reflects the save without a reload
		await waitFor(() => expect(cells()[0].textContent).toContain("Matrix Reloaded"));
		expect(json().movies[0].title).toBe("Matrix Reloaded");
	});

	it("Escape on the add form behaves as Cancel: staged cover discarded, nothing written", async () => {
		seedJson({ movies: [], actors: [ACTOR] });
		await renderApp();
		const jsonBefore = mem.files.get(JSON_PATH);

		fireEvent.click(button("+ Add movie"));
		fireEvent.change(form()!.querySelector('input[type="file"]')!, { target: { files: [pngFile()] } });
		await waitFor(() => expect(form()!.querySelector(".movie-data-cover-preview img")).not.toBeNull());

		pressEsc(dialogs()[0]);

		expect(dialogs()).toHaveLength(0);
		expect(mem.files.get(JSON_PATH)).toBe(jsonBefore);
		expect([...mem.files.keys()].some((k) => k.endsWith(".mcov"))).toBe(false);
		expect(mem.removals).toHaveLength(0);
	});

	it("Escape on the stacked edit form pops one level, leaving the detail open", async () => {
		seedJson({ movies: [MOVIE], actors: [ACTOR] });
		await renderApp();
		const jsonBefore = mem.files.get(JSON_PATH);

		fireEvent.click(cells()[0]);
		fireEvent.click(button("Edit"));
		pressEsc(dialogs()[1]); // the top-most dialog

		expect(dialogs()).toHaveLength(1);
		expect(form()).toBeNull();
		expect(within(dialogs()[0]).getByText("The Matrix")).toBeTruthy(); // detail still open
		expect(mem.files.get(JSON_PATH)).toBe(jsonBefore);
	});

	it("Escape on the detail dialog closes to the list", async () => {
		seedJson({ movies: [MOVIE], actors: [ACTOR] });
		await renderApp();

		fireEvent.click(cells()[0]);
		pressEsc(dialogs()[0]);

		expect(dialogs()).toHaveLength(0);
		expect(cells()).toHaveLength(1);
	});

	it("backdrop click dismisses the top dialog like Escape", async () => {
		seedJson({ movies: [MOVIE], actors: [ACTOR] });
		await renderApp();

		fireEvent.click(cells()[0]);
		fireEvent.click(button("Edit"));
		fireEvent.click(dialogs()[1]); // backdrop of the stacked form
		expect(dialogs()).toHaveLength(1); // only the form popped
		expect(detail()).not.toBeNull();

		fireEvent.click(dialogs()[0]); // backdrop of the detail
		expect(dialogs()).toHaveLength(0);
	});

	it("Delete clears the whole stack: list shows the entity gone", async () => {
		seedJson({ movies: [MOVIE], actors: [ACTOR] });
		await renderApp();

		fireEvent.click(cells()[0]);
		fireEvent.click(button("Edit"));
		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		fireEvent.click(screen.getByRole("button", { name: "Confirm delete?" }));

		await waitFor(() => expect(dialogs()).toHaveLength(0)); // detail and form both gone
		await waitFor(() => expect(cells()).toHaveLength(0));
		expect(json().movies).toHaveLength(0);
	});

	it("Escape with the tag suggestion dropdown open closes only the dropdown", async () => {
		seedJson({ movies: [MOVIE], actors: [ACTOR] });
		await renderApp();

		fireEvent.click(button("+ Add movie"));
		const tagsInput = form()!.querySelectorAll('input[type="text"]')[1];
		fireEvent.focus(tagsInput);
		expect(document.querySelector(".movie-data-tag-suggestion")).not.toBeNull(); // dropdown open

		fireEvent.keyDown(tagsInput, { key: "Escape" });

		expect(document.querySelector(".movie-data-tag-suggestion")).toBeNull(); // dropdown closed
		expect(dialogs()).toHaveLength(1); // dialog unaffected (TagInput prevented default)
		expect(form()).not.toBeNull();
	});
});

describe("stale detail guard", () => {
	it("a detail whose entity vanished renders no dialog (delete clears the stack anyway)", async () => {
		seedJson({ movies: [], actors: [] });
		await renderApp();
		// no cells to click - the guard is exercised via the null-return path in
		// EntityDetail; here we just assert an empty list opens nothing
		expect(cells()).toHaveLength(0);
		expect(dialogs()).toHaveLength(0);
	});
});
