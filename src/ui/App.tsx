import { useCallback, useEffect, useState } from "react";
import { Notice } from "obsidian";
import type { MovieStore } from "../store";
import type { MovieStoreData } from "../types";
import { ListView } from "./components/ListView";
import { MovieForm } from "./components/MovieForm";
import { ActorForm } from "./components/ActorForm";
import type { ListState, Mode } from "./state";

const EMPTY_LIST: ListState = { actorFilter: "", entityFilter: "movies", selectedTags: new Set<string>() };

/**
 * D1: cover files that become unreferenced by this save - entities whose
 * `cover` field goes non-empty -> `""`. Keys off the previously referenced
 * filename (D4), so it can never name a file another entity still uses.
 */
export function staleCovers(prev: MovieStoreData, next: MovieStoreData): string[] {
	const before = new Map<string, string>();
	for (const e of [...prev.movies, ...prev.actors]) before.set(e.id, e.cover);
	const stale: string[] = [];
	for (const e of [...next.movies, ...next.actors]) {
		const was = before.get(e.id);
		if (was && e.cover === "") stale.push(was);
	}
	return stale;
}

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
			// covers cleared by this save; deleted only after the JSON write (D2)
			const stale = staleCovers(data, next);
			try {
				await store.save(next);
			} catch (e) {
				console.error("movie-data: save failed", e);
				new Notice("Failed to save movie data - see console.");
				return false;
			}
			// JSON-first: only now is the file unreferenced. Failures are inert -
			// log them, never roll back the successful save (D3).
			for (const filename of stale) {
				try {
					await store.deleteCover(filename);
				} catch (e) {
					console.error("movie-data: failed to delete removed cover", e);
				}
			}
			setData(next);
			setMode({ kind: "list" });
			return true;
		},
		[store, data]
	);

	/** Cancel path: drop staged covers, write nothing (spec: explicit persistence). */
	const cancel = useCallback(() => {
		store.discardStaged();
		setMode({ kind: "list" });
	}, [store]);

	/**
	 * D2: delete path - persist the filtered dataset first (movies.json), then
	 * remove the entity's cover file. State updates only after save succeeds;
	 * a cover-deletion failure is logged but does not roll back (a leftover
	 * cover file is inert - the storage spec orders JSON first for this).
	 */
	const remove = useCallback(
		async (next: MovieStoreData, coverFile: string | null): Promise<boolean> => {
			// staged-but-unsaved covers must not be written by this save
			store.discardStaged();
			try {
				await store.save(next);
			} catch (e) {
				console.error("movie-data: save failed", e);
				new Notice("Failed to save movie data - see console.");
				return false;
			}
			if (coverFile) {
				try {
					await store.deleteCover(coverFile);
				} catch (e) {
					console.error("movie-data: failed to delete cover", e);
				}
			}
			setData(next);
			setMode({ kind: "list" });
			return true;
		},
		[store]
	);

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
			<MovieForm store={store} data={data} movie={mode.movie} commit={commit} remove={remove} onCancel={cancel} />
		);
	}
	if (mode.kind === "actor-form") {
		return (
			<ActorForm store={store} data={data} actor={mode.actor} commit={commit} remove={remove} onCancel={cancel} />
		);
	}

	return (
		<ListView store={store} data={data} list={list} setList={setList} setMode={setMode} />
	);
}
