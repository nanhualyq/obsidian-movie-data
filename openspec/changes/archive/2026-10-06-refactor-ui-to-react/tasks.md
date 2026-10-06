# Tasks: refactor-ui-to-react

## 1. Toolchain setup

- [x] 1.1 Add dev/runtime dependencies (`react`, `react-dom`, `@types/react`, `@types/react-dom`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`) and verify `npm install` succeeds
- [x] 1.2 Enable JSX: add `"jsx": "react-jsx"` to `tsconfig.json`, extend `include` to `src/**/*.tsx`, and verify `npx tsc -noEmit -skipLibCheck` passes on a smoke `.tsx` file
- [x] 1.3 Add `vitest.config.ts` with jsdom environment + setup file (polyfill `URL.createObjectURL`/`revokeObjectURL`), wire `npm test` to vitest, and verify an empty suite runs green
- [x] 1.4 Verify esbuild production build still emits `main.js` (`npm run build`) with JSX entries

## 2. Store reshape (pure I/O)

- [x] 2.1 Reshape `MovieStore`: `load()` returns `{ ok, data }` / `{ ok: false }`, `save(data)` accepts data, remove `data`/`movies`/`actors`/`actorById`/`loadError`; keep cover staging and blob-URL cache — verify `npx tsc -noEmit -skipLibCheck` reports errors only in `view.ts`/`main.ts` (expected, fixed in tasks 3–4)
- [x] 2.2 Update `src/main.ts` wiring for the new `load()` signature (no data caching on the plugin) and verify tsc errors in `main.ts` are gone
- [x] 2.3 Create vitest store suite porting store-level assertions from `test/verify.ts` (ensure creates layout, load parses/flags corrupt JSON, save writes covers-before-JSON, cover decode cache, stamp/decode round-trip) and verify `npm test` passes them
- [x] 2.4 Shrink `test/obsidian-stub.ts` to vault-adapter stub + `Notice` only, referenced via vitest alias, and verify store suite still passes without `FakeElement`

## 3. React shell + list path

- [x] 3.1 Rewrite `src/view.ts` as a thin shell: mount a React root in `onOpen`, unmount in `onClose`, keep `VIEW_TYPE_MOVIE_DATA` and display/title methods — verify tsc passes with a placeholder `App`
- [x] 3.2 Implement `src/ui/App.tsx` with state per design D2/D3 (`status`, `data`, `mode`, `listState`) and load-in-effect; implement error screen for `status: "error"` — verify corrupt-JSON scenario renders the load-error UI in a vitest UI test
- [x] 3.3 Implement list path components (`ListView`, `Toolbar`, `TagFilter`, `MovieGrid`, `MovieCard`, `CoverImage` + `useCoverUrl`, `EmptyState`) reusing existing `.movie-data-*` classes — verify grid render, corrupt-cover placeholder, and valid-cover `<img>` scenarios pass in vitest
- [x] 3.4 Implement search / tag filter / entity switch behavior with `listState` lifted to `App` — verify search-by-actor-name, no-results empty state, tag filter, and actor/movie switch scenarios pass; verify search text survives an open-and-cancel form round-trip

## 4. Forms + persistence path

- [x] 4.1 Implement shared form primitives (`Field`, `FormButtons`, `CoverPicker`, `ActorSelect`) and `MovieForm` with sequential save (D4: `await store.save(next)` → `setData` → back to list; failure → Notice, stay in form) — verify add-movie scenario: cancel writes nothing (JSON + no staged cover), save persists with parsed tags and deformed cover bytes
- [x] 4.2 Implement `ActorForm` — verify edit-actor scenario: edited in place, movies reference by id, search by new actor name finds referencing movie
- [x] 4.3 Port remaining `verify.ts`/`e2e.ts` scenarios to vitest until coverage parity checklist is complete; verify full `npm test` green
- [x] 4.4 Delete `test/verify.ts`, `test/e2e.ts`, and `FakeElement` from the stub after parity is confirmed — verify no imports reference them and `npm test` still passes

## 5. Live E2E + final verification

- [x] 5.1 Spike: run `test/live-e2e.mjs` early against the React build to confirm native `input` event dispatch reaches React's controlled search input (design risk); if not, adjust the driver to use the native value setter — verify search assertions in live-e2e pass
- [x] 5.2 Replace `store.actors`/`store.movies` reads in `test/live-e2e.mjs` with assertions against `.movie-data/movies.json` — verify the full live suite passes against a real Obsidian instance
- [x] 5.3 Run `npm run build && npm test` and confirm both spec files are untouched (`git diff --stat openspec/specs` empty) — verify all suites green and behavior unchanged
