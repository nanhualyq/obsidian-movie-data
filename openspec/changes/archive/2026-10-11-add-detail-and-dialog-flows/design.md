## Context

`App` currently owns a flat `Mode` union (`list | movie-form | actor-form`) and renders exactly one of list/form — a form replaces the whole list view. See proposal.md for motivation. Constraints that shape this design:

- jsdom 30.1.2 (the test environment) exposes `HTMLDialogElement` but **not** `showModal()`/`close()` and never fires `cancel`/`close` events.
- `TagInput` already handles Escape with `preventDefault()` when its suggestion dropdown is open, which suppresses the native dialog-close request in Chromium.
- Decisions confirmed in exploration: stacked dialogs (detail is the anchor), view-only detail, pop semantics for Save/Cancel/Esc, Delete pops the whole stack, Escape closes forms as Cancel.

## Goals / Non-Goals

**Goals:**
- List stays mounted under all overlays; scroll/filter state survives open/close cycles.
- One consistent dismissal path: Save/Cancel/Esc/backdrop/Delete all reduce to pop / pop-all on a single dialog stack.
- Native `<dialog>` semantics: focus trap, focus return, backdrop, Escape — no hand-rolled equivalents.

**Non-Goals:**
- No data/schema changes; storage spec untouched.
- No Obsidian `Modal` class integration, no router/URL state, no swipe gestures.
- No cross-entity navigation from detail (e.g., clicking an actor name inside a movie detail stays view-only; the existing actors-list jump remains the only cross-jump).
- No changes to form field components (`TagInput`, `CoverPicker`, `ActorSelect`, ...) beyond where they are mounted.

## Decisions

### D1: Dialog stack replaces the flat `Mode`

```ts
type Overlay =
  | { kind: "detail";  entity: "movie" | "actor"; id: string }
  | { kind: "movie-form"; movie: Movie }   // draft snapshot at open time
  | { kind: "actor-form"; actor: Actor };

const [overlays, setOverlays] = useState<Overlay[]>([]);
```

Invariant: at most one `detail` (bottom), at most one form stacked above it. Rendering maps the stack in order — later elements mount later, so top-layer stacking matches.

All mutations funnel through three helpers in `App`:
- `push(overlay)` — open detail / open edit (from detail) / open add (from list).
- `pop()` — Save, Cancel, Escape, backdrop. For a form pop: `discardStaged()` first unless the save already committed.
- `clearStack()` — Delete (the detail below would reference a dead entity).

Alternative considered: keep the flat union and add `detail+form` compound kinds — rejected, every new transition doubles the state count and pop logic becomes untestable-by-construction.

**Detail resolves by id at render time** (`data` lookup), so a popped-back-to detail always shows post-save values with no extra refresh step. Forms keep the existing draft-snapshot pattern (local component state initializes once on mount).

### D2: Native `<dialog>` with `showModal()`, opened from an effect

A small shared `Dialog` wrapper owns the lifecycle: on mount call `showModal()`; in effect cleanup call `close()` (React state remains the source of truth — the dialog never closes itself). `cancel` (Escape) is `preventDefault()`ed and routed to `pop()`, keeping dismissal logic in exactly one place. Backdrop clicks are detected as `e.target === dialogEl` and routed to the same handler; the dialog body is a single child wrapper so padding clicks can't be misread as backdrop.

Alternatives considered:
- *Custom div overlay* — must reimplement focus trap, focus return, Escape; rejected, that is the exact complexity `<dialog>` gives free.
- *Obsidian's `Modal` class* — would mount outside the React root and require portaling React into Obsidian-managed DOM; rejected, breaks the "React owns all UI state (D2)" boundary this codebase already commits to.
- *Non-modal `show()`* — no backdrop, no focus trap, must implement both; rejected.

Backdrop dims the whole Obsidian window (top layer). Accepted: it matches Obsidian's own modals.

### D3: jsdom gap closed by feature detection, not a polyfill

```ts
if (typeof el.showModal === "function") el.showModal(); else el.open = true;
```

In jsdom, the `open` fallback keeps content queryable by Testing Library; tests trigger dismissal explicitly with `fireEvent.cancel(dialog)` / backdrop `fireEvent.click(dialog)`. Rationale over a `test/setup.ts` polyfill: the guard is one line, runs in production too (harmless), and avoids faking native events that jsdom cannot faithfully reproduce anyway (top-layer, focus behavior).

### D4: Escape layering with in-dialog overlays

Native Escape targets the top-most dialog. Inside it, `TagInput`'s existing `preventDefault()` on Escape (dropdown open) suppresses the close request — already implemented, only needs a regression test. The spec adds this scenario so the behavior is contractual, not incidental.

### D5: Dialog CSS scoped by class, sized for the pane

- `dialog.movie-data-dialog` — custom `::backdrop`, `max-height`/`max-width` in viewport units, centered; full-width minus small margin on mobile.
- Dialog uses `overflow: hidden` with an inner scrollable body so anchored dropdowns (tag suggestions, actor select) are not clipped by the UA's `overflow: auto` default on `<dialog>`.

## Risks / Trade-offs

- [jsdom never exercises real `showModal`/top-layer/focus-trap behavior] → the feature-detect branch in D3 means tests validate state machine + DOM presence, not native layering; mitigate with the `test:live` run against real Obsidian/Electron for smoke coverage of actual dialog behavior.
- [Dropdown clipping if the dialog body scrolls near a dropdown anchor] → D5's overflow layout; verify with a long-info movie in the live run.
- [Escape/backdrop discarding typed form input feels destructive] → accepted: identical to today's Cancel semantics, and the spec ties both to Cancel so behavior is uniform.
- [Clicking dialog padding registers as backdrop and closes] → single body wrapper + `target === dialog` check; covered by a unit test.
- [~10 existing tests assume click-cell → form] → mechanical `click Edit` insertion; any that assert "list unmounts" (e.g., `ui.test.tsx:437`) invert to "list stays mounted".
- [Double-close races: cancel event then unmount cleanup] → `close()` in cleanup is idempotent; pop is a no-op on an empty stack.

## Migration Plan

UI-only change, no data migration. Ships as one change: state model + Dialog wrapper + detail component + form shells + spec-delta tests together — there is no sensible intermediate state where half the flows are dialogs.

## Open Questions

None — navigation model, detail contents, dismissal semantics, and backdrop behavior were all decided in exploration.
