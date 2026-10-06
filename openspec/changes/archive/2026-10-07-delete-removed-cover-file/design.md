## Context

Cover files are named `<entityId>.mcov`, so replacing a cover overwrites the same file and leaks nothing. The only leak is the clear path: `CoverPicker.onRemove` sets the entity's `cover` field to `""`, and nothing ever deletes the file. `MovieStore.deleteCover()` already exists and is used only by the entity-delete path (`App.remove`), which runs `store.save(...)` first and then deletes in a try/catch that logs failures. See proposal.md for motivation and `specs/movie-data-storage/spec.md` for the required behavior.

## Goals / Non-Goals

**Goals:**
- Deleting the now-unreferenced `.mcov` file when a save clears an entity's `cover` field, with JSON-first ordering and fail-soft deletion.
- Covering every save path (add/edit, movie/actor, remove-then-replace) without adding per-form bookkeeping that a future form could forget.

**Non-Goals:**
- Garbage-collecting `.mcov` files orphaned by *previous* releases or by the entity-delete failure path (explicitly rejected as scope option 2).
- Changing cover file naming, staging, normalization, rendering, or the `Remove cover` button's in-form behavior.
- Making cover removal reversible (no trash/undo).

## Decisions

**D1: Detect the stale cover by diffing App state, not by threading a new parameter through the forms.**
`App.commit(next)` already closes over the current `data`; on save it compares each movie/actor's `cover` in `data` vs `next` and collects `prev.cover` where the new value is `""` and the old one was non-empty. Those filenames are deleted after `store.save(next)` succeeds, exactly like `App.remove` does today.
- *Alternative A: forms pass `staleCover` like `remove(next, coverFile)`.* Consistent with the existing signature, but every form (and any future form) must remember to compute it; a missed call silently reintroduces the bug. The diff lives in one place and is automatically correct for add, edit, movie, and actor.
- *Alternative B: store-side staged removal (`stageCoverRemoval`).* Pushes UI intent into the I/O layer and needs matching discard logic on cancel; more state for no behavioral gain.
- Cost of the diff: `commit` must list `data` in its `useCallback` deps. Cheap and correct (stale set is computed from the same snapshot `setData` will replace).

**D2: Delete the file only after `store.save()` resolves (JSON-first), reusing `deleteCover`.**
This matches the ordering already mandated by the entity-delete requirement: if the JSON write fails, the file must stay because the persisted entity still references it; if the delete fails, the leftover is inert because the persisted entity references nothing. The reverse order could destroy a cover that `movies.json` still points at (visible data loss on reload).
- Note the pre-existing asymmetry: `store.save()` writes *staged* covers before JSON, and that stays as is - those writes are additive overwrites of `<id>.mcov`, not deletions.

**D3: Deletion failures are logged, never rolled back.**
Mirrors `App.remove`: wrap each `deleteCover` in try/catch, `console.error`, continue. Rolling back a successful JSON write to restore an unreferenced file would be worse than the orphan it avoids. `deleteCover` already treats a missing file as a no-op, satisfying the "already missing" scenario for free.

**D4: The diff keys off the previously referenced filename, not off `<id>.mcov`.**
Whatever string the entity had in `cover` is what gets deleted. Since filenames are entity-scoped (`<entityId>.mcov`), no other entity can reference that file, so the delete can never orphan a live cover - even if legacy data has odd filenames.

## Risks / Trade-offs

- [Stale `data` (e.g., concurrent edits in another leaf) makes the diff see the wrong previous cover] → Worst case is an orphan file, i.e. today's behavior; it cannot delete a file another entity references (D4). Out of scope to solve multi-leaf editing.
- [Users may expect removal to be undoable] → Deliberate: `Remove cover` + save is an explicit persistence action, consistent with delete-entity behavior. No undo in scope.
- [Pre-existing orphan files remain after this change] → Accepted; a one-time GC was rejected as a separate, more aggressive change. Can be proposed later without altering these requirements.
- [Diff misses a clear if `commit` is called by a non-form path in the future] → All current save paths flow through `App.commit`; tasks include a test pinning the behavior so a regression fails loudly.

## Migration Plan

None: no schema, file-layout, or dependency changes. Rollback = revert the code; files already deleted are not recoverable (same as entity deletion today).

## Open Questions

None - scope was confirmed with the user: normal-path cleanup only (option 1), no orphan GC.
