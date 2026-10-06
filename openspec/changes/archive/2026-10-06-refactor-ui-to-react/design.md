# Design: refactor-ui-to-react

## Context

`src/view.ts` (431 lines) is a single `ItemView` subclass that owns UI state (`mode`, `query`, `entityFilter`, `selectedTags`), builds DOM imperatively via Obsidian's `createEl`, reads and mutates `MovieStore.data` directly, and orchestrates persistence. The store (`src/store.ts`, 164 lines) mixes two responsibilities: business data ownership (`data`, `movies`/`actors` getters, `loadError`) and file I/O (JSON read/write, cover stamp/decode, staging, blob-URL cache).

Tests come in three layers: `test/verify.ts` + `test/e2e.ts` (headless, driving a `FakeElement` tree that mirrors Obsidian's `createEl`/`onclick` API), and `test/live-e2e.mjs` (CDP against real Obsidian, CSS-selector based).

Constraints: behavior described by `openspec/specs/movie-data-storage/spec.md` and `openspec/specs/movie-data-ui/spec.md` must not change (this change sets `skip_specs: true`); the on-disk format is fixed; `.movie-data-*` class names and `styles.css` stay as-is so `live-e2e.mjs` selectors survive.

## Goals / Non-Goals

**Goals:**

- UI rendered by React 18, split into small components under `src/ui/`.
- Business data lives in React state; `MovieStore` becomes a pure I/O layer.
- Same scenario coverage as today's tests, on vitest + jsdom + Testing Library.
- Identical observable behavior (specs unchanged).

**Non-Goals:**

- No visual redesign, no CSS/class renames, no new UI features.
- No change to the on-disk format, cover deformation scheme, or explicit-save semantics.
- No state-management library (Redux/Zustand/etc.) — React state only.
- No changes to `movie-data-storage` or `movie-data-ui` spec requirements.

## Decisions

### D1: Data ownership — React state, store as pure I/O (chosen over "external store subscription")

`MovieStore` sheds `data`, `movies`, `actors`, `actorById`, `loadError` and exposes:

```ts
load(): Promise<{ ok: true; data: MovieStoreData } | { ok: false }>
save(data: MovieStoreData): Promise<void>   // flushes staged covers, then writes JSON
stageCover(entityId, bytes): { filename, previewUrl }
discardStaged(): void
coverUrl(filename): Promise<string | null>
unload(): void
```

Cover staging (`pendingCovers`) and the blob-URL cache stay in the store: they are resource lifecycles (paired `revokeObjectURL`), not business data, and `save(data)` flushing them preserves the explicit-persistence contract.

*Alternative considered:* adding `subscribe/emit` to the store and reading it via `useSyncExternalStore` — smaller diff, but leaves the store as a second source of truth, which is exactly the coupling this refactor removes. Rejected per user decision (option B).

### D2: State ownership and lifting

```
App.tsx
  status: "loading" | "ready" | "error"
  data: { movies, actors }                 // single source of truth
  mode: list | movie-form | actor-form     // with draft payload
  listState: { query, entityFilter, selectedTags }
```

`query` / `entityFilter` / `selectedTags` are lifted to `App` even though only the list uses them: today they are view instance fields that survive form round-trips (save/cancel returns to a list with search intact). Keeping them as `ListView` local state would reset them when the form mounts — a behavior regression.

*Alternative considered:* keeping `ListView` mounted and hiding it — more machinery for the same effect. Rejected.

### D3: Initial load happens in `App`'s effect, not `onload`

`main.ts` currently `await`s `store.load()` at plugin load. Under the new design the store no longer keeps the result, and any cache on the plugin would go stale when the view is closed and reopened (a fresh React mount must see fresh data). Instead: `App` mounts → `status: "loading"` → `load()` → `ready` or `error` (the error screen the spec already requires). Reads of one small JSON file; imperceptible latency, and correctness on remount for free.

### D4: Sequential save, no optimistic update

Save path: form builds a new `MovieStoreData` (immutable upsert) → `await store.save(next)` → on success `setData(next)` + return to list → on failure `Notice` + stay in form. Matches current behavior exactly; no rollback logic needed.

### D5: Component structure

```
src/
  main.ts                 wiring only (unchanged role)
  store.ts                pure I/O (reshaped per D1)
  types.ts                unchanged
  view.ts                 thin shell: mount/unmount React root in contentEl
  ui/
    App.tsx               state per D2/D3, routes list vs form
    useCoverUrl.ts        async cover decode hook (loading/ok/placeholder)
    components/
      ListView.tsx  Toolbar.tsx  TagFilter.tsx
      MovieGrid.tsx  MovieCard.tsx  CoverImage.tsx  EmptyState.tsx
      MovieForm.tsx  ActorForm.tsx  Field.tsx
      CoverPicker.tsx  ActorSelect.tsx  FormButtons.tsx
```

`view.ts` keeps `VIEW_TYPE_MOVIE_DATA` and `getViewType`/`getDisplayText`, creates the root in `onOpen`, and calls `root.unmount()` in `onClose` — Obsidian lifecycle stays intact.

### D6: Test strategy — vitest + jsdom + Testing Library (chosen over extending the hand-rolled esbuild harness)

- **Store tests** (port of the store-level assertions in `verify.ts`): plain vitest, no DOM; `test/obsidian-stub.ts` shrinks to a vault-adapter stub + `Notice`.
- **UI tests** (port of `verify.ts`/`e2e.ts` scenarios): `@testing-library/react` in jsdom; scenarios ported 1:1 — grid render, corrupt-cover placeholder, cached decode, search by actor name, empty state, tag filter, entity switch, add-movie cancel-writes-nothing, add-movie save-persists-deformed-cover, edit-actor-single-source, load-error screen.
- **`live-e2e.mjs`**: keeps CSS-selector strategy (classes unchanged); replaces `store.actors`/`store.movies` reads with assertions against `.movie-data/movies.json`.

*Alternative considered:* keeping the esbuild+node hand-rolled harness with manually wired jsdom globals — fewer devDeps, but reimplements per-file setup, watch mode, and DOM environment handling. Rejected per user decision (option B: vitest).

### D7: Toolchain

React 18 with automatic JSX runtime: `"jsx": "react-jsx"` in `tsconfig.json` (extend `include` to `src/**/*.tsx`), esbuild picks JSX up from tsconfig (no loader flags needed), `format: cjs` unchanged. No CSS-in-JS; existing `styles.css` applies via unchanged class names.

## Risks / Trade-offs

- **Two headless test files must be rewritten, not patched** → Port scenarios 1:1 with a checklist so coverage drift is visible; keep the old files until the new suites pass the same scenarios, then delete.
- **React + jsdom quirks around object URLs and binary file inputs** (`URL.createObjectURL` is unimplemented in jsdom; `<input type=file>` needs `fireEvent` with an explicit `File`) → Provide minimal test polyfills in a vitest setup file; the file-pick helper is shared across form tests.
- **`live-e2e.mjs` search dispatch relies on native `input` events, which React handles through its synthetic event system at the root** → Verify the dispatch path early in the migration (task spike); if React's controlled-input tracking swallows the synthetic event, set values through the native setter as the CDP driver already does.
- **~140 KB runtime bundle growth** → Accepted; tree-shaken React is standard for Obsidian plugins, gzips to ~45 KB.
- **Subtle behavior drift (staged-cover discard on cancel, tag chips persisting across entity switch, etc.)** → These are exactly what the ported tests assert; any drift fails the suite.
- **Mixed old/new state during migration (old view + new store API breaks compile)** → Migrate store + view together in one vertical slice (see Migration Plan), not incrementally green-at-every-commit.

## Migration Plan

Order chosen so each step is verifiable and the repo compiles at slice boundaries:

1. Toolchain: deps, `tsconfig` JSX, vitest config, setup file (polyfills).
2. Store reshape (`load`/`save` signatures) + `main.ts` wiring + store tests green.
3. `view.ts` shell + `App` + list path (no forms) with React; port list/search/tag scenarios.
4. Forms + cover picker; port form scenarios; delete `verify.ts`/`e2e.ts`/`FakeElement` once parity is confirmed.
5. `live-e2e.mjs` adjustments; full suite + real-Obsidian run.

Rollback: it is a single git branch; no data migration is involved (disk format untouched), so reverting the code fully restores the old behavior.

## Open Questions

- Preact vs React: settled on React 18 (bundle growth accepted).
- Whether to eventually adopt CSS modules or keep the flat stylesheet: deferred; current class-name stability is a hard requirement for `live-e2e.mjs`.
