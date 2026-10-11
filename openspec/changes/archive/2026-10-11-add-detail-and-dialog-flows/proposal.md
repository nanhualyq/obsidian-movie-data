## Why

Clicking a list entry jumps straight into the edit form, replacing the whole list view — users cannot inspect an entity without entering edit mode, and every open/close round-trip throws away the list's scroll position and context. The plugin should show a read-only detail view first, and all overlays (detail, add, edit) should layer over the list as native HTML `<dialog>` elements instead of swapping the main interface.

## What Changes

- Clicking a list entry opens a **read-only detail dialog** (cover, title/name, tags, actors, URL, info) instead of the edit form. Actions: Edit, Close.
- **Edit** opens the entity's form as a second dialog **stacked on top of** the detail dialog; the list stays mounted underneath throughout.
- The two **add** flows (add movie, add actor) open their forms as a dialog over the list directly — no detail dialog for unsaved entities.
- **Pop semantics** for every close path:
  - Save/Cancel/Esc pop the top dialog: edit Save returns to the (refreshed) detail view, add Save returns to the list; Cancel writes nothing.
  - **Delete** pops the whole stack to the list (the detail would point at a removed entity).
  - Esc on a form dialog behaves as Cancel, including discarding staged covers.
- Forms and detail replace the current full-view swap (`mode`-driven exclusive rendering in `App`); the list is always mounted.
- Detail dialog is view-only: delete remains an action of the edit form only.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `movie-data-ui`: Entry selection opens a read-only detail dialog instead of an edit form; add/edit forms open as native `<dialog>` overlays stacked over the always-mounted list, with pop semantics for save/cancel/Esc/delete (including Esc discarding staged covers).

## Impact

- **Code**: `src/ui/App.tsx` (mode/stack state, always-mounted list, dialog rendering), `src/ui/state.ts` (`Mode` type gains a detail/stack shape), `src/ui/components/ListView.tsx` (click opens detail), new detail dialog component, `MovieForm`/`ActorForm` shells, `styles.css` (dialog styling, dropdown clipping inside dialogs).
- **Tests**: ~10 click-a-cell sites in `test/ui*.tsx` gain a "click Edit" step; new coverage for detail dialog, Esc, and stack pops. jsdom 30 lacks `dialog.showModal()` — needs a feature-detect fallback or test-setup polyfill.
- **Spec**: delta for `openspec/specs/movie-data-ui/spec.md` ("Add and edit forms" and related save/delete/cancel scenarios).
- **Dependencies**: none added — native `<dialog>` only (supported by Obsidian's Electron/Chromium and mobile WebViews).
