import { useState } from "react";
import type { MovieStore } from "../../store";
import { normalizeCover } from "../../coverImage";
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

	/**
	 * Shared staging path for both input sources: file pick and clipboard paste.
	 * Bytes are size-normalized first (spec: "Covers are size-normalized before
	 * storage"); normalization is fail-soft, so staging always receives bytes.
	 */
	const handleImageFile = async (file: File) => {
		const original = new Uint8Array(await file.arrayBuffer());
		const bytes = await normalizeCover(original);
		const staged = store.stageCover(entityId, bytes);
		setStagedUrl(staged.previewUrl);
		onChange(staged.filename);
	};

	const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		await handleImageFile(file);
		// allow re-picking the same file name later
		e.target.value = "";
	};

	const onRemove = () => {
		store.discardStaged(); // a picked-but-removed cover must not be written on save
		setStagedUrl(null);
		onChange("");
	};

	/**
	 * Paste only when focus is inside this field (container is focusable,
	 * events bubble from within). Consumes the event only when an image is
	 * present; text paste keeps its default behavior (design D1/D3).
	 */
	const onPaste = (e: React.ClipboardEvent) => {
		const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
		if (!file) return;
		e.preventDefault();
		handleImageFile(file);
	};

	return (
		<div className="movie-data-field movie-data-cover-field" tabIndex={0} onPaste={onPaste}>
			<label>Cover</label>
			<CoverImage store={store} filename={value} stagedUrl={stagedUrl} preview />
			<input type="file" accept="image/*" onChange={onPick} />
			<button type="button" className="movie-data-remove-btn" onClick={onRemove}>
				Remove cover
			</button>
		</div>
	);
}
