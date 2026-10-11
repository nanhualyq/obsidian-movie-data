// UI tests: React app rendered in jsdom via Testing Library. Ports the
// scenario coverage of the old test/verify.ts + test/e2e.ts view tests.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Platform } from "obsidian";
import { App } from "../src/ui/App";
import { PAGE_SIZE, UNKNOWN_ACTOR_ID } from "../src/ui/state";
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
		expect(document.querySelector("dialog")).toBeNull(); // nor the detail dialog
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

describe("list: pagination", () => {
	/** Newest-first display: page 1 shows the highest-index movies first. */
	const pageMovie = (i: number, tags: string[] = []) => ({
		id: `m_${(1_600_000_000_000 + i * 1000).toString(36)}${i.toString(36).padStart(4, "0")}`,
		title: `Movie ${i}`,
		cover: "",
		tags,
		actorIds: [],
		info: "",
		url: "",
	});
	const seedMany = (n: number, tagged = 0) =>
		seedJson({
			movies: Array.from({ length: n }, (_, i) => pageMovie(i, i < tagged ? ["long"] : [])),
			actors: [],
		});
	const pageLabel = () => document.querySelector(".movie-data-page-label")?.textContent;

	it("renders one page at a time; next/prev navigate; label and disabled states update", async () => {
		seedMany(PAGE_SIZE * 2 + 1); // 121 -> 3 pages
		await renderApp();
		expect(cells()).toHaveLength(PAGE_SIZE);
		expect(pageLabel()).toBe("1 / 3");
		expect(button("Prev").disabled).toBe(true);
		expect(cells()[0].textContent).toContain("Movie 120"); // newest first

		fireEvent.click(button("Next"));
		expect(pageLabel()).toBe("2 / 3");
		expect(cells()).toHaveLength(PAGE_SIZE);
		expect(cells()[0].textContent).toContain("Movie 60");

		fireEvent.click(button("Next"));
		expect(pageLabel()).toBe("3 / 3");
		expect(cells()).toHaveLength(1);
		expect(button("Next").disabled).toBe(true);

		fireEvent.click(button("Prev"));
		expect(pageLabel()).toBe("2 / 3");
		expect(cells()).toHaveLength(PAGE_SIZE);
	});

	it("a filter change from page 3 lands on page 1 of the filtered results", async () => {
		seedMany(140, 70); // 70 tagged -> 2 pages once filtered
		await renderApp();
		fireEvent.click(button("Next"));
		fireEvent.click(button("Next"));
		expect(pageLabel()).toBe("3 / 3");
		fireEvent.click(button("long"));
		expect(pageLabel()).toBe("1 / 2");
		expect(cells()).toHaveLength(PAGE_SIZE);
	});

	it("out-of-range page after deletion shows the last page, not an empty grid", async () => {
		seedMany(PAGE_SIZE * 2 + 1); // page 3 holds exactly one (oldest) movie
		await renderApp();
		fireEvent.click(button("Next"));
		fireEvent.click(button("Next"));
		expect(pageLabel()).toBe("3 / 3");
		expect(cells()).toHaveLength(1);

		fireEvent.click(cells()[0]); // detail dialog
		fireEvent.click(button("Edit")); // stacked edit form
		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		fireEvent.click(screen.getByRole("button", { name: "Confirm delete?" }));
		await waitFor(() => expect(screen.queryByText("Edit movie")).toBeNull());

		// 120 left -> 2 pages; stored page 3 is out of range -> last page shown
		await waitFor(() => expect(pageLabel()).toBe("2 / 2"));
		expect(cells()).toHaveLength(PAGE_SIZE);
	});

	it("saving a new movie returns to page 1 and shows it first", async () => {
		seedMany(70); // 2 pages
		await renderApp();
		fireEvent.click(button("Next"));
		expect(pageLabel()).toBe("2 / 2");

		fireEvent.click(button("+ Add movie"));
		const form = document.querySelector(".movie-data-form")!;
		fireEvent.change(form.querySelector('input[type="text"]')!, { target: { value: "Brand New" } });
		const sel = form.querySelector("select[multiple]") as HTMLSelectElement;
		for (const o of Array.from(sel.options)) o.selected = o.value === UNKNOWN_ACTOR_ID;
		fireEvent.change(sel, {});
		fireEvent.click(button("Save"));

		await waitFor(() => expect(pageLabel()).toBe("1 / 2"));
		expect(cells()).toHaveLength(PAGE_SIZE);
		expect(cells()[0].textContent).toContain("Brand New"); // newest-first
	});

	it("pagination bar shows even for empty and short lists", async () => {
		seedJson({ movies: [], actors: [] });
		await renderApp();
		expect(pageLabel()).toBe("1 / 1");
		expect(button("Prev").disabled).toBe(true);
		expect(button("Next").disabled).toBe(true);
		expect(screen.getByText("No movies yet. Add one!")).toBeTruthy();
	});
});

