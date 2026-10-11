## 1. Dialog infrastructure

- [x] 1.1 Create a shared `Dialog` wrapper component (src/ui/components/Dialog.tsx): mounts a `<dialog>`, calls `showModal()` on mount with feature-detect fallback to `el.open = true` (design D3), `close()` in effect cleanup, `preventDefault()`s the `cancel` event and routes it to an `onDismiss` callback, and treats backdrop clicks (`e.target === dialogEl`, single body wrapper child) as dismissal — verify with unit tests firing `fireEvent.cancel` and backdrop `fireEvent.click` (dialog stays open when `preventDefault` path not taken; content queries succeed via the `open` fallback under jsdom)
- [x] 1.2 Add dialog styling to styles.css (`::backdrop`, centered `max-height`/`max-width` in viewport units, full-width minus margin on mobile, `overflow: hidden` with inner scroll body per design D5) — verify `npm run build` succeeds and the rules are present under a `.movie-data-dialog` class

## 2. Dialog stack state model

- [x] 2.1 Replace `Mode` with the `Overlay` stack in src/ui/state.ts and App.tsx (design D1): `push`/`pop`/`clearStack` helpers, invariant of at most one detail plus one form above it — verify `npx tsc -noEmit -skipLibCheck` passes and `npm test` shows no type regressions
- [x] 2.2 Rewire App rendering: ListView always mounted underneath; overlays map rendered as stacked dialogs; `commit` pops one level, `remove` clears the stack, cancel path discards staged covers then pops — verify existing save/cancel/delete tests pass after section 5 updates

## 3. Detail dialog

- [x] 3.1 Create the detail dialog component (view-only: cover, title/name, tags, actor names, URL, info; Edit + Close actions; entity resolved by id from `data` at render time so it shows post-save values) — verify a new test: click cell opens detail showing saved values with no edit form open
- [x] 3.2 Wire entry clicks in ListView to push the detail overlay (not the form), and Edit inside detail to push the form stacked above it — verify tests: "Edit stacks above detail" and "Close returns to the list" (list unchanged, nothing written)
- [x] 3.3 Keep the actors-list jump action bypassing the detail dialog — verify the existing jump tests still pass with a regression assertion that no dialog opens

## 4. Form dismissal semantics

- [x] 4.1 Add-form opens directly from the toolbar (push form onto an empty stack), edit-form only reachable from detail — verify test: toolbar add opens form dialog with no detail beneath; cancel closes to list
- [x] 4.2 Save pops one level: add-save closes to list; edit-save closes to detail showing updated values — verify tests for both spec scenarios ("Save from add returns to the list", "Save from edit returns to refreshed detail")
- [x] 4.3 Cancel/Escape/backdrop on a form pop one level and run `discardStaged()`; on detail they pop to list; Delete clears the whole stack — verify tests: Escape on add form discards staged cover and writes nothing; Escape on stacked edit leaves detail open; delete returns to list with entity gone
- [x] 4.4 Regression: Escape with the tag suggestion dropdown open closes only the dropdown (TagInput's `preventDefault` suppresses dialog dismissal) — verify test fires Escape with dropdown open and asserts the dialog remains open

## 5. Update existing tests

- [x] 5.1 Insert the extra "click Edit in detail dialog" step at the ~10 `click(cells()[...])` sites across ui.test.tsx, ui-delete.test.tsx, ui-forms.test.tsx, ui-remove-cover.test.tsx — verify `npm test` passes
- [x] 5.2 Invert assertions that relied on the list unmounting while a form is open (e.g., ui.test.tsx "list unmounts") to assert the list stays mounted under the dialog — verify `npm test` passes
- [x] 5.3 Check test/live-e2e.mjs for click-cell-to-form assumptions and update its flow — verify `npm run test:live` passes against a real Obsidian instance (also smoke-checks real `showModal` layering, focus return, and dropdown clipping per design risks)

## 6. Final verification

- [x] 6.1 Run full gate: `npm test` and `npm run build` both green
- [x] 6.2 Run `openspec validate add-detail-and-dialog-flows --strict` and confirm zero errors
