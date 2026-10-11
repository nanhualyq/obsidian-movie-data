## Why

Covers are scaled down everywhere they appear — grid cells are fixed ~140px thumbnails, the form preview is a cropped 120px box, and the detail dialog pins the cover to a fixed 140px column (120px on mobile). The detail dialog is the one place a user opens deliberately to inspect an entry, yet it offers no larger view of the cover, so there is nowhere in the app to see a complete, clear cover.

## What Changes

- The entry detail dialog (movie and actor) presents the cover substantially larger, using the available dialog space instead of a fixed small width.
- The cover renders uncropped: the whole image stays visible with its aspect ratio preserved.
- The cover is never scaled beyond its stored resolution (stored covers are normalized to at most 800px longest side), so the larger display shows the image at its clearest without upscaling artifacts.
- The dialog layout adapts (cover column and text column) so the larger cover does not break the detail's title/tags/meta/actions stacking, including on narrow viewports.
- No image viewer/lightbox is added; grid thumbnails and the form cover preview keep their current sizes (explicitly out of scope per the request decision).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `movie-data-ui`: Adds a requirement for how the entry detail dialog presents the cover image — large, uncropped, aspect-preserving, capped at stored resolution — which the current spec does not constrain.

## Impact

- `styles.css`: `.movie-data-detail .movie-data-cover` fixed 140px/120px rules and the mobile media query.
- `src/ui/components/EntityDetail.tsx`: possible structural tweaks to the detail layout for movie and actor dialogs (shared by both).
- Tests: `test/ui-dialogs.test.tsx` (detail dialog assertions) may need a case for the larger cover presentation.
- No changes to storage, normalization (`src/coverImage.ts`), the store, grid, or forms.
