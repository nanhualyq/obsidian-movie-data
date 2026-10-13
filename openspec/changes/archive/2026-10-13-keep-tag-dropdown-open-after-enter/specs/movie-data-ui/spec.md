## MODIFIED Requirements

### Requirement: Suggestion dropdown from tag history
Focusing the tags input SHALL open a suggestion dropdown listing historical tags (the union of tags across all saved movies) that are not already present as chips on the field, ordered by descending usage frequency with alphabetical tie-break, capped at 10 entries after excluding chips already present, with the first entry pre-highlighted. Typing SHALL filter the list by case-insensitive substring match while preserving frequency order, still excluding tags already present as chips. When no tags exist yet, the dropdown SHALL show a placeholder prompting the user to type to create the first tag rather than an empty list. Selecting a suggestion SHALL add it as a chip.

#### Scenario: Zero-typing selection of the top tag
- **WHEN** the user focuses the tags input (dropdown opens with the most-used tag highlighted) and presses Enter
- THEN the most frequently used tag is added as a chip without any typing

#### Scenario: Filter by typing
- **WHEN** the user types a partial tag name while the dropdown is open
- THEN only historical tags containing the typed text (case-insensitive) remain listed, in frequency order

#### Scenario: Cold start
- **WHEN** the user focuses the tags input of a form while no movie in the library has any tag
- THEN the dropdown shows a placeholder message instead of an empty box

#### Scenario: History reflects all movies
- **WHEN** two movies carry overlapping tags with different frequencies
- THEN the dropdown lists each distinct tag once, ordered by its total count across movies

#### Scenario: Suggestions exclude existing chips
- **WHEN** the field already has a chip for a historical tag and the dropdown is open
- THEN that tag does not appear among the suggestions, regardless of typed text

#### Scenario: Cap counts pickable suggestions only
- **WHEN** the field has chips for several of the top 10 historical tags and the dropdown opens without typed text
- THEN the dropdown lists up to 10 suggestions excluding the chipped tags, reaching further down the frequency-ordered history as needed

### Requirement: Keyboard-first tag entry
The tags field SHALL be operable without a mouse. While the dropdown is open: Arrow Down and Arrow Up SHALL move the highlight (wrapping at the ends) without altering the typed text; Enter SHALL add the highlighted suggestion, or the typed text when no suggestion is highlighted, and SHALL keep the dropdown open afterward with the input cleared and the first remaining suggestion highlighted; Escape SHALL close the dropdown while keeping the typed text. When the input is empty, nothing is highlighted, and it is the only focus target, Enter SHALL add nothing (a safe no-op). Tab SHALL NOT be bound to any tag-input action and SHALL keep its default behavior. The dropdown SHALL close on blur without discarding typed text or chips.

#### Scenario: Navigate with arrow keys
- **WHEN** the user presses Arrow Down repeatedly with the dropdown open
- THEN the highlight moves down the list and wraps back to the top after the last entry

#### Scenario: Enter commits typed text when nothing is highlighted
- **WHEN** the user types text that matches no historical tag and presses Enter
- THEN the typed text is added as a new chip

#### Scenario: Consecutive Enters add successive suggestions
- **WHEN** the user presses Enter repeatedly with the dropdown open and an empty input
- THEN each press adds the currently highlighted suggestion as a chip, and the highlight advances to the next suggestion not already present as a chip, until no suggestions remain

#### Scenario: Dropdown stays open after a commit
- **WHEN** the user adds a tag with Enter (suggestion or typed text) and does not press Escape or leave the input
- THEN the dropdown remains open with an empty input and the first remaining suggestion highlighted — no blur/refocus is needed to pick another tag

#### Scenario: Escape closes but preserves input
- **WHEN** the user presses Escape while the dropdown is open with text typed
- THEN the dropdown closes and the typed text remains in the input

#### Scenario: Tab moves focus normally
- **WHEN** the user presses Tab in the tags input
- THEN focus moves to the next form control; no tag is added or completed
