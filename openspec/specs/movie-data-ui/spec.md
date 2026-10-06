## Purpose

Provides the plugin's main interface as an independent Obsidian workspace tab for browsing, searching, filtering, creating, and editing movies and actors.

## Requirements

### Requirement: Main view opens as a workspace tab
The plugin SHALL register a command (and ribbon entry, if applicable) that opens the movie data view as an independent editor tab (workspace leaf), reusable if already open.

#### Scenario: Opening the view
- **WHEN** the user runs the open command
- THEN a new tab opens showing the movie list, or the existing tab is focused if one is already open

### Requirement: Searchable and filterable list
The list SHALL show entries as items with cover thumbnails and support: full-text search matching movie titles AND actor names (including actors referenced by movies), and filtering by tag (movies) and by entity type (movies/actors).

#### Scenario: Search by actor name
- **WHEN** the user types an actor's name into search
- THEN movies referencing that actor appear in the results, alongside the actor's own entry if it matches

#### Scenario: Filter by tag
- **WHEN** the user selects one or more tags
- THEN only movies carrying any selected tag are shown

#### Scenario: No results
- **WHEN** no entry matches the current search/filter
- THEN an empty state is shown rather than a blank or broken list

### Requirement: Add and edit forms
Selecting an entry SHALL open an edit form in the same tab; the view SHALL provide a way to open an empty add form. Forms cover all schema fields of the respective entity, including a cover picker (choose image file, preview after deforming) and actor selection for a movie's `actorIds`.

#### Scenario: Add a movie
- **WHEN** the user opens the add form, fills title/tags/info/url, picks a cover, selects actors, and saves
- THEN the movie appears in the list, its cover renders, and `movies.json` is updated

#### Scenario: Edit an actor
- **WHEN** the user edits an actor's name/info/cover and saves
- THEN every movie referencing that actor reflects the change, since the actor is stored once

#### Scenario: Cancel
- **WHEN** the user cancels the form
- THEN no data or cover files are written and the list is unchanged

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
