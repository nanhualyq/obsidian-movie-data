## ADDED Requirements

### Requirement: List stays clear of an overlaying mobile navigation bar
On phone layouts where Obsidian's mobile navigation bar overlays the view as a fixed layer (floating navigation or auto full screen), the list view MUST reserve enough space at the bottom of its root region that the scrolling grid, the header, and the footer with the pagination control never render beneath the navigation bar. The reserved space MUST be zero wherever no navigation bar overlays the view (desktop, tablet, and phone layouts where the bar occupies normal flow), leaving those layouts pixel-identical to before.

#### Scenario: Pagination remains reachable above the navigation bar
- **WHEN** the list is displayed on a phone whose navigation bar overlays the view
- THEN the pagination control is fully visible and tappable above the navigation bar, and no grid content is hidden beneath it

#### Scenario: Hidden footer slides fully out of sight
- **WHEN** the user scrolls the grid downward on such a phone and the footer hides
- THEN the footer disappears completely — it must not peek out beside or below the navigation bar

#### Scenario: Layouts without an overlaying bar are unchanged
- **WHEN** the list renders on desktop, on a tablet, or on a phone layout where the navigation bar is not a fixed overlay
- THEN the root region fills the view exactly as before and no bottom gap is reserved
