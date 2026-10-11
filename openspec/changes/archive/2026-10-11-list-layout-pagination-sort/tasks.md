# Tasks: list-layout-pagination-sort

## 1. Newest-first ordering

- [x] 1.1 Add a numeric base36 id-timestamp comparator in `src/ui/state.ts` and apply it (descending) to `computeResults` output for both movies and actors, with fallback to input order for unparseable ids; verify with a unit test that two entities with different id timestamps sort newest-first and that an edit (same id) does not reorder (run `npx vitest run test/state.test.ts`)
- [x] 1.2 Audit existing tests for order assumptions (e.g. `test/ui.test.tsx`, `test/ui-forms.test.tsx`) and update expectations to newest-first; verify `npx vitest run` passes

## 2. Pagination

- [x] 2.1 Add `page` to `ListState` (init 1 in `EMPTY_LIST`, `src/ui/App.tsx`) and a `PAGE_SIZE` constant in `src/ui/state.ts`; verify typecheck passes (`npx tsc --noEmit`)
- [x] 2.2 Route every filter-changing `setList` updater in `ListView` (entity filter, actor filter, tag toggle, `jumpToActor`) through a shared helper that resets `page` to 1, and clamp rendered page to the last available page at render; verify with tests: filter change from page 3 lands on page 1, out-of-range page renders last page (add cases to `test/state.test.tsx` / `test/ui.test.tsx`)
- [x] 2.3 Reset `page` to 1 when returning to the list after a successful save; verify by test or manual check that saving a new movie from page 2+ shows page 1 with the new movie first
- [x] 2.4 Create `PaginationBar` component (prev/next buttons disabled at range ends, `page / total` label) and render it in a new footer region in `ListView`; verify with a component test: next/prev change the rendered slice and the label updates
- [x] 2.5 Slice `entries` by page before rendering `MovieGrid`; verify a test that only the current page's entries are in the DOM and navigation shows the following slice

## 3. Three-region layout

- [x] 3.1 Restructure `styles.css`: `.movie-data-root` becomes `height:100%; display:flex; flex-direction:column`, group header (toolbar + actor select + tag chips) in a `flex:0 0 auto` wrapper, add a `flex:1; overflow-y:auto` scroll region around the grid, add the footer wrapper; move padding to the regions; verify in a desktop Obsidian tab (or `.dev/vault`) that header/footer stay fixed while only the grid scrolls
- [x] 3.2 Keep `EmptyState` inside the scroll region and confirm empty/short lists still show the pagination bar; verify visually

## 4. Mobile hide-on-scroll

- [x] 4.1 Add a passive scroll-direction detector on the scroll region (delta threshold, always show at `scrollTop === 0`, reset on page/filter/mode change) that toggles a hidden class on header and footer; verify with a test simulating scroll events: down hides, up shows, reset restores (component test with a mocked scroll container)
- [x] 4.2 Style the hidden class with `transform: translateY(-100%)`/`translateY(100%)` + transition, with header/footer overlaying the scroll region on mobile so grid columns never reflow; verify a visual mobile-viewport check (narrow window / Obsidian mobile emulation) that no reflow occurs while bars animate
- [x] 4.3 Gate the direction handling to mobile (`Platform.isMobile`, optionally OR narrow-width `matchMedia`); verify desktop scrolling never hides bars (manual check + unit test of the gate)

## 5. Integration verification

- [x] 5.1 Full test run `npx vitest run` and typecheck `npx tsc --noEmit` pass
- [x] 5.2 Manual end-to-end pass in `.dev/vault`: add two movies (newest first), filter (page resets), paginate, deep-scroll with bars fixed (desktop), narrow viewport hide/show on scroll, edit an old movie (no reorder), delete down to <1 page (pagination clamps/hides sensibly)
