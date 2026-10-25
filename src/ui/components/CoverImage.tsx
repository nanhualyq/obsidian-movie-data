import { useEffect, useState } from "react";
import { useCoverUrl } from "../useCoverUrl";
import type { MovieStore } from "../../store";

/**
 * Grid-cell / form-preview cover box. Resolves stored covers lazily via
 * useCoverUrl, renders `<img>` on success and the "?" placeholder on
 * missing/corrupt files (spec: cover file corrupt -> placeholder, no crash).
 *
 * `stagedUrl` (a fresh preview from store.stageCover) takes precedence over
 * the stored filename so a picked-but-not-saved cover shows immediately.
 */
export function CoverImage({
	store,
	filename,
	stagedUrl,
	preview = false,
	ratio,
}: {
	store: MovieStore;
	filename: string;
	stagedUrl?: string | null;
	preview?: boolean;
	/** Preview-only frame ratio (e.g. "4 / 3") from the entity kind (design D2). */
	ratio?: string;
}) {
	const cover = useCoverUrl(store, stagedUrl ? "" : filename);
	const [broken, setBroken] = useState(false);
	useEffect(() => setBroken(false), [filename, stagedUrl]);

	const src = stagedUrl || (cover.status === "ok" ? cover.url : null);
	const placeholder = broken || (!src && cover.status !== "loading");
	const base = preview ? "movie-data-cover-preview" : "movie-data-cover";
	// Only the preview frame varies by entity kind; the grid frame stays CSS-driven.
	const style = preview && ratio ? { aspectRatio: ratio } : undefined;

	return (
		<div className={base + (placeholder ? " is-placeholder" : "")} style={style}>
			{src && !broken ? <img src={src} alt="" onError={() => setBroken(true)} /> : placeholder ? "?" : null}
		</div>
	);
}
