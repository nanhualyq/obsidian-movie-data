## ADDED Requirements

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
