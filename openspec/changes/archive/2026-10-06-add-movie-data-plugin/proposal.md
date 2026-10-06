## Why

We need a dedicated Obsidian plugin to manage movie and actor data inside the vault. Data should live in a plain `./movie-data` directory (one JSON file plus cover image files) so it stays portable and inspectable. Cover images must be "deformed" (prefix-stamped and renamed) so that system photo galleries and other applications scanning the vault do not recognize or display them.

## What Changes

- New Obsidian plugin (greenfield - no existing code in this repo).
- New data store: `./.movie-data/movies.json` containing two collections:
  - `movies`: `{ id, title, cover, tags[], actorIds[], info, url }`
  - `actors`: `{ id, name, cover, info, url }`
  - `info` is free-form text rendered as-is; actors have no tags.
- New cover storage: `./.movie-data/covers/*.mcov` files, each being a fixed binary prefix followed by the original image bytes; decoded on render by slicing off the prefix (format-agnostic, lazy decode with in-memory cache).
- New main UI as an independent workspace tab (editor leaf) containing:
  - A browsable list with thumbnails, full-text search (titles + actor names), and tag filtering.
  - Add/edit forms for movies and actors in the same tab, including a cover picker that reads an image file, stamps the prefix, and saves it.
- Saves are explicit (written to disk when the user saves the form), not autosaved.

## Capabilities

### New Capabilities

- `movie-data-storage`: Persisting and loading the movie/actor JSON store, including cover file naming, prefix stamping, and decoding.
- `movie-data-ui`: The workspace-tab interface - searchable/filterable list, entity switching, and add/edit forms.

### Modified Capabilities

(none - greenfield)

## Impact

- New plugin source tree (manifest.json, main entry, UI modules) - no existing code affected.
- Creates a `./.movie-data` directory inside the vault at runtime (dot-prefixed: hidden from Obsidian's file explorer and vault index, so it never appears in search/quick-switcher/graph).
- Depends on the Obsidian Plugin API (`Plugin`, workspace leaves, vault adapter file I/O).
- No existing specs, tests, or docs in this repo to modify.
