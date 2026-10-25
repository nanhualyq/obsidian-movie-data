## Context

The grid currently renders every cover in a fixed portrait frame with a narrow column:

```css
.movie-data-grid  { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
.movie-data-cover { aspect-ratio: 2 / 3; }
.movie-data-cover img { object-fit: contain; }
```

`object-fit: contain` (from the add-cover-normalization change, design D5) already preserves the whole image without cropping, but the frame shape is portrait 2:3 while real covers are landscape screenshots (movies) and square avatars (actors). A 4:3 landscape screenshot letterboxed into a 2:3 frame fills only about a third of the cell's height, so covers read as tiny. The `MovieGrid` is rendered by `ListView`, which already has the active `view: ListTab` ("movies" | "actors") — the natural signal to select a per-view frame. The `CoverPicker` preview (120px, `aspect-ratio: 2/3`, `object-fit: cover`) is shared by both forms and is currently cropped; it does not know the entity kind. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Make grid covers render noticeably larger by matching the frame ratio to the dominant content per view (movies → `4/3`, actors → `1/1`) and widening the column min-width.
- Keep the no-crop guarantee (`object-fit: contain`) everywhere covers render.
- Bring the form cover preview in line with the grid: per-entity ratio and no crop.
- Thread the entity kind from each form into the preview so it can vary.

**Non-Goals:**
- No storage, normalization, `.mcov` encoding, or persistence changes.
- No change to the detail-dialog enlarged cover (already image-driven and uncropped).
- No new user-facing setting/toggle for size or ratio (explicitly declined).
- No change to column-count strategy, pagination, or grid structure — only frame ratio and sizing.

## Decisions

**D1: Per-view variant class on the grid container, not a prop drilled into `CoverImage`.**
`ListView` already holds `view`; it appends a variant (e.g. `movie-data-grid--movies` / `--actors`) to the existing `movie-data-grid` class, and CSS overrides `aspect-ratio` and `minmax` for each variant. *Why:* keeps the ratio choice a pure CSS concern and needs no new component plumbing for the grid path. *Alternative rejected:* passing a `ratio` prop into `MovieGrid`/`MovieCard`/`CoverImage` for the grid — more layers to change for a styling-only decision.

**D2: `CoverImage` gains an optional `ratio` prop used only by the preview.**
The grid keeps using the existing default (frame set by CSS variant); the preview passes an explicit ratio so `CoverPicker` can vary by entity. `CoverPicker` accepts an `entityKind` ("movie" | "actor") prop and forwards the matching ratio to `CoverImage`; `MovieForm` and `ActorForm` pass their kind. *Why:* `CoverPicker` is shared and currently kind-agnostic — the kind must come from the caller. *Alternative rejected:* two separate picker components — duplicates paste/pick/staging logic for a styling difference.

**D3: Preview switches from `cover` to `contain` and adopts the per-entity ratio.**
`.movie-data-cover-preview` keeps a fixed box width (120px) but takes the per-entity `aspect-ratio` and `object-fit: contain`, matching the grid's no-crop principle. *Rationale:* the user asked the form to sync with the grid, and the standing decision is never to crop covers. *Trade-off:* a landscape screenshot in the preview is now uncropped (smaller within the 120px box) instead of center-cropped — consistent with the grid, which is the intent.

**D4: Sizing targets.** Movies frame `4/3` with column `minmax(200px, 1fr)`; actors frame `1/1` with column `minmax(150px, 1fr)`. Exact px are tuning values, adjustable in implementation without design impact.

## Risks / Trade-offs

- [Posters (2:3) in the movies view now letterbox to ~3/4 width] → Accepted: movies content is landscape screenshots per user; a stray portrait cover still renders fully (contain), just narrower — no crop, no loss.
- [Actors view shows only square frames; a tall portrait avatar letterboxes to ~half width] → Accepted and consistent with "no crop"; avatars are ~1:1 per user.
- [Variant class could be omitted if a new render site adds `movie-data-grid` without a variant] → The base `.movie-data-grid` keeps a sensible default (the movies ratio) so an unstyled addition still renders large, not broken.

## Migration Plan

Display-only and purely client-side; ships in a single release with no data migration. Rollback is a code revert (frames/column width return to prior values); no stored data is affected.

## Open Questions

None — ratios (`4/3` movies, `1/1` actors), no-crop, and form sync are all confirmed by the user; exact px are tuning values, not decisions.
