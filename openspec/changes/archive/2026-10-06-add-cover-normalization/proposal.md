# Add Cover Normalization

## Why

Cover images are stored exactly as picked: a phone photo arrives at 4000x3000 / 3-6 MB and is written verbatim to `.movie-data/covers/`, even though covers are only ever rendered at ~140-190 CSS px in the grid and 120 px in the form. This inflates vault size and slows every sync/backup cycle for no viewing benefit. The use case is on-screen browsing, not print.

## What Changes

- **New: normalize covers before staging.** When an image is picked or pasted into the cover field, it is downscaled proportionally so its longest side is at most 800 px (never upscaled), re-encoded as JPEG (quality ~0.82) using the browser's native canvas APIs (no new dependencies), and only then staged/saved. On any decode/encode failure, or when the image already fits within the cap, the original bytes are staged unchanged — normalization must never block saving.
- **New: covers render uncropped in the grid.** Grid card covers switch from `object-fit: cover` (crops to the fixed 2:3 frame) to `object-fit: contain` (whole image visible inside the same frame). Posters (2:3) look identical; other ratios gain letterboxing instead of cropping.
- **Unchanged (explicitly out of scope):** existing `.mcov` files on disk are never rewritten (normalization applies only to newly saved covers); the form's 120 px preview keeps its current cropped display; the store layer (`.mcov` stamping/decoding, prefix, extension, explicit-save persistence) stays byte-oriented and format-agnostic.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `movie-data-storage`: The "Cover images are deformed" requirement currently mandates storing "the unmodified original image bytes"; it must be revised so covers are size-normalized (proportional downscale to longest side <= 800, re-encoded) before stamping, with scenarios for downscaling, pass-through of already-small images, and failure fallback to original bytes. The deformation requirement itself (prefix + non-image extension, format-agnostic decode) is unchanged.

## Impact

- **Code:** new normalization module (e.g. `src/coverImage.ts`); `src/ui/components/CoverPicker.tsx` (`handleImageFile`, the shared pick/paste entry point) awaits it before `store.stageCover`; `styles.css` (`.movie-data-cover img` `cover` → `contain`). `src/store.ts` unchanged.
- **Specs:** delta for `openspec/specs/movie-data-storage/spec.md`. No `movie-data-ui` delta — that spec never assumes an aspect ratio; the grid display change is below spec level and recorded in design.md.
- **Tests:** existing store/UI tests unaffected (store API unchanged; jsdom lacks canvas so normalization exercises its fallback path); new unit tests for the normalization rule and fallback behavior.
- **Dependencies:** none added (Chromium `createImageBitmap` + canvas + `toBlob`).
- **Data:** old covers remain large until individually re-saved; new/changed covers shrink ~40-100x (e.g. 4-6 MB photo → ~90-130 KB).
