## ADDED Requirements

### Requirement: Entry detail dialog
Selecting an entry in the list SHALL open a read-only detail dialog layered over the list instead of an edit form. The detail SHALL present the entity's saved values: cover image, title (movie) or name (actor), tags and actor names (movie), URL, and info. It SHALL offer an Edit action that opens the entity's edit form stacked above the detail dialog, and a Close action that returns to the list. The detail dialog SHALL NOT allow editing fields in place and SHALL NOT offer a delete action (delete remains an action of the edit form only).

#### Scenario: Click opens detail, not the edit form
- **WHEN** the user clicks a list entry
- THEN a read-only detail dialog showing that entity's saved values opens over the list, and no edit form is open

#### Scenario: Edit stacks above detail
- **WHEN** the user activates Edit in the detail dialog
- THEN the entity's edit form opens as a dialog stacked above the detail dialog, with the list still mounted underneath

#### Scenario: Close returns to the list
- **WHEN** the user activates Close in the detail dialog
- THEN the dialog closes, the list is shown unchanged, and nothing is written

#### Scenario: Add flow has no detail dialog
- **WHEN** the user activates the add action in the toolbar
- THEN the empty add form opens directly as a dialog over the list, with no detail dialog

### Requirement: Escape and backdrop dismiss the top dialog
Pressing Escape SHALL close only the top-most dialog: on a detail dialog it returns to the list; on an add or edit form it SHALL behave exactly as Cancel — nothing written, staged covers discarded — returning to the detail dialog (edit) or the list (add). Clicking the backdrop SHALL have the same effect as Escape. A single Escape press MUST NOT close more than one dialog. When a dialog-local overlay is open inside the top dialog (such as the tag suggestion dropdown), Escape SHALL dismiss that overlay only and SHALL NOT close the dialog.

#### Scenario: Escape on detail dialog
- **WHEN** the user presses Escape while the detail dialog is the only open dialog
- THEN the dialog closes and the list is shown with nothing written

#### Scenario: Escape on add form behaves as Cancel
- **WHEN** the user stages a cover image in the add form and presses Escape
- THEN the form closes to the list, nothing is written, and the staged cover is discarded

#### Scenario: Escape on stacked edit form pops one level
- **WHEN** the user presses Escape while the edit form is stacked above the detail dialog
- THEN only the edit form closes, the detail dialog remains open, and nothing is written

#### Scenario: Escape closes the tag dropdown first
- **WHEN** the user presses Escape while the tag suggestion dropdown is open inside a form dialog
- THEN the dropdown closes (keeping typed text) and the dialog stays open

#### Scenario: Backdrop click dismisses
- **WHEN** the user clicks the backdrop area outside the dialog content
- THEN the top-most dialog closes as if Escape were pressed

## MODIFIED Requirements

### Requirement: Add and edit forms
Selecting an entry SHALL open an entry detail dialog (see "Entry detail dialog"); the detail dialog's Edit action SHALL open the edit form for that entity as a dialog stacked above it. The view SHALL provide a way to open an empty add form as a dialog over the list directly (no detail dialog for an unsaved entity). All forms SHALL render as dialogs layered over the list, which stays mounted underneath, rather than replacing the list view. Forms cover all schema fields of the respective entity, including a cover picker (choose image file, preview after deforming) and actor selection for a movie's `actorIds`, presented as a select control shared with the list's actor filter (multi-select in the form). A movie SHALL NOT save with an empty `actorIds`: on a save attempt with no actor selected, the form SHALL show an inline validation error, keep the form open, and write nothing. The actor selection SHALL offer an "Unknown" fallback option in addition to the saved actor records; selecting it SHALL save the movie referencing a single shared "Unknown" actor record, which the system SHALL create on first use if it does not exist. The same "Unknown" label SHALL be used everywhere an entity has no usable name or cast.

#### Scenario: Add a movie
- **WHEN** the user opens the add form, fills title/tags/info/url, picks a cover, selects actors, and saves
- THEN the movie appears in the list, its cover renders, and `movies.json` is updated

#### Scenario: Edit an actor
- **WHEN** the user edits an actor's name/info/cover and saves
- THEN every movie referencing that actor reflects the change, since the actor is stored once

#### Scenario: Cancel
- **WHEN** the user cancels the add form
- THEN the dialog closes to the list, no data or cover files are written, and the list is unchanged

#### Scenario: Cancel from edit form returns to detail
- **WHEN** the user cancels an edit form opened from a detail dialog
- THEN the edit dialog closes, the detail dialog beneath remains open, and no data or cover files are written

#### Scenario: Save blocked without actors
- **WHEN** the user tries to save a movie with no actor selected
- THEN the save is blocked, an inline error is shown on the Actors field, the form stays open, and no data or cover files are written

#### Scenario: Fallback actor satisfies the requirement
- **WHEN** the user selects the "Unknown" option and saves
- THEN the movie saves with `actorIds` referencing the shared "Unknown" actor record (created if it does not yet exist), and the movie appears in the list

#### Scenario: No saved actors yet
- **WHEN** the user opens the movie form while no actor records exist
- THEN the actor selection still offers the "Unknown" option, so a movie can be saved without a dead end

### Requirement: List reflects saved data
After a successful save, the dialog stack SHALL pop one level and the list underneath SHALL immediately reflect the new or updated entry without requiring a plugin reload: saving from the add form closes to the list; saving from the edit form closes back to the detail dialog, which SHALL show the entity's updated values.

#### Scenario: Save and return
- **WHEN** the user saves a new entity from the add dialog
- THEN the dialog closes to the list and the new entry is visible with its current values

#### Scenario: Save from edit returns to refreshed detail
- **WHEN** the user changes values in an edit form opened from a detail dialog and saves
- THEN the edit dialog closes, the detail dialog beneath shows the updated values, and the list reflects the change

### Requirement: Jump from an actor entry to its filtered movies
Each entry in the actors list SHALL provide a jump action that switches the view to the movies list filtered to that actor. Following the jump SHALL choose that actor in the actor dropdown as the only active actor filter, clear any selected tag chips, and switch the entity filter to movies. Activating the jump SHALL open neither the actor's detail dialog nor its edit form.

#### Scenario: Jump to an actor's movies
- **WHEN** the user activates the jump action on an actor entry in the actors list
- THEN the view switches to the movies list showing only movies referencing that actor, with that actor chosen in the dropdown and no tag chips selected

#### Scenario: Jump for an actor with no movies
- **WHEN** the user activates the jump action for an actor that no movie references
- THEN the movies list is shown with an empty state rather than a blank or broken list
