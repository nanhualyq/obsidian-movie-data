## ADDED Requirements

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
