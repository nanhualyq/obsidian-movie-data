## Purpose

Persists movie and actor data as a plain, portable file store inside the vault, with cover images deformed so other applications cannot recognize or display them.

## ADDED Requirements

### Requirement: Data store layout
The plugin SHALL store all data in a `./.movie-data` directory in the vault, consisting of a single `movies.json` file and a `covers/` subdirectory. The dot-prefixed directory name MUST keep it out of Obsidian's file explorer and vault index (search, quick switcher, graph) while remaining fully readable through the raw file adapter.

#### Scenario: Fresh install creates the store
- **WHEN** the plugin is enabled and no `./.movie-data` directory exists
- THEN the plugin creates `./.movie-data/covers/` and an empty `movies.json` containing empty `movies` and `actors` collections

#### Scenario: Directory is invisible to Obsidian's index
- **WHEN** the user runs a vault-wide search or browses the file explorer
- THEN neither `.movie-data` nor any file under it appears in results or the explorer tree

### Requirement: JSON schema
`movies.json` SHALL contain two collections: `movies`, whose entries have `id`, `title`, `cover`, `tags` (array), `actorIds` (array), `info`, and `url`; and `actors`, whose entries have `id`, `name`, `cover`, `info`, and `url`. `info` SHALL be free-form text preserved verbatim.

#### Scenario: Actor is referenced, not duplicated
- **WHEN** a movie references an actor
- THEN only the actor's `id` is stored on the movie; the actor's `name`, `cover`, `info`, and `url` exist exactly once in the `actors` collection

### Requirement: Cover images are deformed
Each cover SHALL be stored in `covers/` with a `.mcov` extension and a fixed-length binary prefix at the start of the file, followed by the original image bytes. Decoding SHALL strip the prefix by fixed offset, independent of image format.

#### Scenario: Saving a cover
- **WHEN** the user selects an image file as a cover
- THEN the plugin writes `covers/<id>.mcov` containing the fixed prefix followed by the unmodified original image bytes, and stores the filename in the entity's `cover` field

#### Scenario: Rendering a cover
- **WHEN** the UI needs to display a cover
- THEN the plugin reads the `.mcov` file, removes the first N bytes (the prefix), and renders the remainder as an image without inspecting or converting its format

#### Scenario: Cover file is corrupt or missing
- **WHEN** a `.mcov` file is missing or its decoded bytes fail to render
- THEN the UI displays a placeholder instead of failing or blocking the list

### Requirement: Other applications do not recognize covers
Cover files SHALL not be recognizable to applications that scan by file extension or by magic bytes at file offset 0.

#### Scenario: Gallery scan bypass
- **WHEN** a system photo gallery or cloud backup scans the `covers/` directory
- THEN files carry a non-image extension and their first bytes are not a valid image signature

### Requirement: Explicit persistence
Data SHALL be written to disk only when the user explicitly saves; edits in a form in progress MUST NOT modify files on disk.

#### Scenario: Cancelled edit
- **WHEN** the user opens the add/edit form, changes fields, and cancels
- THEN `movies.json` and all cover files remain unchanged on disk
