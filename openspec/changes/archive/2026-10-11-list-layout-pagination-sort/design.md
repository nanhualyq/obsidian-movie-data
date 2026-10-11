# Design: list-layout-pagination-sort

## Context

See proposal.md for motivation. Relevant current-state facts:

- `.movie-data-root` (the Obsidian `ItemView` content element, `src/view.ts`) is the single scroll container: `height: 100%; overflow-y: auto; padding: 8px` in `styles.css`.
- `ListView` renders `Toolbar` → `ActorSelect` → `TagFilter` → `MovieGrid` as siblings inside that scroll container.
- `computeResults` (`src/ui/state.ts`) filters in file order; `MovieForm`/`ActorForm` append new entities (`[...data.movies, nextMovie]`), so display order is oldest-first by accident.
- Entity ids are `${prefix}_${Date.now().toString(36)}${random4}` (`newId`, `src/store.ts`) — creation time is recoverable; edits keep the id.
- `ListState` lives in `App` (`src/ui/App.tsx`, `EMPTY_LIST`), so filter state survives form round-trips.
- No mobile detection exists in `src/` today; Obsidian exposes `Platform.isMobile`, and CSS media queries work as usual.

## Goals / Non-Goals

**Goals:**
- Newest-first ordering with zero data migration.
- Three-region layout with a paginated grid and mobile hide-on-scroll, meeting the four new requirements in the delta spec.

**Non-Goals:**
- No `createdAt`/`updatedAt` schema fields (storage spec untouched).
- No virtualization/infinite scroll — pagination is the chosen strategy.
- No viewport-adaptive page size.
- No changes to forms, cover handling, or delete flows.

## Decisions

### D1: Sort key = numeric parse of the id's timestamp prefix, descending

Sort in `computeResults` after filtering: parse `parseInt(id.slice(id.indexOf("_") + 1, ...), 36)` of the leading base36 timestamp run, compare descending; fall back to array order for ids that don't parse (defensive only — all ids come from `newId`).

- *Alternative A: plain `id` string compare.* Rejected: works only while `Date.now().toString(36)` stays the same length (true until ~2059) and is a latent trap flagged in exploration; numeric parse is strictly correct for a few lines of code.
- *Alternative B: add `createdAt` field.* Rejected: storage schema change + migration fallback for existing records, for capability ("recently edited first") nobody asked for. Edits intentionally do not reorder.
- Applies to actors too — same id scheme, same reasoning.

### D2: Page state lives in `ListState`, reset by construction

Add `page: number` to `ListState`. Rather than sprinkling `setPage(0)` across handlers, treat page as derived-with-guard: every `setList` transition caused by a filter change goes through a single updaters that resets `page` to 1 (the existing updaters in `ListView` — `onEntityFilter`, actor change, tag toggle, `jumpToActor` — already funnel through `setList`, so this is centralized, not scattered). Clamp at render time: `page = min(page, maxPage)` so an out-of-range index shows the last page (spec requirement) instead of an empty grid.

- *Alternative: derive page from a `useEffect` reset.* Rejected: effect-based resets flash one frame of wrong page and are harder to test; reset-in-transition is deterministic.

Save path: `commit` in `App` returns to `setMode({kind:"list"})`; the list's `page` also resets after any successful commit/new entity save so page 1 (newest-first) shows the saved entity. Since forms replace `mode` but keep `list`, the explicit reset belongs where the save completes or where `ListView` observes a data change from a new id — simplest correct point: reset `page` in the same `setList` funnel when the list view mounts fresh after a save (i.e., reset when `mode` transitions back to `list` following a commit). Exact hook point is a tasks-level detail; the spec behavior is what's binding.

### D3: Fixed page size constant

A single exported constant (e.g. `PAGE_SIZE = 60`) in `src/ui/state.ts`, sliced in `ListView` after `computeResults`. The grid keeps its own `overflow-y: auto` for pages taller than the region.

- *Alternative: viewport-filling page size.* Rejected: page membership shifts on window resize, complicates tests, and makes "page 3" mean different things across devices. Predictability wins; the independent grid scroll covers tall pages.

