// Form + persistence scenarios: ported from test/verify.ts (4.1 add movie,
// 4.3 cancel, 4.2 edit actor single-source) and test/e2e.ts.
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "../src/ui/App";
import { MovieStore, COVER_PREFIX, JSON_PATH, COVERS_DIR, newId } from "../src/store";
import { UNKNOWN_ACTOR_ID } from "../src/ui/state";
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

const buttons = () => screen.queryAllByRole("button");
const button = (text: string) => buttons().find((b) => b.textContent === text)!;
const cells = () => Array.from(document.querySelectorAll(".movie-data-cell"));
function form() {
	return document.querySelector(".movie-data-form") as HTMLElement;
}
function textInputs() {
	return Array.from(form().querySelectorAll('input[type="text"]')) as HTMLInputElement[];
}
function fileInput() {
	return form().querySelector('input[type="file"]') as HTMLInputElement;
}
/** The form's shared multi-select actor control. */
function formSelect() {
	return form().querySelector("select[multiple]") as HTMLSelectElement;
}
function selectActorIds(ids: string[]) {
	const sel = formSelect();
	for (const o of Array.from(sel.options)) o.selected = ids.includes(o.value);
	fireEvent.change(sel);
}
/** The list's single-select actor filter dropdown. */
function actorSelect() {
	return document.querySelector(".movie-data-actor-select") as HTMLSelectElement;
}
function pickCover(file: File) {
	fireEvent.change(fileInput(), { target: { files: [file] } });
}
/** Staging is async (file.arrayBuffer); wait for the staged preview to appear. */
async function pickCoverAndWait(file: File) {
	pickCover(file);
	await waitFor(() => expect(form().querySelector(".movie-data-cover-preview img")).not.toBeNull());
}
function coverField() {
	return form().querySelector(".movie-data-cover-field") as HTMLElement;
}
/** Simulate a paste landing inside the cover field (focus scoped to the field). */
function pasteCover(files: File[]) {
	return fireEvent.paste(coverField(), { clipboardData: { files } });
}
async function pasteCoverAndWait(files: File[]) {
	pasteCover(files);
	await waitFor(() => expect(form().querySelector(".movie-data-cover-preview img")).not.toBeNull());
}
function stagedPreviewSrc() {
	return form().querySelector(".movie-data-cover-preview img")?.getAttribute("src");
}
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 7, 7, 7, 7, 7]);
const pngFile = () => new File([PNG as unknown as BlobPart], "poster.png", { type: "image/png" });

const ACTOR = { id: "a_1", name: "Ana de Armas", cover: "", info: "", url: "" };

