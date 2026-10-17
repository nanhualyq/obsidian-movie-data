## Why

The plugin currently manages two entity types (movies, actors) but offers no place for free-form writing — users who want to jot notes about their library have to leave the plugin. We add a Notes page: a single, plain-text scratch note edited in a notepad-like textarea, as simple as Windows Notepad.

## What Changes

- The two-button entity filter (Movies / Actors) becomes a three-tab bar (Movies / Actors / Notes) at the top of the view.
- A new Notes tab shows a single textarea filling the content area — no list, no grid, no pagination, no detail dialog, no add/delete. There is exactly one note per vault.
- `movies.json` gains a `note` string field (default `""`; pre-existing files load with `""` when the field is absent).
- Note edits autosave: a ~500 ms debounced write, with a synchronous flush when the user switches tabs or the view unmounts. There is no Save button, no cancel, and no dirty state.
- Autosave failures show one Notice and set an internal failure flag (further failures stay silent until a save succeeds); the draft stays in memory and the next keystroke retries.
- Autosave writes only `movies.json` — it must never write staged cover files, so the "explicit persistence" rule for form edits keeps holding.
- Storage spec's "explicit persistence" requirement gains an explicit exception scoped to the note field; its schema requirement gains `note`.

## Capabilities

### New Capabilities

<!-- none: the note field and the Notes page both live inside existing capabilities -->

### Modified Capabilities

- `openspec/specs/movie-data-storage/spec.md`: JSON schema requirement adds the `note` field (three fields beyond the two collections); fresh-install scenario writes `note: ""`; "explicit persistence" requirement gains a scoped autosave exception for the note plus the "autosave never writes staged covers" guarantee; load behavior for legacy files without `note`.
- `openspec/specs/movie-data-ui/spec.md`: entity-type switching becomes a three-tab control; filter controls and Add button hidden on the Notes tab; new Notes-page behavior (textarea, autosave contract, failure handling, flush on tab switch/unmount, keyboard defaults); "jump from actor" and empty-state wordings widen from two to three entity views where they reference the entity filter.

## Impact

- `src/types.ts` — `MovieStoreData` gains `note: string`.
- `src/store.ts` — `load()` defaults a missing `note` to `""`; a JSON-only write path for note autosave (no staged-cover flush); `ensure()` seeds `note: ""`.
- `src/ui/App.tsx` — active tab lifted to App state; tabs rendered above `ListView` / new `NoteView`; debounced note autosave + flush lifecycle.
- `src/ui/state.ts` — `EntityFilter` widens to include `"notes"` (or is replaced by an App-level tab type); `computeResults` unaffected for notes.
- `src/ui/components/Toolbar.tsx` — two buttons become three tabs.
- New `src/ui/components/NoteView.tsx` — textarea, draft state, debounce/flush, failure flag.
- `styles.css` — tab styling for the third tab; textarea layout (full-bleed, monospace, mobile bottom inset).
- Tests — `test/state.test.ts`, `test/ui*.tsx`, `test/store.test.ts` gain coverage for the tab, the `note` default, autosave, and the staged-cover invariant.
