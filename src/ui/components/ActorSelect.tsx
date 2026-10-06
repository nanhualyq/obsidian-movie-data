import type { MovieStore } from "../../store";
import type { Actor } from "../../types";
import { Field } from "./Field";

export function ActorSelect({
	actors,
	selectedIds,
	onToggle,
}: {
	actors: Actor[];
	selectedIds: Set<string>;
	onToggle: (id: string) => void;
}) {
	return (
		<div className="movie-data-field">
			<label>Actors</label>
			<div className="movie-data-actor-list">
				{actors.length === 0 ? (
					<div className="movie-data-empty">No actors yet - add actors first.</div>
				) : (
					actors.map((a) => (
						<label key={a.id} className="movie-data-actor-option">
							<input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => onToggle(a.id)} />
							<span>{a.name}</span>
						</label>
					))
				)}
			</div>
		</div>
	);
}
