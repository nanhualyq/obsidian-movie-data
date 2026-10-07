# Proposal: tag-input-with-history

## Why

The movie form's tags field is a free-text input requiring comma-separated entry: it forces re-typing tags that already exist in the library (the top ~10 recurring tags are typed out on every movie), invites separator typos (half-width vs. full-width commas, trailing commas), and hides history that the list view already computes for its tag chips.

## What Changes

- Replace the comma-separated tags text field in the movie form with a chip-based tag input:
  - Selected tags render as removable chips; no separators are ever typed.
  - Focusing the input opens a suggestion dropdown of historical tags ordered by usage frequency (top 10), with the first entry pre-highlighted, so the most common tag is reachable with focus + Enter and zero typing.
  - Typing filters suggestions by case-insensitive substring (frequency order preserved) as a secondary path for less-used tags.
  - Keyboard-first controls: Arrow keys move the highlight, Enter commits the highlighted suggestion (or the typed text if nothing is highlighted), Escape closes the dropdown, Backspace on an empty input removes the last chip. Tab is not bound.
  - Deduplication is case-insensitive; a chip reuses the existing tag's exact casing.
  - Pasting text containing commas still splits into multiple tags (comma survives only as a paste delimiter).
  - Cold start (no tags exist yet): the dropdown shows a placeholder prompting the user to type, not an empty box.
- Extract the tag-frequency computation into a shared pure function so the form's suggestions and the list's tag chips derive from identical data (no drift between the two views).
- No component library is introduced; the widget is hand-rolled.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `openspec/specs/movie-data-ui/spec.md`: adds a requirement for chip-based tag entry in the movie form (suggestion dropdown contents and ordering, keyboard interaction, deduplication, paste behavior), replacing the implicit comma-separated text entry.

## Impact

- **Code**: `src/ui/components/MovieForm.tsx` (tags state becomes `string[]`, save path drops `split(",")`), new `src/ui/components/TagInput.tsx`, `src/ui/state.ts` (shared tag-frequency helper), `src/ui/components/ListView.tsx` (reuse the shared helper for its chips), `styles.css` (chip/dropdown styles; first absolutely-positioned popup in the codebase).
- **Data**: no storage or schema change; `Movie.tags` stays `string[]`.
- **Dependencies**: none added; `TagFilter`, `ActorSelect`, and all other form fields unchanged.
- **Tests**: existing form tests covering comma-splitting (if any) need updating; new tests for the tag-frequency helper and TagInput interaction.
