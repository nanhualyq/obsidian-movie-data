# Design: add-movie-sort-toggle

## Context

Ordering is centralized in one function: `computeResults` in `src/ui/state.ts`,
which filters movies/actors and then sorts the result newest-first via
`byNewestFirst` (parsing the timestamp prefix of each id). The movies/actors
`ListView` computes its entries with
`useMemo(() => computeResults(movies, actors, list, view), [data, list, view])`.
`ListState` (owned by `App`, passed down) currently holds
`{ actorFilter, selectedTags, page }`. The shared `Toolbar` renders only the Add
button. `computeResults` already receives the whole `ListState`, so new sort
fields placed there are visible to it without new wiring.

See `proposal.md` for motivation. The requirement contract lives in
`specs/movie-data-ui/spec.md` (delta).

## Goals / Non-Goals

**Goals:**
- Let the user switch the movies list between newest-first (default) and a random
  order via a two-state toolbar toggle.
- Produce a fresh shuffle each time random mode is entered.
- Keep a chosen random order stable across filter and page changes within a session.
- Leave the actors list, storage format, and all persistence behavior untouched.

**Non-Goals:**
- No "re-roll while already random" affordance (two-state toggle only).
- No persistence of the chosen mode across view close / reload.
- No sort control in the actors view.
- No changes to `movies.json`, cover handling, or the id/timestamp scheme.

## Decisions

### D1. Random order = seeded shuffle stored in state, not recomputed randomness
Add `sortMode: "newest" | "random"` and `shuffleSeed: number` to `ListState`.
In random mode, `computeResults` applies a **Fisher-Yates shuffle driven by a
seeded PRNG** (mulberry32) using `shuffleSeed`. Entering random writes a fresh
random seed; switching to newest leaves the seed untouched.

*Why not `sort(() => Math.random() - 0.5)`?* The `ListView` memo re-runs on any
`ListState` change — every tag-chip toggle, actor change, and page flip. Pure
`Math.random()` inside `computeResults` would reshuffle the whole grid on each of
those interactions (jarring, and it breaks the "filters reveal a stable subset"
requirement). A stored seed makes the order a property of the state that only
changes when the seed is bumped — i.e. only on entry into random mode.

*Alternative considered:* a separate `movies`-only sort-state slice. Rejected as
over-engineering: `computeResults` already takes the full `ListState`, and the
actors branch simply ignores the sort fields.

### D2. Shuffle the full movie list BEFORE filtering
Establish the random order over the **entire** movie collection, then apply tag/
actor filters and slicing on top, so filters and pagination reveal a stable
subset of that order.

*Why not filter-then-shuffle?* A seeded shuffle over a filtered subset produces a
different order whenever the subset's contents/length change (same seed, different
array), so every filter interaction would reshuffle — exactly what D1 avoids.
Shuffling the full list once per seed keeps the visible subset stable.

The newest-first path is unchanged in effect (a total order by timestamp, so
filter-then-sort and sort-then-filter agree); only the random path needs the
order-first structure. The actors branch is untouched and always newest-first.

### D3. Reshuffle trigger = entering random mode
The toggle is two-state. On activation: if leaving random → set `sortMode =
"newest"` (seed unchanged). If entering random → set `sortMode = "random"` and
assign a fresh seed (e.g. `Math.random()`-derived), which flows through the
existing `useMemo` dep (`list`) and re-derives the order. Because the seed lives
in `ListState`, no new memo wiring is needed.

### D4. Seeded PRNG: mulberry32
A tiny deterministic generator using `Math.imul` / integer math, so a given seed
yields the same order on every platform and in tests. No external dependency.
Tests can pin a seed to assert an exact order.

### D5. Toolbar renders the toggle only for `view === "movies"`
Mirrors how `ActorSelect`/`TagFilter` are movies-only (conditionally rendered /
`hidden`). The actors view shows no sort control.

### D6. Session-only persistence
`sortMode` lives in App-level `ListState`, which resets when `App` unmounts
(view close / plugin reload) — identical to how `actorFilter`/`selectedTags`/
`page` already behave. Nothing is written to disk. Newest-first is the default
state value, so a fresh open always starts newest-first.

## Risks / Trade-offs

- **Adding/editing a movie while in random mode re-runs the seeded shuffle over
  the changed list, so the order may shift.** → Acceptable: the spec requires
  stability across *filter/page* changes, not across *data* changes. A new movie
  simply lands somewhere in the random order. Documented as expected behavior.
- **Two different seeds could theoretically produce the same permutation.**
  → Irrelevant to the requirement ("not necessarily the same"); the seed is fresh
  randomness each entry. No dedup needed.
- **Actors list accidentally affected.** → The actors branch of `computeResults`
  ignores `sortMode`/`shuffleSeed`; a dedicated test asserts the actors view stays
  newest-first and shows no toggle.
- **Random order differs across platforms.** → mulberry32's integer math is
  deterministic; tests pin a seed to avoid flakiness.

## Migration Plan

None. Pure UI behavior with no storage/schema change; session-only state needs no
migration or rollback beyond reverting the code.

## Open Questions

None blocking. The toggle's exact label/icon ("Newest" vs "Shuffle") and minor
styling are implementation details that do not affect the specs, approach, or task
breakdown; they can be settled during implementation.
