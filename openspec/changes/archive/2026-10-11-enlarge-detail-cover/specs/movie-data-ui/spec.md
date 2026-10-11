## ADDED Requirements

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
