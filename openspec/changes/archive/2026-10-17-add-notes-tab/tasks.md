# Tasks: add-notes-tab

## 1. Storage layer

- [x] 1.1 Add `note: string` to `MovieStoreData` (src/types.ts), default it to `""` in `MovieStore.load()` when the key is missing (legacy files), and seed `note: ""` in `MovieStore.ensure()` — verify with new store tests: a legacy `movies.json` without `note` loads with `note: ""`, and a fresh `ensure()` writes `note: ""`
- [x] 1.2 Add a JSON-only write path to `MovieStore` (e.g. `saveData(data)` alongside the existing `save(data)`, which keeps writing staged covers) — verify with a test: with a cover staged via `stageCover`, the JSON-only write persists the data and does NOT create the `.mcov` file, while a plain `save()` still writes it

## 2. App-level tabs

- [x] 2.1 Lift the entity switch to App state as `tab: "movies" | "actors" | "notes"`; render a three-tab bar in `App` above a `ListView` / `NoteView` branch; strip the entity-filter buttons out of `Toolbar` (Add button stays); keep `ListState.page` resetting to 1 on tab switch and keep tag/actor filters preserved; make the actor jump also set `tab = "movies"` — verify with ui tests: three tabs render with the active one indicated, switching to Actors hides tag chips and the actor dropdown, Movies -> Actors -> Movies preserves selected chips on page 1, and the actor jump lands on the Movies tab filtered to that actor
- [x] 2.2 Style the tab bar and the notes-tab layout in styles.css (tabs visually match the old filter buttons; NoteView area fills the space below the tab bar) — verify with `npm run build` succeeding and a manual `npm run dev:open` check that all three tabs render correctly at desktop and narrow widths

## 3. NoteView (editor)

- [x] 3.1 Create `src/ui/components/NoteView.tsx`: controlled textarea (value from App's `noteDraft`), monospace, `spellCheck={false}`, placeholder shown only while the note is empty, Tab key inserts `\t` instead of moving focus — verify with ui tests: placeholder appears for an empty note and disappears on typing, Tab inserts a tab character and keeps focus, whitespace/newlines round-trip verbatim through a remount, and no add/save/cancel/filter/pagination controls exist on the notes tab

## 4. Autosave

- [x] 4.1 Implement the autosave contract in App (design D3/D4/D6): edits update `noteDraft` immediately, a 500 ms debounce schedules a single-flight JSON-only write of the latest draft through one serialized persist queue shared with `commit`/`remove`; tab switch awaits the flush before switching; `view.ts` `onClose` awaits the flush before unmounting — verify with fake-timer tests: typing then waiting out the debounce writes the note, typing then switching tabs immediately persists before/with the switch and shows the text on return, closing the view flushes, rapid keystrokes coalesce into one write, and a note write racing a form save leaves both changes in the final JSON
- [x] 4.2 Implement failure semantics (design D4): one `Notice` on the first failure plus a failure flag, silent failures while the flag is set, typed text never discarded, the next edit retries, and a successful write clears the flag — verify with tests: a failing write shows exactly one Notice across repeated failures, the draft stays visible, a retry succeeds and a later failure notifies again
- [x] 4.3 Add the storage-spec scenario guard: a note autosave firing while a cover is staged for a pending form edit writes only `movies.json` and leaves the staged cover pending (no `.mcov` on disk until the form saves) — verify with a test covering the staged-cover invariant end to end

## 5. Integration and regression

- [x] 5.1 Run the full suite and build (`npm test`, `npm run build`) — verify both pass with no regressions in the existing movie/actor dialog, delete, cover, and pagination tests
- [x] 5.2 Manual smoke check via `npm run dev:open` (or `npm run test:live`): type in Notes, immediately switch to Movies, add a movie with a cover, switch back to Notes — verify the note text persisted, the cover saved normally, and nothing was lost
