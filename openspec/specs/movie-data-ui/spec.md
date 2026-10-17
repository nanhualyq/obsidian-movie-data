## Purpose

Provides the plugin's main interface as an independent Obsidian workspace tab for browsing, searching, filtering, creating, and editing movies and actors.

## Requirements

### Requirement: Main view opens as a workspace tab
The plugin SHALL register a command (and ribbon entry, if applicable) that opens the movie data view as an independent editor tab (workspace leaf), reusable if already open.

#### Scenario: Opening the view
- **WHEN** the user runs the open command
- THEN a new tab opens showing the movie list, or the existing tab is focused if one is already open

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

### Requirement: Detail dialog presents the cover large and uncropped
The entry detail dialog (movie and actor) SHALL display the entity's cover image substantially larger than the list thumbnail, sized from the available dialog space rather than a fixed small thumbnail width. The complete image SHALL be visible with its aspect ratio preserved (no cropping). The rendered image SHALL NOT be scaled beyond its stored pixel dimensions (never upscaled), and the enlarged cover SHALL NOT overflow the dialog, cause horizontal scrolling, or hide the detail values (title/name, tags, actors, URL, info) and the Edit/Close actions on any supported viewport. An entity with no cover, or whose cover file is missing or unreadable, SHALL show the existing placeholder in the enlarged cover area rather than an empty or broken region.

#### Scenario: Cover is shown large in the detail dialog
- **WHEN** the user opens the detail dialog of an entity with a saved cover
- THEN the cover renders at a substantially larger size than in the list, the whole image is visible, and its proportions are preserved

#### Scenario: Small cover is not upscaled
- **WHEN** the stored cover image's pixel dimensions are smaller than the space available for it in the detail dialog
- THEN the image is displayed at no more than its stored resolution (no blurring from upscaling)

#### Scenario: Detail stays usable on a narrow viewport
- **WHEN** the detail dialog opens on a narrow (mobile-width) viewport with an enlarged cover
- THEN the dialog has no horizontal overflow, and the detail values and Edit/Close actions remain reachable by scrolling within the dialog

#### Scenario: Missing or unreadable cover keeps the placeholder
- **WHEN** the user opens the detail dialog of an entity whose cover is absent or whose cover file fails to load
- THEN the enlarged cover area shows the existing "?" placeholder and the dialog remains fully usable

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
After a successful save, the dialog stack SHALL pop one level and the list underneath SHALL immediately reflect the new or updated entry without requiring a plugin reload: saving from the add form closes to the list; saving from the edit form closes back to the detail dialog, which SHALL show the entity's updated values.

#### Scenario: Save and return
- **WHEN** the user saves a new entity from the add dialog
- THEN the dialog closes to the list and the new entry is visible with its current values

#### Scenario: Save from edit returns to refreshed detail
- **WHEN** the user changes values in an edit form opened from a detail dialog and saves
- THEN the edit dialog closes, the detail dialog beneath shows the updated values, and the list reflects the change

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

### Requirement: Chip-based tag entry in the movie form
The movie form's tags field SHALL accept tags as removable chips rather than comma-separated text: the input SHALL never require the user to type a separator. The tags state SHALL be a list of tag strings; saving SHALL persist exactly the chips present, unchanged in format from the existing `Movie.tags` schema.

#### Scenario: Add a tag without separators
- **WHEN** the user types a tag name and presses Enter
- THEN a chip for that tag appears and the input clears, with no comma or other separator involved

#### Scenario: Remove a tag
- **WHEN** the user activates a chip's remove action, or presses Backspace while the input is empty and holds at least one chip
- THEN that chip is removed from the field

#### Scenario: Save and reload round-trip
- **WHEN** the user edits chips, saves, and reopens the form
- THEN the chips shown equal the saved `Movie.tags` list

### Requirement: Suggestion dropdown from tag history
Focusing the tags input SHALL open a suggestion dropdown listing historical tags (the union of tags across all saved movies) that are not already present as chips on the field, ordered by descending usage frequency with alphabetical tie-break, capped at 10 entries after excluding chips already present, with the first entry pre-highlighted. Typing SHALL filter the list by case-insensitive substring match while preserving frequency order, still excluding tags already present as chips. When no tags exist yet, the dropdown SHALL show a placeholder prompting the user to type to create the first tag rather than an empty list. Selecting a suggestion SHALL add it as a chip.

