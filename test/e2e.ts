// End-to-end pass: fresh install -> add movie w/ cover+actors -> search by
// actor name -> filter by tag -> edit actor -> "reload plugin" (fresh store
// instances) -> scanner-resistance checks on covers/.
// Run via: npx esbuild test/e2e.ts --bundle --format=cjs --platform=node
//   --alias:obsidian=./test/obsidian-stub.ts --outfile=... && node ...
import { FakeElement } from "./obsidian-stub";
import { MovieStore, COVER_PREFIX } from "../src/store";
import { MovieDataView } from "../src/view";

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

let failures = 0;
function assert(cond: any, msg: string): void {
	if (!cond) {
		console.error("FAIL: " + msg);
		failures++;
	} else console.log("ok: " + msg);
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const buttons = (root: FakeElement) => root.findAll((e) => e.tag === "button");
const cellsOf = (root: FakeElement) => root.findAll((e) => e.cls.has("movie-data-cell"));
const inputs = (root: FakeElement, type: string) =>
	root.findAll((e) => e.tag === "input" && e.attrs["type"] === type);

async function main(): Promise<void> {
	// 1. Fresh install
	const store = new MovieStore(app as any);
	await store.ensure();
	await store.load();
	assert(files.has(".movie-data/covers") && files.has(".movie-data/movies.json"),
		"fresh install creates ./.movie-data/covers + movies.json");
	assert(store.loadError === false, "fresh load has no error");

	// 2. Add actors + movie through the UI
	const plugin: any = { store };
	const view: any = new MovieDataView({}, plugin);
	await view.onOpen();
	let root: FakeElement = view.contentEl;

	root.findAll((e) => e.tag === "button").find((b) => b.text === "+ Add movie")!.onclick();
	let form = root.find((e) => e.cls.has("movie-data-form"))!;
	assert(form.find((e) => e.tag === "h2")?.text === "Add movie", "add form opens empty");

	// save with no actors yet -> placeholder, then cancel first movie attempt
	let cancel = form.findAll((e) => e.tag === "button").find((b) => b.text === "Cancel")!;
	cancel.onclick();
	assert(JSON.parse(files.get(".movie-data/movies.json")).movies.length === 0,
		"cancel before any save leaves store empty");

	// create actor via UI
	root.findAll((e) => e.tag === "button").find((b) => b.text === "Actors")!.onclick();
	root.findAll((e) => e.tag === "button").find((b) => b.text === "+ Add actor")!.onclick();
	form = root.find((e) => e.cls.has("movie-data-form"))!;
	const nameIn = inputs(form, "text")[0];
	nameIn.value = "Ana de Armas";
	await form.findAll((e) => e.tag === "button").find((b) => b.text === "Save")!.onclick();
	assert(store.actors.length === 1, "actor added via UI");

	// create movie with cover + actor + tags + info + url
	root.findAll((e) => e.tag === "button").find((b) => b.text === "Movies")!.onclick();
	root.findAll((e) => e.tag === "button").find((b) => b.text === "+ Add movie")!.onclick();
	form = root.find((e) => e.cls.has("movie-data-form"))!;
	const [t, tg, u] = inputs(form, "text");
	const info = form.find((e) => e.tag === "textarea")!;
	t.value = "Blade Runner 2049";
	tg.value = "sci-fi, noir";
	u.value = "https://example.com/br2049";
	info.value = "Line one\nline two (verbatim)";
	const cb = inputs(form, "checkbox")[0];
	cb.checked = true;
	cb.onchange();
	const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 7, 7, 7, 7, 7]);
	const fileInput = form.find((e) => e.tag === "input" && e.attrs["type"] === "file")!;
	fileInput.files = [{ arrayBuffer: async () => png.slice().buffer }];
	await fileInput.onchange();
	await form.findAll((e) => e.tag === "button").find((b) => b.text === "Save")!.onclick();

	assert(store.movies.length === 1, "movie saved");
	const saved = JSON.parse(files.get(".movie-data/movies.json")).movies[0];
	assert(saved.info === "Line one\nline two (verbatim)", "info kept verbatim (newlines preserved)");
	assert(saved.actorIds.length === 1 && saved.actorIds[0] === store.actors[0].id,
		"movie stores actor id only (actor data not duplicated)");

	// 3. Search by actor name (fresh view render)
	root = view.contentEl;
	const search = root.find((e) => e.tag === "input" && e.attrs["type"] === "search")!;
	search.value = "ana de";
	search.oninput();
	let cells = cellsOf(root);
	assert(cells.length === 1 && cells[0].children.some((c) => c.text === "Blade Runner 2049"),
		"search by actor name returns the movie");
	search.value = "";
	search.oninput();

	// 4. Filter by tag
	const chips = root.findAll((e) => e.cls.has("movie-data-tag"));
	assert(chips.map((c) => c.text).sort().join(",") === "noir,sci-fi", "tag chips = union of tags");
	root.findAll((e) => e.cls.has("movie-data-tag")).find((c) => c.text === "noir")!.onclick();
	assert(cellsOf(root).length === 1, "tag filter narrows to tagged movie");
	root.findAll((e) => e.cls.has("movie-data-tag")).find((c) => c.text === "noir")!.onclick();

	// 5. Edit actor -> reflected via id reference
	root.findAll((e) => e.tag === "button").find((b) => b.text === "Actors")!.onclick();
	cellsOf(root)[0].onclick();
	form = root.find((e) => e.cls.has("movie-data-form"))!;
	inputs(form, "text")[0].value = "Ana de Armas Prime";
	await form.findAll((e) => e.tag === "button").find((b) => b.text === "Save")!.onclick();
	root.findAll((e) => e.tag === "button").find((b) => b.text === "Movies")!.onclick();
	const s2 = root.find((e) => e.tag === "input" && e.attrs["type"] === "search")!;
	s2.value = "Prime";
	s2.oninput();
	assert(cellsOf(root).length === 1, "movie found via renamed actor (single-source reference)");
	s2.value = "";
	s2.oninput();

	// 6. "Reload plugin": brand-new store + view over same files
	const store2 = new MovieStore(app as any);
	await store2.ensure();
	await store2.load();
	assert(store2.loadError === false, "reload parses movies.json without error");
	assert(store2.movies.length === 1 && store2.actors.length === 1, "reload restores both collections");
	assert(store2.actors[0].name === "Ana de Armas Prime", "actor edit persisted");
	assert(store2.movies[0].info.includes("\n"), "info still intact after reload");
	const coverUrl = await store2.coverUrl(store2.movies[0].cover);
	assert(coverUrl !== null, "cover decodes after reload");

	// 7. Scanner resistance: extension + magic bytes at offset 0
	const coverNames = [...files.keys()].filter((k) => k.startsWith(".movie-data/covers/"));
	assert(coverNames.length > 0 && coverNames.every((n) => n.endsWith(".mcov")),
		"no image extensions in covers/");
	assert(coverNames.every((n) => !/\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i.test(n)),
		"extension-based scanners find nothing");
	const IMAGE_SIGS = [
		[0x89, 0x50, 0x4e, 0x47], // PNG
		[0xff, 0xd8, 0xff], // JPEG
		[0x47, 0x49, 0x46, 0x38], // GIF
		[0x42, 0x4d], // BMP
	];
	for (const n of coverNames) {
		const bytes: Buffer = files.get(n);
		const matches = IMAGE_SIGS.some((sig) => sig.every((b, i) => bytes[i] === b));
		assert(!matches, `magic-byte scan fails on ${n.split("/").pop()}`);
		assert(bytes.slice(0, COVER_PREFIX.length).equals(Buffer.from(COVER_PREFIX)),
			`${n.split("/").pop()} carries the fixed prefix at offset 0`);
	}

	// 8. Round-trip: decoded bytes == original png
	const decoded = (await import("../src/store")).decodeCover(new Uint8Array(files.get(`.movie-data/covers/${saved.cover}`)));
	assert(Buffer.compare(Buffer.from(decoded), Buffer.from(png)) === 0,
		"decoded cover byte-identical to original image");

	console.log(failures === 0 ? "\nE2E: ALL SCENARIOS PASS" : `\nE2E: ${failures} FAILURES`);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
	console.error("FAIL:", e);
	process.exit(1);
});
