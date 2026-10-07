## Context

List filtering lives in a single client-side path: `App` owns `ListState` (`query`, `entityFilter`, `selectedTags`), `ListView` renders `Toolbar` (search input + Movies/Actors toggle), `TagFilter` chips, and the `MovieGrid`/`MovieCard` cells; `computeResults` in `src/ui/state.ts` applies the query as an in-memory haystack match (title + actor names for movies, name for actors) plus the tag filter. Actor picking is a second, unrelated UI: `ActorSelect.tsx` renders a checkbox list inside `MovieForm`, and `MovieForm.onSave` never validates `actorIds` (an empty set saves silently; title already falls back to "Untitled"). Cell click opens the edit form. Motivation is in proposal.md; requirements are in specs/movie-data-ui/spec.md.

## Goals / Non-Goals

**Goals:**
- Remove the search input and its `query` state entirely; all list narrowing is selection-driven.
- Add a compact actor `<select>` dropdown for list filtering (fixed one-line footprint regardless of actor count).
- Reuse that same select component in the movie form (multi-select variant), replacing the checkbox list.
- Require at least one actor on movie save, with an "Unknown / Unnamed" fallback option so the rule can always be satisfied.
- Add a jump action on actor entries that lands on that actor's filtered movie list.
- Keep the rest intact: entity toggle, tag chips, cell-click-to-edit, cover picker/paste, cancel/delete flows.

**Non-Goals:**
- No persistence of filter selections across reloads or view reopen (state stays in-memory, as today).
- No restoration of any text search "later"; search is removed, not hidden.
- No validation of other fields (title still falls back to "Untitled"; the actor form's own name field is not validated - only the movie form's Actors field was requested).
- No storage/schema changes; `movies.json` format and covers are unaffected.
- No changes to delete flows (the existing referenced-actor block already protects the fallback record).

## Decisions

1. **State shape**: replace `ListState.query: string` with `ListState.actorFilter: string` (actor id, `""` = all); drop `query` from `EMPTY_LIST`, `computeResults`, and `Toolbar` props. Alternative: `selectedActors: Set<string>` - rejected: the dropdown is single-select (see 2), a set would carry impossible state. Alternative: keep `query` wired but unused - rejected as dead code.

2. **Actor filter control is a native `<select>`**: single-select, first option "All actors", then every saved actor sorted by name (includes zero-movie actors and the fallback record once it exists). Shown only in the movies view (mirrors today's tag-chip visibility). Alternatives: chip row - rejected, long actor lists eat exactly the space this is meant to save; `<select multiple>` for the filter - rejected, awkward UX for a one-choice filter. `TagFilter` stays tag-only; no chip generalization is needed anymore.

3. **One shared select component**: rewrite `ActorSelect.tsx` into a single component parameterized by mode - `multiple` renders a multi-select list box for `MovieForm` (a movie keeps multi-actor support), single renders the filter dropdown for `ListView`. Options logic (saved actors, sort order, fallback entry) lives in one place. Alternatives: keep checkboxes in the form - rejected, that is the duplication being removed; two separate components - rejected, same reason. This is the user's explicit dedup instruction.

4. **Filter semantics - AND across groups, OR within the tag group**: a movie shows when (no tag chips selected OR carries any selected tag) AND (`actorFilter` is `""` OR references that actor). Alternative: OR everything - rejected: a tag plus an actor would surface unrelated movies. *Recorded assumption; pinned by the Combined scenario.*

5. **Jump action**: a small link/button inside actor cells (actors view only) whose handler calls `stopPropagation()` before updating state - required because the cell's root `onClick` opens the edit form. Sets `{ entityFilter: "movies", actorFilter: actorId, selectedTags: new Set() }`. Clearing tags is deliberate: a stale tag selection could make the jump land on an empty list and look broken. Pinned by the Jump scenarios.

6. **Validation**: `MovieForm.onSave` checks `actorIds.size === 0` first and returns before `commit`, setting an error state rendered inline under the Actors field; the form stays open and nothing is written (staged covers stay staged so a retry can still save them; Cancel still discards them via the existing path). Alternative: disable the Save button until valid - rejected: the user cannot tell *why* it is disabled. Scope: only the movie form's Actors field.

7. **Fallback record**: a single shared actor with a fixed well-known id and label "Unknown / Unnamed" (English, consistent with the rest of the UI), referenced by `movie.actorIds` like any actor. Created lazily in the same commit as the first movie that references it - no data is written until the user actually uses it. It then behaves as an ordinary actor: appears in the actor list, the filter dropdown, supports edit, and the existing delete-referenced-actor block protects it; if deleted while unreferenced, the next use recreates it. Alternative: a sentinel value inside `movie.actorIds` that references no record - rejected, it breaks the "actorIds reference real actors" invariant and forces special-casing in filter, jump, and delete-block logic. The form always offers the option (even with zero saved actors), removing today's "No actors yet" dead end.

8. **Empty-state text**: drop the `list.query` branch in `ListView.emptyText`; show "No results" whenever tag chips are selected or `actorFilter` is set, otherwise the per-entity "No X yet" text.

9. **Styles**: delete the `.movie-data-search` rule; style the select to match the toolbar (Obsidian theme variables), add a subtle jump-link style and an inline validation error style. Long actor names may truncate in the select - mitigate with a `title` attribute on options and adequate width.

10. **Tests drive the redesign**: `test/ui.test.tsx` (search helper, actor-name search, form round-trip), `test/ui-forms.test.tsx` (two `input[type="checkbox"]` actor-picking spots), and `test/live-e2e.mjs` (four `.movie-data-search` interactions + one actor checkbox) are rewritten against the dropdown/select controls, plus new tests for validation and the fallback record.

## Risks / Trade-offs

- [Text search by title is gone; users must scan the full movie grid] -> Intentional per the request; tag chips + actor dropdown cover the two common narrowing paths. Title lookup later would be a new change.
- [`<select multiple>` in the form is less discoverable than checkboxes] -> Accepted per the user's dedup request; native Ctrl/Cmd-click multi-select, and e2e covers selecting actors through it.
- [Legacy movies saved with zero actors now block on their next edit] -> One-click fix via the fallback option; disk data is untouched until the user saves.
- [Unknown/Unnamed record renamed or deleted by the user] -> Behaves like any actor; recreated lazily if deleted while unreferenced. No special protection beyond the existing delete-block.
- [Actor names longer than the select width truncate] -> `title` attribute on options plus adequate width.
- [Jump link competes with the cell's open-form click] -> `stopPropagation` on the link plus a dedicated test that the form does not open.
- [Test churn: selectors and flows tied to the search box and actor checkboxes] -> Rewriting them is explicit in the tasks; no test is deleted without a selection-based replacement covering the same behavior.
- [Filter state survives open/cancel of a form but not a plugin reload] -> Same as today's tag behavior; no regression, documented as non-goal.

## Migration Plan

Single-step in-repo change; no data migration (no schema or file format changes; the fallback record is created lazily on first use). Rollback = revert the commit. Validation is enforced only at save time, so existing on-disk movies with zero actors remain loadable. Tests and e2e updated atomically with the UI so main stays green.

## Open Questions

None.
