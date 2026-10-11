## 1. Detail layout and styling

- [x] 1.1 In `src/ui/components/EntityDetail.tsx`, pass a detail-only class (e.g. `movie-data-detail-dialog`) to both the movie and actor `Dialog` usages, and verify the dialogs still open/stack/close as before (`npm test`)
- [x] 1.2 In `styles.css`, add the detail-dialog width rule (`min(840px, calc(100vw - 24px))`, forms stay 640px) and rework `.movie-data-detail .movie-data-cover` from the fixed 140px/`flex: 0 0 140px` to a large capped column (max ~400px / ~45% of dialog) with `flex: 0 0 auto`; verify with `npm run build` that styles compile
- [x] 1.3 Ensure the enlarged cover never upscales: `<img>` inside the detail cover keeps auto dimensions capped by `max-width: 100%` with `object-fit: contain`, so undersized stored images render at intrinsic size (verify by inspection of the applied rules)
- [x] 1.4 Update the ≤600px media query: replace the fixed 120px detail cover with a viewport-based capped size (e.g. `min(70vw, 320px)`) while keeping `flex-direction: column`, and verify no horizontal overflow at 375px width

## 2. Placeholder and edge cases

- [x] 2.1 Verify the "?" placeholder renders correctly centered in the enlarged cover box (`.movie-data-cover.is-placeholder`) for an entity with no cover and for a corrupt cover file; adjust placeholder font-size/centering styles if needed (`npm test`)
- [x] 2.2 Verify a very wide (landscape) cover letterboxes inside the cover column without squeezing `.movie-data-detail-main` below a readable width (manual check in dev, `npm run dev:open`)

## 3. Tests and verification

- [x] 3.1 Add a case in `test/ui-dialogs.test.tsx` asserting the detail dialog carries the detail-only class and still renders the cover/placeholder inside `.movie-data-detail` (`npm test`)
- [x] 3.2 Run the full suite and typecheck (`npm test` and `npm run build`) and confirm all pass
- [x] 3.3 Manually verify against the spec scenarios: cover substantially larger than list thumbnail, whole image visible, no upscale of a small cover, no horizontal overflow on a narrow viewport with Edit/Close reachable, placeholder case intact (optionally via `npm run test:live`)
