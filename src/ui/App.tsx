import { useCallback, useEffect, useState } from "react";
import { Notice } from "obsidian";
import type { MovieStore } from "../store";
import type { MovieStoreData } from "../types";
import { ListView } from "./components/ListView";
import { MovieForm } from "./components/MovieForm";
import { ActorForm } from "./components/ActorForm";
import type { ListState, Mode } from "./state";

const EMPTY_LIST: ListState = { query: "", entityFilter: "movies", selectedTags: new Set<string>() };

/**
 * Root component: owns all application state (design D2) and the load
 * lifecycle (D3). Business data lives here - MovieStore is pure I/O.
 */
export function App({ store }: { store: MovieStore }) {
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
	const [data, setData] = useState<MovieStoreData>({ movies: [], actors: [] });
	const [mode, setMode] = useState<Mode>({ kind: "list" });
	const [list, setList] = useState<ListState>(EMPTY_LIST);

	useEffect(() => {
		let alive = true;
		store.load().then((res) => {
			if (!alive) return;
			if (res.ok) {
				setData(res.data);
				setStatus("ready");
			} else {
				setStatus("error");
			}
		});
		return () => {
			alive = false;
		};
	}, [store]);

	/** D4: sequential save - persist first, update state only on success. */
	const commit = useCallback(
		async (next: MovieStoreData): Promise<boolean> => {
			try {
				await store.save(next);
			} catch (e) {
				console.error("movie-data: save failed", e);
				new Notice("Failed to save movie data - see console.");
				return false;
			}
			setData(next);
			setMode({ kind: "list" });
			return true;
		},
		[store]
	);

	/** Cancel path: drop staged covers, write nothing (spec: explicit persistence). */
	const cancel = useCallback(() => {
		store.discardStaged();
		setMode({ kind: "list" });
	}, [store]);

	if (status === "error") {
		return (
			<div className="movie-data-load-error">
				<h3>Could not load movie data</h3>
				<p>
					.movie-data/movies.json is missing or corrupt. Fix or delete the file, then reload the plugin.
					Editing is disabled to avoid overwriting it.
				</p>
			</div>
		);
	}

	if (status === "loading") return null;

	if (mode.kind === "movie-form") {
		return (
			<MovieForm store={store} data={data} movie={mode.movie} commit={commit} onCancel={cancel} />
		);
	}
	if (mode.kind === "actor-form") {
		return (
			<ActorForm store={store} data={data} actor={mode.actor} commit={commit} onCancel={cancel} />
		);
	}

	return (
		<ListView store={store} data={data} list={list} setList={setList} setMode={setMode} />
	);
}