#### Scenario: Zero-typing selection of the top tag
- **WHEN** the user focuses the tags input (dropdown opens with the most-used tag highlighted) and presses Enter
- THEN the most frequently used tag is added as a chip without any typing

#### Scenario: Filter by typing
- **WHEN** the user types a partial tag name while the dropdown is open
- THEN only historical tags containing the typed text (case-insensitive) remain listed, in frequency order

#### Scenario: Cold start
- **WHEN** the user focuses the tags input of a form while no movie in the library has any tag
- THEN the dropdown shows a placeholder message instead of an empty box

#### Scenario: History reflects all movies
- **WHEN** two movies carry overlapping tags with different frequencies
- THEN the dropdown lists each distinct tag once, ordered by its total count across movies

#### Scenario: Suggestions exclude existing chips
- **WHEN** the field already has a chip for a historical tag and the dropdown is open
- THEN that tag does not appear among the suggestions, regardless of typed text

#### Scenario: Cap counts pickable suggestions only
- **WHEN** the field has chips for several of the top 10 historical tags and the dropdown opens without typed text
- THEN the dropdown lists up to 10 suggestions excluding the chipped tags, reaching further down the frequency-ordered history as needed

### Requirement: Keyboard-first tag entry
The tags field SHALL be operable without a mouse. While the dropdown is open: Arrow Down and Arrow Up SHALL move the highlight (wrapping at the ends) without altering the typed text; Enter SHALL add the highlighted suggestion, or the typed text when no suggestion is highlighted, and SHALL keep the dropdown open afterward with the input cleared and the first remaining suggestion highlighted; Escape SHALL close the dropdown while keeping the typed text. When the input is empty, nothing is highlighted, and it is the only focus target, Enter SHALL add nothing (a safe no-op). Tab SHALL NOT be bound to any tag-input action and SHALL keep its default behavior. The dropdown SHALL close on blur without discarding typed text or chips.

#### Scenario: Navigate with arrow keys
- **WHEN** the user presses Arrow Down repeatedly with the dropdown open
- THEN the highlight moves down the list and wraps back to the top after the last entry

#### Scenario: Enter commits typed text when nothing is highlighted
- **WHEN** the user types text that matches no historical tag and presses Enter
- THEN the typed text is added as a new chip

#### Scenario: Consecutive Enters add successive suggestions
- **WHEN** the user presses Enter repeatedly with the dropdown open and an empty input
- THEN each press adds the currently highlighted suggestion as a chip, and the highlight advances to the next suggestion not already present as a chip, until no suggestions remain

#### Scenario: Dropdown stays open after a commit
- **WHEN** the user adds a tag with Enter (suggestion or typed text) and does not press Escape or leave the input
- THEN the dropdown remains open with an empty input and the first remaining suggestion highlighted — no blur/refocus is needed to pick another tag

#### Scenario: Escape closes but preserves input
- **WHEN** the user presses Escape while the dropdown is open with text typed
- THEN the dropdown closes and the typed text remains in the input

#### Scenario: Tab moves focus normally
- **WHEN** the user presses Tab in the tags input
- THEN focus moves to the next form control; no tag is added or completed

### Requirement: Tag normalization on entry
Added tags SHALL be trimmed of surrounding whitespace and deduplicated case-insensitively: entering a tag that differs from an existing chip only by letter case SHALL NOT create a second chip, and a suggestion SHALL add with its stored casing. Pasted text SHALL be split on commas (both half- and full-width) into multiple tags, each trimmed; the comma is meaningful only on paste, never as typed input.

#### Scenario: Case-insensitive duplicate
- **WHEN** the chips already include "Drama" and the user types "drama" and presses Enter
- THEN no new chip is added (the existing "Drama" chip remains the only one)

#### Scenario: Paste multiple tags
- **WHEN** the user pastes "action, drama，thriller" into the input
- THEN three chips are created: "action", "drama", "thriller"

#### Scenario: Whitespace trimmed
- **WHEN** the user types "  comedy  " and presses Enter
- THEN a chip labeled "comedy" is added

### Requirement: Tag entry and tag filter share one history source
The suggestion dropdown's history and the list view's tag chips SHALL derive from the same tag data over all saved movies, so a tag visible in one is always available in the other. The dropdown's frequency counts SHALL count each occurrence of a tag across movies.

#### Scenario: No drift between form and list
- **WHEN** the list view's tag chips show a tag
- THEN focusing the movie form's tags input reveals the same tag among the suggestions (subject to the top-10 cap when unfiltered)

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
