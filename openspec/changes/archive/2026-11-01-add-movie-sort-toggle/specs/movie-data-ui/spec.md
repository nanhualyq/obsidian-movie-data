## MODIFIED Requirements

### Requirement: Newest-first list ordering
The list SHALL display entries ordered newest-first by default. Ordering SHALL be
derived from each entity's id (which embeds its creation timestamp) by parsing the
timestamp prefix numerically and comparing descending; id MUST NOT be compared as a
plain string. Newest-first SHALL be the default ordering for both the movies list
and the actors list, SHALL always apply to the actors list (the actors list has no
alternate ordering), SHALL apply to existing data without migration, and SHALL NOT
change when an entity is edited (editing preserves the id). The movies list defaults
to newest-first but the user MAY switch it to a random order (see "Movie sort
toggle"); switching does not change the underlying newest-first derivation, so
returning the movies list to its default mode restores newest-first.

#### Scenario: Newly added movie appears first
- **WHEN** a movie is saved for the first time and the list is shown without filters that exclude it
- THEN the new movie is displayed before every older movie

#### Scenario: Editing does not reorder
- **WHEN** a user edits an older movie and saves
- THEN the movie keeps its position in the newest-first ordering

#### Scenario: Existing data sorts without migration
- **WHEN** the plugin is upgraded on a vault whose movies.json predates this change
- THEN the list renders newest-first from the existing ids alone, with no file rewrite

#### Scenario: Actors list stays newest-first
- **WHEN** the user views the actors list
- THEN its entries are ordered newest-first, regardless of the movies list's sort mode

## ADDED Requirements

### Requirement: Movie sort toggle (newest first / random)
The movies view SHALL provide a sort control in its toolbar that switches the movies
list between the default newest-first order and a random order. The control SHALL be
a two-state toggle that reflects the current mode. Activating it to enter random
order SHALL produce a fresh random ordering each time — re-entering random order
after leaving it SHALL reshuffle rather than reuse a previous random order. While
random order is active, changing filters (tag chips, the actor dropdown) or the page
SHALL NOT reshuffle the order already chosen; the filters and page reveal a stable
subset of the current random order. The actors list SHALL be unaffected, and the sort
control SHALL NOT appear in the actors view. The selected mode SHALL be session-only:
it resets to newest-first when the view is closed or the plugin reloads and is not
persisted to disk.

#### Scenario: Toggle to random shuffles the list
- **WHEN** the user activates the sort control to switch the movies list from newest-first to random
- THEN the movies list is shown in a random order that differs from newest-first

#### Scenario: Re-entering random reshuffles
- **WHEN** the user switches the movies list back to newest-first and then activates the control to enter random again
- THEN the movies list shows a newly shuffled order, not necessarily the same as the previous random order

#### Scenario: Filters do not reshuffle a random order
- **WHEN** random order is active and the user selects a tag chip, changes the actor dropdown, or moves to another page
- THEN the movies shown keep the same relative order from the current random ordering (a stable subset), with no reshuffle

#### Scenario: Actors view has no sort control
- **WHEN** the user switches to the Actors tab
- THEN the actors list is ordered newest-first and no sort toggle is present

#### Scenario: Mode is session-only
- **WHEN** the user sets the movies list to random and then closes the view (or reloads the plugin)
- THEN reopening the view shows the movies list in the default newest-first order
