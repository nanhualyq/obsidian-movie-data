# Design: Add Cover Normalization

## Context

The cover pipeline is byte-oriented and format-agnostic end to end: `CoverPicker.handleImageFile` (the single entry point shared by file pick and clipboard paste) reads bytes, `MovieStore.stageCover` prepends the fixed 16-byte prefix and returns a preview blob URL, and `save()` writes the staged bytes verbatim. The store is deliberately synchronous and knows nothing about image formats; `.mcov` decoding strips the prefix by fixed offset regardless of format. Display is CSS-only: the grid card and the form preview use a fixed `aspect-ratio: 2/3` frame with `object-fit: cover`.

See proposal.md for motivation. The storage spec currently mandates "unmodified original image bytes", which this change revises (delta in `specs/movie-data-storage/spec.md`).

Constraints carried over from the exploration:

- Caps and rules confirmed with the user: longest side <= 800, proportional scale only, never upscale; new saves only (no migration of existing `.mcov` files); grid display switches to `contain` inside the same fixed frame; the form's 120 px preview stays exactly as it is today (cropped).
- No new dependencies may be added (Chromium/Electron canvas APIs are available).

## Goals / Non-Goals

**Goals:**

- Covers that enter the system through pick/paste are stored at on-screen-appropriate size (~40-100x smaller files), with zero risk of blocking or breaking the save path.
- The store layer stays format-agnostic and synchronous; `.mcov` files remain undecodable by external scanners.
- Grid cards show the whole image (no cropping) without destabilizing the grid layout.

**Non-Goals:**

- Rewriting or optimizing existing `.mcov` files on disk (explicitly deferred by the user).
- A settings UI for cap/quality/format.
- Changing the form preview's size or its cropped display.
- Changing `.mcov` format, prefix, filename scheme, or explicit-save persistence semantics.
- Preserving animation (GIF) or transparency (alpha) through normalization.

## Decisions

**D1: Normalize at stage time, inside `handleImageFile` (UI layer), not in the store.**
`handleImageFile` is the one funnel both input sources flow through, and it is already `async`. Alternatives rejected: normalizing inside `store.stageCover` would make the store format-aware and force it async (its contract is "pure I/O, format-agnostic, no parsing"); normalizing in `save()` would stage and preview full-size bytes, wasting memory and showing the user an unnormalized preview. The staged preview therefore shows exactly what will be written (WYSIWYG).

**D2: New module `src/coverImage.ts` exporting a single async function (e.g. `normalizeCover(bytes: Uint8Array): Promise<Uint8Array>`).**
Keeps `CoverPicker` thin, gives the unit tests a direct target, and isolates all canvas/format knowledge in one file. The module returns the original bytes whenever anything goes wrong (see D4).

**D3: Algorithm: `createImageBitmap` -> canvas sized to scaled dims -> `toBlob("image/jpeg", 0.82)`.**
Scale factor `s = min(1, 800 / max(width, height))`; destination canvas is `(round(w*s), round(h*s))`. The canvas MUST be sized to the scaled dimensions — drawing into a fixed 800x800 canvas is the anti-pattern that distorts non-square images. The canvas is filled white before drawing so transparent sources do not become black under JPEG (which has no alpha). Animated GIFs decode to their first frame; this is accepted (covers are posters, not animations).

Format choice: JPEG at quality ~0.82 over WebP (marginally smaller but gains nothing meaningful at these sizes and JPEG is boringly safe) and over PNG (screenshots stay sharp but files are multiples larger; small screenshots are already protected by the pass-through rule). Alternative considered and rejected: bundling a WASM/sharp-style encoder — adds megabytes to the plugin for negligible benefit given the cap.

**D4: Fail-soft on every path.**
Any throw (`createImageBitmap` rejection, canvas/`toBlob` unavailable, out-of-memory) returns the input bytes unchanged. This is a product rule (save must never be blocked by normalization) that doubles as the test-environment strategy: jsdom has no `createImageBitmap`/canvas, so existing UI tests automatically exercise the fallback and keep passing; new tests can stub the canvas globals to exercise the scaling path, plus a pure test of the scale-factor math.

**D5: Grid display: keep the fixed 2:3 frame, change `object-fit` from `cover` to `contain` (`.movie-data-cover img` only).**
The frame shape is a layout decision, not an assumption about image ratios: `contain` makes any ratio fully visible inside the card. Alternatives rejected: image-driven cell height (uneven grid rows, misaligned titles within a row, and a hidden height cap reintroduces an assumption); a square frame (posters letterbox and render smaller). Posters render pixel-for-pixel as today; landscape/square covers gain letterboxing instead of cropping. The form preview (`.movie-data-cover-preview`) is deliberately untouched per the user's decision.

**D6: Cap = 800 is spec-level, not a setting.**
At the largest card width (~190 CSS px), 2x density needs ~380 device px; a 2:3 poster normalized to 533x800 supplies 533 px of width — comfortable headroom, ~90-130 KB per poster versus multi-MB sources. Hardcoding keeps the spec, code, and tests aligned; a settings UI is a separate future change if ever needed.

## Risks / Trade-offs

- [Landscape covers in the grid letterbox instead of cropping to fill] → Accepted explicitly by the user ("接纳各种可能性"); posters (the dominant content) are unaffected.
- [Existing `.mcov` files stay at original size forever unless the user re-picks the image — editing an entity without touching the cover field does not rewrite it] → Accepted (user chose option A: no migration); recorded in the proposal's out-of-scope.
- [JPEG artifacts on text-heavy screenshots at 800 px] → At display sizes (<= 190 CSS px) artifacts are imperceptible; images already <= 800 px pass through untouched.
- [Transparency flattened to white, animation lost] → Accepted for the poster use case; documented here so the behavior change is deliberate, not accidental.
- [Normalization adds an async beat before the preview appears] → Milliseconds on canvas at <= 800 px; the preview already renders asynchronously via blob URL.
- [Spec/implementation drift on the 800 cap] → The cap is stated normatively in the delta spec; the implementation reads it from one constant and a test pins the behavior.

## Migration Plan

None. New saves are normalized; old files remain valid (decode is format-agnostic and unchanged). Rollback is removing the change — previously written normalized covers continue to render, since nothing about `.mcov` layout changed.

## Open Questions

None blocking. Deferred by design: whether the grid's uncropped rendering deserves its own `movie-data-ui` requirement later (the current UI spec makes no claim about cropping, so no delta is needed now).
