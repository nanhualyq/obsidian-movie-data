import type { MovieStore } from "../../store";
import type { GridEntry } from "../state";
import { CoverImage } from "./CoverImage";

export function MovieCard({
	entry,
	store,
	onSelect,
	onJumpActor,
}: {
	entry: GridEntry;
	store: MovieStore;
	onSelect: (entry: GridEntry) => void;
	/** Actor entries only: jump to this actor's filtered movies (actors view). */
	onJumpActor?: (actorId: string) => void;
}) {
	return (
		<div className="movie-data-cell" onClick={() => onSelect(entry)}>
			<CoverImage store={store} filename={entry.cover} />
			<div className="movie-data-cell-title">{entry.title}</div>
			{onJumpActor && (
				<button
					className="movie-data-jump"
					onClick={(e) => {
						// must not bubble: the cell's click opens the edit form
						e.stopPropagation();
						onJumpActor(entry.id);
					}}
				>
					Filter movies
				</button>
			)}
		</div>
	);
}
