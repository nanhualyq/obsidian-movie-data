import { useMemo, type Dispatch, type SetStateAction } from "react";
import { newId, type MovieStore } from "../../store";
import type { MovieStoreData } from "../../types";
import { computeResults, type EntityFilter, type ListState, type Mode } from "../state";
import { MovieGrid } from "./MovieGrid";
import { TagFilter } from "./TagFilter";
import { Toolbar } from "./Toolbar";

export function ListView({
	store,
	data,
	list,
	setList,
	setMode,
}: {
	store: MovieStore;
	data: MovieStoreData;
	list: ListState;
	setList: Dispatch<SetStateAction<ListState>>;
	setMode: (mode: Mode) => void;
}) {
	const entries = useMemo(() => computeResults(data.movies, data.actors, list), [data, list]);

	// Union of movie tags, only shown while the movies filter is active.
	const tags = useMemo(() => {
		if (list.entityFilter !== "movies") return [];
		const all = new Set<string>();
		for (const m of data.movies) for (const t of m.tags) all.add(t);
		return [...all].sort();
	}, [data.movies, list.entityFilter]);

	const emptyText =
		list.query || list.selectedTags.size > 0
			? "No results"
			: list.entityFilter === "movies"
				? "No movies yet. Add one!"
				: "No actors yet. Add one!";

	const openAdd = () => {
		if (list.entityFilter === "movies") {
			setMode({
				kind: "movie-form",
				movie: { id: newId("m"), title: "", cover: "", tags: [], actorIds: [], info: "", url: "" },
			});
		} else {
			setMode({
				kind: "actor-form",
				actor: { id: newId("a"), name: "", cover: "", info: "", url: "" },
			});
		}
	};

	const openEntry = (entry: ReturnType<typeof computeResults>[number]) => {
		if (entry.kind === "movie") {
			const fresh = data.movies.find((m) => m.id === entry.id);
			if (fresh) setMode({ kind: "movie-form", movie: { ...fresh, tags: [...fresh.tags], actorIds: [...fresh.actorIds] } });
		} else {
			const fresh = data.actors.find((a) => a.id === entry.id);
			if (fresh) setMode({ kind: "actor-form", actor: { ...fresh } });
		}
	};

	return (
		<>
			<Toolbar
				query={list.query}
				entityFilter={list.entityFilter}
				onQuery={(q) => setList((prev) => ({ ...prev, query: q }))}
				onEntityFilter={(f) => setList((prev) => ({ ...prev, entityFilter: f }))}
				onAdd={openAdd}
			/>
			<TagFilter
				hidden={list.entityFilter !== "movies"}
				tags={tags}
				selectedTags={list.selectedTags}
				onToggle={(tag) =>
					setList((prev) => {
						const selectedTags = new Set(prev.selectedTags);
						if (selectedTags.has(tag)) selectedTags.delete(tag);
						else selectedTags.add(tag);
						return { ...prev, selectedTags };
					})
				}
			/>
			<MovieGrid entries={entries} store={store} emptyText={emptyText} onSelect={openEntry} />
		</>
	);
}
