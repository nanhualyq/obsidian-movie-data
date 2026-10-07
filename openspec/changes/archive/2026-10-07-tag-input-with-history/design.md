# Design: tag-input-with-history

## Context

See proposal.md for motivation. Current state relevant to the approach:

- `MovieForm` holds `tagsText: string` and splits on `,` at save time (`src/ui/components/MovieForm.tsx`).
- `ListView` computes the union of movie tags inline in a `useMemo` to feed `TagFilter` (`src/ui/components/ListView.tsx`).
- The codebase is ~1,500 lines of TS/TSX + 213 lines CSS, dependencies are only `react` + `react-dom`, and the UI uses native controls (`select`, `input`, `button`) styled by `.movie-data-*` classes in `styles.css`.
- No absolutely-positioned popup exists anywhere in the codebase yet.
- `main.js` production bundle is ~156 KB, loaded at Obsidian startup.

## Goals / Non-Goals

**Goals:**

- Zero-typing selection of frequently used tags (focus + Enter).
- Full keyboard operability of the tags field.
- Single source of truth for tag history shared by form and list.

**Non-Goals:**

- No component library (see Decision 1).
- No changes to `TagFilter`, `ActorSelect`, storage format, or `Movie.tags` schema.
- No tag management UI (renaming/merging tags globally).
- No suggestion ordering preferences or caps configuration.

## Decisions

### D1: Hand-roll the widget; no component library

**Chosen:** implement `TagInput` as one component (~150 lines).

Alternatives considered:

- **Antd / MUI**: Element Plus is Vue-only and doesn't apply. React libraries (Antd) would add hundreds of KB to a startup-loaded Obsidian plugin bundle, inject global reset/theme styles that conflict with Obsidian's dark/light themes and other plugins, and serve exactly one widget out of a 60+ component library. The codebase is 1.5K lines with no design-system needs beyond this widget.
- **Native `<datalist>`**: cannot render chips, has inconsistent keyboard behavior across engines, no control over the pre-highlight on open.

### D2: Suggestion ordering and open state

**Chosen:** frequency descending, alphabetical tie-break, top 10 unfiltered; `activeIdx = 0` (first entry pre-highlighted) when the dropdown opens; substring case-insensitive filter preserves frequency order; `activeIdx` resets to 0 (or -1 if no matches) after each keystroke.

Rationale: the top ~10 tags cover most entries, so ordering is stable in practice (new tags sink, head is stable), making muscle memory reliable. Pre-highlight makes the common path focus + Enter. Alternatives: alphabetical ordering was rejected (typo-adjacent Enter commits a wrong-but-plausible tag, and it doesn't serve the frequency insight); never-auto-highlight was rejected because it costs an ArrowDown per suggested tag, reverting toward click-first UX.

### D3: State model

**Chosen:** `MovieForm` state becomes `tags: string[]`; `TagInput` is a controlled component (`value: string[]`, `onChange: (next: string[]) => void`). The save path drops `tagsText.split(...)` entirely.

Internal state of `TagInput`: `inputText: string`, `open: boolean`, `activeIdx: number`.

Event handling (single handler keyed on key + open state):

```
type        -> set inputText; refilter; activeIdx = matches.length ? 0 : -1; open = true
ArrowDown   -> activeIdx = (activeIdx + 1) % n        (wrap)
ArrowUp     -> activeIdx = (activeIdx - 1 + n) % n    (wrap)
Enter       -> if activeIdx >= 0: add matches[activeIdx]
               else if inputText.trim(): add typed text
               else: no-op
               then clear inputText, close dropdown
Escape      -> close, keep inputText
Tab         -> no binding (default behavior)
Backspace   -> empty input && chips.length: remove last chip
blur        -> close, keep inputText and chips
click row   -> same as Enter with that index
focus/click -> open
```

### D4: Deduplication and paste

**Chosen:** add-tag is idempotent case-insensitively — if an existing chip matches `trim().toLowerCase()`, the add is a no-op and the stored chip (its original casing) stays. Paste handler splits on `,` and `，` (half/full-width), trims, dedupes each piece through the same add path.

Rationale: full-width/half-width comma confusion was an original pain point; handling both on paste removes it while commas remain meaningless in typed input. Case-insensitive dedupe prevents tag-pool fragmentation, which would corrupt both `TagFilter` and the frequency ordering.

### D5: Shared tag history helper

**Chosen:** a pure function in `src/ui/state.ts`, e.g. `tagHistory(movies): { tag: string; count: number }[]` sorted by count desc then alphabetically. `ListView` derives its chip set from it (dedupe/order), `MovieForm` passes it to `TagInput` (which slices top 10 when unfiltered).

Rationale: mirrors the existing `ActorSelect` pattern — option lists are built in one place "so filter and form can never drift apart." `ListView`'s inline `useMemo` is replaced by a call to this helper.

### D6: Dropdown positioning

**Chosen:** `position: absolute` within the tags field container (`.movie-data-field` gains `position: relative`), no portal. 10 rows is a short dropdown; the form is scrollable if it approaches the viewport edge.

Alternative considered: a portal/flip-logic library (`popper`-style) — rejected as disproportionate; revisit only if clipping is actually observed.

## Risks / Trade-offs

- **[First absolute popup in the codebase may clip inside the view]** → keep the dropdown short (10 rows, max-height with overflow scroll); if clipping shows up in testing, add a simple upward flip before considering portals.
- **[Pre-highlighted first row means a fast Enter commits suggestion[0], not typed text, when text partially matches]** → accepted: with substring filter the first row is the best match by frequency; Escape offers an undo-free escape hatch (closes without committing). Mitigated further by dedupe making accidental re-adds harmless.
- **[Frequency counts shift as movies are added/deleted, so row positions can change]** → accepted by design (Decision D2): head of list is stable in practice; entries only move when data changes, not per form open.
- **[Keyboard handler conflicts (Enter submitting the form while dropdown open, arrow keys scrolling)]** → `preventDefault` on bound keys while dropdown is open; verify form-level submit behavior in tests.
- **[`styles.css` grows its first positioned component]** → follow existing `.movie-data-*` naming; reuse `.movie-data-tag` visual tokens for suggestion rows so chips and filter chips stay visually consistent without sharing components.

## Migration Plan

None — UI-only change over an unchanged schema. Rollback is reverting the code; saved data is format-identical (`string[]`) either way.

## Open Questions

None blocking. Deferrable: whether to later bind Tab to text-completion (would be additive, no spec change required unless made normative).
