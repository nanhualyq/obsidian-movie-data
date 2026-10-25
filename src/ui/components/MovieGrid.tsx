import type { MovieStore } from "../../store";
import type { GridEntry } from "../state";
import { EmptyState } from "./EmptyState";
import { MovieCard } from "./MovieCard";

export function MovieGrid({
	entries,
	store,
	emptyText,
	variant,
	onSelect,
	onJumpActor,
}: {
	entries: GridEntry[];
	store: MovieStore;
	emptyText: string;
	/** Per-view grid variant class (frame ratio + column width, design D1). */
	variant?: string;
	onSelect: (entry: GridEntry) => void;
	/** Provided only in the actors view: jump an actor entry to its filtered movies. */
	onJumpActor?: (actorId: string) => void;
}) {
	const gridClass = "movie-data-grid" + (variant ? ` ${variant}` : "");
	if (entries.length === 0) {
		return (
			<div className={gridClass}>
				<EmptyState text={emptyText} />
			</div>
		);
	}
	return (
		<div className={gridClass}>
			{entries.map((entry) => (
				<MovieCard
					key={`${entry.kind}:${entry.id}`}
					entry={entry}
					store={store}
					onSelect={onSelect}
					onJumpActor={entry.kind === "actor" ? onJumpActor : undefined}
				/>
			))}
		</div>
	);
}
