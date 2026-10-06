export function TagFilter({
	tags,
	selectedTags,
	onToggle,
	hidden = false,
}: {
	tags: string[];
	selectedTags: Set<string>;
	onToggle: (tag: string) => void;
	hidden?: boolean;
}) {
	return (
		<div className={"movie-data-tags" + (hidden ? " is-hidden" : "")}>
			{tags.map((tag) => (
				<button
					key={tag}
					className={"movie-data-tag" + (selectedTags.has(tag) ? " is-active" : "")}
					onClick={() => onToggle(tag)}
				>
					{tag}
				</button>
			))}
		</div>
	);
}
