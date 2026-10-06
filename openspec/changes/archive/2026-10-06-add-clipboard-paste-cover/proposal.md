## Why

Cover images can currently only be added by picking a file from disk, but the most common source for covers (e.g. screenshots or images copied from a browser) is already on the clipboard. Forcing a detour through "save to disk, then pick the file" is an unnecessary friction in the edit form.

## What Changes

- The cover picker accepts a pasted image: when focus is inside the cover field and the user pastes (Ctrl/Cmd+V) with an image in the clipboard, the image is staged exactly as if it had been picked from disk (same deform-and-preview flow, same save path).
- Pasting inside the cover field while the clipboard contains no image does nothing (text paste is not hijacked elsewhere in the form; the listener is scoped to the cover field only).
- No new dependency; the clipboard is read via the standard `paste` event (`clipboardData.files`).
- No drag & drop support (explicitly out of scope).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `movie-data-ui`: The cover picker requirement gains clipboard paste as a second input source alongside choosing a file; behavior for staging, preview, save, and cancel stays unchanged.

## Impact

- Affected code: `src/ui/components/CoverPicker.tsx` (paste listener + shared image-bytes handler; small refactor of the existing `onPick` body). No changes to `src/store.ts` — `stageCover()` already accepts arbitrary image bytes.
- Tests: `test/` gains coverage for the paste path (image staged, non-image paste ignored).
- Dependencies: none added.
- Specs: delta for `openspec/specs/movie-data-ui/spec.md`.
