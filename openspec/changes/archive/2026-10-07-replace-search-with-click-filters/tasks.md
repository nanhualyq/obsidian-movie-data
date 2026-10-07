## 1. Filtering state core

- [x] 1.1 In `src/ui/state.ts`: replace `ListState.query` with `actorFilter: string` (`""` = all) and rewrite `computeResults` to apply tag chips (OR within group) plus the single actor filter (AND across groups) with no text matching; verify with unit tests in `test/ui.test.tsx` covering: dropdown narrowing (only movies referencing the chosen actor shown), combined tag+actor filter, "All actors" resets actor narrowing, tag chip deselect widens the list, and no-filter list unchanged (`npm test`).
- [x] 1.2 Update `EMPTY_LIST` in `src/ui/App.tsx` and the `emptyText` logic in `src/ui/components/ListView.tsx` (drop the `list.query` branch; show "No results" when any tag chip is selected or `actorFilter` is set) so `npm run build` (tsc) passes and the empty-state tests still pass (`npm test`).

## 2. Toolbar and filter controls

- [x] 2.1 In `src/ui/components/Toolbar.tsx`: remove the search `<input>` and its `query`/`onQuery` props, keeping the Movies/Actors toggle and Add button; verify `document.querySelector('.movie-data-search')` is null and the toolbar still renders (test: "no text search input is present" in `test/ui.test.tsx`, `npm test`).
- [x] 2.2 Add the actor filter dropdown in the movies view (single-select `<select>`: "All actors" first, then every saved actor sorted by name, including zero-movie ones), rendered only when `entityFilter === "movies"`; `TagFilter` stays tag-only; verify tests: option list content/order and the dropdown (like tag chips) is hidden in the actors view (`npm test`).

## 3. Actor jump link

- [x] 3.1 In `src/ui/components/MovieCard.tsx` (actor branch) add a jump action rendered only for actor entries in the actors view, with `stopPropagation()` so the cell's open-form click does not fire; clicking sets `entityFilter: "movies"`, `actorFilter = that actor id`, `selectedTags = {}`; verify tests: jump shows only that actor's movies with that actor chosen in the dropdown and tags cleared, jump for an actor with no movies shows the empty state, and the actor's edit form does NOT open on jump click (`npm test`).

## 4. Form: shared select, validation, fallback

- [x] 4.1 Rewrite `src/ui/components/ActorSelect.tsx` into the shared select component (single-select for the list filter, `multiple` list box for the form) and wire the `multiple` variant into `MovieForm` in place of the checkbox list; update the two checkbox-driven spots in `test/ui-forms.test.tsx` (lines 101/187) to select-based interaction; verify actor selection round-trips: saved movie's `actorIds` still store id-only references (`npm test`).
- [x] 4.2 Add actors-required validation in `MovieForm.onSave`: when no actor is selected, set an inline error under the Actors field, return before `commit`, keep the form open, write nothing (staged cover stays staged for retry); verify tests: save blocked with 0 actors (error visible, `movies.json` unchanged), save succeeds after selecting an actor, error clears once an actor is selected (`npm test`).
- [x] 4.3 Add the "Unknown / Unnamed" fallback: the form's select always offers it (even with zero saved actors); saving with it creates the shared actor record lazily in the same commit and the movie references its fixed id; verify tests: option present when no actors exist, save creates the record + `actorIds` references it, the record then appears in the actor list and the filter dropdown (`npm test`).

## 5. Styles

- [x] 5.1 In `styles.css`: delete the `.movie-data-search` rule; add styles for the actor select (toolbar and form variants, using Obsidian theme variables), the `.movie-data-jump` link, and the inline validation error; verify `npm run build` succeeds and a visual check in Obsidian (or `npm run test:live`) shows the dropdown compact in the toolbar, the multi-select readable in the form, and the jump link clear on actor cells.

## 6. Test and e2e updates

- [x] 6.1 Rewrite search-driven tests: remove the `searchInput()` helper and the "search by actor name" / "search survives form round-trip" tests in `test/ui.test.tsx`, replacing them with dropdown equivalents (actor narrowing; selected filters survive an open-and-cancel form round-trip); verify the full suite passes: `npm test`.
- [x] 6.2 Update `test/live-e2e.mjs`: replace the four `.movie-data-search` interactions (search 'keanu', 'ana', '', 'Prime') with actor-dropdown + tag-chip filtering plus one actor-jump round trip, and replace the form's `input[type=checkbox]` actor pick (line 114) with select interaction; verify `npm run test:live` passes against a deployed vault.
- [x] 6.3 Run final verification: `npm run build && npm test` both green, and grep confirms no remaining references to `movie-data-search`, `list.query`, or checkbox-based actor picking in `src/`, `test/`, `styles.css`.

## 7. Spec sync check

- [x] 7.1 Run `openspec validate replace-search-with-click-filters --strict` and confirm it passes; re-read the delta in `specs/movie-data-ui/spec.md` (REMOVED, MODIFIED "Add and edit forms", both ADDED requirements) and confirm each scenario is covered by a test from tasks 1-6 (map scenario → test name in the task summary comment).

<!-- Scenario → test coverage map (verified 7.1):
  MODIFIED Add and edit forms:
    Add a movie                       -> ui-forms: "save persists movie: parsed tags, verbatim info, deformed cover, list refresh"
    Edit an actor                     -> ui-forms: "edit is reflected through movie references and the filter dropdown"
    Cancel                            -> ui-forms: "opens an empty add form; cancel writes nothing"
    Save blocked without actors       -> ui-forms: "save with no actor is blocked: inline error, form stays open, nothing written"
    Fallback actor satisfies          -> ui-forms: "fallback option is offered with zero actors; saving creates the shared record"
    No saved actors yet               -> ui-forms: same test (option asserted with zero saved actors)
  ADDED Click-to-filter list:
    Filter by tag                     -> ui: "tag chips are the sorted union of movie tags; filter narrows and deselect widens"
    Filter by actor                   -> ui: "actor dropdown: 'All actors' first, sorted actors; narrows and resets"
    Combined tag and actor filter     -> ui: "combined tag + actor filter intersects; no match shows empty state"
    Reset actor filter                -> ui: "actor dropdown: ... narrows and resets" (All actors step)
    Deselect a filter chip            -> ui: "tag chips ... filter narrows and deselect widens"
    No text search                    -> ui: "no text search input is present; toolbar still renders"
    Filter controls hidden in actors  -> ui: "entity switch shows actors; add button follows filter; filters hidden in actors view"
    No results                        -> ui: "combined tag + actor filter intersects; no match shows empty state" + "jump for an actor with no movies shows the empty state" (also live-e2e: non-matching actor filter -> empty state)
  ADDED Jump from an actor entry:
    Jump to an actor's movies         -> ui: "jump shows only that actor's movies, selects it in the dropdown, clears tags, opens no form" (also live-e2e jump round trip)
    Jump for an actor with no movies  -> ui: "jump for an actor with no movies shows the empty state"
-->
