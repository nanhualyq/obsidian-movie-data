# Tasks: tag-input-with-history

## 1. Shared tag history

- [x] 1.1 Add a pure `tagHistory(movies)` helper to `src/ui/state.ts` returning distinct tags with occurrence counts, sorted count-desc then alphabetically, and unit-test it (overlapping tags across movies, alphabetical ties, empty input)
- [x] 1.2 Reuse `tagHistory` in `src/ui/components/ListView.tsx` to derive the `TagFilter` chip list (replacing the inline `useMemo` union) and verify existing tag-filter tests in `test/ui.test.tsx` still pass

## 2. TagInput component

- [x] 2.1 Create `src/ui/components/TagInput.tsx` as a controlled component (`value: string[]`, `onChange`) rendering removable chips plus text input, with case-insensitive trim/dedupe on add (existing chip's casing wins), and verify chip add/remove/dedupe behavior with tests
- [x] 2.2 Implement the suggestion dropdown: opens on focus, shows top-10 from `tagHistory` with `activeIdx = 0` pre-highlighted, substring case-insensitive filtering preserves frequency order, cold-start placeholder when no tags exist (per specs "Suggestion dropdown from tag history")
- [x] 2.3 Implement keyboard handling per design D3: Arrow wrap navigation without changing input text, Enter adds highlighted suggestion / typed text / no-op when empty, Escape closes keeping text, Backspace on empty input removes last chip, Tab unbound, blur closes keeping state — verify each with keyboard tests (`userEvent`)
- [x] 2.4 Implement paste handling: split on half- and full-width commas, trim, dedupe each piece through the add path; verify with a paste test producing three chips from `"action, drama，thriller"`
- [x] 2.5 Add dropdown/chip styles to `styles.css` (`.movie-data-field` gets `position: relative`; suggestion rows reuse `.movie-data-tag` visual tokens) and verify the dropdown renders positioned under the input in the jsdom tests (class/structure assertions)

## 3. MovieForm integration

- [x] 3.1 Replace the `tagsText` field in `src/ui/components/MovieForm.tsx` with `tags: string[]` state wired to `TagInput`; drop `split(",")` from the save path; keep the label accurate (no more "comma-separated")
- [x] 3.2 Update existing tests that type comma-separated tags (`test/ui-forms.test.tsx`: "save persists movie: parsed tags", "empty tags dropped") to drive the chip input instead, and verify the full suite (`npm test`) plus `npm run build` (tsc + esbuild) pass

## 4. Verification

- [x] 4.1 Manual smoke check against every scenario in `openspec/changes/tag-input-with-history/specs/movie-data-ui/spec.md` (zero-typing top-tag pick, arrow/Enter/Escape/Tab semantics, case-insensitive duplicate, paste split, cold start, form/list history parity) using `npm run dev` + `npm run deploy:copy` into a test vault; record any deviations
