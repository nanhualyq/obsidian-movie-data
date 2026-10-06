import { useState } from "react";
import type { MovieStore } from "../../store";
import type { Movie, MovieStoreData } from "../../types";
import { ActorSelect } from "./ActorSelect";
import { CoverPicker } from "./CoverPicker";
import { DeleteControls } from "./DeleteControls";
import { Field } from "./Field";
import { FormButtons } from "./FormButtons";

export function MovieForm({
	store,
	data,
	movie,
	commit,
	remove,
	onCancel,
}: {
	store: MovieStore;
	data: MovieStoreData;
	movie: Movie;
	commit: (next: MovieStoreData) => Promise<boolean>;
	remove: (next: MovieStoreData, coverFile: string | null) => Promise<boolean>;
	onCancel: () => void;
}) {
	const isNew = !data.movies.some((x) => x.id === movie.id);

	const [title, setTitle] = useState(movie.title);
	const [tagsText, setTagsText] = useState(movie.tags.join(", "));
	const [url, setUrl] = useState(movie.url);
	const [info, setInfo] = useState(movie.info);
	const [actorIds, setActorIds] = useState<Set<string>>(new Set(movie.actorIds));
	const [cover, setCover] = useState(movie.cover);
	const [saving, setSaving] = useState(false);

	// D2: form computes the filtered dataset; App persists JSON first, then the cover
	const onDelete = () =>
		remove(
			{ movies: data.movies.filter((m) => m.id !== movie.id), actors: data.actors },
			movie.cover || null
		);

	const onSave = async () => {
		const nextMovie: Movie = {
			...movie,
			title: title.trim() || movie.title || "Untitled",
			tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
			url: url.trim(),
			info,
			// preserve store order, only keep checked ids (D1: ids only)
			actorIds: data.actors.filter((a) => actorIds.has(a.id)).map((a) => a.id),
			cover,
		};
		const idx = data.movies.findIndex((m) => m.id === nextMovie.id);
		const movies = idx >= 0 ? data.movies.map((m, i) => (i === idx ? nextMovie : m)) : [...data.movies, nextMovie];
		setSaving(true);
		try {
			await commit({ movies, actors: data.actors });
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="movie-data-form">
			<h2>{isNew ? "Add movie" : "Edit movie"}</h2>
			<Field label="Title" value={title} onChange={setTitle} />
			<Field label="Tags (comma-separated)" value={tagsText} onChange={setTagsText} />
			<Field label="URL" value={url} onChange={setUrl} />
			<Field label="Info" value={info} onChange={setInfo} multiline />
			<ActorSelect
				actors={data.actors}
				selectedIds={actorIds}
				onToggle={(id) =>
					setActorIds((prev) => {
						const next = new Set(prev);
						if (next.has(id)) next.delete(id);
						else next.add(id);
						return next;
					})
				}
			/>
			<CoverPicker store={store} entityId={movie.id} value={cover} onChange={setCover} />
			<FormButtons onSave={onSave} onCancel={onCancel} saving={saving} />
			{!isNew && <DeleteControls onConfirm={onDelete} />}
		</div>
	);
}
