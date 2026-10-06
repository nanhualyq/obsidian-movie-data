## Why

The plugin currently supports only adding and editing movies and actors — there is no way to delete an entry. Users who add a movie or actor by mistake (or no longer want it) are stuck with it forever, and the only workaround is hand-editing `.movie-data/movies.json`. This was reported directly: "why I can't delete a item of movie/actor" — because no delete path exists in the UI, the store, or the specs.

## What Changes

- Add a **Delete** button to the movie and actor edit forms (alongside Save/Cancel), with a confirmation step before anything is written.
- Deleting an **actor that is referenced by one or more movies** is blocked: the form shows a warning naming the number of referencing movies instead of deleting. (No dangling `actorIds`, no silent cascade.)
- On a confirmed delete: the entity is removed from `movies.json`, its `.mcov` cover file is deleted from `covers/`, and the in-memory cover cache entry is invalidated.
- The list immediately reflects the deletion without a plugin reload (same as the existing save path).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `openspec/specs/movie-data-ui`: New requirement for deleting entities from the edit form — confirmation step, blocked-actor warning, and list refresh after deletion.
- `openspec/specs/movie-data-storage`: New requirement for persisting deletions — removing the entity from `movies.json`, deleting its cover file, and keeping the cache consistent.

## Impact

- `src/ui/App.tsx` — new delete action alongside `commit`/`cancel`
- `src/ui/components/MovieForm.tsx`, `src/ui/components/ActorForm.tsx` — Delete button, confirmation UI, referenced-actor warning
- `src/store.ts` — new delete method (remove entity cover file, invalidate cache)
- `src/ui/state.ts` — likely no change (mode returns to list on delete)
- Specs: delta specs under `openspec/changes/add-delete-entities/specs/` for `movie-data-ui` and `movie-data-storage`
