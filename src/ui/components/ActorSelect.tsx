import type { Actor } from "../../types";
import { UNKNOWN_ACTOR_ID, UNKNOWN_ACTOR_NAME } from "../state";

/**
 * Shared actor select (design decision: one control, two modes):
 * - mode="single": compact dropdown for the list's actor filter. First option
 *   "All actors" (value "") means no actor filtering.
 * - mode="multiple": list box for the movie form. Always offers the
 *   "Unknown / Unnamed" fallback option (even with zero saved actors) so the
 *   required-actors rule is always satisfiable.
 * Option lists are built here so filter and form never drift apart.
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
	const sorted = [...actors].sort((a, b) => a.name.localeCompare(b.name));

	if (mode === "single") {
		return (
			<select
				className="movie-data-actor-select"
				aria-label="Filter by actor"
				value={value as string}
				onChange={(e) => onChange(e.target.value)}
			>
				<option value="">All actors</option>
				{sorted.map((a) => (
					<option key={a.id} value={a.id} title={a.name}>
						{a.name}
					</option>
				))}
			</select>
		);
	}

	const selected = value as Set<string>;
	// Fallback is always offered; show it in name order alongside saved actors.
	const options = sorted.some((a) => a.id === UNKNOWN_ACTOR_ID)
		? sorted
		: [...sorted, { id: UNKNOWN_ACTOR_ID, name: UNKNOWN_ACTOR_NAME, cover: "", info: "", url: "" }].sort((a, b) =>
				a.name.localeCompare(b.name)
			);
	return (
		<div className="movie-data-field">
			<label>Actors</label>
			<select
				className="movie-data-actor-select movie-data-actor-select-form"
				multiple
				size={Math.min(6, Math.max(3, options.length))}
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
