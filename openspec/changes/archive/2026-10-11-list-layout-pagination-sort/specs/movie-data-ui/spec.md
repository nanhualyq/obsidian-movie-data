# Delta spec: movie-data-ui

## ADDED Requirements

### Requirement: Newest-first list ordering
The list SHALL display entries ordered newest-first. Ordering SHALL be derived from each entity's id (which embeds its creation timestamp) by parsing the timestamp prefix numerically and comparing descending; id MUST NOT be compared as a plain string. The ordering SHALL apply to both the movies list and the actors list, SHALL apply to existing data without migration, and SHALL NOT change when an entity is edited (editing preserves the id).

#### Scenario: Newly added movie appears first
- **WHEN** a movie is saved for the first time and the list is shown without filters that exclude it
- THEN the new movie is displayed before every older movie

#### Scenario: Editing does not reorder
- **WHEN** a user edits an older movie and saves
- THEN the movie keeps its position in the newest-first ordering

#### Scenario: Existing data sorts without migration
- **WHEN** the plugin is upgraded on a vault whose movies.json predates this change
- THEN the list renders newest-first from the existing ids alone, with no file rewrite

### Requirement: Paginated list display
The list SHALL be paginated with a fixed page size (a single constant for all viewports). The view SHALL show a pagination control with previous/next navigation and the current page position. The current page SHALL reset to 1 whenever any filter changes (entity type, actor filter, or tag selection), when switching between movies and actors, and after a new entity is saved, so the user is never left on a page that is out of range or hides their newest/filtered results. If the current result set fits within fewer pages than the current page index (e.g., after a filter change), the view SHALL display the last available page rather than an empty grid.

#### Scenario: Filter change returns to page 1
- **WHEN** the user is on page 3 and selects a tag chip
- THEN the list shows page 1 of the tag-filtered results

#### Scenario: Navigation within range
- **WHEN** the result set spans more than one page and the user activates next/previous
- THEN the grid shows the corresponding page's entries and the control reports the new page position, never going below page 1 or above the last page

#### Scenario: Saving a new entity shows it immediately
- **WHEN** the user saves a new movie and returns to the list
- THEN the list shows page 1, where the new movie appears first

#### Scenario: Out-of-range page shows last page
- **WHEN** the active filters reduce the result set so the current page index exceeds the last available page
- THEN the view displays the last available page's entries instead of an empty grid

### Requirement: List layout with independent grid scroll
The list view SHALL be laid out as three regions: a fixed header containing the toolbar, actor filter, and tag chips; an independently scrolling grid region; and a fixed footer containing the pagination control. Scrolling SHALL affect only the grid region — the header and footer remain visible without the page itself scrolling as a single unit.

#### Scenario: Header and footer stay visible while browsing
- **WHEN** the user scrolls deep into a page of results
- THEN the toolbar, filters, and pagination control remain visible and do not scroll away

#### Scenario: Grid scrolls within its own region
- **WHEN** a page's entries are taller than the grid region
- THEN only the grid region scrolls; the header and footer do not move

### Requirement: Header and footer hide on scroll (mobile)
On mobile viewports, scrolling the grid down SHALL hide the header and footer to maximize content space, and scrolling up SHALL bring them back. The hide/show SHALL be animated with a transform-based transition and MUST NOT trigger layout of the grid content (no reflow of grid columns). On desktop viewports, the header and footer SHALL remain visible at all times regardless of scroll direction.

#### Scenario: Scroll down hides bars on mobile
- **WHEN** the user scrolls the grid downward on a mobile viewport
- THEN the header and footer slide out of view and the grid region occupies the freed space

#### Scenario: Scroll up restores bars on mobile
- **WHEN** the user scrolls the grid upward after the bars were hidden
- THEN the header and footer slide back and the pagination control is usable again

#### Scenario: Desktop keeps bars visible
- **WHEN** the user scrolls the grid on a desktop viewport
- THEN the header and footer remain visible
