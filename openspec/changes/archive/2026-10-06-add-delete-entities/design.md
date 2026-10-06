## Context

`App.tsx` owns all state and exposes `commit(next)` (persist, then update state) and `cancel()`. `MovieStore` is pure I/O over `movies.json` and `covers/*.mcov`; it can write but has no delete operation. Forms (`MovieForm`, `ActorForm`) receive `commit`/`onCancel` and hold unsaved field state. Covers are named `<entityId>.mcov`, so a cover file belongs to exactly one entity. The in-memory `coverCache` maps filename → object URL. Tests run against an in-memory adapter (`test/memory-app.ts`) and an Obsidian stub (`Notice` only) with React Testing Library.

See proposal.md for motivation and the delta specs for the required behavior.

## Goals / Non-Goals

**Goals:**
- Delete flow reachable only from the edit form of an already-saved entity
- Fail-safe persistence order: JSON first, cover file second
- Blocked-actor guard evaluated at delete time, never dangling `actorIds`

**Non-Goals:**
- Bulk/multi-select delete, delete from the list/card, or context menus
- Cascading delete of movies when an actor is deleted
- Undo/soft-delete/recycle bin — deletes are permanent
- Cover sharing between entities (ids are unique per entity, so no refcounting)

## Decisions

**D1: Inline two-step confirmation instead of `window.confirm` or an Obsidian `Modal`.**
The Delete button switches to a confirming state ("Confirm delete?" / "Cancel") on first click; only the second click executes. Rationale: deterministic and testable in jsdom without stubbing `window.confirm`, non-blocking, and consistent with the existing plain-button UI. Alternatives: `window.confirm` (blocking, awkward in tests, native look inconsistent with Obsidian); Obsidian `Modal` (much more code for a single confirmation).

**D2: `App.tsx` gains a `remove(next: MovieStoreData, coverFile: string | null)` callback mirroring `commit`.**
The form computes the filtered dataset (entity removed; for actors, no `actorIds` edits needed since referenced actors are blocked anyway) and passes the entity's cover filename. `App` calls `store.save(next)` first — reusing the existing JSON write path and its error handling (`Notice`, no state change on failure) — then, only on success, `store.deleteCover(coverFile)`. State (`setData`, `setMode({kind:"list"})`) updates only after `store.save` succeeds; a subsequent cover-deletion failure is logged but does not roll back state (a leftover cover file is harmless and invisible — the spec orders JSON first for exactly this reason). Alternative rejected: a bespoke `store.removeEntity()` doing both internally — splits the "persist JSON via existing path" invariant and duplicates error handling.

**D3: Referenced-actor guard lives in the form, evaluated at delete time.**
`ActorForm` counts `data.movies.filter(m => m.actorIds.includes(actor.id)).length`; if > 0, clicking Delete shows an inline warning ("Referenced by N movie(s)") and never enters the confirmation state. Guard-in-form (vs. inside `commit`/`store`) keeps `commit` a dumb persist path and matches where the count is already available as props. The delete button is hidden entirely for new/unsaved entities (`isNew` check already exists in the forms).

**D4: `MovieStore.deleteCover(filename)` deletes `covers/<filename>` if present, then invalidates the cache entry (revoke object URL).**
Missing file is not an error (delete-after-JSON-write may race a failed prior write, and entities may have no cover). Store method order: `save()` completes → `deleteCover()`. Load-failure path is unchanged.

**D5: `test/memory-app.ts` adapter gains a `remove(p)` operation (records deletions) so tests can assert cover-file removal and ordering.** Assertions: JSON write precedes cover deletion; failed JSON write leaves the cover file intact.

## Risks / Trade-offs

- [Cover file orphaned if JSON write succeeds but cover deletion fails] → Accepted: invisible to users (missing file already renders a placeholder per storage spec); can be cleaned up manually. JSON-first ordering means the worse failure (JSON lost, cover kept) cannot happen.
- [Two-step inline confirm can feel less "final" than a modal] → Button label change plus destructive styling (`mod-warning`) communicates state.
- [Actor reference guard races a concurrent movie edit adding a reference] → Single-threaded React state; the count is derived from the same `data` snapshot the form renders, so it is consistent within a session.
- [No undo] → Matches spec intent (explicit persistence); out of scope per Non-Goals.

## Migration Plan

None — no schema change; `movies.json` format is untouched. Rollback = revert the code.

## Open Questions

None — trigger location, referenced-actor policy, cover cleanup, and confirmation were decided with the user (form button; block with warning; delete cover; confirm required).