describe("list: layout regions", () => {
	it("header / scroll / footer regions: grid scrolls alone, bars live outside it", async () => {
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		const header = document.querySelector(".movie-data-header")!;
		const scroll = document.querySelector(".movie-data-scroll")!;
		const footer = document.querySelector(".movie-data-footer")!;
		expect(header).not.toBeNull();
		expect(scroll).not.toBeNull();
		expect(footer).not.toBeNull();
		// toolbar + filters live in the header, outside the scroll region
		expect(header.querySelector(".movie-data-toolbar")).not.toBeNull();
		expect(header.querySelector(".movie-data-actor-select")).not.toBeNull();
		expect(header.querySelector(".movie-data-tags")).not.toBeNull();
		expect(scroll.querySelector(".movie-data-toolbar")).toBeNull();
		// the grid (incl. empty state) is inside the scroll region only
		expect(scroll.querySelector(".movie-data-grid")).not.toBeNull();
		expect(header.querySelector(".movie-data-grid")).toBeNull();
		// pagination lives in the footer, outside the scroll region
		expect(footer.querySelector(".movie-data-pagination")).not.toBeNull();
		expect(scroll.querySelector(".movie-data-pagination")).toBeNull();
		// regions are siblings in order (flex column layout); in tests App mounts
		// into a plain container instead of the classed Obsidian contentEl
		const root = header.parentElement!;
		expect(root.children.length).toBe(3);
		expect(root.children[0]).toBe(header);
		expect(root.children[1]).toBe(scroll);
		expect(root.children[2]).toBe(footer);
	});
});

describe("list: mobile hide-on-scroll", () => {
	afterEach(() => {
		Platform.isMobile = false; // stub is shared; always restore desktop
	});

	/** jsdom has no layout: shadow the element's scrollTop with a value. */
	const mockScrollTop = (el: Element, v: number) =>
		Object.defineProperty(el, "scrollTop", { value: v, writable: true, configurable: true });
	const bars = () => ({
		header: document.querySelector(".movie-data-header") as HTMLElement,
		footer: document.querySelector(".movie-data-footer") as HTMLElement,
		scroll: document.querySelector(".movie-data-scroll") as HTMLElement,
	});
	const hidden = (el: HTMLElement) => el.className.includes("is-hidden-bars");

	it("mobile: scroll down hides both bars, scroll up or top restores them", async () => {
		Platform.isMobile = true;
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		const { header, footer, scroll } = bars();
		expect(header.className).toContain("is-overlay"); // overlays grid (spec: no reflow)

		mockScrollTop(scroll, 100);
		fireEvent.scroll(scroll);
		await waitFor(() => expect(hidden(header)).toBe(true));
		expect(hidden(footer)).toBe(true);

		mockScrollTop(scroll, 60); // scrolling up
		fireEvent.scroll(scroll);
		await waitFor(() => expect(hidden(header)).toBe(false));
		expect(hidden(footer)).toBe(false);

		mockScrollTop(scroll, 200); // down again
		fireEvent.scroll(scroll);
		await waitFor(() => expect(hidden(header)).toBe(true));
		mockScrollTop(scroll, 0); // back at the top: always visible
		fireEvent.scroll(scroll);
		await waitFor(() => expect(hidden(header)).toBe(false));
		expect(hidden(footer)).toBe(false);
	});

	it("desktop: the gate keeps bars visible on any scroll", async () => {
		Platform.isMobile = false;
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		const { header, footer, scroll } = bars();
		expect(header.className).not.toContain("is-overlay"); // normal flow on desktop

		mockScrollTop(scroll, 500);
		fireEvent.scroll(scroll);
		mockScrollTop(scroll, 10);
		fireEvent.scroll(scroll);
		expect(hidden(header)).toBe(false);
		expect(hidden(footer)).toBe(false);
	});

	it("mobile: measures bar heights into the scroll-region spacer vars", async () => {
		Platform.isMobile = true;
		seedJson({ movies: MOVIES, actors: [ACTOR] });
		await renderApp();
		const { header, footer } = bars();
		// jsdom has no layout: mock the heights the component measures
		Object.defineProperty(header, "offsetHeight", { value: 120, configurable: true });
		Object.defineProperty(footer, "offsetHeight", { value: 44, configurable: true });
		fireEvent(window, new Event("resize")); // measurement effect re-runs
		const root = header.parentElement!;
		expect(root.style.getPropertyValue("--movie-data-hd")).toBe("120px");
		expect(root.style.getPropertyValue("--movie-data-ft")).toBe("44px");
	});

	it("page change and filter change restore the bars; a dialog round-trip preserves them hidden", async () => {
		Platform.isMobile = true;
		seedJson({
			movies: Array.from({ length: 140 }, (_, i) => ({
				id: `m_${(1_600_000_000_000 + i * 1000).toString(36)}${i.toString(36).padStart(4, "0")}`,
				title: `Movie ${i}`,
				cover: "",
				tags: i < 70 ? ["long"] : [],
				actorIds: [],
				info: "",
				url: "",
			})),
			actors: [],
		});
		await renderApp();
		let top = 0;
		const hide = async () => {
			top += 100; // monotonically increasing so every delta is "down"
			const { header, scroll } = bars(); // re-query: bar refs can change per render
			mockScrollTop(scroll, top);
			fireEvent.scroll(scroll);
			await waitFor(() => expect(hidden(header)).toBe(true));
		};
		const expectShown = () => {
			const { header } = bars();
			return waitFor(() => expect(hidden(header)).toBe(false));
		};

		await hide();
		fireEvent.click(button("Next")); // page change
		await expectShown();

		await hide();
		fireEvent.click(button("long")); // filter change
		await expectShown();

		await hide();
		fireEvent.click(cells()[0]); // detail dialog (list stays mounted beneath)
		fireEvent.click(button("Edit")); // stacked edit form
		fireEvent.click(button("Cancel")); // pop back to the detail
		fireEvent.click(button("Close")); // pop to the list
		// no remount happened: the hidden-bars state survives the round-trip
		expect(hidden(bars().header)).toBe(true);
		expect(hidden(bars().footer)).toBe(true);
		// scrolling up restores them as usual
		const restored = bars();
		mockScrollTop(restored.scroll, 0);
		fireEvent.scroll(restored.scroll);
		await waitFor(() => expect(hidden(restored.header)).toBe(false));
		expect(hidden(restored.footer)).toBe(false);
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
