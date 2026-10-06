"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MovieDataPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/store.ts
var DATA_DIR = ".movie-data";
var JSON_PATH = `${DATA_DIR}/movies.json`;
var COVERS_DIR = `${DATA_DIR}/covers`;
var COVER_PREFIX = new TextEncoder().encode("MOVIEMOVIECOVER!");
function stampCover(original) {
  const out = new Uint8Array(COVER_PREFIX.length + original.length);
  out.set(COVER_PREFIX, 0);
  out.set(original, COVER_PREFIX.length);
  return out;
}
function decodeCover(stamped) {
  return stamped.slice(COVER_PREFIX.length);
}
function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
var MovieStore = class {
  constructor(app) {
    this.app = app;
    this.data = { movies: [], actors: [] };
    /** True when movies.json is missing/unreadable/unparseable. */
    this.loadError = false;
    this.pendingCovers = /* @__PURE__ */ new Map();
    this.coverCache = /* @__PURE__ */ new Map();
    this.stagedPreviewUrls = /* @__PURE__ */ new Set();
  }
  get adapter() {
    return this.app.vault.adapter;
  }
  /** Spec: Fresh install creates ./.movie-data/covers/ and an empty movies.json. */
  async ensure() {
    if (!await this.adapter.exists(DATA_DIR)) {
      await this.adapter.mkdir(DATA_DIR);
    }
    if (!await this.adapter.exists(COVERS_DIR)) {
      await this.adapter.mkdir(COVERS_DIR);
    }
    if (!await this.adapter.exists(JSON_PATH)) {
      await this.adapter.write(JSON_PATH, JSON.stringify({ movies: [], actors: [] }, null, 2));
    }
  }
  /** Load movies.json. On failure, sets loadError and keeps in-memory data untouched. */
  async load() {
    try {
      if (!await this.adapter.exists(JSON_PATH)) {
        await this.ensure();
      }
      const raw = await this.adapter.read(JSON_PATH);
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.movies) || !Array.isArray(parsed.actors)) {
        throw new Error("movies.json has unexpected shape");
      }
      this.data = { movies: parsed.movies, actors: parsed.actors };
      this.loadError = false;
    } catch (e) {
      console.error("movie-data: failed to load movies.json", e);
      this.loadError = true;
    }
  }
  /**
   * Stage a cover for a pending edit. Nothing touches disk until save().
   * Returns the cover filename and a preview URL of the deformed-then-decoded bytes.
   */
  stageCover(entityId, original) {
    const filename = `${entityId}.mcov`;
    const stamped = stampCover(original);
    this.pendingCovers.set(filename, stamped);
    const previewUrl = URL.createObjectURL(new Blob([toArrayBuffer(decodeCover(stamped))]));
    this.stagedPreviewUrls.add(previewUrl);
    return { filename, previewUrl };
  }
  /** Drop all staged covers (cancel path: nothing was written). */
  discardStaged() {
    this.pendingCovers.clear();
    for (const url of this.stagedPreviewUrls)
      URL.revokeObjectURL(url);
    this.stagedPreviewUrls.clear();
  }
  /**
   * Spec: Explicit persistence. Writes staged covers first, then the whole
   * movies.json. Nothing is written unless this is called (save path only).
   */
  async save() {
    for (const [filename, bytes] of this.pendingCovers) {
      await this.adapter.writeBinary(`${COVERS_DIR}/${filename}`, toArrayBuffer(bytes));
      this.invalidateCover(filename);
    }
    this.discardStaged();
    await this.adapter.write(JSON_PATH, JSON.stringify(this.data, null, 2));
  }
  /**
   * Lazy decode with in-memory cache (D3). Returns an object URL for the
   * decoded image, or null on missing/corrupt file (placeholder path).
   */
  async coverUrl(filename) {
    if (!filename)
      return null;
    const cached = this.coverCache.get(filename);
    if (cached)
      return cached;
    try {
      const raw = await this.adapter.readBinary(`${COVERS_DIR}/${filename}`);
      const bytes = new Uint8Array(raw);
      if (bytes.length <= COVER_PREFIX.length)
        throw new Error("cover too short");
      const url = URL.createObjectURL(new Blob([toArrayBuffer(decodeCover(bytes))]));
      this.coverCache.set(filename, url);
      return url;
    } catch (e) {
      console.error(`movie-data: failed to decode cover ${filename}`, e);
      return null;
    }
  }
  invalidateCover(filename) {
    const url = this.coverCache.get(filename);
    if (url) {
      URL.revokeObjectURL(url);
      this.coverCache.delete(filename);
    }
  }
  /** Revoke all object URLs on plugin unload. */
  unload() {
    for (const url of this.coverCache.values())
      URL.revokeObjectURL(url);
    this.coverCache.clear();
    this.discardStaged();
  }
  get movies() {
    return this.data.movies;
  }
  get actors() {
    return this.data.actors;
  }
  actorById(id) {
    return this.data.actors.find((a) => a.id === id);
  }
};

