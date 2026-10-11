import { useCallback, useEffect, useState } from "react";
import { Notice } from "obsidian";
import type { MovieStore } from "../store";
import type { MovieStoreData } from "../types";
import { ListView } from "./components/ListView";
import { MovieForm } from "./components/MovieForm";
import { ActorForm } from "./components/ActorForm";
import { Dialog } from "./components/Dialog";
import { EntityDetail } from "./components/EntityDetail";
import type { ListState, Overlay } from "./state";

const EMPTY_LIST: ListState = { actorFilter: "", entityFilter: "movies", selectedTags: new Set<string>(), page: 1 };

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
 *
 * UI state is a dialog stack (change: add-detail-and-dialog-flows, D1): the
 * list stays mounted underneath every overlay, and every close path funnels
 * through pop()/clearStack() below.
 */
export function App({ store }: { store: MovieStore }) {
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
	const [data, setData] = useState<MovieStoreData>({ movies: [], actors: [] });
	const [overlays, setOverlays] = useState<Overlay[]>([]);
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

	/** Push an overlay: open detail, open edit (stacked over detail), open add. */
	const push = useCallback((overlay: Overlay) => setOverlays((prev) => [...prev, overlay]), []);

	/**
	 * Pop the top overlay - the single funnel for Cancel, Escape, backdrop,
	 * and Save (design D1). None of these paths write anything, so staged
	 * covers are dropped here (spec: explicit persistence); after a
	 * successful save the store has already discarded them (no-op).
	 */
	const pop = useCallback(() => {
		store.discardStaged();
		setOverlays((prev) => prev.slice(0, -1));
	}, [store]);

	/**
	 * Delete path (design D2): clears the WHOLE stack, not just the form -
	 * a detail below would reference the removed entity. Staged covers are
	 * dropped so this save never writes them (spec: staged-but-unsaved
	 * covers must not be written by this save).
	 */
	const clearStack = useCallback(() => {
		store.discardStaged();
		setOverlays([]);
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
			// Returning to the list after a save: land on page 1 so a new entity
			// (newest-first) is visible without hunting for it.
			setList((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
			// Pop the form: add-save lands on the list, edit-save on the detail.
			pop();
			return true;
		},
		[store, data, pop]
	);

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
			clearStack();
			return true;
		},
		[store, clearStack]
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

	return (
		<>
			<ListView store={store} data={data} list={list} setList={setList} push={push} />
			{overlays.map((overlay) => {
				if (overlay.kind === "detail") {
					return (
						<EntityDetail
							key={`detail:${overlay.entity}:${overlay.id}`}
							kind={overlay.entity}
							id={overlay.id}
							data={data}
							store={store}
							onEdit={push}
							onClose={pop}
						/>
					);
				}
				const isNew =
					overlay.kind === "movie-form"
						? !data.movies.some((m) => m.id === overlay.movie.id)
						: !data.actors.some((a) => a.id === overlay.actor.id);
				const kindWord = overlay.kind === "movie-form" ? "movie" : "actor";
				return (
					<Dialog
						key={overlay.kind === "movie-form" ? `form:${overlay.movie.id}` : `form:${overlay.actor.id}`}
						label={`${isNew ? "Add" : "Edit"} ${kindWord}`}
						onDismiss={pop}
					>
						{overlay.kind === "movie-form" ? (
							<MovieForm
								store={store}
								data={data}
								movie={overlay.movie}
								commit={commit}
								remove={remove}
								onCancel={pop}
							/>
						) : (
							<ActorForm
								store={store}
								data={data}
								actor={overlay.actor}
								commit={commit}
								remove={remove}
								onCancel={pop}
							/>
						)}
					</Dialog>
				);
			})}
		</>
	);
}