describe("add movie (4.1)", () => {
	beforeEach(() => seedJson({ movies: [], actors: [ACTOR] }));

	it("opens an empty add form; cancel writes nothing", async () => {
		await renderApp();
		const jsonBefore = mem.files.get(JSON_PATH);

		fireEvent.click(button("+ Add movie"));
		expect(screen.getByText("Add movie")).toBeTruthy();

		fireEvent.change(textInputs()[0], { target: { value: "Heat" } });
		fireEvent.change(textInputs()[1], { target: { value: "crime, heist" } });
		await pickCoverAndWait(pngFile());

		fireEvent.click(button("Cancel"));

		// 4.3: cancel leaves movies.json unchanged, writes no staged cover
		expect(mem.files.get(JSON_PATH)).toBe(jsonBefore);
		expect([...mem.files.keys()].some((k) => k.endsWith(".mcov"))).toBe(false);
		expect(screen.queryByText("Add movie")).toBeNull();
		expect(cells()).toHaveLength(0);
	});

	it("save persists movie: parsed tags, verbatim info, deformed cover, list refresh", async () => {
		await renderApp();

		fireEvent.click(button("+ Add movie"));
		const [t, tg, u] = textInputs();
		fireEvent.change(t, { target: { value: "Heat" } });
		fireEvent.change(tg, { target: { value: "crime, heist" } });
		fireEvent.change(u, { target: { value: "https://example.com/heat" } });
		fireEvent.change(form().querySelector("textarea")!, { target: { value: "Line one\nline two" } });
		// pick the single actor in the shared select
		selectActorIds([ACTOR.id]);
		await pickCoverAndWait(pngFile());

		fireEvent.click(button("Save"));

		await waitFor(() => {
			const j = JSON.parse(mem.files.get(JSON_PATH) as string);
			expect(j.movies).toHaveLength(1);
		});
		const j = JSON.parse(mem.files.get(JSON_PATH) as string);
		const heat = j.movies[0];
		expect(heat.title).toBe("Heat");
		expect(heat.tags).toEqual(["crime", "heist"]);
		expect(heat.info).toBe("Line one\nline two"); // verbatim
		expect(heat.url).toBe("https://example.com/heat");
		expect(heat.actorIds).toEqual(["a_1"]); // id only, actor not duplicated

		// cover written deformed: .mcov, prefix at 0, not a PNG signature
		expect(heat.cover).toMatch(/\.mcov$/);
		const coverBytes = mem.files.get(`${COVERS_DIR}/${heat.cover}`) as Buffer;
		expect(coverBytes.slice(0, COVER_PREFIX.length).equals(Buffer.from(COVER_PREFIX))).toBe(true);
		expect(coverBytes[0]).not.toBe(0x89);
		expect([...coverBytes.slice(COVER_PREFIX.length)]).toEqual([...PNG]);

		// back on the list, new entry visible without reload
		await waitFor(() => expect(cells()).toHaveLength(1));
		expect(cells()[0].textContent).toContain("Heat");
	});

	it("empty title falls back to Untitled; empty tags dropped", async () => {
		await renderApp();
		fireEvent.click(button("+ Add movie"));
		selectActorIds([ACTOR.id]); // actors are required now
		fireEvent.click(button("Save"));
		await waitFor(() => expect(cells()).toHaveLength(1));
		const j = JSON.parse(mem.files.get(JSON_PATH) as string);
		expect(j.movies[0].title).toBe("Untitled");
		expect(j.movies[0].tags).toEqual([]);
	});
});

describe("edit actor (4.2): single source, id reference", () => {
	it("edit is reflected through movie references and the filter dropdown", async () => {
		seedJson({
			movies: [{ id: "m_1", title: "The Matrix", cover: "", tags: ["sci-fi"], actorIds: ["a_1"], info: "x", url: "" }],
			actors: [ACTOR],
		});
		await renderApp();

		// open actor edit via grid
		fireEvent.click(button("Actors"));
		fireEvent.click(cells()[0]);
		expect(screen.getByText("Edit actor")).toBeTruthy();

		fireEvent.change(textInputs()[0], { target: { value: "Ana de Armas Prime" } });
		fireEvent.click(button("Save"));

		await waitFor(() => expect(screen.queryByText("Edit actor")).toBeNull());
		const j = JSON.parse(mem.files.get(JSON_PATH) as string);
		expect(j.actors).toHaveLength(1); // edited in place, no duplicate row
		expect(j.actors[0].name).toBe("Ana de Armas Prime");
		expect(j.actors[0].id).toBe("a_1");
		expect(j.movies[0].actorIds).toEqual(["a_1"]); // still id-only reference

		// choosing the renamed actor in the dropdown still returns the referencing
		// movie (id reference intact; text search no longer exists)
		fireEvent.click(button("Movies"));
		expect(Array.from(actorSelect().options).map((o) => o.textContent)).toContain("Ana de Armas Prime");
		fireEvent.change(actorSelect(), { target: { value: "a_1" } });
		expect(cells()).toHaveLength(1);
		expect(cells()[0].textContent).toContain("The Matrix");
	});

	it("new actor via add form appears in lists and is selectable", async () => {
		seedJson({ movies: [], actors: [] });
		await renderApp();
		fireEvent.click(button("Actors"));
		fireEvent.click(button("+ Add actor"));
		fireEvent.change(textInputs()[0], { target: { value: "Cuban actress" } });
		fireEvent.click(button("Save"));
		await waitFor(() => expect(cells()).toHaveLength(1));
		expect(cells()[0].textContent).toContain("Cuban actress");

		// now addable to a movie
		fireEvent.click(button("Movies"));
		fireEvent.click(button("+ Add movie"));
		const opt = Array.from(formSelect().options).find((o) => o.textContent === "Cuban actress");
		expect(opt).toBeTruthy();
		selectActorIds([opt!.value]);
		fireEvent.click(button("Save"));
		await waitFor(() => {
			const j = JSON.parse(mem.files.get(JSON_PATH) as string);
			expect(j.movies[0].actorIds).toHaveLength(1);
		});
	});
});

