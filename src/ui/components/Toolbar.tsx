import type { ListTab, SortMode } from "../state";

export function Toolbar({
	view,
	onAdd,
	sortMode,
	onToggleSort,
}: {
	view: ListTab;
	onAdd: () => void;
	sortMode: SortMode;
	onToggleSort: () => void;
}) {
	return (
		<div className="movie-data-toolbar">
			{/* Sort toggle: movies view only (spec: the actors list has no alternate ordering). */}
			{view === "movies" && (
				<button
					className="movie-data-sort-btn"
					aria-pressed={sortMode === "random"}
					aria-label="Toggle sort order"
					onClick={onToggleSort}
				>
					{sortMode === "random" ? "Sort: Random" : "Sort: Newest"}
				</button>
			)}
			<button className="movie-data-add-btn mod-cta" onClick={onAdd}>
				{view === "movies" ? "+ Add movie" : "+ Add actor"}
			</button>
		</div>
	);
}
