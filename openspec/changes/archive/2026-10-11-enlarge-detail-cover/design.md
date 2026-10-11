# Design: Enlarge the detail dialog cover

## Context

Covers are normalized to at most 800px longest side before storage (`src/coverImage.ts`), so the stored image is the ceiling for any display size. The detail dialog (`EntityDetail.tsx`) renders `CoverImage` inside `.movie-data-detail .movie-data-cover`, which is pinned to `width/flex-basis: 140px` (120px in the ≤600px media query) with `object-fit: contain`. The dialog itself is `min(640px, 100vw - 24px)` with a scrollable body wrapper (`.movie-data-dialog-body`), and the `Dialog` component accepts a `className`. The cover already renders uncropped (`contain`) and shows the "?" placeholder on missing/broken files. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- The detail dialog becomes the place to inspect a cover: markedly larger, whole image, aspect preserved, never upscaled beyond stored pixels.
- Layout stays sound on desktop and narrow viewports (no horizontal overflow, values and actions reachable).
- Placeholder behavior unchanged for missing/unreadable covers.

**Non-Goals:**
- No image viewer/lightbox/zoom (explicitly rejected: option 1, enlarge only).
- No changes to grid thumbnails, form cover preview, cover normalization, storage, or the store.
- No dialog-stack / Escape / backdrop behavior changes.

## Decisions

**D1 — CSS-driven sizing, no JS measurement.**
Enlarge by changing the detail layout CSS (`.movie-data-detail .movie-data-cover` and the ≤600px media query) rather than measuring the image or dialog in JS. The browser already caps `<img>` at its intrinsic size when width/height are `auto` with `max-width`/`max-height`, which satisfies "never upscale" for free.
*Alternative:* JS that reads `naturalWidth` and sets an explicit scale — rejected: extra code, resize-observer complexity, and no behavioral gain.

**D2 — Give the detail dialog more room via its existing `className` prop.**
Keep the shared form/dialog width at 640px, but pass a detail-only class (e.g. `movie-data-detail-dialog`) that widens only the detail dialog (e.g. `min(840px, 100vw - 24px)`), and let the cover column take a large share of it (roughly `min(45%, ~400px)`, `flex: 0 0 auto`) while `.movie-data-detail-main` keeps `flex: 1 1 auto; min-width: 0` for the text column. Covers then display up to ~2x the old width (and far more area) without forms growing.
*Alternative:* keep 640px and just widen the 140px cover column — rejected: the text column would squeeze below usable width; 640px cannot host a genuinely large cover.
*Alternative:* stack cover above text on desktop — rejected: it forces scrolling for basic fields and wastes the side-by-side reading layout.

**D3 — Cap display at stored resolution structurally.**
The cover box gets a max size (width and, via `aspect-ratio`, height bounded by the dialog/viewport); the `<img>` keeps `width/height: auto` with `max-width: 100%` (inherited `.movie-data-cover img` rule stays `object-fit: contain`), so an undersized image renders at intrinsic size instead of stretching. No new constants beyond layout values.
*Alternative:* read `naturalWidth` in `CoverImage` and set inline dimensions — rejected: JS for something CSS handles.

**D4 — Narrow viewports: stacked layout, capped cover.**
Keep the existing ≤600px pattern (`.movie-data-detail { flex-direction: column }`) but size the cover there from viewport width with a cap (e.g. `width: min(70vw, 320px)`), replacing the fixed 120px. The dialog body remains the scroll region, so values and Edit/Close stay reachable without horizontal overflow.

**D5 — Placeholder unchanged.**
`CoverImage`'s `is-placeholder` path renders in the same enlarged box; `.movie-data-cover.is-placeholder` styling (centered "?") scales with the box. No component API change needed for movies vs. actors — both use the same markup.

## Risks / Trade-offs

- [Wider detail dialog on small-but-not-mobile screens (600–840px) eats backdrop margin] → width is `min(840px, 100vw - 24px)`, the same viewport guard the existing dialog uses.
- [Large covers make the dialog body taller, pushing actions below the fold] → the body wrapper already scrolls (`overflow-y: auto`); acceptable and consistent with existing long-info behavior.
- [Very wide aspect images stretch the cover column] → `max-width` on the column plus `contain` letterboxing keeps the text column from being squeezed; the image never overflows.
- [jsdom tests cannot assert rendered pixel sizes] → tests assert structure/placeholder behavior; visual size is verified manually (or via the existing live e2e script), noted in tasks.
- [A future request for true full-size viewing may still appear] → out of scope here (option 1); the enlarged detail view is the designated place per this change.

## Migration Plan

None — presentation-only change, no data or API format changes; rollback is reverting the CSS/markup diff.

## Open Questions

None.
