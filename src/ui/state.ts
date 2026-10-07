import type { Actor, Movie } from "../types";

export type EntityFilter = "movies" | "actors";

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

export interface ListState {
	/** Actor id to filter movies by; "" = all actors (no actor filter). */
	actorFilter: string;
	entityFilter: EntityFilter;
	selectedTags: Set<string>;
}

export type Mode =
	| { kind: "list" }
	| { kind: "movie-form"; movie: Movie }
	| { kind: "actor-form"; actor: Actor };

export interface GridEntry {
	kind: "movie" | "actor";
	id: string;
	title: string;
	cover: string;
}

/**
 * Selection-only filtering (no text search): tag chips (OR within group)
 * and the single actor filter, combined AND across groups. The actor filter
 * applies to movies only; actor entries are never narrowed.
 */
export function computeResults(
	movies: Movie[],
	actors: Actor[],
	list: ListState
): GridEntry[] {
	const out: GridEntry[] = [];

	if (list.entityFilter === "movies") {
		for (const m of movies) {
			if (list.selectedTags.size > 0 && !m.tags.some((t) => list.selectedTags.has(t))) continue;
			if (list.actorFilter && !m.actorIds.includes(list.actorFilter)) continue;
			out.push({ kind: "movie", id: m.id, title: m.title, cover: m.cover });
		}
	} else {
		for (const a of actors) {
			out.push({ kind: "actor", id: a.id, title: a.name, cover: a.cover });
		}
	}
	return out;
}
