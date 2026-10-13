## Why

After committing a tag with Enter, the tag suggestion dropdown closes (`commit()` sets `open = false`) while focus stays in the input, so `onFocus` never re-fires. Arrow keys become dead keys (`if (!open) return`) and Enter on the now-empty input is a no-op — the keyboard-only user is stuck and must blur/refocus (or type a character) before they can pick another suggestion. Selecting several tags from the list is a natural flow the current state machine (design D3: `commit -> close`) never supported.

## What Changes

- **Dropdown stays open after an Enter commit**: after adding a tag, the input clears but the dropdown remains open with the first remaining suggestion highlighted, until Escape or blur. The focus + Enter loop becomes "Enter, Enter, Enter" to walk down the frequency-ranked list.
- **Suggestions exclude tags already present as chips**: a suggestion row that matches an existing chip is dead (case-insensitive dedupe in `addTag` silently no-ops). Excluding chips from `matches` prevents the "commit keeps re-highlighting the tag you just added" stall and removes dead rows while typing.
- **Top-10 cap applies after chip exclusion**: the cap's intent is "show 10 pickable options", so chips are filtered out first, then the cap — a user who already holds 5 of the top 10 still sees 10 selectable rows.
- Spec-level changes to two existing requirements in `movie-data-ui` (dropdown open/close semantics and suggestion contents). No format, storage, or list-view changes.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `movie-data-ui`: "Suggestion dropdown from tag history" gains: suggestion list excludes tags already added as chips; the unfiltered top-10 cap applies after that exclusion. "Keyboard-first tag entry" gains: Enter commit keeps the dropdown open (highlighting the next suggestion) until Escape or blur; new scenario for consecutive Enter presses adding successive suggestions.

## Impact

- `src/ui/components/TagInput.tsx` — `commit()` no longer closes the dropdown; `matches` computation filters out `value` chips (before the cap), for both unfiltered and query-filtered paths.
- `openspec/specs/movie-data-ui/spec.md` — two requirements updated (via delta spec in this change).
- `test/tag-input.test.tsx` — existing tests asserting the dropdown closes after Enter need updating; new tests for consecutive Enter and chip exclusion.
- Archived design `2026-10-07-tag-input-with-history` (D3 state model) is superseded for the `commit` transition; noted in this change's design.md, archive left untouched.
