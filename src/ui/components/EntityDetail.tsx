import type { MovieStore } from "../../store";
import type { MovieStoreData } from "../../types";
import { UNKNOWN_ACTOR_NAME, type Overlay } from "../state";
import { CoverImage } from "./CoverImage";
import { Dialog } from "./Dialog";

/**
 * Read-only detail dialog (change: add-detail-and-dialog-flows, spec:
 * "Entry detail dialog").
 *
 * The entity is resolved from `data` by id on every render, so popping back
 * here after an edit save shows the updated values with no refresh step
 * (design D1). View-only: Edit stacks the form on top of this dialog;
 * delete stays an action of the edit form only.
 *
 * A missing entity cannot occur while on the stack (delete clears the whole
 * stack) - returning null is a guard so no empty dialog ever opens.
 */
export function EntityDetail({
	kind,
	id,
	data,
	store,
	onEdit,
	onClose,
}: {
	kind: "movie" | "actor";
	id: string;
	data: MovieStoreData;
	store: MovieStore;
	onEdit: (overlay: Overlay) => void;
	onClose: () => void;
}) {
	const movie = kind === "movie" ? data.movies.find((m) => m.id === id) : undefined;
	const actor = kind === "actor" ? data.actors.find((a) => a.id === id) : undefined;

	if (kind === "movie" && movie) {
		// Unknown/absent cast records fall back to the one shared label (spec).
		const actorNames = movie.actorIds.map(
			(aid) => data.actors.find((a) => a.id === aid)?.name || UNKNOWN_ACTOR_NAME
		);
		return (
			<Dialog label={movie.title || "Movie details"} onDismiss={onClose}>
				<div className="movie-data-detail">
					<CoverImage store={store} filename={movie.cover} />
					<div className="movie-data-detail-main">
						<h2 className="movie-data-detail-title">{movie.title}</h2>
						{movie.tags.length > 0 && (
							<div className="movie-data-detail-tags">
								{movie.tags.map((t) => (
									<span key={t} className="movie-data-tag-chip">
										{t}
									</span>
								))}
							</div>
						)}
						{actorNames.length > 0 && <div className="movie-data-detail-meta">{actorNames.join(", ")}</div>}
						{movie.url && (
							<div className="movie-data-detail-meta">
								<a href={movie.url} target="_blank" rel="noreferrer noopener">
									{movie.url}
								</a>
							</div>
						)}
						{movie.info && <div className="movie-data-detail-info">{movie.info}</div>}
						<div className="movie-data-detail-actions">
							<button
								type="button"
								className="mod-cta"
								onClick={() =>
									onEdit({
										kind: "movie-form",
										// draft snapshot: the form must not alias store data (design D1)
										movie: { ...movie, tags: [...movie.tags], actorIds: [...movie.actorIds] },
									})
								}
							>
								Edit
							</button>
							<button type="button" onClick={onClose}>
								Close
							</button>
						</div>
					</div>
				</div>
			</Dialog>
		);
	}

	if (kind === "actor" && actor) {
		return (
			<Dialog label={actor.name || "Actor details"} onDismiss={onClose}>
				<div className="movie-data-detail">
					<CoverImage store={store} filename={actor.cover} />
					<div className="movie-data-detail-main">
						<h2 className="movie-data-detail-title">{actor.name}</h2>
						{actor.url && (
							<div className="movie-data-detail-meta">
								<a href={actor.url} target="_blank" rel="noreferrer noopener">
									{actor.url}
								</a>
							</div>
						)}
						{actor.info && <div className="movie-data-detail-info">{actor.info}</div>}
						<div className="movie-data-detail-actions">
							<button
								type="button"
								className="mod-cta"
								onClick={() => onEdit({ kind: "actor-form", actor: { ...actor } })}
							>
								Edit
							</button>
							<button type="button" onClick={onClose}>
								Close
							</button>
						</div>
					</div>
				</div>
			</Dialog>
		);
	}

	return null;
}
