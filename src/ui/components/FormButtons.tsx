export function FormButtons({
	onSave,
	onCancel,
	saving = false,
}: {
	onSave: () => void;
	onCancel: () => void;
	saving?: boolean;
}) {
	return (
		<div className="movie-data-form-buttons">
			<button className="mod-cta" disabled={saving} onClick={onSave}>
				Save
			</button>
			<button disabled={saving} onClick={onCancel}>
				Cancel
			</button>
		</div>
	);
}
