# Proposal: list-layout-pagination-sort

## Why

The list page scrolls as a single unit — toolbar, filters, and grid move together, so browsing deep into the list hides the controls. There is no pagination, so large collections become one endless scroll, and the display order is an accident of file order (oldest first) rather than a deliberate choice. Users want newest entries front and center, more room for content while browsing, and quick access to page controls.

## What Changes

- **Newest-first ordering**: list entries (movies and actors) render sorted newest-first, derived from the entity id's embedded creation timestamp (parsed numerically from the base36 prefix). No schema change; works retroactively on existing data. Edits preserve the id and therefore do not reorder.
- **Three-region layout**: the list view becomes a fixed header (toolbar + actor filter + tag chips), an independently scrolling grid region, and a fixed footer (pagination bar).
- **Pagination**: a fixed page size; the footer shows prev/next and page position. The current page resets to 1 whenever any filter changes (entity type, actor, tags) and after saving a new entity, so the user always sees their newest/filtered results.
- **Mobile hide-on-scroll**: on mobile, scrolling the grid down hides the header and footer to maximize content space; scrolling up brings them back (animated via transform). Desktop keeps both bars visible at all times.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `movie-data-ui`: adds requirements for newest-first list ordering, paginated list display with page-reset rules, the fixed-header/fixed-footer layout with an independently scrolling grid, and direction-based header/footer hiding on mobile.

## Impact

- **Code**: `src/ui/state.ts` (sort + pagination slicing in `computeResults`/`ListState`), `src/ui/components/ListView.tsx` (layout regions, page state), `src/ui/components/MovieGrid.tsx` (scroll container), new pagination bar component, `styles.css` (flex-column layout, sticky/transform header & footer, mobile breakpoint), possibly `src/ui/App.tsx` (`EMPTY_LIST` gains `page`).
- **Specs**: `openspec/specs/movie-data-ui/spec.md` gains requirements (delta in this change).
- **Data/storage**: none — no schema or persistence changes (`movie-data-storage` untouched).
- **Tests**: existing UI tests may assert list order or layout structure; ordering assertions will need to reflect newest-first.
