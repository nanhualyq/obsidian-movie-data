## ADDED Requirements

### Requirement: Chip-based tag entry in the movie form
The movie form's tags field SHALL accept tags as removable chips rather than comma-separated text: the input SHALL never require the user to type a separator. The tags state SHALL be a list of tag strings; saving SHALL persist exactly the chips present, unchanged in format from the existing `Movie.tags` schema.

#### Scenario: Add a tag without separators
- **WHEN** the user types a tag name and presses Enter
- THEN a chip for that tag appears and the input clears, with no comma or other separator involved

#### Scenario: Remove a tag
- **WHEN** the user activates a chip's remove action, or presses Backspace while the input is empty and holds at least one chip
- THEN that chip is removed from the field

#### Scenario: Save and reload round-trip
- **WHEN** the user edits chips, saves, and reopens the form
- THEN the chips shown equal the saved `Movie.tags` list

### Requirement: Suggestion dropdown from tag history
Focusing the tags input SHALL open a suggestion dropdown listing historical tags (the union of tags across all saved movies), ordered by descending usage frequency with alphabetical tie-break, capped at 10 entries, with the first entry pre-highlighted. Typing SHALL filter the list by case-insensitive substring match while preserving frequency order. When no tags exist yet, the dropdown SHALL show a placeholder prompting the user to type to create the first tag rather than an empty list. Selecting a suggestion SHALL add it as a chip.

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

### Requirement: Keyboard-first tag entry
The tags field SHALL be operable without a mouse. While the dropdown is open: Arrow Down and Arrow Up SHALL move the highlight (wrapping at the ends) without altering the typed text; Enter SHALL add the highlighted suggestion, or the typed text when no suggestion is highlighted; Escape SHALL close the dropdown while keeping the typed text. When the input is empty and it is the only focus target, Enter SHALL add nothing (a safe no-op). Tab SHALL NOT be bound to any tag-input action and SHALL keep its default behavior. The dropdown SHALL also close on blur without discarding typed text or chips.

#### Scenario: Navigate with arrow keys
- **WHEN** the user presses Arrow Down repeatedly with the dropdown open
- THEN the highlight moves down the list and wraps back to the top after the last entry

#### Scenario: Enter commits typed text when nothing is highlighted
- **WHEN** the user types text that matches no historical tag and presses Enter
- THEN the typed text is added as a new chip

#### Scenario: Escape closes but preserves input
- **WHEN** the user presses Escape while the dropdown is open with text typed
- THEN the dropdown closes and the typed text remains in the input

#### Scenario: Tab moves focus normally
- **WHEN** the user presses Tab in the tags input
- THEN focus moves to the next form control; no tag is added or completed

### Requirement: Tag normalization on entry
Added tags SHALL be trimmed of surrounding whitespace and deduplicated case-insensitively: entering a tag that differs from an existing chip only by letter case SHALL NOT create a second chip, and a suggestion SHALL add with its stored casing. Pasted text SHALL be split on commas (both half- and full-width) into multiple tags, each trimmed; the comma is meaningful only on paste, never as typed input.

#### Scenario: Case-insensitive duplicate
- **WHEN** the chips already include "Drama" and the user types "drama" and presses Enter
- THEN no new chip is added (the existing "Drama" chip remains the only one)

#### Scenario: Paste multiple tags
- **WHEN** the user pastes "action, drama，thriller" into the input
- THEN three chips are created: "action", "drama", "thriller"

#### Scenario: Whitespace trimmed
- **WHEN** the user types "  comedy  " and presses Enter
- THEN a chip labeled "comedy" is added

### Requirement: Tag entry and tag filter share one history source
The suggestion dropdown's history and the list view's tag chips SHALL derive from the same tag data over all saved movies, so a tag visible in one is always available in the other. The dropdown's frequency counts SHALL count each occurrence of a tag across movies.

#### Scenario: No drift between form and list
- **WHEN** the list view's tag chips show a tag
- THEN focusing the movie form's tags input reveals the same tag among the suggestions (subject to the top-10 cap when unfiltered)
