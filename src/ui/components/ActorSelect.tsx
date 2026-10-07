import type { Actor } from "../../types";
import { UNKNOWN_ACTOR_ID, UNKNOWN_ACTOR_NAME } from "../state";

/**
 * Shared actor select (one control, two modes):
 * - mode="single": compact dropdown for the list's actor filter. First option
 *   "All actors" (value "") means no actor filtering.
 * - mode="multiple": list box for the movie form (roomy, see `size` below).
 * Both modes always list the "Unknown" fallback entry (its saved record when
 * it exists - shown under its current name - otherwise a synthetic option), so
 * movies with unknown cast are always selectable in the form and always
 * filterable in the list. Option lists are built here so filter and form can
 * never drift apart.
 */
export function ActorSelect({
	actors,
	mode,
	value,
	onChange,
}: {
	actors: Actor[];
	mode: "single" | "multiple";
	/** single: selected actor id ("" = all). multiple: selected actor ids. */
	value: string | Set<string>;
	onChange: (next: string | Set<string>) => void;
}) {
	const options = [...(actors.some((a) => a.id === UNKNOWN_ACTOR_ID)
		? actors
		: [...actors, { id: UNKNOWN_ACTOR_ID, name: UNKNOWN_ACTOR_NAME, cover: "", info: "", url: "" }])].sort(
		(a, b) => a.name.localeCompare(b.name)
	);

	if (mode === "single") {
		return (
			<select
				className="movie-data-actor-select"
				aria-label="Filter by actor"
				value={value as string}
				onChange={(e) => onChange(e.target.value)}
			>
				<option value="">All actors</option>
				{options.map((a) => (
					<option key={a.id} value={a.id} title={a.name}>
						{a.name}
					</option>
				))}
			</select>
		);
	}

	const selected = value as Set<string>;
	return (
		<div className="movie-data-field">
			<label>Actors</label>
			<select
				className="movie-data-actor-select movie-data-actor-select-form"
				multiple
				size={Math.max(6, Math.min(12, options.length))}
				aria-label="Actors"
				value={[...selected]}
				onChange={(e) => {
					const next = new Set<string>();
					for (const o of Array.from(e.target.selectedOptions)) next.add(o.value);
					onChange(next);
				}}
			>
				{options.map((a) => (
					<option key={a.id} value={a.id} title={a.name}>
						{a.name}
					</option>
				))}
			</select>
		</div>
	);
}
