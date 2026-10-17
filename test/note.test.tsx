// Notes tab tests (spec: Notes page / note autosave draft behavior).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "../src/ui/App";
import { JSON_PATH, COVERS_DIR } from "../src/store";
import { MovieStore } from "../src/store";
import { Notice } from "obsidian";
import { createMemoryApp, type MemoryApp } from "./memory-app";

let mem: MemoryApp;
let store: MovieStore;

beforeEach(() => {
	cleanup();
	mem = createMemoryApp();
	store = new MovieStore(mem.app);
	Notice.last = "";
	Notice.count = 0;
});

afterEach(() => {
	vi.useRealTimers(); // a failing test must not leak fake timers into the next
	cleanup();
});

function seedJson(data: unknown): void {
	mem.files.set(JSON_PATH, JSON.stringify(data, null, 2));
}

const json = () => JSON.parse(mem.files.get(JSON_PATH) as string);

async function renderApp() {
	const view = render(<App store={store} />);
	await waitFor(() => {
		expect(document.querySelector(".movie-data-grid, .movie-data-load-error")).not.toBeNull();
	});
	return view;
}

const noteArea = () => document.querySelector(".movie-data-note") as HTMLTextAreaElement;
const button = (text: string) =>
	Array.from(document.querySelectorAll("button")).find((b) => b.textContent === text) as HTMLButtonElement;
function goToNotes() {
	fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent === "Notes")!);
}
function goToList(tab: "Movies" | "Actors") {
	fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent === tab)!);
}

describe("notes page", () => {
	it("placeholder shows for an empty note and disappears while typing", async () => {
		seedJson({ movies: [], actors: [], note: "" });
		await renderApp();
		goToNotes();
		expect(noteArea().placeholder).toBe("Start typing...");
		fireEvent.change(noteArea(), { target: { value: "hello" } });
		expect(noteArea().placeholder).toBe("Start typing..."); // attribute stays; empty-only is UA behavior
		expect(noteArea().value).toBe("hello");
		// empty again after clearing: placeholder visible again (value "")
		fireEvent.change(noteArea(), { target: { value: "" } });
		expect(noteArea().value).toBe("");
	});

	it("loads the saved note into the editor", async () => {
		seedJson({ movies: [], actors: [], note: "seeded note" });
		await renderApp();
		goToNotes();
		expect(noteArea().value).toBe("seeded note");
	});

	it("Tab inserts a tab character at the caret and keeps focus", async () => {
		seedJson({ movies: [], actors: [], note: "" });
		await renderApp();
		goToNotes();
		fireEvent.change(noteArea(), { target: { value: "ab" } });
		const ta = noteArea();
		ta.focus();
		ta.setSelectionRange(1, 1); // caret between a and b
		fireEvent.keyDown(ta, { key: "Tab" });
		expect(noteArea().value).toBe("a\tb");
		expect(document.activeElement).toBe(noteArea()); // focus never left
		expect(noteArea().selectionStart).toBe(2); // caret after the inserted tab
	});

	it("whitespace and newlines round-trip verbatim across a tab-switch remount", async () => {
		seedJson({ movies: [], actors: [], note: "" });
		await renderApp();
		goToNotes();
		const text = "  leading\n\n\tblank + tab\ntrailing spaces  ";
		fireEvent.change(noteArea(), { target: { value: text } });
		goToList("Movies"); // unmounts NoteView (async: flushes the draft first)
		await waitFor(() => expect(document.querySelector(".movie-data-note")).toBeNull());
		expect(json().note).toBe(text); // flushed to disk as part of the switch
		goToNotes(); // remounts; draft comes from App state (design D3)
		expect(noteArea().value).toBe(text);
	});

	it("shows no add/save/cancel/filter/pagination controls on the notes tab", async () => {
		seedJson({ movies: [{ id: "m_1", title: "X", cover: "", tags: ["t"], actorIds: [], info: "", url: "" }], actors: [], note: "" });
		await renderApp();
		goToNotes();
		const texts = screen.getAllByRole("button").map((b) => b.textContent);
		expect(texts).toEqual(["Movies", "Actors", "Notes"]); // only the tab bar
		expect(document.querySelector(".movie-data-toolbar, .movie-data-tags, .movie-data-actor-select, .movie-data-pagination, .movie-data-scroll")).toBeNull();
	});
});

