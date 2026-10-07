import { useMemo, type Dispatch, type SetStateAction } from "react";
import { newId, type MovieStore } from "../../store";
import type { MovieStoreData } from "../../types";
import { computeResults, tagHistory, type EntityFilter, type ListState, type Mode } from "../state";
import { ActorSelect } from "./ActorSelect";
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

	// Tag chips derive from the shared tag history (same source as the form's
	// suggestions), alphabetical here to keep the chip row stable.
	const tags = useMemo(() => {
		if (list.entityFilter !== "movies") return [];
		return tagHistory(data.movies)
			.map((e) => e.tag)
			.sort((a, b) => a.localeCompare(b));
	}, [data.movies, list.entityFilter]);

	const emptyText =
		list.selectedTags.size > 0 || list.actorFilter
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

	/** Jump from an actor entry to its movies, filtered to that actor only. */
	const jumpToActor = (actorId: string) =>
		setList({ entityFilter: "movies", actorFilter: actorId, selectedTags: new Set<string>() });

	return (
		<>
			<Toolbar
				entityFilter={list.entityFilter}
				onEntityFilter={(f) => setList((prev) => ({ ...prev, entityFilter: f }))}
				onAdd={openAdd}
			/>
			{list.entityFilter === "movies" && (
				<ActorSelect
					mode="single"
					actors={data.actors}
					value={list.actorFilter}
					onChange={(id) => setList((prev) => ({ ...prev, actorFilter: id as string }))}
				/>
			)}
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
			<MovieGrid
				entries={entries}
				store={store}
				emptyText={emptyText}
				onSelect={openEntry}
				onJumpActor={list.entityFilter === "actors" ? jumpToActor : undefined}
			/>
		</>
	);
}
