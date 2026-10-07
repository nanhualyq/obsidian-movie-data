import type { EntityFilter } from "../state";

export function Toolbar({
	entityFilter,
	onEntityFilter,
	onAdd,
}: {
	entityFilter: EntityFilter;
	onEntityFilter: (f: EntityFilter) => void;
	onAdd: () => void;
}) {
	return (
		<div className="movie-data-toolbar">
			<div className="movie-data-filters">
				<button
					className={"movie-data-filter-btn" + (entityFilter === "movies" ? " is-active" : "")}
					onClick={() => onEntityFilter("movies")}
				>
					Movies
				</button>
				<button
					className={"movie-data-filter-btn" + (entityFilter === "actors" ? " is-active" : "")}
					onClick={() => onEntityFilter("actors")}
				>
					Actors
				</button>
			</div>
			<button className="movie-data-add-btn mod-cta" onClick={onAdd}>
				{entityFilter === "movies" ? "+ Add movie" : "+ Add actor"}
			</button>
		</div>
	);
}
