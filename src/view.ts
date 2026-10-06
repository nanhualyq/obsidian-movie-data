import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type MovieDataPlugin from "./main";
import { newId } from "./store";
import type { Actor, Movie } from "./types";
export const VIEW_TYPE_MOVIE_DATA = "movie-data-view";

type Mode =
	| { kind: "list" }
	| { kind: "movie-form"; movie: Movie }
	| { kind: "actor-form"; actor: Actor };

interface DraftCover {
	filename: string;
	previewUrl: string;
}

export class MovieDataView extends ItemView {
	private mode: Mode = { kind: "list" };
	private query = "";
	private entityFilter: "movies" | "actors" = "movies";
	private selectedTags = new Set<string>();

	private gridEl!: HTMLElement;
	private toolbarEl!: HTMLElement;

	constructor(leaf: WorkspaceLeaf, private plugin: MovieDataPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_MOVIE_DATA;
	}

	getDisplayText(): string {
		return "Movie data";
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	private get store() {
		return this.plugin.store;
	}

	private render(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass("movie-data-root");

		if (this.store.loadError) {
			const err = root.createDiv({ cls: "movie-data-load-error" });
			err.createEl("h3", { text: "Could not load movie data" });
			err.createEl("p", {
				text: ".movie-data/movies.json is missing or corrupt. Fix or delete the file, then reload the plugin. Editing is disabled to avoid overwriting it.",
			});
			return;
		}

		switch (this.mode.kind) {
			case "list":
				this.renderList(root);
				break;
			case "movie-form":
				this.renderMovieForm(root, this.mode.movie);
				break;
			case "actor-form":
				this.renderActorForm(root, this.mode.actor);
				break;
		}
	}

	// ---------- List ----------

	private renderList(root: HTMLElement): void {
		const toolbar = root.createDiv({ cls: "movie-data-toolbar" });
		this.toolbarEl = toolbar;

		const search = toolbar.createEl("input", {
			cls: "movie-data-search",
			attr: { type: "search", placeholder: "Search title or actor..." },
		});
		search.value = this.query;
		search.oninput = () => {
			this.query = search.value;
			this.renderGrid();
		};

		const filterGroup = toolbar.createDiv({ cls: "movie-data-filters" });

		const addBtn = toolbar.createEl("button", {
			text: this.entityFilter === "movies" ? "+ Add movie" : "+ Add actor",
			cls: "movie-data-add-btn mod-cta",
		});
		addBtn.onclick = () => this.openAddForm();

		const movieBtn = filterGroup.createEl("button", { text: "Movies", cls: "movie-data-filter-btn" });
		const actorBtn = filterGroup.createEl("button", { text: "Actors", cls: "movie-data-filter-btn" });
		const syncActive = () => {
			movieBtn.toggleClass("is-active", this.entityFilter === "movies");
			actorBtn.toggleClass("is-active", this.entityFilter === "actors");
			addBtn.textContent = this.entityFilter === "movies" ? "+ Add movie" : "+ Add actor";
		};
		syncActive();
		movieBtn.onclick = () => {
			this.entityFilter = "movies";
			syncActive();
			this.renderTags();
			this.renderGrid();
		};
		actorBtn.onclick = () => {
			this.entityFilter = "actors";
			syncActive();
			this.renderTags();
			this.renderGrid();
		};

		this.tagsEl = root.createDiv({ cls: "movie-data-tags" });
		this.renderTags();

		this.gridEl = root.createDiv({ cls: "movie-data-grid" });
		this.renderGrid();
	}

	private tagsEl!: HTMLElement;

	private renderTags(): void {
		const el = this.tagsEl;
		el.empty();
		el.toggleClass("is-hidden", this.entityFilter !== "movies");
		if (this.entityFilter !== "movies") return;

		const allTags = new Set<string>();
		for (const m of this.store.movies) for (const t of m.tags) allTags.add(t);
		if (allTags.size === 0) return;

		for (const tag of [...allTags].sort()) {
			const chip = el.createEl("button", {
				text: tag,
				cls: "movie-data-tag" + (this.selectedTags.has(tag) ? " is-active" : ""),
			});
			chip.onclick = () => {
				if (this.selectedTags.has(tag)) this.selectedTags.delete(tag);
				else this.selectedTags.add(tag);
				this.renderTags();
				this.renderGrid();
			};
		}
	}

	private renderGrid(): void {
		this.gridEl.empty();

		const results = this.computeResults();
		if (results.length === 0) {
			this.gridEl.createDiv({
				cls: "movie-data-empty",
				text:
					this.query || this.selectedTags.size > 0
						? "No results"
						: this.entityFilter === "movies"
							? "No movies yet. Add one!"
							: "No actors yet. Add one!",
			});
			return;
		}

		for (const entry of results) {
			const cell = this.gridEl.createDiv({ cls: "movie-data-cell" });
			const coverEl = cell.createDiv({ cls: "movie-data-cover" });
			this.renderCover(coverEl, entry.cover);
			cell.createDiv({ cls: "movie-data-cell-title", text: entry.title });

			cell.onclick = () => {
				if (entry.kind === "movie") {
					const fresh = this.store.movies.find((m) => m.id === entry.id);
					if (fresh) this.mode = { kind: "movie-form", movie: { ...fresh, tags: [...fresh.tags], actorIds: [...fresh.actorIds] } };
				} else {
					const fresh = this.store.actors.find((a) => a.id === entry.id);
					if (fresh) this.mode = { kind: "actor-form", actor: { ...fresh } };
				}
				this.render();
			};
		}
	}

	/** D6: in-memory haystack search + tag filter + entity type. */
	private computeResults(): Array<{ kind: "movie" | "actor"; id: string; title: string; cover: string }> {
		const q = this.query.trim().toLowerCase();
		const out: Array<{ kind: "movie" | "actor"; id: string; title: string; cover: string }> = [];

		if (this.entityFilter === "movies") {
			for (const m of this.store.movies) {
				if (this.selectedTags.size > 0 && !m.tags.some((t) => this.selectedTags.has(t))) continue;
				if (q) {
					const actorNames = m.actorIds
						.map((id) => this.store.actorById(id)?.name ?? "")
						.join(" ");
					const hay = `${m.title} ${actorNames}`.toLowerCase();
					if (!hay.includes(q)) continue;
				}
				out.push({ kind: "movie", id: m.id, title: m.title, cover: m.cover });
			}
		} else {
			for (const a of this.store.actors) {
				if (q && !a.name.toLowerCase().includes(q)) continue;
				out.push({ kind: "actor", id: a.id, title: a.name, cover: a.cover });
			}
		}
		return out;
	}

	/** Lazy decode: covers resolve async; corrupt/missing shows placeholder. */
	private renderCover(holder: HTMLElement, filename: string): void {
		if (!filename) {
			holder.addClass("is-placeholder");
			holder.setText("?");
			return;
		}
		holder.setText("");
		this.store
			.coverUrl(filename)
			.then((url) => {
				if (!url) throw new Error("no url");
				const img = holder.createEl("img");
				img.src = url;
				img.onerror = () => {
					img.remove();
					holder.addClass("is-placeholder");
					holder.setText("?");
				};
			})
			.catch(() => {
				holder.addClass("is-placeholder");
				holder.setText("?");
			});
	}

	// ---------- Forms ----------

	private openAddForm(): void {
		if (this.entityFilter === "movies") {
			this.mode = {
				kind: "movie-form",
				movie: { id: newId("m"), title: "", cover: "", tags: [], actorIds: [], info: "", url: "" },
			};
		} else {
			this.mode = { kind: "actor-form", actor: { id: newId("a"), name: "", cover: "", info: "", url: "" } };
		}
		this.render();
	}

	private renderMovieForm(root: HTMLElement, movie: Movie): void {
		const form = root.createDiv({ cls: "movie-data-form" });
		form.createEl("h2", { text: this.isNewMovie(movie) ? "Add movie" : "Edit movie" });

		const title = this.textField(form, "Title", movie.title);
		const tags = this.textField(form, "Tags (comma-separated)", movie.tags.join(", "));
		const url = this.textField(form, "URL", movie.url);
		const info = this.textArea(form, "Info", movie.info);

		// Actor selection (D1: ids only)
		const actorGroup = form.createDiv({ cls: "movie-data-field" });
		actorGroup.createEl("label", { text: "Actors" });
		const actorList = actorGroup.createDiv({ cls: "movie-data-actor-list" });
		const checkedActors = new Set(movie.actorIds);
		for (const a of this.store.actors) {
			const row = actorList.createEl("label", { cls: "movie-data-actor-option" });
			const cb = row.createEl("input", { attr: { type: "checkbox" } });
			cb.checked = checkedActors.has(a.id);
			row.createSpan({ text: a.name });
			cb.onchange = () => {
				if (cb.checked) checkedActors.add(a.id);
				else checkedActors.delete(a.id);
			};
		}
		if (this.store.actors.length === 0) {
			actorList.createDiv({ cls: "movie-data-empty", text: "No actors yet - add actors first." });
		}

		let draft: DraftCover | null = null;
		const cover = this.coverPicker(form, movie.cover, (d) => (draft = d));

		this.formButtons(form, cover, () => {
			movie.title = title.value.trim() || movie.title || "Untitled";
			movie.tags = tags.value.split(",").map((t) => t.trim()).filter(Boolean);
			movie.url = url.value.trim();
			movie.info = info.value;
			movie.actorIds = this.store.actors.filter((a) => checkedActors.has(a.id)).map((a) => a.id);
			if (draft) movie.cover = draft.filename;
			return movie;
		}, () => {
			// cancel: no disk writes
			this.mode = { kind: "list" };
			this.render();
		});
	}

	private renderActorForm(root: HTMLElement, actor: Actor): void {
		const form = root.createDiv({ cls: "movie-data-form" });
		form.createEl("h2", { text: this.isNewActor(actor) ? "Add actor" : "Edit actor" });

		const name = this.textField(form, "Name", actor.name);
		const url = this.textField(form, "URL", actor.url);
		const info = this.textArea(form, "Info", actor.info);

		let draft: DraftCover | null = null;
		const cover = this.coverPicker(form, actor.cover, (d) => (draft = d));

		this.formButtons(form, cover, () => {
			actor.name = name.value.trim() || actor.name || "Unnamed";
			actor.url = url.value.trim();
			actor.info = info.value;
			if (draft) actor.cover = draft.filename;
			return actor;
		}, () => {
			this.mode = { kind: "list" };
			this.render();
		});
	}

	private isNewMovie(m: Movie): boolean {
		return !this.store.movies.some((x) => x.id === m.id);
	}

	private isNewActor(a: Actor): boolean {
		return !this.store.actors.some((x) => x.id === a.id);
	}

	private textField(parent: HTMLElement, label: string, value: string): HTMLInputElement {
		const field = parent.createDiv({ cls: "movie-data-field" });
		field.createEl("label", { text: label });
		const input = field.createEl("input", { attr: { type: "text" } });
		input.value = value;
		return input;
	}

	private textArea(parent: HTMLElement, label: string, value: string): HTMLTextAreaElement {
		const field = parent.createDiv({ cls: "movie-data-field" });
		field.createEl("label", { text: label });
		const ta = field.createEl("textarea");
		ta.value = value;
		return ta;
	}

	/** Cover picker: choose image file -> stage (deform) -> preview after deforming. */
	private coverPicker(
		parent: HTMLElement,
		currentCover: string,
		onPicked: (d: DraftCover | null) => void
	): { previewEl: HTMLElement; getFilename: () => string; resetPreview: () => void } {
		const field = parent.createDiv({ cls: "movie-data-field" });
		field.createEl("label", { text: "Cover" });
		const previewEl = field.createDiv({ cls: "movie-data-cover-preview" });
		let filename = currentCover;
		this.renderCover(previewEl, currentCover);

		const picker = field.createEl("input", { attr: { type: "file", accept: "image/*" } });
		picker.onchange = async () => {
			const file = picker.files?.[0];
			if (!file) return;
			const bytes = new Uint8Array(await file.arrayBuffer());
			const staged = this.store.stageCover(this.currentEntityId(), bytes);
			filename = staged.filename;
			onPicked({ filename: staged.filename, previewUrl: staged.previewUrl });
			previewEl.empty();
			previewEl.removeClass("is-placeholder");
			const img = previewEl.createEl("img");
			img.src = staged.previewUrl;
		};

		const removeBtn = field.createEl("button", { text: "Remove cover", cls: "movie-data-remove-btn" });
		removeBtn.onclick = () => {
			this.store.discardStaged(); // a picked-but-removed cover must not be written on save
			filename = "";
			onPicked({ filename: "", previewUrl: "" });
			previewEl.empty();
			previewEl.addClass("is-placeholder");
			previewEl.setText("?");
		};

		return {
			previewEl,
			getFilename: () => filename,
			resetPreview: () => undefined,
		};
	}

	private currentEntityId(): string {
		if (this.mode.kind === "movie-form") return this.mode.movie.id;
		if (this.mode.kind === "actor-form") return this.mode.actor.id;
		return newId("m");
	}

	private formButtons(
		form: HTMLElement,
		_cover: unknown,
		onSave: () => Movie | Actor,
		onCancel: () => void
	): void {
		const row = form.createDiv({ cls: "movie-data-form-buttons" });
		const save = row.createEl("button", { text: "Save", cls: "mod-cta" });
		const cancel = row.createEl("button", { text: "Cancel" });
		cancel.onclick = () => {
			this.store.discardStaged(); // cancel: nothing on disk changes
			onCancel();
		};
		save.onclick = async () => {
			const entity = onSave();
			// persist into collections (add or replace in place)
			if ("title" in entity) {
				const idx = this.store.movies.findIndex((m) => m.id === entity.id);
				if (idx >= 0) this.store.movies[idx] = entity as Movie;
				else this.store.movies.push(entity as Movie);
			} else {
				const idx = this.store.actors.findIndex((a) => a.id === entity.id);
				if (idx >= 0) this.store.actors[idx] = entity as Actor;
				else this.store.actors.push(entity as Actor);
			}
			try {
				await this.store.save(); // covers first, then movies.json
			} catch (e) {
				console.error("movie-data: save failed", e);
				new Notice("Failed to save movie data - see console.");
				return;
			}
			this.mode = { kind: "list" };
			this.render();
		};
	}
}
