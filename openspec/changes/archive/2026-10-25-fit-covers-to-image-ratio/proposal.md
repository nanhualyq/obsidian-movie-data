## Why

Covers in the grid render too small, and the dominant cover ratio in real use is landscape (video screenshots for movies, square-ish avatars for actors) — not the portrait 2:3 poster the current frame assumes. The fixed `2 / 3` frame plus a narrow `minmax(140px, ...)` column squeezes a 4:3 landscape screenshot into roughly a third of the cell's height, so most of the image area is wasted and covers read as tiny thumbnails. This matches user feedback: grid covers are too small and most images are landscape.

## What Changes

- **Movies grid**: cover frame changes from `2 / 3` to `4 / 3`; column min-width grows from `140px` to ~`200px`.
- **Actors grid**: cover frame changes from `2 / 3` to `1 / 1` (square, matches avatars); column min-width grows to ~`150px`.
- **Form cover preview** (`CoverPicker` / `CoverImage` with `preview`): no longer a fixed cropped `2 / 3` box. It adopts the per-entity ratio (`4 / 3` for movies, `1 / 1` for actors) and switches from `object-fit: cover` (crop) to `contain` (no crop), staying consistent with the grid's no-crop principle.
- `CoverImage` gains a ratio/kind input so the preview can vary by entity type; `CoverPicker` and both forms (`MovieForm`, `ActorForm`) pass their entity kind through.
- Grid container gains a per-view variant class (movies vs. actors) so each view selects its own frame ratio and column width.
- Detail-dialog enlarged cover is already image-driven and stays unchanged.
- No changes to storage format, cover normalization, `.mcov` encoding, or any data/persistence behavior.

`object-fit: contain` is preserved everywhere (no cropping) per the standing "don't crop covers" decision; only the frame ratio and sizing change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — pure visual/implementation change; specs never assume an aspect ratio, so no requirement-level behavior changes)

## Impact

- **Code:** `styles.css` (grid column width + two frame-ratio variants + preview variant), `src/ui/components/CoverImage.tsx` (ratio/kind param), `src/ui/components/CoverPicker.tsx` (accept and forward entity kind), `src/ui/components/MovieForm.tsx` / `ActorForm.tsx` (pass entity kind), and the grid container component (`MovieGrid.tsx` / its caller in `App.tsx` or `ListView.tsx`) to set the per-view variant class.
- **APIs/dependencies:** none added.
- **Systems:** display layer only; storage, cover pipeline, and detail dialog unaffected.
