export function Field({
	label,
	value,
	onChange,
	multiline = false,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	multiline?: boolean;
}) {
	return (
		<div className="movie-data-field">
			<label>{label}</label>
			{multiline ? (
				<textarea value={value} onChange={(e) => onChange(e.target.value)} />
			) : (
				<input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
			)}
		</div>
	);
}
