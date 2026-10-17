import { useCallback, useEffect, useRef, useState } from "react";
import { Notice } from "obsidian";
import type { MovieStore } from "../store";
import type { MovieStoreData } from "../types";
import { ListView } from "./components/ListView";
import { MovieForm } from "./components/MovieForm";
import { ActorForm } from "./components/ActorForm";
import { Dialog } from "./components/Dialog";
import { EntityDetail } from "./components/EntityDetail";
import { NoteView } from "./components/NoteView";
import { TabBar } from "./components/TabBar";
import type { ListState, Overlay, Tab } from "./state";

const EMPTY_LIST: ListState = { actorFilter: "", selectedTags: new Set<string>(), page: 1 };

/** Debounce before the note autosave writes (design D4). */
const NOTE_AUTOSAVE_MS = 500;

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
 * Shared flush handle: view.ts awaits it in onClose before unmounting so a
 * pending note draft is persisted (spec: closing the view flushes the draft).
 */
export type FlushHandle = { current: (() => Promise<void>) | null };

/**
 * Root component: owns all application state (design D2) and the load
 * lifecycle (D3). Business data lives here - MovieStore is pure I/O.
 *
 * UI state is a dialog stack (change: add-detail-and-dialog-flows, D1): the
 * list stays mounted underneath every overlay, and every close path funnels
 * through pop()/clearStack() below.
 */
export function App({ store, flushHandle }: { store: MovieStore; flushHandle?: FlushHandle }) {
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
	const [data, setData] = useState<MovieStoreData>({ movies: [], actors: [], note: "" });
	const [overlays, setOverlays] = useState<Overlay[]>([]);
	const [list, setList] = useState<ListState>(EMPTY_LIST);
	// Design D3: the note draft lives here (not in NoteView) so it survives the
	// notes-tab unmount; the autosave wiring (task 4.1) persists it.
	const [tab, setTab] = useState<Tab>("movies");
	const [noteDraft, setNoteDraft] = useState("");

	// --- Note autosave state (design D3/D4/D6) -------------------------------
	// dataRef: latest COMMITTED data, updated synchronously at every write path
	// so a queued write never reads stale React state (design D6).
	const dataRef = useRef<MovieStoreData>(data);
	// Latest typed text (survives the notes-tab unmount via noteDraft state).
	const noteDraftRef = useRef(noteDraft);
	const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Failure flag (spec: failure is reported once, then retried silently): set
	// on the first failed write, cleared on the first success after it.
	const noteFailedRef = useRef(false);
	// Single sequential write queue: form saves and note autosaves can never
	// interleave (design D6 - the "no clobber" invariant).
	const writeQueueRef = useRef<Promise<unknown>>(Promise.resolve());

	useEffect(() => {
		let alive = true;
		store.load().then((res) => {
			if (!alive) return;
			if (res.ok) {
				dataRef.current = res.data;
				noteDraftRef.current = res.data.note;
				setData(res.data);
				setNoteDraft(res.data.note);
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
	 * Serialize every disk write through one queue (design D6): note autosaves
	 * and form saves execute strictly in order, each reading the latest refs at
	 * execution time - ordering is an invariant, not a timing accident.
	 */
	const enqueueWrite = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
		const result = writeQueueRef.current.then(task);
		// Keep the chain resolved regardless of the task's outcome; the caller
		// still receives the raw result (errors propagate to its own catch).
		writeQueueRef.current = result.then(
			() => undefined,
			() => undefined
		);
		return result;
	}, []);

	/**
	 * Queue one JSON-only write of the latest draft (design D4/D5): payload is
	 * built INSIDE the queued task so it always reflects the newest committed
	 * data, and store.saveData never touches staged covers (spec: note autosave
	 * does not write staged covers).
	 */
	const writeNote = useCallback((): Promise<void> => {
		return enqueueWrite(async () => {
			const payload: MovieStoreData = { ...dataRef.current, note: noteDraftRef.current };
			try {
				await store.saveData(payload);
				// dataRef/data.note mirror the last PERSISTED note; a newer draft
				// stays in noteDraftRef and is picked up by the next write.
				noteFailedRef.current = false; // recovered: failures notify again
				dataRef.current = payload;
				setData((prev) => (prev.note === payload.note ? prev : { ...prev, note: payload.note }));
			} catch (e) {
				// Draft untouched: it stays in memory and the next edit/flush
				// retries (spec: Note autosave failure leaves disk unchanged).
				console.error("movie-data: note autosave failed", e);
				// Notify on the FIRST failure only; further failures stay silent
				// while the flag is set (spec: failure is reported once).
				if (!noteFailedRef.current) {
					noteFailedRef.current = true;
					new Notice("Failed to save the note - see console.");
				}
			}
		});
	}, [enqueueWrite, store]);

	/** Schedule the debounced write; every edit restarts the window (D4). */
	const scheduleNoteWrite = useCallback(() => {
		if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
		noteTimerRef.current = setTimeout(() => {
			noteTimerRef.current = null;
			void writeNote();
		}, NOTE_AUTOSAVE_MS);
	}, [writeNote]);

	const onNoteChange = useCallback(
		(next: string) => {
			noteDraftRef.current = next;
			setNoteDraft(next);
			scheduleNoteWrite();
		},
		[scheduleNoteWrite]
	);

	/**
	 * Flush the pending draft (spec: leaving the Notes tab and closing the view
	 * persist first): cancel the debounce, queue the write if the draft differs
	 * from the persisted note, then await the whole write queue.
	 */
	const flushNote = useCallback(async () => {
		if (noteTimerRef.current) {
			clearTimeout(noteTimerRef.current);
			noteTimerRef.current = null;
		}
		if (noteDraftRef.current !== dataRef.current.note) void writeNote();
		await writeQueueRef.current;
	}, [writeNote]);

	// view.ts onClose awaits this handle before unmounting (spec: closing the
	// view flushes the draft).
	useEffect(() => {
		if (!flushHandle) return;
		flushHandle.current = flushNote;
		return () => {
			flushHandle.current = null;
		};
	}, [flushHandle, flushNote]);

	/**
	 * App-level tab switch (spec: three-tab entity navigation): landing on a
	 * list tab resets pagination to 1 (as with any view switch); filters are
	 * preserved in ListState. Leaving Notes first flushes the pending draft so
	 * the text is on disk before the tab switch completes (spec: switching away
	 * from Notes persists pending text).
	 */
	const switchTab = useCallback(
		async (next: Tab) => {
			if (next === tab) return;
			if (tab === "notes") await flushNote();
			setTab(next);
			setList((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
		},
		[tab, flushNote]
	);

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
				await enqueueWrite(() => store.save(next));
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
			dataRef.current = next;
			setData(next);
			// Returning to the list after a save: land on page 1 so a new entity
			// (newest-first) is visible without hunting for it.
			setList((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
			// Pop the form: add-save lands on the list, edit-save on the detail.
			pop();
			return true;
		},
		[store, data, pop, enqueueWrite]
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
				await enqueueWrite(() => store.save(next));
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
			dataRef.current = next;
			setData(next);
			clearStack();
			return true;
		},
		[store, clearStack, enqueueWrite]
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
			<TabBar active={tab} onSelect={switchTab} />
			<div className="movie-data-body">
				{tab === "notes" ? (
					<NoteView value={noteDraft} onChange={onNoteChange} />
				) : (
					<ListView
						store={store}
						data={data}
						list={list}
						setList={setList}
						push={push}
						view={tab}
						onSwitchTab={switchTab}
					/>
				)}
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
			</div>
		</>
	);
}
