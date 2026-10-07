## REMOVED Requirements

### Requirement: Searchable and filterable list
**Reason**: Full-text search - the defining behavior of this requirement - is replaced by selection-driven filtering; keeping the requirement would mandate a text search input the product is deliberately removing, and its "Search by actor name" scenario no longer describes supported behavior.
**Migration**: Tag filtering, entity-type filtering, and the no-results empty state are redefined by the "Click-to-filter list" requirement below; looking up a movie by actor name is replaced by the actor dropdown, and by the "Jump from an actor entry to its filtered movies" requirement for the actor-list path.

## MODIFIED Requirements

### Requirement: Add and edit forms
Selecting an entry SHALL open an edit form in the same tab; the view SHALL provide a way to open an empty add form. Forms cover all schema fields of the respective entity, including a cover picker (choose image file, preview after deforming) and actor selection for a movie's `actorIds`, presented as a select control shared with the list's actor filter (multi-select in the form). A movie SHALL NOT save with an empty `actorIds`: on a save attempt with no actor selected, the form SHALL show an inline validation error, keep the form open, and write nothing. The actor selection SHALL offer an "Unknown / Unnamed" fallback option in addition to the saved actor records; selecting it SHALL save the movie referencing a single shared "Unknown / Unnamed" actor record, which the system SHALL create on first use if it does not exist.

#### Scenario: Add a movie
- **WHEN** the user opens the add form, fills title/tags/info/url, picks a cover, selects actors, and saves
- THEN the movie appears in the list, its cover renders, and `movies.json` is updated

#### Scenario: Edit an actor
- **WHEN** the user edits an actor's name/info/cover and saves
- THEN every movie referencing that actor reflects the change, since the actor is stored once

#### Scenario: Cancel
- **WHEN** the user cancels the form
- THEN no data or cover files are written and the list is unchanged

#### Scenario: Save blocked without actors
- **WHEN** the user tries to save a movie with no actor selected
- THEN the save is blocked, an inline error is shown on the Actors field, the form stays open, and no data or cover files are written

#### Scenario: Fallback actor satisfies the requirement
- **WHEN** the user selects the "Unknown / Unnamed" option and saves
- THEN the movie saves with `actorIds` referencing the shared "Unknown / Unnamed" actor record (created if it does not yet exist), and the movie appears in the list

#### Scenario: No saved actors yet
- **WHEN** the user opens the movie form while no actor records exist
- THEN the actor selection still offers the "Unknown / Unnamed" option, so a movie can be saved without a dead end

## ADDED Requirements

### Requirement: Click-to-filter list
The list SHALL show entries as items with cover thumbnails and be filterable by selection only: by tag (movie tag chips), by actor (an actor dropdown in the movies view), and by entity type (movies/actors). The view SHALL NOT provide a text search input, and SHALL NOT perform full-text matching of titles or names. The actor dropdown SHALL list an "All actors" option first (no actor filtering), followed by every saved actor; choosing an actor SHALL narrow the movies to those referencing it. Tag chips SHALL be toggleable: clicking a selected chip deselects it, and within the tag group a movie matches if it carries any selected tag. When an actor is chosen AND tag chips are selected, a movie SHALL satisfy both.

#### Scenario: Filter by tag
- **WHEN** the user clicks one or more tag chips in the movies view
- THEN only movies carrying any selected tag are shown

#### Scenario: Filter by actor
- **WHEN** the user chooses an actor from the actor dropdown in the movies view
- THEN only movies referencing that actor are shown

#### Scenario: Combined tag and actor filter
- **WHEN** the user has tag chips selected and an actor chosen in the dropdown
- THEN only movies that carry a selected tag AND reference that actor are shown

#### Scenario: Reset actor filter
- **WHEN** the user chooses "All actors" in the dropdown
- THEN the actor filter is lifted and movies are no longer narrowed by actor

#### Scenario: Deselect a filter chip
- **WHEN** the user clicks a tag chip that is already selected
- THEN that chip becomes deselected and the list widens accordingly

#### Scenario: No text search
- **WHEN** the user views the toolbar
- THEN no text search input is present; the list is narrowed only by tag chips and the actor dropdown

#### Scenario: Filter controls hidden in actors view
- **WHEN** the user switches the entity filter to actors
- THEN the tag chips and the actor dropdown are hidden, and no tag or actor filtering is applied to actor entries

#### Scenario: No results
- **WHEN** no entry matches the active filters and entity filter
- THEN an empty state is shown rather than a blank or broken list

### Requirement: Jump from an actor entry to its filtered movies
Each entry in the actors list SHALL provide a jump action that switches the view to the movies list filtered to that actor. Following the jump SHALL choose that actor in the actor dropdown as the only active actor filter, clear any selected tag chips, and switch the entity filter to movies. Activating the jump SHALL NOT open the actor's edit form.

#### Scenario: Jump to an actor's movies
- **WHEN** the user activates the jump action on an actor entry in the actors list
- THEN the view switches to the movies list showing only movies referencing that actor, with that actor chosen in the dropdown and no tag chips selected

#### Scenario: Jump for an actor with no movies
- **WHEN** the user activates the jump action for an actor that no movie references
- THEN the movies list is shown with an empty state rather than a blank or broken list
