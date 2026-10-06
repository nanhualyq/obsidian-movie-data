## 1. Store layer

- [x] 1.1 Add `MovieStore.deleteCover(filename: string): Promise<void>` that removes `covers/<filename>` if it exists and invalidates/revokes its cached object URL; missing file resolves without error — verify with a store test covering existing-file removal and missing-file no-op (`npm test`)
- [x] 1.2 Add `remove(path)` support to the in-memory adapter in `test/memory-app.ts` (recording deletions) so tests can assert cover-file removal and JSON-before-cover write ordering — verify adapter tests / existing suite still passes

## 2. App-level delete action

- [x] 2.1 Add a `remove(next: MovieStoreData, coverFile: string | null)` callback in `src/ui/App.tsx` that calls `store.save(next)` first (reusing the failure `Notice` path, no state change on failure), then `store.deleteCover(coverFile)` only on success, then `setData(next)` and returns to the list — verify with a UI test: confirmed movie delete updates the list without reload and removes the cover file
- [x] 2.2 Add a UI test for the JSON-write-failure path: save fails → `Notice` shown, entity and its cover file remain on disk, list unchanged — verify test passes

## 3. Movie form delete

- [x] 3.1 Add a Delete button (destructive styling) to `MovieForm.tsx`, shown only when the movie exists in `data.movies` (hidden in add mode), with D1's two-step inline confirmation (click → "Confirm delete?" + Cancel, second click executes) — verify with a UI test: button absent in add mode, single click does not delete, confirm deletes and returns to list
- [x] 3.2 Wire the button to `remove({ movies: filtered, actors: data.actors }, movie.cover || null)` and test decline-confirmation: clicking away/Cancel writes nothing and keeps the form open

## 4. Actor form delete

- [x] 4.1 Add the same Delete button + two-step confirmation to `ActorForm.tsx`, hidden for unsaved actors — verify with a UI test mirroring task 3.1
- [x] 4.2 Implement the referenced-actor guard: on delete click, count `data.movies` whose `actorIds` includes the actor id; if > 0, show inline warning "Referenced by N movie(s)" and do not enter confirmation — verify with a UI test: referenced actor cannot be deleted and data is unchanged, unreferenced actor deletes successfully

## 5. Verification

- [x] 5.1 Run full suite and type check: `npm test` and `npm run build` (tsc + esbuild) both pass with the new delete tests included
- [x] 5.2 Manual smoke check against the delta specs: confirm/decline flows, add-form has no delete, referenced-actor warning, list refresh after delete, cover file gone from `.movie-data/covers/` (via `openspec validate --strict` plus Obsidian vault inspection)
