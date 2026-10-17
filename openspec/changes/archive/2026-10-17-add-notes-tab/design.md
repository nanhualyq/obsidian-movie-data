# Design: add-notes-tab

## Context

Single-view React app inside an Obsidian `ItemView`: `App.tsx` owns all state (`data`, dialog stack, `ListState`), `ListView` renders header (Toolbar with the two-button entity filter + Add, ActorSelect, TagFilter), a scrolling grid, and a paginated footer. `MovieStore` is pure I/O over one `movies.json` plus `covers/*.mcov`; its `save(data)` writes staged covers first, then the whole JSON — that ordering is load-bearing for the storage spec's "Explicit persistence" rule (staged covers must only hit disk on an explicit form save).

See proposal.md for motivation; specs (movie-data-storage, movie-data-ui deltas) for the behavior contract.

## Goals / Non-Goals

**Goals:**
- One single plain-text note per vault, edited in a notepad-like textarea on a third tab.
- Autosave with a tiny failure surface; no Save button anywhere.
- Zero risk to the staged-cover invariant of form edits.

**Non-Goals:**
- Multiple notes, note lists, titles, tags, or search over notes.
- Note <-> movie/actor linking, backlinks, or Obsidian-visible note files.
- Markdown rendering or rich text in the note.

## Decisions

### D1: Storage shape — `note: string` in movies.json

`MovieStoreData` gains `note: string`; `load()` defaults a missing key to `""` (legacy files), `ensure()` seeds `""`. Alternatives rejected: `notes: []` array (a collection that ever holds exactly one element is complexity without a consumer); a separate `notes.json` (second failure domain and load lifecycle for one string); per-note text files (fights the explicit-persistence contract). A string migrates to an array later if multiple notes ever become real.

### D2: Tabs lifted to App level

The tab bar (Movies / Actors / Notes) moves out of `Toolbar`/`ListView` into `App`, above a branch: `ListView` (movies/actors, essentially unchanged) or new `NoteView`. `entityFilter` becomes an App-level `tab: "movies" | "actors" | "notes"`; `ListState` keeps `actorFilter`/`selectedTags`/`page` and keeps resetting `page: 1` on tab switch (existing spec: pagination resets on view switch). Alternative rejected: branching to a no-grid mode inside `ListView` — a list component with a "no list" mode is exactly the kind of state that rots; the tab bar is navigation, not a list filter. The actor-jump action now sets `tab = "movies"` in addition to the actor filter.

### D3: Draft lives in App, NoteView is controlled

The textarea is a controlled component whose value is App state (`noteDraft`, initialized from `data.note` on load). Rationale: `NoteView` unmounts on tab switch; a draft owned by the component would need an async unmount flush React cannot reliably provide. App-level state survives unmounts for free; only the *write* needs flushing, which the tab-switch handler can await before committing the switch.

### D4: Autosave contract — debounce, single-flight, explicit flush points

- Edits update `noteDraft` immediately; a 500 ms debounce schedules a write.
- Writes are single-flight: a pending in-flight write coalesces with new edits into one follow-up write of the latest draft (never queue N writes for N keystrokes).
- Flush points: tab switch (awaited, before the switch renders the new tab) and view close (`view.ts` `onClose` is `async` — it awaits the flush before unmounting).
- Write failure: `Notice` once + `saveFailed` flag in App state; while the flag is set, failures stay silent; the next edit retries; a successful write clears the flag. The draft is never discarded on failure.

### D5: Note writes never touch staged covers

`store.save(data)` writes `pendingCovers` first — reusing it for autosave would persist a form's staged cover outside the form's explicit save (storage-spec violation). The store gains a JSON-only write path (e.g. `saveData(data)` / `save(data, { covers: false })` — name TBD in implementation) used exclusively by the note autosave; `save()` keeps its staged-cover behavior untouched.

### D6: Writes are serialized through one queue in App

Form saves and note autosaves both rewrite the whole JSON. Although D4's flush-on-tab-switch makes a true race unreachable by construction (note writes complete before a list tab — and thus any form — can be reached), both paths still funnel through a single sequential persist queue keyed off a `dataRef` (latest committed data + latest note) so ordering is an invariant, not a timing accident. The "autosave does not clobber a concurrent form save" spec scenario tests this.

### D7: Editor defaults

`<textarea>` with `spellCheck={false}`, monospace via CSS, Tab key inserts `\t` (preventDefault), placeholder text on empty note. The draft preserves whitespace verbatim; no trimming on save.

## Risks / Trade-offs

- [Autosave rewrites the whole movies.json on every debounce] → File is small (metadata only); acceptable. Revisit only if covers ever move into JSON (they don't).
- [Debounce timer firing after unmount leaks a write] → Flush + clear the timer in the tab-switch handler and in `onClose`; timer owned by App (D3), so unmount of `NoteView` doesn't orphan it.
- [D6's queue adds a small abstraction over today's ad-hoc `commit`/`remove`] → Both existing paths migrate onto it; net complexity is neutral and the ordering invariant becomes testable.
- [Legacy `movies.json` without `note`] → `load()` defaults it; the "File predating the note field loads" scenario covers it; no file rewrite happens until the next save.
- [Mobile: on-screen keyboard shrinks the viewport] → `NoteView` uses the same full-height layout conventions as the list's scroll region; the tab bar stays visible. No new scroll-direction machinery (notes has no hide-on-scroll bars).

## Migration Plan

None: the `note` field defaults on load, old plugin versions ignore it. Rollback is code-only; the field left behind in `movies.json` is inert.

## Open Questions

- Exact placeholder copy ("Start typing..." or similar) — cosmetic, decided during implementation.
