## 1. Grid frame variants (CSS + view variant class)

- [x] 1.1 In `styles.css`, add per-view grid variants: `.movie-data-grid--movies` sets `.movie-data-cover` `aspect-ratio: 4 / 3` and column `minmax(200px, 1fr)`; `.movie-data-grid--actors` sets `aspect-ratio: 1 / 1` and `minmax(150px, 1fr)`. Keep the base `.movie-data-grid`/`.movie-data-cover` as the movies-ratio default so an unstyled grid still renders large. Verify the base still uses `object-fit: contain`.
- [x] 1.2 In `src/ui/components/ListView.tsx`, append the variant class to the grid container based on `view` (`movie-data-grid--movies` / `--actors`). Verify the built class string selects the right variant for each tab.

## 2. Form preview sync (CoverImage / CoverPicker / forms)

- [x] 2.1 Add an optional `ratio` prop to `src/ui/components/CoverImage.tsx` used only when `preview` is set; apply it as the preview frame's `aspect-ratio`. Verify the grid (non-preview) path is unaffected.
- [x] 2.2 In `src/ui/components/CoverPicker.tsx`, accept an `entityKind` prop ("movie" | "actor") and forward the matching ratio to the preview `CoverImage`. Verify staging/pick/paste behavior is unchanged.
- [x] 2.3 Pass `entityKind` from `src/ui/components/MovieForm.tsx` ("movie") and `src/ui/components/ActorForm.tsx` ("actor"). Verify each form's preview frame matches its entity ratio.
- [x] 2.4 In `styles.css`, switch `.movie-data-cover-preview img` from `object-fit: cover` to `contain` and drive its `aspect-ratio` from the passed ratio (keep the 120px box width). Verify the preview no longer crops and matches the grid's no-crop behavior.

## 3. Verification

- [x] 3.1 Run the app/tests (`npm test`) and confirm no regressions. (Automated part done: 160/160 tests, tsc, production build all pass. Manual visual check confirmed by user via `npm run dev:open`.) Manually verify: Movies grid shows 4:3 landscape frames at the wider column; Actors grid shows 1:1 frames; movie form preview is uncropped 4:3 and actor form preview uncropped 1:1; the detail-dialog enlarged cover is unchanged and still uncropped.
