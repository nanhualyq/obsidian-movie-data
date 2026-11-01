# Tasks: add-movie-sort-toggle

## 1. State and ordering logic

- [x] 1.1 Add `sortMode: "newest" | "random"` and `shuffleSeed: number` to the
      `ListState` interface in `src/ui/state.ts`, and extend the `EMPTY_LIST`
      constant in `src/ui/App.tsx` with the defaults (`sortMode: "newest"`, an
      initial `shuffleSeed`). Verify the project typechecks (`npx tsc --noEmit`).
- [x] 1.2 Implement a seeded PRNG (mulberry32) and a Fisher-Yates shuffle helper
      in `src/ui/state.ts`. Verify with a unit test that the same seed yields an
      identical permutation across calls and that a different seed yields a
      different permutation.
- [x] 1.3 Update `computeResults` in `src/ui/state.ts` so the movies branch
      establishes order first — seeded shuffle by `shuffleSeed` when
      `sortMode === "random"`, newest-first otherwise — then applies tag/actor
      filters; leave the actors branch newest-first (ignore the sort fields).
      Verify existing `test/state.test.ts` ordering tests still pass.
- [x] 1.4 Add state tests in `test/state.test.ts`: (a) random mode with a pinned
      seed produces the expected stable order; (b) narrowing filters in random
      mode returns a stable subset (no reshuffle); (c) the actors branch is
      newest-first regardless of `sortMode`. Verify `npx vitest run test/state.test.ts`.

## 2. Toolbar toggle and wiring

- [x] 2.1 Render a two-state sort toggle in `src/ui/components/Toolbar.tsx` for
      the movies view only (no control in the actors view), showing the current
      mode and invoking a change handler on activation. Verify by component test
      or manual render that the control is absent for `view === "actors"`.
- [x] 2.2 Wire the handler in `src/ui/components/ListView.tsx`: entering random
      sets `sortMode: "random"` with a fresh `shuffleSeed`; returning sets
      `sortMode: "newest"` (seed untouched). Confirm the existing
      `useMemo(..., [data, list, view])` picks up the change (no wiring change
      needed). Verify toggling re-derives the order.
- [x] 2.3 Add toggle styling in `styles.css` consistent with existing toolbar
      controls. Verify the toggle renders correctly in the movies toolbar.

## 3. UI integration tests

- [x] 3.1 Add UI tests in `test/ui.test.tsx`: toggling to random changes the
      movies order; toggling back to newest-first and into random again reshuffles;
      changing a tag chip / page while random does not reshuffle; the Actors tab
      shows no toggle and stays newest-first; the mode resets to newest-first on a
      fresh mount. Verify `npx vitest run test/ui.test.tsx`.

## 4. Full verification

- [x] 4.1 Run the whole suite (`npx vitest run`) and confirm no regressions across
      ordering, toggle, and existing UI/storage tests.