describe("movie form: required actors + Unknown fallback", () => {
	it("save with no actor is blocked: inline error, form stays open, nothing written", async () => {
		seedJson({ movies: [], actors: [ACTOR] });
		await renderApp();
		const jsonBefore = mem.files.get(JSON_PATH);
		fireEvent.click(button("+ Add movie"));
		fireEvent.change(textInputs()[0], { target: { value: "Heat" } });

		fireEvent.click(button("Save"));

		expect(screen.getByText("Add movie")).toBeTruthy(); // form stays open
		expect(screen.getByText("Select at least one actor.")).toBeTruthy(); // inline error
		expect(mem.files.get(JSON_PATH)).toBe(jsonBefore); // nothing written
		expect(cells()).toHaveLength(0);
	});

	it("error clears once an actor is selected and save succeeds", async () => {
		seedJson({ movies: [], actors: [ACTOR] });
		await renderApp();
		fireEvent.click(button("+ Add movie"));
		fireEvent.change(textInputs()[0], { target: { value: "Heat" } });
		fireEvent.click(button("Save"));
		expect(screen.getByText("Select at least one actor.")).toBeTruthy();

		selectActorIds([ACTOR.id]);
		expect(screen.queryByText("Select at least one actor.")).toBeNull();
		fireEvent.click(button("Save"));
		await waitFor(() => expect(cells()).toHaveLength(1));
		const j = JSON.parse(mem.files.get(JSON_PATH) as string);
		expect(j.movies[0].actorIds).toEqual([ACTOR.id]);
	});

	it("fallback option is offered with zero actors; saving creates the shared record", async () => {
		seedJson({ movies: [], actors: [] }); // no actors at all - no dead end
		await renderApp();
		fireEvent.click(button("+ Add movie"));
		const opt = Array.from(formSelect().options).find((o) => o.value === UNKNOWN_ACTOR_ID);
		expect(opt?.textContent).toBe("Unknown");
		expect(formSelect().size).toBeGreaterThanOrEqual(6); // roomy list box, not a sliver

		fireEvent.change(textInputs()[0], { target: { value: "Mystery Film" } });
		selectActorIds([UNKNOWN_ACTOR_ID]);
		fireEvent.click(button("Save"));
		await waitFor(() => expect(cells()).toHaveLength(1));

		const j = JSON.parse(mem.files.get(JSON_PATH) as string);
		expect(j.actors).toHaveLength(1); // created lazily in the same commit
		expect(j.actors[0]).toMatchObject({ id: UNKNOWN_ACTOR_ID, name: "Unknown" });
		expect(j.movies[0].actorIds).toEqual([UNKNOWN_ACTOR_ID]);

		// the record behaves like any actor: appears in the actor list...
		fireEvent.click(button("Actors"));
		expect(cells()[0].textContent).toContain("Unknown");
		// ...and in the filter dropdown
		fireEvent.click(button("Movies"));
		expect(Array.from(actorSelect().options).map((o) => o.value)).toContain(UNKNOWN_ACTOR_ID);
	});
});

