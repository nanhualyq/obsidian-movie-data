import type { Actor, Movie } from "../types";

export type EntityFilter = "movies" | "actors";

export interface ListState {
	query: string;
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

/** D6: in-memory haystack search + tag filter + entity type (ported from view.ts). */
export function computeResults(
	movies: Movie[],
	actors: Actor[],
	list: ListState
): GridEntry[] {
	const q = list.query.trim().toLowerCase();
	const out: GridEntry[] = [];

	if (list.entityFilter === "movies") {
		for (const m of movies) {
			if (list.selectedTags.size > 0 && !m.tags.some((t) => list.selectedTags.has(t))) continue;
			if (q) {
				const actorNames = m.actorIds
					.map((id) => actors.find((a) => a.id === id)?.name ?? "")
					.join(" ");
				const hay = `${m.title} ${actorNames}`.toLowerCase();
				if (!hay.includes(q)) continue;
			}
			out.push({ kind: "movie", id: m.id, title: m.title, cover: m.cover });
		}
	} else {
		for (const a of actors) {
			if (q && !a.name.toLowerCase().includes(q)) continue;
			out.push({ kind: "actor", id: a.id, title: a.name, cover: a.cover });
		}
	}
	return out;
}
