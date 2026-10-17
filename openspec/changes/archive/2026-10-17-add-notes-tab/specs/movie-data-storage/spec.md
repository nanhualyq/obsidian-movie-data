## MODIFIED Requirements

### Requirement: Data store layout
The plugin SHALL store all data in a `./.movie-data` directory in the vault, consisting of a single `movies.json` file and a `covers/` subdirectory. The dot-prefixed directory name MUST keep it out of Obsidian's file explorer and vault index (search, quick switcher, graph) while remaining fully readable through the raw file adapter.

#### Scenario: Fresh install creates the store
- **WHEN** the plugin is enabled and no `./.movie-data` directory exists
- THEN the plugin creates `./.movie-data/covers/` and an empty `movies.json` containing empty `movies` and `actors` collections and a `note` field set to `""`

#### Scenario: Directory is invisible to Obsidian's index
- **WHEN** the user runs a vault-wide search or browses the file explorer
- THEN neither `.movie-data` nor any file under it appears in results or the explorer tree

### Requirement: JSON schema
`movies.json` SHALL contain two collections: `movies`, whose entries have `id`, `title`, `cover`, `tags` (array), `actorIds` (array), `info`, and `url`; and `actors`, whose entries have `id`, `name`, `cover`, `info`, and `url`. In addition, `movies.json` SHALL contain a `note` field: a string holding the vault's single plain-text note. `info` and `note` SHALL be free-form text preserved verbatim.

#### Scenario: Actor is referenced, not duplicated
- **WHEN** a movie references an actor
- THEN only the actor's `id` is stored on the movie; the actor's `name`, `cover`, `info`, and `url` exist exactly once in the `actors` collection

#### Scenario: File predating the note field loads
- **WHEN** an existing `movies.json` written before this change (no `note` key) is loaded
- THEN the load succeeds, the note is treated as `""`, and the rest of the file is unchanged

### Requirement: Explicit persistence
Data SHALL be written to disk only when the user explicitly saves; edits in a form in progress MUST NOT modify files on disk. The sole exception is the `note` field: after the user edits the note, the plugin SHALL write `movies.json` automatically after a short debounce, with no explicit save action. That note autosave SHALL write only `movies.json` and MUST NOT write staged cover files, so a cover staged for a pending form edit is never persisted by it.

#### Scenario: Cancelled edit
- **WHEN** the user opens the add/edit form, changes fields, and cancels
- THEN `movies.json` and all cover files remain unchanged on disk

#### Scenario: Note autosaves without an explicit save
- **WHEN** the user types into the note and pauses for the debounce interval without performing any save action
- THEN `movies.json` on disk contains the typed note text

#### Scenario: Note autosave does not write staged covers
- **WHEN** a cover has been staged in an open add/edit form and a note autosave fires
- THEN no `.mcov` file is written or overwritten, the staged cover remains pending for the form's own save, and only the `note` field differs from the previous `movies.json` on disk

#### Scenario: Note autosave failure leaves disk unchanged
- **WHEN** writing `movies.json` during a note autosave fails
- THEN the file on disk keeps its previous content, the typed text is not discarded, and a later edit retries the write
