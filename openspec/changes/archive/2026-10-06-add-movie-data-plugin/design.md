## Context

Greenfield Obsidian plugin (repo contains only OpenSpec scaffolding). Motivation and scope are in `proposal.md`; behavior contracts are in `specs/movie-data-storage/spec.md` and `specs/movie-data-ui/spec.md`. No existing code, tests, or specs constrain the approach. Target is the Obsidian Plugin API on a `FileSystemAdapter` vault (full file I/O via `vault.adapter`).

## Goals / Non-Goals

**Goals:**
- Small, dependency-light plugin; plain-file data that stays human-inspectable.
- Cover obfuscation that defeats extension-based and offset-0 magic-byte scanning.
- A responsive list even as the collection grows to a few thousand entries.

**Non-Goals:**
- Encrypting `movies.json` (data itself stays plaintext).
- Sync/multi-device conflict resolution (Obsidian Sync/git handles files; last-write-wins is acceptable).
- Rich text editing for `info` (plain text area, rendered as-is).
- Import from external services (TMDb, Letterboxd, etc.).

## Decisions

**D1: Single JSON file, two collections, actors referenced by id.**
`movies.json` = `{ movies: [...], actors: [...] }`; movies hold `actorIds[]`.
- *Why:* actor data (cover, info, url) is edited independently and must exist once; embedding duplicates it and rots on edit. A join at render time is trivial at this scale.
- *Alternative rejected:* separate `actors.json` — no benefit, two files to keep consistent.

**D2: Fixed-length prefix + non-image extension for covers.**
Each cover: `covers/<entityId>.mcov` = `[PREFIX][original bytes]`; decode = `bytes.slice(PREFIX.length)`.
- *Why:* format-agnostic (no parsing, works for any current or future image format), defeats both the extension-based scan layer and the magic-byte-at-offset-0 layer. One mechanism for movie and actor covers.
- *Alternatives rejected:* AES encryption — heavier (key management, async crypto in render path) and unnecessary for the stated threat (system photo galleries); note the design keeps an escape hatch: replacing `slice` with `decrypt` changes no schema or UI. Storing base64 inside JSON — bloats the single file and kills diff-friendliness.
- Prefix is a fixed constant (e.g. 16 ASCII bytes). No length header (YAGNI; migration script is cheap if the prefix ever changes).

**D3: Lazy decode with in-memory cache.**
Covers are decoded only when rendered, memoized by filename (blob URL or data URL keyed by cover name), invalidated when a cover is rewritten on save.
- *Why:* list rendering must not read and slice every file up front; re-renders must not re-decode.

**D4: One workspace tab hosts list and forms (no side panel).**
Registered as an `ItemView` on a custom leaf type, opened via a command; list and add/edit form are internal states of the same view.
- *Why:* user's primary activity is data management (add/edit heavy), so space beats always-on presence; per explore-mode decision "c".
- *Alternative rejected:* sidebar list + modal form — cramped forms, two containers to manage.

**D5: Explicit save, synchronous write path.**
Form save → write changed covers → write `movies.json` (single atomic-ish write of the whole file) → return to list. Cancel writes nothing.
- *Why:* predictable, trivially consistent, no debounce/merge races. Whole-file write is fine below tens of MB.
- In-memory store is the source of truth while the view is open; disk is written only on save (per spec "Explicit persistence").

**D6: Search index built in memory.**
On load, build a lowercase haystack per movie: title + referenced actors' names + tags; actor entries: name. Filter: entity-type selector + tag multi-select.
- *Why:* full scan per keystroke is O(n) with tiny constants at this scale; no index file needed. Revisit only if profiling shows jank > a few thousand entries.

**D7: IDs are `Date.now()`-based short ids plus a random suffix** (e.g. `m_1715829x4f2`), prefixed `m_`/`a_` for readability.
- *Why:* sortable, collision-safe enough for single-user local data, no uuid dependency.

**D8: Data directory is dot-prefixed (`.movie-data`).**
The store lives at `./.movie-data/` (data) instead of `./movie-data/`.
- *Why:* verified empirically on Obsidian 1.14.4 - dot-prefixed directories are excluded from both the file explorer and `vault.getFiles()` (the index feeding search, quick switcher, and graph), giving three layers of protection for covers (extension + magic-byte offset + directory hiding) and keeping the data dir out of the user's way. The plugin reads exclusively through `vault.adapter`, which is unaffected by index exclusion.
- *Alternative rejected:* `.obsidian/movie-data` (inside plugin config dir) - mixes data with config, gets wiped on some reinstall paths.
- *Migration:* none needed pre-release; dev data dir simply renamed.

## Risks / Trade-offs

- [Aggressive scanners search the *whole file* for embedded JPEG markers, defeating prefix obfuscation] → Accept for v1 (stated threat is extension/magic-byte scanners); D2 keeps the upgrade path to AES without schema change.
- [Whole-file `movies.json` write could corrupt on crash mid-write] → Write to a temp file then rename via `adapter`, if supported; otherwise accept the risk (small file, local disk). At minimum, back up the previous contents in memory and surface a load-error state if parsing fails.
- [Prefix stripped from a file by an external tool / file hand-edited] → Render failure shows a placeholder (per spec); no crash, no blocking.
- [Obsidian API churn across versions] → Pin a minimum app version in `manifest.json`; use only stable APIs (`registerView`, `addItem`, `vault.adapter`).
- [Tab reopened against externally modified files (e.g. git pull)] → Reload store on view open; last-write-wins is a documented non-goal.

## Migration Plan

None - greenfield, no existing data.

## Open Questions

None - both previously open visual questions are resolved:
- List layout: **grid** of cover thumbnails (with title below each cell).
- Entry points: command **and** a ribbon icon, both opening the same tab.
