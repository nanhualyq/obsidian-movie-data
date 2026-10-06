## ADDED Requirements

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