### D4: Three-region flex layout, scroll moves to the grid region

```
.movie-data-root            height:100%; display:flex; flex-direction:column;
  .movie-data-header        flex:0 0 auto  (toolbar + actor select + tag chips)
  .movie-data-scroll        flex:1 1 auto; overflow-y:auto   <-- grid scrolls here
    .movie-data-grid
  .movie-data-footer        flex:0 0 auto  (pagination bar)
```

Padding (`8px`) moves from the root to header/scroll/footer children so horizontal gutters stay consistent. `EmptyState` stays inside the scroll region. This is the minimal change: `overflow-y: auto` effectively migrates from root to a middle wrapper.

### D5: Hide-on-scroll = transform on header/footer, direction detector on the scroll region

- The scroll region (D4) is the only scroll source, so one listener suffices: track `scrollTop`, compare to last sample; delta beyond a small threshold (e.g. 4px) decides direction; scrolling up at `scrollTop === 0` always shows.
- Hidden state toggles a class that applies `transform: translateY(-100%)` / `translateY(100%)` with a CSS transition. Grid space is reclaimed by making the header/footer `position: absolute` overlay over the scroll region when hidden-capable, or by keeping them in flow and letting the transition run while `margin`/`flex-basis` animate — **chosen: absolute overlay on mobile** so grid layout (columns) never reflows mid-scroll (spec: MUST NOT trigger reflow).
  - Concretely: on mobile the scroll region spans full height under the bars; header/footer float above it. Collapsing a bar exposes grid space with zero layout work.
- Desktop: bars never receive the hidden class.
- *Detection:* CSS media query for styling + a small `matchMedia`/`Platform.isMobile` check in the component to decide whether to attach scroll direction handling (avoid running the listener's side effects on desktop). `Platform.isMobile` matches Obsidian's own mobile app; a width media query additionally covers narrow desktop splits — choose `Platform.isMobile` ORed with a narrow-width query only if testing shows split-pane desktops want it; default to `Platform.isMobile` first (see Open Questions).
- *Alternative: `position: sticky` headers.* Rejected as the sole mechanism: sticky keeps bars in layout flow, so hiding them doesn't reclaim grid space; transform overlay does.
- Direction state resets when: filters change, page changes, or mode returns to list — otherwise a bar stays hidden after the grid content is replaced.

### D6: Component shape

- New `PaginationBar` component (prev/next buttons, `page / total` label) rendered in the footer by `ListView`.
- `MovieGrid` unchanged except being wrapped by the scroll region in `ListView` (keeps grid dumb, testable).
- Header wrapper in `ListView` groups `Toolbar` + `ActorSelect` + `TagFilter` — no changes to those three.

## Risks / Trade-offs

- [Overlay bars cover grid content on mobile] → Bars overlay the grid even when visible; reserve bottom/top padding inside the scroll region equal to bar heights (or accept cards passing under a translucent bar). Decide during implementation; spec only requires bars visible + grid reclaiming space.
- [Scroll listener jank on low-end mobile] → Class toggles + CSS transform only; listener is passive and does delta-threshold work, no per-frame React state (state updates batched/direction-only).
- [Direction flicker on scroll reversal] → Threshold (a few px) before flipping direction; always-show at `scrollTop === 0`.
- [Base36 parse misreads future/odd ids] → Fallback to stable original order for unparseable ids; all current ids parse.
- [Existing tests assert current DOM order/oldest-first] → Audit `test/ui.test.tsx` and friends for order assumptions; update expectations as part of tasks.
- [Page reset missed in a filter path] → Centralized `setList` updaters (D2) + explicit clamp at render as a safety net.

## Migration Plan

None — no data or schema changes. Rollback is a plain code revert; `movies.json` format is untouched.

## Open Questions

- Should desktop narrow split panes behave like mobile (hide-on-scroll)? Default: no (desktop = always visible, per spec). Revisit if split-pane usage feels cramped.
- Exact page size (60 proposed): adjustable constant, no spec impact (spec says "fixed page size", not the number).
