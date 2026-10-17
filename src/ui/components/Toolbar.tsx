import type { ListTab } from "../state";

export function Toolbar({
	view,
	onAdd,
}: {
	view: ListTab;
	onAdd: () => void;
}) {
	return (
		<div className="movie-data-toolbar">
			<button className="movie-data-add-btn mod-cta" onClick={onAdd}>
				{view === "movies" ? "+ Add movie" : "+ Add actor"}
			</button>
		</div>
	);
}
