# Proposal: refactor-ui-to-react

## Why

The entire UI lives in one 431-line `src/view.ts` class that mixes state management, list rendering, forms, cover handling, and persistence — it is hard to read, hard to extend, and grows linearly with every new feature. Rewriting the view layer in React with a component/module structure makes the UI maintainable, testable with standard tooling, and ready for future features.

## What Changes

- Replace the imperative DOM-building UI (`MovieDataView` with `createEl`/manual re-render) with a React 18 component tree mounted inside the same `ItemView` shell.
- Split `view.ts` into focused modules under `src/ui/` (list, toolbar, tag filter, grid, cards, forms, cover picker, etc.).
- Move all application data (`movies`, `actors`, load error) out of `MovieStore` into React state; reshape `MovieStore` into a pure I/O layer (`load()` returns data, `save(data)` takes data). Cover staging and blob-URL caching stay in the store (resource lifecycle, not business data).
- Replace the FakeElement-based headless tests (`test/verify.ts`, `test/e2e.ts`) with vitest + jsdom + Testing Library, preserving the same scenario coverage. Adjust `test/live-e2e.mjs` where it reads data off the store.
- Add React toolchain dependencies and JSX compiler config; keep `styles.css` and all `.movie-data-*` class names unchanged.
- **No behavior changes**: explicit-save persistence, cancel-writes-nothing, cover deformation, search/filter semantics, and error states all stay exactly as specified in the existing specs.

## Capabilities

### New Capabilities

None — this is a pure implementation refactor.

### Modified Capabilities

None — no spec-level behavior changes; both existing specs (`movie-data-storage`, `movie-data-ui`) continue to describe the system as-is.

(Note: this change sets `skip_specs: true` because behavior is unchanged.)

## Impact

- **Source**: `src/view.ts` (removed/replaced), new `src/ui/**` modules; `src/store.ts` API reshape; `src/main.ts` wiring for initial load; `src/types.ts` unchanged.
- **Dependencies (runtime)**: + `react`, `react-dom` (~140 KB in `main.js`, ~45 KB gzipped).
- **Dependencies (dev)**: + `vitest`, `jsdom`, `@testing-library/react`, `@types/react`, `@types/react-dom`.
- **Config**: `tsconfig.json` (+ `"jsx": "react-jsx"`), `package.json` test scripts → vitest, `esbuild.config.mjs` (JSX handling).
- **Tests**: `test/verify.ts` and `test/e2e.ts` rewritten as vitest suites (store tests become plain node-compatible vitest tests; UI tests run in jsdom); `test/obsidian-stub.ts` shrinks to stubbing only what the store needs (vault adapter, `Notice`); `test/live-e2e.mjs` keeps its CSS-selector strategy but replaces `store.movies`/`store.actors` reads with file-based assertions.
- **Unchanged**: both spec files, `styles.css`, data format on disk (`.movie-data/` layout, JSON schema, `.mcov` cover format).
