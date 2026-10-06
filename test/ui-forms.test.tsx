// Form + persistence scenarios: ported from test/verify.ts (4.1 add movie,
// 4.3 cancel, 4.2 edit actor single-source) and test/e2e.ts.
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "../src/ui/App";
import { MovieStore, COVER_PREFIX, JSON_PATH, COVERS_DIR, newId } from "../src/store";
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
function pickCover(file: File) {
	fireEvent.change(fileInput(), { target: { files: [file] } });
}
/** Staging is async (file.arrayBuffer); wait for the staged preview to appear. */
async function pickCoverAndWait(file: File) {
	pickCover(file);
	await waitFor(() => expect(form().querySelector(".movie-data-cover-preview img")).not.toBeNull());
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
		// check the single actor
		const cb = form().querySelector('input[type="checkbox"]') as HTMLInputElement;
		fireEvent.click(cb);
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
		fireEvent.click(button("Save"));
		await waitFor(() => expect(cells()).toHaveLength(1));
		const j = JSON.parse(mem.files.get(JSON_PATH) as string);
		expect(j.movies[0].title).toBe("Untitled");
		expect(j.movies[0].tags).toEqual([]);
	});
});

describe("edit actor (4.2): single source, id reference", () => {
	it("edit is reflected through movie references and search", async () => {
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

		// search by renamed actor still returns the referencing movie
		fireEvent.click(button("Movies"));
		fireEvent.change(screen.getByPlaceholderText("Search title or actor..."), {
			target: { value: "Prime" },
		});
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
		const cb = form().querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(cb).toBeTruthy();
		fireEvent.click(cb);
		fireEvent.click(button("Save"));
		await waitFor(() => {
			const j = JSON.parse(mem.files.get(JSON_PATH) as string);
			expect(j.movies[0].actorIds).toHaveLength(1);
		});
	});
});

describe("actor-less movie form", () => {
	it("shows placeholder when no actors exist", async () => {
		seedJson({ movies: [], actors: [] });
		await renderApp();
		fireEvent.click(button("+ Add movie"));
		expect(screen.getByText("No actors yet - add actors first.")).toBeTruthy();
	});
});

describe("reload persistence (e2e 6)", () => {
	it("fresh store instance restores both collections", async () => {
		seedJson({ movies: [], actors: [ACTOR] });
		await renderApp();
		fireEvent.click(button("+ Add movie"));
		fireEvent.change(textInputs()[0], { target: { value: "Blade Runner 2049" } });
		fireEvent.change(form().querySelector("textarea")!, { target: { value: "kept\nverbatim" } });
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
