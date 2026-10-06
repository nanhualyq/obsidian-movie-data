# Tasks: Add Cover Normalization

## 1. Normalization module

- [x] 1.1 Create `src/coverImage.ts` exporting `normalizeCover(bytes: Uint8Array): Promise<Uint8Array>` plus a pure exported scale-factor helper, implementing design D3/D4: `s = min(1, 800 / max(w, h))`, canvas sized to `(round(w*s), round(h*s))` (never a fixed box), white background fill before drawing, JPEG quality ~0.82, and a catch-all that returns the input bytes on any failure — verify with `npx tsc -noEmit -skipLibCheck` passing
- [x] 1.2 Add `test/cover-image.test.ts` covering the spec scenarios: large source downscales to longest side <= 800 with ratio preserved and smaller output (stub `createImageBitmap`/canvas globals), source already <= 800 px returns byte-identical input (pass-through), and canvas APIs unavailable/throwing returns input unchanged (fallback) — verify `npm test` green

## 2. Pipeline wiring

- [x] 2.1 In `src/ui/components/CoverPicker.tsx`, `await normalizeCover(bytes)` inside `handleImageFile` before `store.stageCover(...)` so both pick and paste paths normalize — verify existing `test/ui-forms.test.tsx` and `test/ui.test.tsx` still pass (jsdom exercises the fallback path)
- [x] 2.2 Confirm `handleImageFile` is the only user-bytes entry into `stageCover` (grep for `stageCover` callers) and that `src/store.ts` needs no changes — verify `git diff -- src/store.ts` is empty

## 3. Grid display

- [x] 3.1 In `styles.css`, change `.movie-data-cover img` from `object-fit: cover` to `object-fit: contain`, leaving `.movie-data-cover-preview` untouched — verify in a dev run (`.dev/vault`) that grid cards show uncropped images, 2:3 posters render exactly as before, and the form preview is unchanged

## 4. End-to-end verification

- [x] 4.1 Run `npm test` and `npm run build` — both pass with no regressions
- [x] 4.2 Verify spec scenarios manually or via `npm run test:live`: pick a multi-MB photo, save, confirm `covers/<id>.mcov` decodes to longest side <= 800 and file size < 200 KB; pick an image already <= 800 px and confirm stored bytes are identical to the source; cancel after picking writes no file — check against `specs/movie-data-storage/spec.md` scenarios
