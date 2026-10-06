## MODIFIED Requirements

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

## ADDED Requirements

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
