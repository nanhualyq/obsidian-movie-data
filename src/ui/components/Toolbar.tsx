import type { EntityFilter } from "../state";

export function Toolbar({
	query,
	entityFilter,
	onQuery,
	onEntityFilter,
	onAdd,
}: {
	query: string;
	entityFilter: EntityFilter;
	onQuery: (q: string) => void;
	onEntityFilter: (f: EntityFilter) => void;
	onAdd: () => void;
}) {
	return (
		<div className="movie-data-toolbar">
			<input
				type="search"
				className="movie-data-search"
				placeholder="Search title or actor..."
				value={query}
				onChange={(e) => onQuery(e.target.value)}
			/>
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
