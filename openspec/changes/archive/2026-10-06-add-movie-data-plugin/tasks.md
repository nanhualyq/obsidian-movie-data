## 1. Project setup

- [x] 1.1 Scaffold plugin skeleton (`manifest.json`, `package.json`, `tsconfig.json`, `main.ts`) and verify Obsidian loads it as a plugin (appears in Community plugins list with no errors)
- [x] 1.2 Register a command "Open movie data" plus a ribbon icon, both opening the custom view as a workspace tab; verify the tab opens from either entry point and reuses an already-open instance

## 2. Storage layer (per specs/movie-data-storage)

- [x] 2.1 Implement store module: load/create `./movie-data/movies.json` with empty `movies`/`actors` collections and create `covers/` on first run; verify fresh vault gets the directory structure and plugin still loads an existing file without error
- [x] 2.2 Implement cover write/read: stamp fixed binary prefix + save as `covers/<id>.mcov`, and decode by slicing the prefix; verify a saved cover file has the non-image extension, first bytes are not an image signature, and decoded bytes render as the original image
- [x] 2.3 Implement explicit save path: write changed covers then the whole `movies.json`; verify cancel writes nothing and a save is fully reflected after plugin reload
- [x] 2.4 Handle error cases: missing/corrupt `.mcov` file and unparseable `movies.json`; verify UI shows placeholder/load-error state instead of crashing

## 3. View: list with search and filter (per specs/movie-data-ui)

- [x] 3.1 Implement the list as a grid of cover thumbnails with the title below each cell (lazy decode + in-memory cache keyed by filename); verify thumbnails appear only after decode, re-renders don't re-read files, and a corrupt cover shows a placeholder
- [x] 3.2 Implement in-memory search over movie titles + referenced actor names + actor entries, and tag filtering + movie/actor type switch; verify searching an actor name returns their movies, tag filter narrows results, and empty results show an empty state

## 4. View: add/edit forms

- [x] 4.1 Implement movie form (title, tags, info, url, cover picker, actor selection from `actorIds`) with add and edit modes; verify saving a new movie appears in the list immediately and persists across reload
- [x] 4.2 Implement actor form (name, info, url, cover picker); verify editing an actor is reflected in every movie referencing them without duplicating data
- [x] 4.3 Wire cancel/save/return-to-list navigation; verify cancel changes nothing on disk and save returns to the list with updated data visible

## 5. Integration verification

- [x] 5.1 End-to-end pass against spec scenarios: fresh install → add movie with cover and actors → search by actor name → filter by tag → edit actor → reload plugin → verify all data and covers intact and `covers/` files are not recognized by extension- or magic-byte scanners

## 6. Dot-prefixed data directory

- [x] 6.1 Rename data dir to `.movie-data` in `src/store.ts` and update hardcoded paths in `test/verify.ts`, `test/e2e.ts`, `test/live-e2e.mjs`; verify build passes, all `npm test` suites pass, and the fresh-install scenario creates `./.movie-data/covers/`
- [x] 6.2 Verify against real Obsidian: `.movie-data` does not appear in the file explorer or `vault.getFiles()`, live E2E (19 checks) passes, and rename the existing dev-vault `movie-data/` directory to `.movie-data/`
