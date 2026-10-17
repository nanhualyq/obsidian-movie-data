import type { Tab } from "../state";

const TABS: { id: Tab; label: string }[] = [
	{ id: "movies", label: "Movies" },
	{ id: "actors", label: "Actors" },
	{ id: "notes", label: "Notes" },
];

/**
 * Top-level three-tab navigation (spec: three-tab entity navigation).
 * Rendered by App above the ListView/NoteView branch, visible in all views.
 * Reuses the old filter-button styling so the tabs look identical to the
 * previous Movies/Actors switch.
 */
export function TabBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
	return (
		<div className="movie-data-tabs">
			{TABS.map((t) => (
				<button
					key={t.id}
					className={"movie-data-tab" + (active === t.id ? " is-active" : "")}
					aria-current={active === t.id ? "page" : undefined}
					onClick={() => onSelect(t.id)}
				>
					{t.label}
				</button>
			))}
		</div>
	);
}
