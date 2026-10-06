import { useState } from "react";
import type { MovieStore } from "../../store";
import { CoverImage } from "./CoverImage";

/**
 * Cover picker: choose image file -> stage (deform) -> preview after
 * deforming. The staged bytes live in the store until save() (spec:
 * explicit persistence) or discardStaged() (cancel/remove).
 */
export function CoverPicker({
	store,
	entityId,
	value,
	onChange,
}: {
	store: MovieStore;
	entityId: string;
	value: string;
	onChange: (filename: string) => void;
}) {
	const [stagedUrl, setStagedUrl] = useState<string | null>(null);

	const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const bytes = new Uint8Array(await file.arrayBuffer());
		const staged = store.stageCover(entityId, bytes);
		setStagedUrl(staged.previewUrl);
		onChange(staged.filename);
		// allow re-picking the same file name later
		e.target.value = "";
	};

	const onRemove = () => {
		store.discardStaged(); // a picked-but-removed cover must not be written on save
		setStagedUrl(null);
		onChange("");
	};

	return (
		<div className="movie-data-field">
			<label>Cover</label>
			<CoverImage store={store} filename={value} stagedUrl={stagedUrl} preview />
			<input type="file" accept="image/*" onChange={onPick} />
			<button type="button" className="movie-data-remove-btn" onClick={onRemove}>
				Remove cover
			</button>
		</div>
	);
}
