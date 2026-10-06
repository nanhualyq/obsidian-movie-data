## 1. Stale-cover deletion on save

- [x] 1.1 In `src/ui/App.tsx`, compute stale cover filenames inside `commit` by diffing `data` vs `next` (collect `prev.cover` where the new value is `""` and the old was non-empty, for both movies and actors), keeping `data` in the `useCallback` deps - verify with a focused unit test that the diff returns the old filename only on clear (not on replace, not on unchanged, not for a brand-new entity)
- [x] 1.2 After `store.save(next)` succeeds, delete each stale file with `store.deleteCover(f)` in its own try/catch that only `console.error`s (mirroring `App.remove`), so a JSON write failure never deletes anything and a delete failure never rolls back - verify with a test asserting the console error path leaves the save successful
- [x] 1.3 Confirm `src/store.ts` needs no change (`deleteCover` already tolerates a missing file and invalidates the cache); if a change looks necessary, stop and reconcile with design.md D2/D3 instead of widening the store API - verify `test/store.test.ts` still passes untouched

## 2. Spec scenario tests

- [x] 2.1 Add a test: existing movie with a cover, click Remove cover, save → `covers/<id>.mcov` is gone from `mem.files`, JSON `cover` is `""`, list shows the placeholder (`covers/movie-data-storage` scenario "Remove cover and save")
- [x] 2.2 Add a test: remove then pick a replacement image and save → no removal recorded in `mem.removals`, the file contains the newly staged bytes (`covers/<id>.mcov` overwritten)
- [x] 2.3 Add a test: remove cover, cancel → `mem.removals` empty and the `.mcov` file bytes unchanged ("Cancel after removing a cover")
- [x] 2.4 Add a test: fail the JSON write only (patch `adapter.write` for `JSON_PATH`, as in `test/ui-delete.test.tsx`) → Notice shown, cover file still present, form stays open ("JSON write fails")
- [x] 2.5 Add a test: entity whose `cover` field references a file that does not exist, remove + save → save succeeds with no error ("Cover file already missing")
- [x] 2.6 Add a test: patch `adapter.remove` to throw → save still succeeds, JSON has `""`, `console.error` was called, list renders ("Removal failure does not roll back")
- [x] 2.7 Add a test: add form → stage a cover → Remove cover → save → no `.mcov` file created for the new id ("Add form with a cover removed before saving")

## 3. Verification

- [x] 3.1 Run `npm test` and confirm the full suite (existing + new) passes
- [x] 3.2 Run `npm run build` and confirm `tsc -noEmit` plus esbuild succeed with no type errors
- [x] 3.3 Run `openspec validate "delete-removed-cover-file"` and confirm the change validates cleanly before hand-off
