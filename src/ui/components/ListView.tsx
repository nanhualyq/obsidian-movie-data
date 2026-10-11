import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Platform } from "obsidian";
import { newId, type MovieStore } from "../../store";
import type { MovieStoreData } from "../../types";
import { computeResults, tagHistory, PAGE_SIZE, type ListState, type Mode } from "../state";
import { ActorSelect } from "./ActorSelect";
import { MovieGrid } from "./MovieGrid";
import { PaginationBar } from "./PaginationBar";
import { TagFilter } from "./TagFilter";
import { Toolbar } from "./Toolbar";

/** Per-scroll-event delta (px) before the direction flips. */
const SCROLL_DIR_THRESHOLD = 4;

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
	// Mobile hide-on-scroll (spec: header and footer hide on scroll): direction
	// detector on the grid's scroll region. Desktop never hides (gated below).
	const [barsHidden, setBarsHidden] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const footerRef = useRef<HTMLDivElement>(null);
	const lastScrollTop = useRef(0);
	const mobile = Platform.isMobile;

	useEffect(() => {
		// Reset when the page changes so the bars come back with the new slice.
		setBarsHidden(false);
	}, [list.page]);

	const handleScroll = () => {
		if (!Platform.isMobile) return; // gate: desktop bars always visible
		const el = scrollRef.current;
		if (!el) return;
		const next = el.scrollTop;
		const delta = next - lastScrollTop.current;
		lastScrollTop.current = next;
		if (next <= 0) setBarsHidden(false); // at the top: always show
		else if (delta > SCROLL_DIR_THRESHOLD) setBarsHidden(true);
		else if (delta < -SCROLL_DIR_THRESHOLD) setBarsHidden(false);
	};

	// Mobile overlay spacer (design D5): keep the scroll region's padding in
	// step with the bars' measured heights so content starts/ends below them.
	// Runs after every render (header height changes with filters/entity view)
	// and on window resize (chip wrapping). No-op off-mobile and in jsdom.
	useLayoutEffect(() => {
		if (!Platform.isMobile) return;
		const apply = () => {
			const root = headerRef.current?.parentElement;
			if (!root || !headerRef.current || !footerRef.current) return;
			root.style.setProperty("--movie-data-hd", `${headerRef.current.offsetHeight}px`);
			root.style.setProperty("--movie-data-ft", `${footerRef.current.offsetHeight}px`);
		};
		apply();
		window.addEventListener("resize", apply);
		return () => window.removeEventListener("resize", apply);
	});

	const entries = useMemo(() => computeResults(data.movies, data.actors, list), [data, list]);

	// Tag chips derive from the shared tag history (same source as the form's
	// suggestions), alphabetical here to keep the chip row stable.
	const tags = useMemo(() => {
		if (list.entityFilter !== "movies") return [];
		return tagHistory(data.movies)
			.map((e) => e.tag)
			.sort((a, b) => a.localeCompare(b));
	}, [data.movies, list.entityFilter]);

	// Pagination (spec: paginated list display): clamp the stored page into the
	// available range, so a shrunken result set shows its last page, never none.
	const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
	const page = Math.min(Math.max(list.page, 1), totalPages);
	const pageEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	/**
	 * Single funnel for filter changes: applies the patch, resets pagination to
	 * page 1 (spec: a filter change lands on page 1 of the new results), and
	 * brings the bars back so a new result set starts with controls visible.
	 */
	const setFilter = (patch: (prev: ListState) => Partial<ListState>) => {
		setBarsHidden(false);
		setList((prev) => ({ ...prev, ...patch(prev), page: 1 }));
	};

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
		setFilter(() => ({ entityFilter: "movies", actorFilter: actorId, selectedTags: new Set<string>() }));

	return (
		<>
			<div
				className={
					"movie-data-header" + (mobile ? " is-overlay" : "") + (barsHidden ? " is-hidden-bars" : "")
				}
				ref={headerRef}
			>
				<Toolbar
					entityFilter={list.entityFilter}
					onEntityFilter={(f) => setFilter(() => ({ entityFilter: f }))}
					onAdd={openAdd}
				/>
				{list.entityFilter === "movies" && (
					<ActorSelect
						mode="single"
						actors={data.actors}
						value={list.actorFilter}
						onChange={(id) => setFilter(() => ({ actorFilter: id as string }))}
					/>
				)}
				<TagFilter
					hidden={list.entityFilter !== "movies"}
					tags={tags}
					selectedTags={list.selectedTags}
					onToggle={(tag) =>
						setFilter((prev) => {
							const selectedTags = new Set(prev.selectedTags);
							if (selectedTags.has(tag)) selectedTags.delete(tag);
							else selectedTags.add(tag);
							return { selectedTags };
						})
					}
				/>
			</div>
			<div className="movie-data-scroll" ref={scrollRef} onScroll={handleScroll}>
				<MovieGrid
					entries={pageEntries}
					store={store}
					emptyText={emptyText}
					onSelect={openEntry}
					onJumpActor={list.entityFilter === "actors" ? jumpToActor : undefined}
				/>
			</div>
			<div
				className={
					"movie-data-footer" + (mobile ? " is-overlay" : "") + (barsHidden ? " is-hidden-bars" : "")
				}
				ref={footerRef}
			>
				<PaginationBar
					page={page}
					total={totalPages}
					onChange={(next) => {
						setBarsHidden(false);
						setList((prev) => ({ ...prev, page: next }));
					}}
				/>
			</div>
		</>
	);
}
