## Purpose

Persists movie and actor data as a plain, portable file store inside the vault, with cover images deformed so other applications cannot recognize or display them.

## Requirements

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
Each cover SHALL be stored in `covers/` with a `.mcov` extension and a fixed-length binary prefix at the start of the file, followed by the staged image bytes (the normalized bytes produced by size normalization when it applies, otherwise the original image bytes). Decoding SHALL strip the prefix by fixed offset, independent of image format.

#### Scenario: Saving a cover
- **WHEN** the user selects an image file as a cover
- THEN the plugin writes `covers/<id>.mcov` containing the fixed prefix followed by the staged image bytes, and stores the filename in the entity's `cover` field

#### Scenario: Rendering a cover
- **WHEN** the UI needs to display a cover
- THEN the plugin reads the `.mcov` file, removes the first N bytes (the prefix), and renders the remainder as an image without inspecting or converting its format

#### Scenario: Cover file is corrupt or missing
- **WHEN** a `.mcov` file is missing or its decoded bytes fail to render
- THEN the UI displays a placeholder instead of failing or blocking the list

### Requirement: Covers are size-normalized before storage
When an image is chosen or pasted as a cover, the plugin SHALL downscale it proportionally so that its longest side is at most 800 px and re-encode it to reduce file size, before it is staged and written to disk. An image whose longest side is already at most 800 px SHALL be staged unchanged. Normalization MUST never enlarge an image and MUST preserve its aspect ratio (beyond integer rounding). Any failure to decode or re-encode SHALL fall back to staging the original bytes: normalization MUST NOT block staging, preview, or saving.

#### Scenario: Large photo is downscaled proportionally
- **WHEN** the user picks a 4000x3000 photo as a cover and saves
- THEN the stored cover image has a longest side of at most 800 px, keeps the source width:height ratio (within integer rounding), and is smaller on disk than the source file

#### Scenario: Already-small image passes through unchanged
- **WHEN** the user picks an image whose longest side is at most 800 px (for example a 100x150 icon or a 700x700 screenshot)
- THEN the stored cover contains exactly the original image bytes: no downscaling, no enlargement, and no re-encoding

#### Scenario: Normalization failure never blocks saving
- **WHEN** the chosen or pasted image cannot be decoded or re-encoded
- THEN the original image bytes are staged as the cover, the form preview renders them, and saving completes without error

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

### Requirement: Deleting an entity persists to disk
On a confirmed, unblocked delete, the plugin SHALL remove the entity from the `movies` or `actors` collection in `movies.json`, delete the entity's `.mcov` cover file from `covers/` if one exists, and drop any cached object URL for that cover so it cannot be rendered again. `movies.json` SHALL be written before the cover file is removed; if the JSON write fails, the cover file SHALL be left in place and the store SHALL remain unchanged on disk.

#### Scenario: Movie deleted with cover
- **WHEN** a confirmed delete of a movie with a cover succeeds
- THEN `movies.json` no longer contains the movie, `covers/<id>.mcov` no longer exists, and the list renders no stale thumbnail for it

#### Scenario: JSON write fails
- **WHEN** writing `movies.json` during a delete fails
- THEN the user is informed that the save failed, the movie or actor remains on disk with its cover file, and the list is unchanged

#### Scenario: Entity without cover
- **WHEN** a confirmed delete succeeds for an entity with no cover file
- THEN the entity is removed from `movies.json` and the delete completes without error despite the missing cover file

### Requirement: Removing a cover persists to disk
When a save completes for an entity whose `cover` field is empty while a cover file previously referenced by that entity exists in `covers/`, the plugin SHALL remove that file and drop any cached object URL for it. `movies.json` SHALL be written before the cover file is removed; if the JSON write fails, the cover file SHALL be left in place and the store SHALL remain unchanged. A cover file that does not exist MUST NOT be treated as an error, and a removal failure SHALL be logged without rolling back the save (the leftover file is inert - nothing references it anymore).

#### Scenario: Remove cover and save
- **WHEN** the user opens an existing entity that has a cover, clicks Remove cover, and saves
- THEN `movies.json` records an empty `cover` field, `covers/<id>.mcov` no longer exists, the list shows the placeholder instead of a thumbnail, and no stale object URL for that cover can render

#### Scenario: Remove cover then pick a replacement
- **WHEN** the user removes the current cover, picks a different image, and saves
- THEN no file is deleted: `covers/<id>.mcov` is overwritten with the newly staged bytes and the entity's `cover` field points at it

#### Scenario: Cancel after removing a cover
- **WHEN** the user removes the cover in the form and cancels instead of saving
- THEN `movies.json` and `covers/<id>.mcov` are both unchanged on disk and the entity keeps its cover

#### Scenario: JSON write fails
- **WHEN** writing `movies.json` during a save that removed a cover fails
- THEN the user is informed that the save failed, the cover file is left in place, and the entity still has its cover on disk

#### Scenario: Cover file already missing
- **WHEN** the user removes a cover from an entity whose `.mcov` file does not exist on disk (never written, or a prior write failed) and saves
- THEN the save completes without error and `movies.json` records the empty `cover` field

#### Scenario: Removal failure does not roll back
- **WHEN** the cover file exists but cannot be deleted during a save
- THEN the save still succeeds, the empty `cover` field is persisted, the list returns showing the placeholder, and the failure is logged to the console

#### Scenario: Add form with a cover removed before saving
- **WHEN** the user opens the add form, stages a cover, removes it again, and saves
- THEN no cover file is created for the new entity and the save completes without error
