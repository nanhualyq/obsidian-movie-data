## Why

Removing a cover in the add/edit form only clears the entity's `cover` field in `movies.json`; the existing `covers/<id>.mcov` file is left on disk with no reference to it. Every such removal leaks a file forever (only deleting the whole entity calls `deleteCover`), so `covers/` slowly accumulates orphaned bytes the user can neither see nor manage.

## What Changes

- Saving a form where the entity's cover was removed deletes the entity's stale `.mcov` file from `covers/` after `movies.json` is written, mirroring the ordering and failure rules already used by entity deletion.
- Removing a cover and then picking/pasting a replacement before saving is unchanged: the same `<id>.mcov` file is overwritten by the staged bytes, no deletion happens.
- Cancelling after removing a cover writes nothing: the file stays, the entity keeps its cover on disk.
- A missing cover file at removal time is not an error (the entity may never have had one, or a prior write may have failed); real removal failures are logged and do not roll back the save.
- **No breaking changes**: cover file naming, staging, normalization, and rendering are untouched.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `movie-data-storage`: Adds a requirement that clearing an entity's `cover` field and saving removes that entity's `.mcov` file, with `movies.json` written first and fail-soft behavior when the file is missing or cannot be removed.

## Impact

- **Code**: `src/ui/App.tsx` (`commit` path must learn which cover file, if any, became stale), `src/ui/components/MovieForm.tsx` / `ActorForm.tsx` (pass the previous cover filename on save), `src/store.ts` (delete the stale file after the JSON write; reuse `deleteCover`).
- **Tests**: `test/store.test.ts`, `test/ui-forms.test.tsx` (save-with-removed-cover), `test/cover-image.test.ts` untouched.
- **Data**: `./.movie-data/covers/` gains no new file types; existing orphan files from past removals are NOT cleaned up by this change (out of scope).
- **Specs**: `openspec/specs/movie-data-storage/spec.md` gains one requirement after sync; `movie-data-ui` unchanged (the list already renders a placeholder once `cover` is `""`).
