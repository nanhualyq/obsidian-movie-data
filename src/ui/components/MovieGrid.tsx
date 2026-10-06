import type { MovieStore } from "../../store";
import type { GridEntry } from "../state";
import { EmptyState } from "./EmptyState";
import { MovieCard } from "./MovieCard";

export function MovieGrid({
	entries,
	store,
	emptyText,
	onSelect,
}: {
	entries: GridEntry[];
	store: MovieStore;
	emptyText: string;
	onSelect: (entry: GridEntry) => void;
}) {
	if (entries.length === 0) {
		return (
			<div className="movie-data-grid">
				<EmptyState text={emptyText} />
			</div>
		);
	}
	return (
		<div className="movie-data-grid">
			{entries.map((entry) => (
				<MovieCard key={`${entry.kind}:${entry.id}`} entry={entry} store={store} onSelect={onSelect} />
			))}
		</div>
	);
}
