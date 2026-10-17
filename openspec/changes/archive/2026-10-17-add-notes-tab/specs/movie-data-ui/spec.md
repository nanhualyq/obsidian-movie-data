## MODIFIED Requirements

### Requirement: Click-to-filter list
The list SHALL show entries as items with cover thumbnails and be filterable by selection only: by tag (movie tag chips), by actor (an actor dropdown in the movies view), and by the active entity tab (Movies or Actors; the Notes tab has no list). The view SHALL NOT provide a text search input, and SHALL NOT perform full-text matching of titles or names. The actor dropdown SHALL list an "All actors" option first (no actor filtering), followed by every saved actor plus an "Unknown" option for movies with unknown cast - the "Unknown" option SHALL always be listed, whether or not its shared record exists yet, so unknown-cast movies remain filterable; choosing an option SHALL narrow the movies to those referencing it. Tag chips SHALL be toggleable: clicking a selected chip deselects it, and within the tag group a movie matches if it carries any selected tag. When an actor is chosen AND tag chips are selected, a movie SHALL satisfy both.

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
- **WHEN** the user switches to the Actors tab
- THEN the tag chips and the actor dropdown are hidden, and no tag or actor filtering is applied to actor entries

#### Scenario: No results
- **WHEN** no entry matches the active filters and the active tab shows a list
- THEN an empty state is shown rather than a blank or broken list

### Requirement: Jump from an actor entry to its filtered movies
Each entry in the actors list SHALL provide a jump action that switches the view to the movies list filtered to that actor. Following the jump SHALL choose that actor in the actor dropdown as the only active actor filter, clear any selected tag chips, and switch to the Movies tab. Activating the jump SHALL open neither the actor's detail dialog nor its edit form.

#### Scenario: Jump to an actor's movies
- **WHEN** the user activates the jump action on an actor entry in the actors list
- THEN the view switches to the movies list showing only movies referencing that actor, with that actor chosen in the dropdown and no tag chips selected

#### Scenario: Jump for an actor with no movies
- **WHEN** the user activates the jump action for an actor that no movie references
- THEN the movies list is shown with an empty state rather than a blank or broken list

## ADDED Requirements

### Requirement: Three-tab entity navigation
The view SHALL present its top-level navigation as three tabs — Movies, Actors, and Notes — with the active tab visually indicated, positioned at the top of the view and visible in all three views. Activating a tab SHALL show that tab's content below the tab bar and write nothing to disk, except that leaving the Notes tab SHALL first complete any pending note autosave (see "Note autosave"). The Movies/Actors list state (selected tag chips, chosen actor) SHALL be preserved across tab switches; returning to a list tab shows page 1, as with any view switch.

#### Scenario: Tab bar is always present
- **WHEN** the Movies, Actors, or Notes tab is active
- THEN the three-tab bar is visible at the top of the view with the current tab indicated

#### Scenario: List state survives a tab switch
- **WHEN** the user selects tag chips on the Movies tab, switches to Actors, and returns to Movies
- THEN the same tag chips are still selected and the movies list is filtered accordingly

#### Scenario: Switching between list tabs writes nothing
- **WHEN** the user switches between the Movies and Actors tabs
- THEN no file is written to disk

#### Scenario: Switching away from Notes persists pending text
- **WHEN** the user edits the note and activates another tab within the debounce interval
- THEN the edited note text is persisted to disk as part of the tab switch, and returning to Notes shows that text

### Requirement: Notes page
The Notes tab SHALL show a single plain-text editor occupying the content area below the tab bar. There is exactly one note per vault: the page SHALL offer no list of entries and no add, delete, save, or cancel actions, and SHALL show no cover, tag, actor, or pagination controls. The editor SHALL present plain text only (no markdown rendering or rich formatting) and SHALL preserve the text verbatim, including whitespace and newlines. The editor SHALL use a monospace font and SHALL NOT enable spellcheck. While the editor is focused, the Tab key SHALL insert a tab character into the text instead of moving focus. When the note is empty, the editor SHALL show placeholder text inviting the user to type.

#### Scenario: Empty note shows a placeholder
- **WHEN** the user opens the Notes tab while the note is empty
- THEN the editor shows placeholder text; as soon as text is entered the placeholder disappears

#### Scenario: Tab key inserts a tab character
- **WHEN** the user presses Tab while the editor is focused
- THEN a tab character is inserted at the cursor position and focus stays in the editor

#### Scenario: Text round-trips exactly
- **WHEN** the user types text with leading spaces and multiple blank lines, the autosave completes, and they switch tabs and return
- THEN the editor shows exactly the text that was typed

#### Scenario: No note management controls
- **WHEN** the Notes tab is active
- THEN no add, delete, save, cancel, filter, or pagination controls are present anywhere in the view

### Requirement: Note autosave
Edits to the note SHALL autosave: after an edit, the plugin SHALL write the note into `movies.json` following a short debounce (on the order of half a second) with no explicit save action, while the in-memory draft updates immediately so typing never waits on disk. Any pending unsaved text SHALL be flushed when the user switches tabs and when the view closes. On a failed write the plugin SHALL notify the user once, keep further failures silent while the failure persists, keep the typed text in the editor, retry the write on the next edit, and resume notifying on failure after a write succeeds. Autosave SHALL NEVER write staged cover files (storage spec: explicit persistence).

#### Scenario: Debounced write with no save button
- **WHEN** the user types into the editor and pauses for the debounce interval
- THEN `movies.json` contains the typed text and no save control was involved

#### Scenario: Immediate tab switch flushes the draft
- **WHEN** the user types and activates another tab before the debounce interval elapses
- THEN the draft is written to disk before the tab switch completes and no text is lost

#### Scenario: Closing the view flushes the draft
- **WHEN** the user types and closes the view (or the plugin unloads) before the debounce interval elapses
- THEN the draft is written to disk before the view unloads

#### Scenario: Failure is reported once, then retried silently
- **WHEN** a note autosave write fails
- THEN the user is notified once, subsequent failed writes are not re-notified while the failure persists, the typed text remains visible, the next edit retries the write, and a successful write clears the failure state

#### Scenario: Autosave does not clobber a concurrent form save
- **WHEN** a note autosave and a movie or actor form save both occur in quick succession
- THEN the final `movies.json` on disk contains both the note text and the form's changes