describe("clipboard paste into cover field", () => {
	beforeEach(() => seedJson({ movies: [], actors: [ACTOR] }));

	it("paste stages an image with preview; nothing written until save", async () => {
		await renderApp();
		fireEvent.click(button("+ Add movie"));
		fireEvent.change(textInputs()[0], { target: { value: "Heat" } });

		await pasteCoverAndWait([pngFile()]);
		expect(form().querySelector(".movie-data-cover-preview img")).not.toBeNull();
		// staged in memory only: no cover file on disk yet
		expect([...mem.files.keys()].some((k) => k.endsWith(".mcov"))).toBe(false);
	});

	it("paste over an existing staged cover replaces it", async () => {
		await renderApp();
		fireEvent.click(button("+ Add movie"));
		await pasteCoverAndWait([pngFile()]);
		const firstSrc = stagedPreviewSrc();
		expect(firstSrc).toBeTruthy();

		const other = new File([new Uint8Array([1, 2, 3, 4, 5])], "other.png", { type: "image/png" });
		await pasteCoverAndWait([other]);
		// stageCover mints a fresh object URL per stage: src must change
		expect(stagedPreviewSrc()).not.toBe(firstSrc);
	});

	it("paste with only text in the clipboard is not consumed and stages nothing", async () => {
		await renderApp();
		fireEvent.click(button("+ Add movie"));

		const notCancelled = pasteCover([]); // no files: text-only clipboard
		expect(notCancelled).toBe(true); // default not prevented (design D3)
		// no staging side effect after the async window would have elapsed
		await new Promise((r) => setTimeout(r, 10));
		expect(form().querySelector(".movie-data-cover-preview img")).toBeNull();
		expect([...mem.files.keys()].some((k) => k.endsWith(".mcov"))).toBe(false);
	});

	it("paste outside the cover field does not stage a cover", async () => {
		await renderApp();
		fireEvent.click(button("+ Add movie"));

		fireEvent.paste(textInputs()[0], { clipboardData: { files: [pngFile()] } });
		await new Promise((r) => setTimeout(r, 10));
		expect(form().querySelector(".movie-data-cover-preview img")).toBeNull();
	});

	it("saved pasted cover is written deformed like a picked one", async () => {
		await renderApp();
		fireEvent.click(button("+ Add movie"));
		fireEvent.change(textInputs()[0], { target: { value: "Heat" } });
		selectActorIds([ACTOR.id]); // actors are required now
		await pasteCoverAndWait([pngFile()]);

		fireEvent.click(button("Save"));
		await waitFor(() => {
			const j = JSON.parse(mem.files.get(JSON_PATH) as string);
			expect(j.movies).toHaveLength(1);
		});
		const heat = JSON.parse(mem.files.get(JSON_PATH) as string).movies[0];
		expect(heat.cover).toMatch(/\.mcov$/);
		const coverBytes = mem.files.get(`${COVERS_DIR}/${heat.cover}`) as Buffer;
		expect(coverBytes.slice(0, COVER_PREFIX.length).equals(Buffer.from(COVER_PREFIX))).toBe(true);
		expect(coverBytes[0]).not.toBe(0x89);
		expect([...coverBytes.slice(COVER_PREFIX.length)]).toEqual([...PNG]);
		await waitFor(() => expect(cells()).toHaveLength(1));
	});

	it("cancel after paste writes nothing", async () => {
		await renderApp();
		const jsonBefore = mem.files.get(JSON_PATH);
		fireEvent.click(button("+ Add movie"));
		await pasteCoverAndWait([pngFile()]);

		fireEvent.click(button("Cancel"));
		expect(mem.files.get(JSON_PATH)).toBe(jsonBefore);
		expect([...mem.files.keys()].some((k) => k.endsWith(".mcov"))).toBe(false);
	});
});

describe("reload persistence (e2e 6)", () => {
	it("fresh store instance restores both collections", async () => {
		seedJson({ movies: [], actors: [ACTOR] });
		await renderApp();
		fireEvent.click(button("+ Add movie"));
		fireEvent.change(textInputs()[0], { target: { value: "Blade Runner 2049" } });
		fireEvent.change(form().querySelector("textarea")!, { target: { value: "kept\nverbatim" } });
		selectActorIds([ACTOR.id]); // actors are required now
		fireEvent.click(button("Save"));
		await waitFor(() => expect(cells()).toHaveLength(1));

		const store2 = new MovieStore(mem.app);
		const res = await store2.load();
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.data.movies).toHaveLength(1);
		expect(res.data.movies[0].info).toContain("\n");
	});
});