// src/view.ts
var import_obsidian = require("obsidian");
var VIEW_TYPE_MOVIE_DATA = "movie-data-view";
var MovieDataView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.mode = { kind: "list" };
    this.query = "";
    this.entityFilter = "movies";
    this.selectedTags = /* @__PURE__ */ new Set();
  }
  getViewType() {
    return VIEW_TYPE_MOVIE_DATA;
  }
  getDisplayText() {
    return "Movie data";
  }
  async onOpen() {
    this.render();
  }
  get store() {
    return this.plugin.store;
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("movie-data-root");
    if (this.store.loadError) {
      const err = root.createDiv({ cls: "movie-data-load-error" });
      err.createEl("h3", { text: "Could not load movie data" });
      err.createEl("p", {
        text: ".movie-data/movies.json is missing or corrupt. Fix or delete the file, then reload the plugin. Editing is disabled to avoid overwriting it."
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
  renderList(root) {
    const toolbar = root.createDiv({ cls: "movie-data-toolbar" });
    this.toolbarEl = toolbar;
    const search = toolbar.createEl("input", {
      cls: "movie-data-search",
      attr: { type: "search", placeholder: "Search title or actor..." }
    });
    search.value = this.query;
    search.oninput = () => {
      this.query = search.value;
      this.renderGrid();
    };
    const filterGroup = toolbar.createDiv({ cls: "movie-data-filters" });
    const addBtn = toolbar.createEl("button", {
      text: this.entityFilter === "movies" ? "+ Add movie" : "+ Add actor",
      cls: "movie-data-add-btn mod-cta"
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
  renderTags() {
    const el = this.tagsEl;
    el.empty();
    el.toggleClass("is-hidden", this.entityFilter !== "movies");
    if (this.entityFilter !== "movies")
      return;
    const allTags = /* @__PURE__ */ new Set();
    for (const m of this.store.movies)
      for (const t of m.tags)
        allTags.add(t);
    if (allTags.size === 0)
      return;
    for (const tag of [...allTags].sort()) {
      const chip = el.createEl("button", {
        text: tag,
        cls: "movie-data-tag" + (this.selectedTags.has(tag) ? " is-active" : "")
      });
      chip.onclick = () => {
        if (this.selectedTags.has(tag))
          this.selectedTags.delete(tag);
        else
          this.selectedTags.add(tag);
        this.renderTags();
        this.renderGrid();
      };
    }
  }
  renderGrid() {
    this.gridEl.empty();
    const results = this.computeResults();
    if (results.length === 0) {
      this.gridEl.createDiv({
        cls: "movie-data-empty",
        text: this.query || this.selectedTags.size > 0 ? "No results" : this.entityFilter === "movies" ? "No movies yet. Add one!" : "No actors yet. Add one!"
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
          if (fresh)
            this.mode = { kind: "movie-form", movie: { ...fresh, tags: [...fresh.tags], actorIds: [...fresh.actorIds] } };
        } else {
          const fresh = this.store.actors.find((a) => a.id === entry.id);
          if (fresh)
            this.mode = { kind: "actor-form", actor: { ...fresh } };
        }
        this.render();
      };
    }
  }
  /** D6: in-memory haystack search + tag filter + entity type. */
  computeResults() {
    const q = this.query.trim().toLowerCase();
    const out = [];
    if (this.entityFilter === "movies") {
      for (const m of this.store.movies) {
        if (this.selectedTags.size > 0 && !m.tags.some((t) => this.selectedTags.has(t)))
          continue;
        if (q) {
          const actorNames = m.actorIds.map((id) => this.store.actorById(id)?.name ?? "").join(" ");
          const hay = `${m.title} ${actorNames}`.toLowerCase();
          if (!hay.includes(q))
            continue;
        }
        out.push({ kind: "movie", id: m.id, title: m.title, cover: m.cover });
      }
    } else {
      for (const a of this.store.actors) {
        if (q && !a.name.toLowerCase().includes(q))
          continue;
        out.push({ kind: "actor", id: a.id, title: a.name, cover: a.cover });
      }
    }
    return out;
  }
  /** Lazy decode: covers resolve async; corrupt/missing shows placeholder. */
  renderCover(holder, filename) {
    if (!filename) {
      holder.addClass("is-placeholder");
      holder.setText("?");
      return;
    }
    holder.setText("");
    this.store.coverUrl(filename).then((url) => {
      if (!url)
        throw new Error("no url");
      const img = holder.createEl("img");
      img.src = url;
      img.onerror = () => {
        img.remove();
        holder.addClass("is-placeholder");
        holder.setText("?");
      };
    }).catch(() => {
      holder.addClass("is-placeholder");
      holder.setText("?");
    });
  }
  // ---------- Forms ----------
  openAddForm() {
    if (this.entityFilter === "movies") {
      this.mode = {
        kind: "movie-form",
        movie: { id: newId("m"), title: "", cover: "", tags: [], actorIds: [], info: "", url: "" }
      };
    } else {
      this.mode = { kind: "actor-form", actor: { id: newId("a"), name: "", cover: "", info: "", url: "" } };
    }
    this.render();
  }
  renderMovieForm(root, movie) {
    const form = root.createDiv({ cls: "movie-data-form" });
    form.createEl("h2", { text: this.isNewMovie(movie) ? "Add movie" : "Edit movie" });
    const title = this.textField(form, "Title", movie.title);
    const tags = this.textField(form, "Tags (comma-separated)", movie.tags.join(", "));
    const url = this.textField(form, "URL", movie.url);
    const info = this.textArea(form, "Info", movie.info);
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
        if (cb.checked)
          checkedActors.add(a.id);
        else
          checkedActors.delete(a.id);
      };
    }
    if (this.store.actors.length === 0) {
      actorList.createDiv({ cls: "movie-data-empty", text: "No actors yet - add actors first." });
    }
    let draft = null;
    const cover = this.coverPicker(form, movie.cover, (d) => draft = d);
    this.formButtons(form, cover, () => {
      movie.title = title.value.trim() || movie.title || "Untitled";
      movie.tags = tags.value.split(",").map((t) => t.trim()).filter(Boolean);
      movie.url = url.value.trim();
      movie.info = info.value;
      movie.actorIds = this.store.actors.filter((a) => checkedActors.has(a.id)).map((a) => a.id);
      if (draft)
        movie.cover = draft.filename;
      return movie;
    }, () => {
      this.mode = { kind: "list" };
      this.render();
    });
  }
  renderActorForm(root, actor) {
    const form = root.createDiv({ cls: "movie-data-form" });
    form.createEl("h2", { text: this.isNewActor(actor) ? "Add actor" : "Edit actor" });
    const name = this.textField(form, "Name", actor.name);
    const url = this.textField(form, "URL", actor.url);
    const info = this.textArea(form, "Info", actor.info);
    let draft = null;
    const cover = this.coverPicker(form, actor.cover, (d) => draft = d);
    this.formButtons(form, cover, () => {
      actor.name = name.value.trim() || actor.name || "Unnamed";
      actor.url = url.value.trim();
      actor.info = info.value;
      if (draft)
        actor.cover = draft.filename;
      return actor;
    }, () => {
      this.mode = { kind: "list" };
      this.render();
    });
  }
  isNewMovie(m) {
    return !this.store.movies.some((x) => x.id === m.id);
  }
  isNewActor(a) {
    return !this.store.actors.some((x) => x.id === a.id);
  }
  textField(parent, label, value) {
    const field = parent.createDiv({ cls: "movie-data-field" });
    field.createEl("label", { text: label });
    const input = field.createEl("input", { attr: { type: "text" } });
    input.value = value;
    return input;
  }
  textArea(parent, label, value) {
    const field = parent.createDiv({ cls: "movie-data-field" });
    field.createEl("label", { text: label });
    const ta = field.createEl("textarea");
    ta.value = value;
    return ta;
  }
  /** Cover picker: choose image file -> stage (deform) -> preview after deforming. */
  coverPicker(parent, currentCover, onPicked) {
    const field = parent.createDiv({ cls: "movie-data-field" });
    field.createEl("label", { text: "Cover" });
    const previewEl = field.createDiv({ cls: "movie-data-cover-preview" });
    let filename = currentCover;
    this.renderCover(previewEl, currentCover);
    const picker = field.createEl("input", { attr: { type: "file", accept: "image/*" } });
    picker.onchange = async () => {
      const file = picker.files?.[0];
      if (!file)
        return;
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
      this.store.discardStaged();
      filename = "";
      onPicked({ filename: "", previewUrl: "" });
      previewEl.empty();
      previewEl.addClass("is-placeholder");
      previewEl.setText("?");
    };
    return {
      previewEl,
      getFilename: () => filename,
      resetPreview: () => void 0
    };
  }
  currentEntityId() {
    if (this.mode.kind === "movie-form")
      return this.mode.movie.id;
    if (this.mode.kind === "actor-form")
      return this.mode.actor.id;
    return newId("m");
  }
  formButtons(form, _cover, onSave, onCancel) {
    const row = form.createDiv({ cls: "movie-data-form-buttons" });
    const save = row.createEl("button", { text: "Save", cls: "mod-cta" });
    const cancel = row.createEl("button", { text: "Cancel" });
    cancel.onclick = () => {
      this.store.discardStaged();
      onCancel();
    };
    save.onclick = async () => {
      const entity = onSave();
      if ("title" in entity) {
        const idx = this.store.movies.findIndex((m) => m.id === entity.id);
        if (idx >= 0)
          this.store.movies[idx] = entity;
        else
          this.store.movies.push(entity);
      } else {
        const idx = this.store.actors.findIndex((a) => a.id === entity.id);
        if (idx >= 0)
          this.store.actors[idx] = entity;
        else
          this.store.actors.push(entity);
      }
      try {
        await this.store.save();
      } catch (e) {
        console.error("movie-data: save failed", e);
        new import_obsidian.Notice("Failed to save movie data - see console.");
        return;
      }
      this.mode = { kind: "list" };
      this.render();
    };
  }
};

// src/main.ts
var MovieDataPlugin = class extends import_obsidian2.Plugin {
  async onload() {
    this.store = new MovieStore(this.app);
    await this.store.ensure();
    await this.store.load();
    this.registerView(VIEW_TYPE_MOVIE_DATA, (leaf) => new MovieDataView(leaf, this));
    this.addCommand({
      id: "open-movie-data",
      name: "Open movie data",
      callback: () => this.openView()
    });
    this.addRibbonIcon("film", "Open movie data", () => this.openView());
  }
  /** Open the movie data tab, or focus it if already open (reuse). */
  async openView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_MOVIE_DATA);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_MOVIE_DATA, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  onunload() {
    this.store?.unload();
  }
};
