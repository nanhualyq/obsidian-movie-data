## Why

The toolbar's full-text search box is inconvenient: users must type and keep typing to narrow the list, while the tag chips already offer the preferred interaction - a single click to toggle a filter. The same convenience should exist for actors, in a form that does not eat toolbar space, and users who browse the actor list need a one-click way to jump to that actor's movies. Meanwhile the movie form's actor picker is a separate checkbox list that duplicates actor-picking UI and happily saves movies with no actor at all; it should share the same select control, gain a required-field rule, and offer a safe fallback for unknown cast.

## What Changes

- **BREAKING**: Remove the search input from the toolbar (and the query state behind it); full-text search by title/actor name is gone. Filtering becomes entirely selection-driven.
- Keep the tag chip filter exactly as it works today (click to toggle, movies view only).
- Add an actor filter: a compact `<select>` dropdown (first option "All actors") in the movies view; choosing an actor narrows the list to movies referencing it - a fixed one-line footprint regardless of actor count, unlike chips.
- Add a direct-jump link on each actor entry in the actors list: clicking it switches to the movies list filtered to that actor.
- Rewrite the movie form's actor picker (checkbox list) to use the **same shared `<select>` component** as the actor filter (`multiple` variant), eliminating the duplicate actor-picking UI.
- **BREAKING**: movie save is validated - the Actors field is required; saving with no actor selected shows an inline error and writes nothing.
- Add an **"Unknown / Unnamed"** (未知/无名) fallback option to the actor select so a movie with unknown cast can always satisfy the requirement; it maps to a shared actor record created on first use.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `movie-data-ui`: "Searchable and filterable list" is removed and replaced by selection-driven filtering (tag chips + actor dropdown), the actors list gains a jump-to-filter link per entry, and "Add and edit forms" changes so a movie requires at least one actor on save, with an "Unknown / Unnamed" fallback option.

## Impact

- `src/ui/components/Toolbar.tsx` - remove search input and `query` props
- `src/ui/components/TagFilter.tsx` - stays tag-only (unchanged); `src/ui/components/ListView.tsx` - renders the actor dropdown and jump-link wiring
- `src/ui/components/ActorSelect.tsx` - rewritten from checkbox list into the shared select component (single for filter, `multiple` for form)
- `src/ui/components/MovieForm.tsx` - actors-required validation with inline error before commit
- `src/ui/components/MovieCard.tsx` (or an actor-specific cell) - add the jump link for actor entries
- `src/ui/state.ts` - `ListState` drops `query`, gains `actorFilter: string` (`""` = all); `computeResults` filters by dropdown selection instead of text; unknown-actor helper
- `src/ui/App.tsx` - `EMPTY_LIST` initializer
- `styles.css` - remove `.movie-data-search`; add actor select, jump link, and validation error styles
- Tests: `test/ui.test.tsx` (search + chip flows), `test/ui-forms.test.tsx` (two `input[type="checkbox"]` actor-picking spots, lines 101/187), `test/live-e2e.mjs` (four `.movie-data-search` interactions + one actor checkbox) rewritten around select controls; new validation and fallback tests
- Existing spec `openspec/specs/movie-data-ui/spec.md` gets a delta via this change
