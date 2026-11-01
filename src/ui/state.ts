import type { Actor, Movie } from "../types";

/** Top-level tab of the view (design D2): two list tabs plus the notes editor. */
export type Tab = "movies" | "actors" | "notes";
/** The tabs that show the list (everything except Notes). */
export type ListTab = Exclude<Tab, "notes">;

/** Fixed page size for the list (spec: one constant for all viewports). */
export const PAGE_SIZE = 60;

/** Shared fallback actor for movies with unknown cast (fixed id, created lazily). */
export const UNKNOWN_ACTOR_ID = "a_unknown";
/** The one and only unknown-name label, used by the fallback option, the shared record, and empty actor names. */
export const UNKNOWN_ACTOR_NAME = "Unknown";

/** Return `actors` with the shared Unknown record present (created on first use). */
export function ensureUnknownActor(actors: Actor[]): Actor[] {
	return actors.some((a) => a.id === UNKNOWN_ACTOR_ID)
		? actors
		: [...actors, { id: UNKNOWN_ACTOR_ID, name: UNKNOWN_ACTOR_NAME, cover: "", info: "", url: "" }];
}

/** One distinct tag with its occurrence count across movies. */
export interface TagCount {
	tag: string;
	count: number;
}

/**
 * Distinct tags across all movies with occurrence counts, sorted by count
 * descending then alphabetically. Single source of truth for both the list's
 * tag chips and the movie form's suggestion dropdown (no drift between the
 * two views - same idea as ActorSelect building its own option list).
 */
export function tagHistory(movies: Movie[]): TagCount[] {
	const counts = new Map<string, number>();
	for (const m of movies) for (const t of m.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
	return [...counts.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Movies-list ordering mode (spec: movie sort toggle). The actors list ignores it. */
export type SortMode = "newest" | "random";

export interface ListState {
	/** Actor id to filter movies by; "" = all actors (no actor filter). */
	actorFilter: string;
	selectedTags: Set<string>;
	/** 1-based current page; reset to 1 on filter change and after a save. */
	page: number;
	/** Movies-list ordering (spec: movie sort toggle). The actors list ignores it. */
	sortMode: SortMode;
	/** Seed for random mode; bumped when entering random to reshuffle (design D1/D3). */
	shuffleSeed: number;
}

/**
 * One entry in the dialog stack (change: add-detail-and-dialog-flows,
 * design D1). The list is never an overlay - it stays mounted underneath.
 * Invariant: at most one detail (bottom) plus at most one form above it.
 * A detail stores only ids: the entity is resolved from `data` at render
 * time, so a popped-back-to detail always shows post-save values.
 */
export type Overlay =
	| { kind: "detail"; entity: "movie" | "actor"; id: string }
	| { kind: "movie-form"; movie: Movie }
	| { kind: "actor-form"; actor: Actor };

export interface GridEntry {
	kind: "movie" | "actor";
	id: string;
	title: string;
	cover: string;
}

/**
 * Creation timestamp embedded in an id by newId (`<prefix>_<base36 time><4 random>`),
 * parsed NUMERICALLY from the base36 prefix (a plain string compare would only
 * hold while the time part keeps a constant digit count). Returns null for ids
 * not in that shape (hand-edited data, the fixed `a_unknown` id, test fixtures);
 * callers keep input order for those.
 */
export function idTimestamp(id: string): number | null {
	const at = id.indexOf("_");
	const body = at < 0 ? "" : id.slice(at + 1);
	// base36 time (>= 7 digits for any real clock) + exactly 4 random chars
	if (!/^[0-9a-z]{11,}$/.test(body)) return null;
	const ts = parseInt(body.slice(0, -4), 36);
	return Number.isNaN(ts) ? null : ts;
}

/** Newest first; ids without a parseable timestamp keep their input order. */
function byNewestFirst<T extends { id: string }>(a: T, b: T): number {
	const ta = idTimestamp(a.id);
	const tb = idTimestamp(b.id);
	if (ta === null || tb === null) return 0;
	return tb - ta;
}

/**
 * Mulberry32: a tiny deterministic PRNG. The same seed yields the same
 * sequence on every platform (integer math via Math.imul), so a random order
 * is reproducible in tests and stable for a given seed (design D4).
 */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Fisher-Yates shuffle driven by a seeded PRNG. Pure: returns a new array and
 * leaves the input untouched. The same `seed` always yields the same order,
 * which is what makes a random movie order stable across filter/page changes
 * (design D1/D2).
 */
export function shuffleSeeded<T>(items: readonly T[], seed: number): T[] {
	const out = items.slice();
	const rand = mulberry32(seed);
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * Selection-only filtering (no text search): tag chips (OR within group)
 * and the single actor filter, combined AND across groups. The actor filter
 * applies to movies only; actor entries are never narrowed.
 *
 * Movie ordering is established FIRST over the full list (design D2), then
 * filtering runs in that order, so tag/actor filters and paging reveal a
 * stable subset in both modes. Random mode shuffles the whole list once per
 * `shuffleSeed`; newest-first sorts by id timestamp. Filtering after ordering
 * keeps a random order stable across filter changes (a seeded shuffle of a
 * shrinking subset would reshuffle on every filter). The actors branch always
 * sorts newest-first and ignores the sort mode (spec: movie sort toggle).
 */
export function computeResults(
	movies: Movie[],
	actors: Actor[],
	list: ListState,
	view: ListTab
): GridEntry[] {
	const out: GridEntry[] = [];

	if (view === "movies") {
		const ordered: Movie[] =
			list.sortMode === "random"
				? shuffleSeeded(movies, list.shuffleSeed)
				: movies.slice().sort(byNewestFirst);
		for (const m of ordered) {
			if (list.selectedTags.size > 0 && !m.tags.some((t) => list.selectedTags.has(t))) continue;
			if (list.actorFilter && !m.actorIds.includes(list.actorFilter)) continue;
			out.push({ kind: "movie", id: m.id, title: m.title, cover: m.cover });
		}
		return out;
	}

	for (const a of actors) {
		out.push({ kind: "actor", id: a.id, title: a.name, cover: a.cover });
	}
	// Actors: always newest-first (spec: the actors list has no alternate ordering).
	// Array.prototype.sort is stable, so same-millisecond ids and unparseable ids
	// keep their input order.
	return out.sort(byNewestFirst);
}
