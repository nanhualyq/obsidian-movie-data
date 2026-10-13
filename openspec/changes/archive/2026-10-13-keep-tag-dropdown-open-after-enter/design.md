## Context

`TagInput` (src/ui/components/TagInput.tsx) manages an `open` flag for the suggestion dropdown. Today `commit()` (Enter path) sets `open = false`, while focus stays in the input — so `onFocus` never re-fires and arrows/Enter become dead keys until the user blurs and refocuses (or types a character, which goes through `onTextChange`). The state machine in the archived `tag-input-with-history` design (D3) specifies `commit -> close`; this change replaces that transition.

A second, coupled fact: `matches` is derived from `history`, which comes from **saved** movies (`tagHistory(data.movies)`), while chips reflect the **current form state**. A freshly added chip keeps appearing as a suggestion, where `addTag`'s idempotent dedupe silently no-ops. If the dropdown stayed open without excluding chips, repeated Enter would re-highlight the tag just added and stall forever.

See proposal.md for motivation; specs define the required behavior.

## Goals / Non-Goals

**Goals:**
- Keyboard-only continuous selection: focus → Enter → Enter → Enter adds successive suggestions with no blur/refocus.
- One consistent post-commit state: input cleared, dropdown open, first remaining suggestion highlighted — regardless of whether Enter committed a suggestion or typed text.

**Non-Goals:**
- Changing history derivation, frequency ordering, or save flow (history still updates only on movie save).
- Changing click-to-select, paste splitting, dedupe rules, Escape/Tab/blur semantics.
- A "no matches for query" empty-state message (the dropdown already renders an empty list for non-matching queries today; unchanged).
- Editing the archived change under `openspec/changes/archive/`.

## Decisions

### D1: Keep the dropdown open on commit; close only on Escape or blur

`commit()` stops calling `setOpen(false)`; it only clears `inputText` and (when a suggestion was picked) leaves `open = true`. Escape and blur remain the sole close paths, so the open/close rule stays a single sentence: *"open from focus/typing; close on Escape/blur."*

**Alternatives rejected:**
- *Close unless the commit came from a suggestion* — split mental model ("typed text closes, picked row stays open"), more state branches, no user benefit.
- *Reopen only when the last commit added a suggestion* — same complexity; typing-created tags are then in a different state for no clear reason.
- *Keep D3 `commit -> close` and rely on typing to reopen* — this is the status quo and the reported problem: arrow keys are dead and empty-input Enter is a no-op, so the no-typing pick flow is stuck.

### D2: Exclude chips from `matches` before the top-10 cap

`matches` filters out entries whose tag case-insensitively equals any chip in `value`, then applies the query filter, then the cap (unfiltered path). Rationale: the cap's intent is "show 10 *pickable* options" (spec scenario: cap counts pickable suggestions only); filtering chips out first also guarantees the post-commit highlight always lands on an actually-addable row, which is what makes D1 safe.

**Alternatives rejected:**
- *Cap first, then exclude* — a user holding 5 of the top 10 sees only 5 rows; rows are wasted on tags that cannot be selected.
- *Keep dead rows, but advance `activeIdx` past chips* — more index bookkeeping for a strictly worse list; the "Drama" row you can't pick still renders while typing.

Chip exclusion also subsumes the old failure mode where typing an already-chipped tag showed a row whose Enter did nothing (the dedupe in `addTag` stays as a safety net; the "Case-insensitive duplicate" spec scenario still passes via typed text).

### D3: Single derivation of `matches` — one memo, one source

Today the filtering logic is written twice: the `useMemo` for `matches`, and an inline copy inside `onTextChange` used to pre-set `activeIdx`. With chip exclusion added, two copies would drift. Refactor so both the rendered list and the highlight pre-computation read the same memoized `matches` (e.g., a small helper or computing `activeIdx` from `matches` inside an effect / derived setter). This is an internal refactor with no observable behavior change beyond the spec deltas.

Concretely after commit: `setInputText("")`, keep `open`, `setActiveIdx(matchesAfterReset.length > 0 ? 0 : -1)` where the pool is the unfiltered (chip-excluded, capped) list — note `inputText` is being cleared, so the pool must not be computed from the stale query.

### D4: Highlight index under a mutating list

Chips are added without reordering history, so rows keep their relative order; the row for the just-committed tag disappears (D2), which shifts everything after it up by one. Resetting `activeIdx` to 0 on commit is correct and simple: the user is at the top of the "remaining pickable" list, and ArrowDown walks it. Preserving the previous index across the list mutation (skip-one semantics) was rejected — it highlights an arbitrary mid-list row after each commit and complicates wrap-around reasoning.

Edge cases:
- **All suggestions are chips / query matches nothing** → `matches` empty, dropdown open with an empty list (same rendering as today's non-matching query). Enter is the spec's safe no-op (empty input, no highlight).
- **Cold start (empty history)** → placeholder row still shown (`showPlaceholder` keys off `history.length === 0`); after committing the first typed tag, the placeholder remains until save refreshes history — pre-existing behavior, unchanged.
- **Click path** (`onClick` on a row) does the same reset as `commit()` — it currently closes the dropdown too; it must keep it open per the spec (the spec's post-commit state is source-independent).

## Risks / Trade-offs

- [Enter stays `preventDefault`-ed while the dropdown is open indefinitely] → Already the case whenever open; no form exists in this field (archived D3 noted this), and commit-keeps-open only extends the window in which Enter is captured by the input — which is the point. Verified by existing/updated tests around form behavior.
- [Dropdown floating over content while input is idle-open after commit] → Same visual state as focus-open today; closes on Escape/blur as before. Acceptable.
- [Cap-after-exclusion means adding chips can reveal tags ranked >10, so two movies' dropdowns differ even with the same history] → Already true whenever text is typed; the list remains deterministic given (history, chips, query).
- [Existing tests assert the dropdown closes after Enter] → Update those assertions to the new post-commit state; audit `test/tag-input.test.tsx` and `test/ui-forms.test.tsx` for `aria-expanded`/listbox presence expectations.

## Migration Plan

None — pure client-side behavior, no data or storage changes. Rollback is a code revert.

## Open Questions

None blocking. (The user-visible question of whether typing already reopened the dropdown is settled by code reading: `onTextChange` always reopens; the gap was the no-typing path, which this change fixes.)
