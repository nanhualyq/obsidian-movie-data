import type { MovieStore } from "../../store";
import type { GridEntry } from "../state";
import { CoverImage } from "./CoverImage";

export function MovieCard({
	entry,
	store,
	onSelect,
}: {
	entry: GridEntry;
	store: MovieStore;
	onSelect: (entry: GridEntry) => void;
}) {
	return (
		<div className="movie-data-cell" onClick={() => onSelect(entry)}>
			<CoverImage store={store} filename={entry.cover} />
			<div className="movie-data-cell-title">{entry.title}</div>
		</div>
	);
}
