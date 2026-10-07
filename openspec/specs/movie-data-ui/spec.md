## Purpose

Provides the plugin's main interface as an independent Obsidian workspace tab for browsing, searching, filtering, creating, and editing movies and actors.

## Requirements

### Requirement: Main view opens as a workspace tab
The plugin SHALL register a command (and ribbon entry, if applicable) that opens the movie data view as an independent editor tab (workspace leaf), reusable if already open.

#### Scenario: Opening the view
- **WHEN** the user runs the open command
- THEN a new tab opens showing the movie list, or the existing tab is focused if one is already open

### Requirement: Click-to-filter list
The list SHALL show entries as items with cover thumbnails and be filterable by selection only: by tag (movie tag chips), by actor (an actor dropdown in the movies view), and by entity type (movies/actors). The view SHALL NOT provide a text search input, and SHALL NOT perform full-text matching of titles or names. The actor dropdown SHALL list an "All actors" option first (no actor filtering), followed by every saved actor plus an "Unknown" option for movies with unknown cast - the "Unknown" option SHALL always be listed, whether or not its shared record exists yet, so unknown-cast movies remain filterable; choosing an option SHALL narrow the movies to those referencing it. Tag chips SHALL be toggleable: clicking a selected chip deselects it, and within the tag group a movie matches if it carries any selected tag. When an actor is chosen AND tag chips are selected, a movie SHALL satisfy both.

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

### Requirement: Add and edit forms
Selecting an entry SHALL open an edit form in the same tab; the view SHALL provide a way to open an empty add form. Forms cover all schema fields of the respective entity, including a cover picker (choose image file, preview after deforming) and actor selection for a movie's `actorIds`, presented as a select control shared with the list's actor filter (multi-select in the form). A movie SHALL NOT save with an empty `actorIds`: on a save attempt with no actor selected, the form SHALL show an inline validation error, keep the form open, and write nothing. The actor selection SHALL offer an "Unknown" fallback option in addition to the saved actor records; selecting it SHALL save the movie referencing a single shared "Unknown" actor record, which the system SHALL create on first use if it does not exist. The same "Unknown" label SHALL be used everywhere an entity has no usable name or cast.

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
- **WHEN** the user selects the "Unknown" option and saves
- THEN the movie saves with `actorIds` referencing the shared "Unknown" actor record (created if it does not yet exist), and the movie appears in the list

#### Scenario: No saved actors yet
- **WHEN** the user opens the movie form while no actor records exist
- THEN the actor selection still offers the "Unknown" option, so a movie can be saved without a dead end

### Requirement: Paste an image into the cover picker
When focus is inside the cover field of the add/edit form and the user pastes, the system SHALL stage the clipboard image as the entity's cover if the clipboard contains image data, using the same staging behavior as choosing a file from disk (staged in memory until save, deformed bytes, preview shown). If the clipboard contains no image, the paste SHALL be ignored by the cover picker without side effects. Paste events outside the cover field SHALL NOT stage a cover.

#### Scenario: Paste an image into an empty cover field
- **WHEN** the user copies an image to the clipboard, focuses the cover field of an open form, and pastes
- THEN the image is staged as the cover and its preview appears in the cover field, with nothing written to disk until save

#### Scenario: Paste replaces an already staged cover
- **WHEN** the user already picked or pasted a cover and then pastes a different image into the cover field
- THEN the newly pasted image replaces the staged cover and the preview updates to the new image

#### Scenario: Paste with no image in the clipboard
- **WHEN** the user focuses the cover field and pastes while the clipboard holds only text
- THEN no cover is staged or changed and the existing preview (or empty state) is unchanged

#### Scenario: Saved pasted cover behaves like a picked cover
- **WHEN** the user pastes an image, saves the form, and reopens the list
- THEN the entry renders the pasted cover exactly as it would a cover chosen from disk

#### Scenario: Cancel discards a pasted cover
- **WHEN** the user pastes an image into the cover field and cancels the form
- THEN nothing is written and no cover file exists for that paste

### Requirement: List reflects saved data
After a successful save, the list SHALL immediately reflect the new or updated entry without requiring a plugin reload.

#### Scenario: Save and return
- **WHEN** the user saves a form
- THEN the view returns to the list and the changed entry is visible with its current values

### Requirement: Delete an entity from the edit form
The edit form for an existing movie or actor SHALL provide a Delete action, separate from Save and Cancel. The Delete action SHALL require an explicit confirmation step before anything is written; declining the confirmation SHALL leave the form open and write nothing. The Delete action SHALL NOT be offered for an entity that has not been saved yet (an add form in progress).

#### Scenario: Confirm deletion of a movie
- **WHEN** the user opens an existing movie's form, clicks Delete, and confirms
- THEN the movie is removed, the view returns to the list, and the list no longer shows the movie without a plugin reload

#### Scenario: Decline deletion
- **WHEN** the user clicks Delete and then declines the confirmation
- THEN nothing is written, the form stays open, and the entry remains in the list

#### Scenario: Add form has no delete
- **WHEN** the user opens the add form for a movie or actor that was never saved
- THEN no Delete action is offered

### Requirement: Deleting a referenced actor is blocked
When the user attempts to delete an actor that is referenced by at least one movie (i.e., any movie's `actorIds` contains the actor's id), the deletion SHALL be blocked: the view shows a warning stating how many movies reference the actor, and no data or files are written. Deleting an actor that no movie references SHALL proceed normally through the confirmation step.

#### Scenario: Actor referenced by movies
- **WHEN** the user clicks Delete on an actor that appears in the `actorIds` of one or more movies and confirms
- THEN the deletion is blocked, a warning naming the number of referencing movies is shown, and the actor and all movies are unchanged

#### Scenario: Unreferenced actor
- **WHEN** the user clicks Delete on an actor no movie references and confirms
- THEN the actor is removed and the view returns to the list, which no longer shows the actor