describe("note autosave", () => {
	it("debounced write: nothing on disk inside the window, text after it", async () => {
		seedJson({ movies: [], actors: [], note: "" });
		await renderApp();
		goToNotes();
		vi.useFakeTimers();
		fireEvent.change(noteArea(), { target: { value: "hello" } });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(100); // still inside the debounce
		});
		expect(mem.writes).toHaveLength(0);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(450); // debounce elapses
		});
		vi.useRealTimers();
		await waitFor(() => expect(json().note).toBe("hello"));
	});

	it("rapid keystrokes coalesce into a single write of the latest draft", async () => {
		seedJson({ movies: [], actors: [], note: "" });
		await renderApp();
		goToNotes();
		vi.useFakeTimers();
		fireEvent.change(noteArea(), { target: { value: "a" } });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(200);
		});
		fireEvent.change(noteArea(), { target: { value: "ab" } });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(200);
		});
		fireEvent.change(noteArea(), { target: { value: "abc" } });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(501);
		});
		vi.useRealTimers();
		await waitFor(() => expect(json().note).toBe("abc"));
		expect(mem.writes.filter((p) => p === JSON_PATH)).toHaveLength(1);
	});

	it("closing the view flushes the pending draft (view onClose awaits the handle)", async () => {
		seedJson({ movies: [], actors: [], note: "" });
		const flushRef: { current: (() => Promise<void>) | null } = { current: null };
		render(<App store={store} flushHandle={flushRef} />);
		await waitFor(() => expect(document.querySelector(".movie-data-grid")).not.toBeNull());
		goToNotes();
		fireEvent.change(noteArea(), { target: { value: "closing" } });
		expect(typeof flushRef.current).toBe("function");
		await flushRef.current!(); // what view.ts's onClose awaits before unmount
		expect(json().note).toBe("closing");
	});

	it("autosave plus a quick form save: final JSON keeps both changes", async () => {
		const MOVIE = { id: "m_1", title: "Old", cover: "", tags: [], actorIds: ["a_1"], info: "", url: "" };
		const ACTOR = { id: "a_1", name: "Keanu", cover: "", info: "", url: "" };
		seedJson({ movies: [MOVIE], actors: [ACTOR], note: "" });
		await renderApp();
		goToNotes();
		fireEvent.change(noteArea(), { target: { value: "note text" } });
		goToList("Movies"); // flush first, then the switch completes
		await waitFor(() => expect(document.querySelector(".movie-data-note")).toBeNull());
		// quick form save right after the switch
		fireEvent.click(document.querySelector(".movie-data-cell")!); // detail dialog
		fireEvent.click(button("Edit"));
		const titleInput = document.querySelectorAll(".movie-data-field input")[0];
		fireEvent.change(titleInput, { target: { value: "New title" } });
		fireEvent.click(button("Save"));
		await waitFor(() => expect(json().movies[0].title).toBe("New title"));
		expect(json().note).toBe("note text"); // the form save did not clobber the note
	});
});

describe("note autosave failure semantics", () => {
	it("notifies once, retries silently, recovers, and notifies again on a later failure", async () => {
		seedJson({ movies: [], actors: [], note: "" });
		await renderApp();
		goToNotes();
		const adapter = mem.app.vault.adapter;
		const origWrite = adapter.write.bind(adapter);
		let failing = true;
		adapter.write = async (p: string, c: string) => {
			if (failing && p === JSON_PATH) throw new Error("disk full");
			return origWrite(p, c);
		};

		// 1st failure: one Notice, draft kept, disk unchanged
		vi.useFakeTimers();
		fireEvent.change(noteArea(), { target: { value: "v1" } });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(501);
		});
		expect(Notice.count).toBe(1);
		expect(Notice.last).toContain("Failed to save the note");
		expect(noteArea().value).toBe("v1"); // typed text never discarded
		expect(json().note).toBe(""); // disk unchanged

		// 2nd failure: silent retry (no second Notice)
		fireEvent.change(noteArea(), { target: { value: "v12" } });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(501);
		});
		expect(Notice.count).toBe(1);
		expect(json().note).toBe("");

		// recovery: the next edit succeeds and clears the failure state
		failing = false;
		fireEvent.change(noteArea(), { target: { value: "v123" } });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(501);
		});
		vi.useRealTimers();
		await waitFor(() => expect(json().note).toBe("v123"));

		// a later failure notifies again (flag was cleared by the success)
		vi.useFakeTimers();
		failing = true;
		fireEvent.change(noteArea(), { target: { value: "boom" } });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(501);
		});
		vi.useRealTimers();
		expect(Notice.count).toBe(2);
		expect(json().note).toBe("v123"); // last good state still on disk
	});
});

describe("staged-cover invariant (end to end)", () => {
	it("the flushed note write never creates a cover; the form save does, exactly once", async () => {
		const ACTOR = { id: "a_1", name: "Keanu", cover: "", info: "", url: "" };
		seedJson({ movies: [], actors: [ACTOR], note: "" });
		await renderApp();
		goToNotes();
		// draft pending (debounce NOT elapsed) when the user leaves the tab
		fireEvent.change(noteArea(), { target: { value: "typed" } });
		goToList("Movies"); // flushes the draft as JSON-only, then switches
		await waitFor(() => expect(json().note).toBe("typed"));

		// open the add form and stage a cover
		fireEvent.click(button("+ Add movie"));
		const formEl = document.querySelector(".movie-data-form") as HTMLElement;
		fireEvent.change(formEl.querySelectorAll(".movie-data-field input")[0], { target: { value: "Heat" } });
		const sel = formEl.querySelector("select") as HTMLSelectElement;
		for (const o of Array.from(sel.options)) o.selected = o.value === "a_1";
		fireEvent.change(sel);
		const file = formEl.querySelector('input[type="file"]') as HTMLInputElement;
		const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 7, 7, 7])], "p.png", { type: "image/png" });
		fireEvent.change(file, { target: { files: [png] } });
		await waitFor(() => expect(formEl.querySelector(".movie-data-cover-preview img")).not.toBeNull());

		// staged but unsaved: no cover file, and the note flush did not make one
		expect(mem.files.has(`${COVERS_DIR}/m_x.mcov`)).toBe(false);
		expect([...mem.files.keys()].filter((k) => k.startsWith(`${COVERS_DIR}/`))).toHaveLength(0);

		// the form's explicit save writes the cover exactly once
		fireEvent.click(button("Save"));
		await waitFor(() => expect(json().movies).toHaveLength(1));
		const coverFile = json().movies[0].cover;
		expect(mem.files.has(`${COVERS_DIR}/${coverFile}`)).toBe(true);
		expect(json().note).toBe("typed"); // note still intact after the form save
	});
});
