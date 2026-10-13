## 1. Suggestion list derivation (spec: Suggestion dropdown from tag history)

- [x] 1.1 Exclude chips already present (`value`, case-insensitive) from the suggestion `matches` in `src/ui/components/TagInput.tsx`, applying exclusion before the query filter and the top-10 cap; verify with a new test: an already-chipped historical tag never appears in the dropdown, with or without typed text
- [x] 1.2 Add a test for cap-after-exclusion: with chips covering some of the top 10 historical tags, focus opens the dropdown with up to 10 pickable rows reaching beyond rank 10 in frequency order
- [x] 1.3 Unify the duplicated filter logic (memoized `matches` vs. the inline copy in `onTextChange`) into one source of truth per design D3; verify `npm test` still passes with no behavior change beyond 1.1/1.2

## 2. Open-on-commit state machine (spec: Keyboard-first tag entry)

- [x] 2.1 Change `commit()` in `src/ui/components/TagInput.tsx` so Enter no longer closes the dropdown: clear `inputText`, keep `open`, and set `activeIdx` to 0 when the post-reset `matches` is non-empty (else -1), per design D1/D4; verify existing Enter tests are updated to expect the listbox still present (`aria-expanded="true"`) after commit
- [x] 2.2 Apply the same keep-open post-commit state to the click-on-row selection path (`onClick`), which currently closes the dropdown; verify a new test: clicking a suggestion leaves the dropdown open with the next suggestion highlighted
- [x] 2.3 Add a test for consecutive Enters: focus + Enter + Enter adds the two most-used distinct tags as chips, highlight advances, no blur/refocus; also cover the terminal state (all suggestions chipped → Enter is a safe no-op)
- [x] 2.4 Verify Escape and blur still close the dropdown keeping state (existing tests) and that the zero-typing path (focus + Enter adds top tag) still passes unchanged

## 3. Verification sweep

- [x] 3.1 Audit `test/tag-input.test.tsx`, `test/ui-forms.test.tsx`, and `test/ui-dialogs.test.tsx` for assertions assuming the dropdown closes after Enter (including the dialog-Escape-closes-dropdown-first scenario) and update them to the new semantics
- [x] 3.2 Run `npm test` (vitest) and `npm run build` (tsc + esbuild) — both green
- [x] 3.3 Run `openspec validate "keep-tag-dropdown-open-after-enter"` and confirm the delta spec passes
