import { useState } from "react";
import type { MovieStore } from "../../store";
import type { Actor, MovieStoreData } from "../../types";
import { CoverPicker } from "./CoverPicker";
import { DeleteControls } from "./DeleteControls";
import { Field } from "./Field";
import { FormButtons } from "./FormButtons";

export function ActorForm({
	store,
	data,
	actor,
	commit,
	remove,
	onCancel,
}: {
	store: MovieStore;
	data: MovieStoreData;
	actor: Actor;
	commit: (next: MovieStoreData) => Promise<boolean>;
	remove: (next: MovieStoreData, coverFile: string | null) => Promise<boolean>;
	onCancel: () => void;
}) {
	const isNew = !data.actors.some((x) => x.id === actor.id);
	// D3: reference guard evaluated at delete time from the same data snapshot
	const refCount = data.movies.filter((m) => m.actorIds.includes(actor.id)).length;

	const [name, setName] = useState(actor.name);
	const [url, setUrl] = useState(actor.url);
	const [info, setInfo] = useState(actor.info);
	const [cover, setCover] = useState(actor.cover);
	const [saving, setSaving] = useState(false);

	const onDelete = () =>
		remove(
			{ movies: data.movies, actors: data.actors.filter((a) => a.id !== actor.id) },
			actor.cover || null
		);

	const onSave = async () => {
		const nextActor: Actor = {
			...actor,
			name: name.trim() || actor.name || "Unnamed",
			url: url.trim(),
			info,
			cover,
		};
		const idx = data.actors.findIndex((a) => a.id === nextActor.id);
		const actors = idx >= 0 ? data.actors.map((a, i) => (i === idx ? nextActor : a)) : [...data.actors, nextActor];
		setSaving(true);
		try {
			await commit({ movies: data.movies, actors });
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="movie-data-form">
			<h2>{isNew ? "Add actor" : "Edit actor"}</h2>
			<Field label="Name" value={name} onChange={setName} />
			<Field label="URL" value={url} onChange={setUrl} />
			<Field label="Info" value={info} onChange={setInfo} multiline />
			<CoverPicker store={store} entityId={actor.id} value={cover} onChange={setCover} />
			<FormButtons onSave={onSave} onCancel={onCancel} saving={saving} />
			{!isNew && (
				<DeleteControls
					onConfirm={onDelete}
					guardWarning={refCount > 0 ? `Referenced by ${refCount} movie(s)` : null}
				/>
			)}
		</div>
	);
}
