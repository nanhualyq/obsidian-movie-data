// Headless verification harness: bundles src/view.ts with the obsidian API
// stub, then drives the UI through the spec scenarios.
// Run: npx esbuild test/verify.ts --bundle --format=cjs --platform=node
//        --alias:obsidian=./test/obsidian-stub.ts --outfile=/tmp/verify.js && node /tmp/verify.js
import { FakeElement } from "./obsidian-stub";
import { MovieStore, COVER_PREFIX, stampCover } from "../src/store";
import { MovieDataView, VIEW_TYPE_MOVIE_DATA } from "../src/view";

const files = new Map<string, any>();
const adapter = {
	exists: async (p: string) => files.has(p),
	mkdir: async (p: string) => void files.set(p, null),
	read: async (p: string) => {
		const v = files.get(p);
		if (v === undefined || v === null) throw new Error("ENOENT " + p);
		return v;
	},
	write: async (p: string, c: string) => void files.set(p, c),
	writeBinary: async (p: string, b: ArrayBuffer) => void files.set(p, Buffer.from(b)),
	readBinary: async (p: string) => {
		const v = files.get(p);
		if (v === undefined || v === null) throw new Error("ENOENT " + p);
		return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
	},
};
const app = { vault: { adapter } };

function assert(cond: any, msg: string): void {
	if (!cond) {
		console.error("FAIL: " + msg);
		process.exit(1);
	}
	console.log("ok: " + msg);
}

const tick = () => new Promise((r) => setTimeout(r, 0));

