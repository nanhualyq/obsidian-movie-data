# Proposal: add-movie-sort-toggle

## Why

The movies list is always ordered newest-first, and there is no way to see the
library in a different order. Browsing a large library in a fixed order makes
the same titles surface every time; a user who wants to rediscover older or
overlooked movies has no control to shuffle the view. Adding a sort toggle
gives a lightweight way to browse randomly without changing how data is stored.

## What Changes

- Add a two-state sort toggle to the movies view toolbar that switches the
  movies list between the default **newest-first** order and a **random** order.
- Entering random order produces a **fresh shuffle each time** the user switches
  into random (no fixed order sticks across toggles).
- While random order is active, changing filters (tag chips, actor dropdown) or
  the page reveals a **stable subset** of the chosen random order — it does not
  reshuffle.
- The **actors list is unaffected**: it always shows newest-first, and the sort
  toggle does not appear in the actors view.
- The selected mode is **session-only**: it resets to newest-first when the view
  closes or the plugin reloads (not persisted to disk).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `movie-data-ui`: The existing "Newest-first list ordering" requirement is
  scoped so newest-first is the default ordering (always permanent for actors,
  the default for movies), and a new "Movie sort toggle" requirement is added
  describing the movies-only newest-first/random toggle and its reshuffle and
  stability behavior.

## Impact

- **Code**: `src/ui/state.ts` (add sort mode + shuffle seed to list state and to
  `computeResults`), `src/ui/components/Toolbar.tsx` (render the toggle,
  movies-only), `src/ui/components/ListView.tsx` (wire the toggle into list
  state), `styles.css` (toggle styling). No storage/schema change — `movies.json`
  and cover handling are untouched.
- **Behavior**: Movies list gains an alternate (random) ordering; actors list and
  all persistence behavior are unchanged.
- **Tests**: `test/state.test.ts` (ordering/seed behavior) and `test/ui.test.tsx`
  (toggle interaction, actors view unaffected) gain coverage.