async function main(): Promise<void> {
	const store = new MovieStore(app as any);
	await store.ensure();
	await store.load();

	// Seed: actor referenced by movie (D1: stored once)
	const actor = { id: "a_1", name: "Keanu Reeves", cover: "", info: "bio", url: "" };
	store.actors.push(actor);
	store.movies.push({
		id: "m_1",
		title: "The Matrix",
		cover: "",
		tags: ["sci-fi"],
		actorIds: ["a_1"],
		info: "free text\nkept verbatim",
		url: "http://x",
	});
	store.movies.push({
		id: "m_2",
		title: "Amelie",
		cover: "",
		tags: ["comedy"],
		actorIds: [],
		info: "",
		url: "",
	});

	// Corrupt cover for placeholder test
	files.set(".movie-data/covers/bad.mcov", Buffer.from([1, 2]));
	store.movies[0].cover = "bad.mcov";

	const plugin: any = { store };
	const view: any = new MovieDataView({}, plugin);
	await view.onOpen();
	const root: FakeElement = view.contentEl;

	// --- 3.1 grid ---
	let cells = root.findAll((e) => e.cls.has("movie-data-cell"));
	assert(cells.length === 2, "3.1 grid renders one cell per movie");
	assert(cells[0].find((e) => e.cls.has("movie-data-cell-title"))?.text === "The Matrix",
		"3.1 title below cell");
	await tick();
	const holder = cells[0].find((e) => e.cls.has("movie-data-cover"));
	assert(holder?.cls.has("is-placeholder"), "3.1 corrupt cover shows placeholder (no crash)");

	// valid cover decodes to img (cache)
	const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
	files.set(".movie-data/covers/m_2.mcov", Buffer.from(stampCover(png)));
	store.movies[1].cover = "m_2.mcov";
	view.render();
	await tick();
	cells = root.findAll((e) => e.cls.has("movie-data-cell"));
	const imgCell = cells[1].find((e) => e.tag === "img");
	assert(imgCell !== null, "3.1 valid cover renders as <img> after lazy decode");
	const url1 = await store.coverUrl("m_2.mcov");
	const url2 = await store.coverUrl("m_2.mcov");
	assert(url1 === url2, "3.1 decode cached across re-renders");

	// --- 3.2 search ---
	const search: FakeElement = root.find((e) => e.tag === "input" && e.attrs["type"] === "search")!;
	assert(!!search, "3.2 search input exists");
	search.value = "keanu";
	search.oninput();
	cells = root.findAll((e) => e.cls.has("movie-data-cell"));
	assert(cells.length === 1 && cells[0].children.some((c) => c.text === "The Matrix"),
		"3.2 search by actor name returns referencing movie");

	search.value = "zzz-no-match";
	search.oninput();
	const empty = root.find((e) => e.cls.has("movie-data-empty"));
	assert(empty?.text === "No results", "3.2 no results shows empty state");

	search.value = "";
	search.oninput();

	// tag filter
	const tagChips = root.findAll((e) => e.cls.has("movie-data-tag"));
	assert(tagChips.length === 2, "3.2 tag chips from union of movie tags");
	tagChips.find((c) => c.text === "comedy")!.onclick();
	cells = root.findAll((e) => e.cls.has("movie-data-cell"));
	assert(cells.length === 1 && cells[0].children.some((c) => c.text === "Amelie"),
		"3.2 tag filter narrows results");
	tagChips2(root).find((c) => c.text === "comedy")!.onclick();

	// entity switch
	const actorBtn = root.findAll((e) => e.tag === "button").find((b) => b.text === "Actors")!;
	actorBtn.onclick();
	cells = root.findAll((e) => e.cls.has("movie-data-cell"));
	assert(cells.length === 1 && cells[0].children.some((c) => c.text === "Keanu Reeves"),
		"3.2 entity switch shows actors");
	const addBtnAfter = root.findAll((e) => e.tag === "button").find((b) => b.cls.has("movie-data-add-btn"))!;
	assert(addBtnAfter.text === "+ Add actor", "3.2 add button follows entity filter");
	root.findAll((e) => e.tag === "button").find((b) => b.text === "Movies")!.onclick();

	// --- 4.1 add movie ---
	const jsonBefore = files.get(".movie-data/movies.json");
	root.findAll((e) => e.tag === "button").find((b) => b.text === "+ Add movie")!.onclick();
	let form = root.find((e) => e.cls.has("movie-data-form"))!;
	assert(form.find((e) => e.tag === "h2")?.text === "Add movie", "4.1 add form opens");
	const titleInput = form.findAll((e) => e.tag === "input" && e.attrs["type"] === "text")[0];
	const tagsInput = form.findAll((e) => e.tag === "input" && e.attrs["type"] === "text")[1];
	titleInput.value = "Heat";
	tagsInput.value = "crime, heist";
	// pick a cover through the file input
	const fileInput: FakeElement = form.find((e) => e.tag === "input" && e.attrs["type"] === "file")!;
	fileInput.files = [{ arrayBuffer: async () => png.slice().buffer }];
	await fileInput.onchange();
	// cancel must write nothing
	const cancelBtn = form.findAll((e) => e.tag === "button").find((b) => b.text === "Cancel")!;
	cancelBtn.onclick();
	assert(files.get(".movie-data/movies.json") === jsonBefore, "4.3 cancel leaves movies.json unchanged");
	assert(!files.has(".movie-data/covers/m_3.mcov"), "4.3 cancel writes no staged cover");

	// now save for real
	root.findAll((e) => e.tag === "button").find((b) => b.text === "+ Add movie")!.onclick();
	form = root.find((e) => e.cls.has("movie-data-form"))!;
	const t2 = form.findAll((e) => e.tag === "input" && e.attrs["type"] === "text")[0];
	const g2 = form.findAll((e) => e.tag === "input" && e.attrs["type"] === "text")[1];
	t2.value = "Heat";
	g2.value = "crime, heist";
	const fi2: FakeElement = form.find((e) => e.tag === "input" && e.attrs["type"] === "file")!;
	fi2.files = [{ arrayBuffer: async () => png.slice().buffer }];
	await fi2.onchange();
	const saveBtn = form.findAll((e) => e.tag === "button").find((b) => b.text === "Save")!;
	await saveBtn.onclick();

	const j = JSON.parse(files.get(".movie-data/movies.json"));
	const heat = j.movies.find((m: any) => m.title === "Heat");
	assert(!!heat, "4.1 save persists new movie to movies.json");
	assert(JSON.stringify(heat.tags) === JSON.stringify(["crime", "heist"]), "4.1 tags parsed from comma input");
	const heatCover = files.get(`.movie-data/covers/${heat.cover}`);
	assert(heatCover && heatCover[0] !== 0x89, "4.1 cover written deformed (magic bytes hidden)");
	assert(Buffer.compare(Buffer.from(heatCover.slice(COVER_PREFIX.length)), Buffer.from(png)) === 0,
		"4.1 decoded cover equals original bytes");
	cells = root.findAll((e) => e.cls.has("movie-data-cell"));
	assert(cells.some((c) => c.children.some((x) => x.text === "Heat")),
		"4.1 list reflects save immediately (no reload)");
	assert(!!root.find((e) => e.cls.has("movie-data-grid")), "4.3 save returns to list");

	// --- 4.2 edit actor, single source ---
	root.findAll((e) => e.tag === "button").find((b) => b.text === "Actors")!.onclick();
	cells = root.findAll((e) => e.cls.has("movie-data-cell"));
	cells[0].onclick(); // open actor edit
	form = root.find((e) => e.cls.has("movie-data-form"))!;
	assert(form.find((e) => e.tag === "h2")?.text === "Edit actor", "4.2 actor edit form opens");
	const nameInput = form.findAll((e) => e.tag === "input" && e.attrs["type"] === "text")[0];
	nameInput.value = "Johnny Utah";
	await form.findAll((e) => e.tag === "button").find((b) => b.text === "Save")!.onclick();

	assert(store.actors.length === 1 && store.actors[0].name === "Johnny Utah",
		"4.2 actor edited in place (no duplicate row)");
	const matrix = store.movies.find((m) => m.id === "m_1")!;
	assert(matrix.actorIds.length === 1 && matrix.actorIds[0] === store.actors[0].id,
		"4.2 movies reference actor by id; edit reflected everywhere");
	root.findAll((e) => e.tag === "button").find((b) => b.text === "Movies")!.onclick();
	const s2: FakeElement = root.find((e) => e.tag === "input" && e.attrs["type"] === "search")!;
	s2.value = "johnny";
	s2.oninput();
	cells = root.findAll((e) => e.cls.has("movie-data-cell"));
	assert(cells.some((c) => c.children.some((x) => x.text === "The Matrix")),
		"4.2 search by new actor name still returns referencing movie");

	// --- 2.4 load error state ---
	const storeBad = new MovieStore(app as any);
	files.set(".movie-data/movies.json", "{broken");
	await storeBad.load();
	const viewBad: any = new MovieDataView({}, { store: storeBad });
	await viewBad.onOpen();
	assert(!!viewBad.contentEl.find((e) => e.cls.has("movie-data-load-error")),
		"2.4 corrupt movies.json shows load-error state, no crash");

	console.log("\nALL VIEW CHECKS PASS");
}

function tagChips2(root: FakeElement): FakeElement[] {
	return root.findAll((e) => e.cls.has("movie-data-tag"));
}

main().catch((e) => {
	console.error("FAIL:", e);
	process.exit(1);
});
