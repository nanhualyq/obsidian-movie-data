## Context

Obsidian 1.13's `.mobile-navbar` becomes a `position: fixed` overlay on phones in the `.is-phone.is-floating-nav` and `.is-phone.auto-full-screen` states; the workspace leaf then extends to the screen bottom (only a fade mask is applied). The plugin root (`.movie-data-root`) fills the leaf with `height: 100%`, and the mobile footer is `position: absolute; bottom: 0` — so the pagination bar lands underneath the navbar. The root also sets `padding: 0`, which removes Obsidian's default safe-area bottom padding for `.view-content`. See proposal.md for motivation; extracted navbar CSS values are recorded in the Decisions below.

## Goals / Non-Goals

**Goals:**
- The list's three regions (header, grid, footer/pagination) never sit beneath the overlaying navbar.
- Zero behavioral and pixel change on desktop, tablet, and non-overlay phone layouts.
- CSS-only: no JS measurement, no React changes.

**Non-Goals:**
- Dialogs (they render in the top layer above the navbar — verified, intentionally untouched).
- Changing the hide-on-scroll interaction or the header/footer overlay design.
- Adjusting to keyboard-open animation frame-by-frame.

## Decisions

**D1 — Shrink the root (Option B) via a flex-aware `margin-bottom`, not a height subtraction.**
The root lives in `.workspace-leaf-content`, an unconditional `display: flex; flex-direction: column` (asar), with an in-flow sibling above it (`.view-header`, measured at ~92px on the Android test device — contrary to the earlier assumption that floating-nav phones take it out of flow). A `height: calc(100% - clear)` subtraction is absorbed by the flex algorithm: the root just shrinks to the space left by the sibling and the bottom gap comes out as `clear - sibling` (≈ 0 or negative on real devices) — verified as "no visible change" on device. A `margin-bottom: var(--movie-data-navbar-clear, 0px)` instead participates in the flex outer-size math: the hypothetical outer size (100% + margin) overflows the container, flex-shrink resolves it, and the bottom gap equals the margin **exactly, independent of sibling height and of grow/shrink values** (holds for S = 0 with fixed headers too). This moves every dependent behavior at once: the overlay footer's `bottom: 0` and the scroll region's padding end above the navbar, and the hidden footer's `translateY(100%)` exits the root and is clipped by `overflow: hidden` (important because the floating pill is only ~316px wide and does not cover the sides). Alternatives rejected: offsetting three CSS sites (Option A, must stay in sync); JS measurement of `.mobile-navbar` (Option C — the element exists, but margin achieves exactness without runtime observers; C stays as fallback if a device still misbehaves).

**D2 — Derive the clearance from Obsidian's own variables, not the ready-made `--view-bottom-spacing`.**
Formula: `--movie-data-navbar-clear: calc(var(--navbar-height) + var(--navbar-bottom-offset) - var(--keyboard-height, 0px) - 2px)`.
The navbar's occupied strip is `margin-bottom + height` where floating mode sets `margin-bottom: calc(var(--navbar-bottom-offset) - var(--keyboard-height) - 2px)` with `--navbar-bottom-offset: max(var(--safe-area-inset-bottom), var(--size-4-3))`. Obsidian's `--view-bottom-spacing` (`safe-area - keyboard + navbar-height`) equals this minus `max(safe-area, 12px) - 2 - safe-area` — i.e. it **under-reserves by up to 10px when `safe-area-inset-bottom` is 0** (Android three-button navigation; `--size-4-3` measured at 12px), which would leave the pagination bar's bottom edge covered. The `- 2px` term matches Obsidian's own margin so the footer's bottom edge lands flush with the navbar's top edge.

**D3 — Scope the variable to the two body-class states where the navbar is `fixed`.**
`--navbar-height` and `--navbar-bottom-offset` are defined on `.is-mobile` (80px there even when the navbar is in normal flow; undefined on desktop), so an unscoped formula would reserve ~94px on non-overlay phones and produce a permanent gap. Definition:
```css
body.is-phone.is-floating-nav .movie-data-root,
body.is-phone.auto-full-screen .movie-data-root {
  --movie-data-navbar-clear: calc(...D2...);
}
```
The consuming rule is `body.is-mobile .movie-data-root { height: calc(100% - var(--movie-data-navbar-clear, 0px)); }` — the fallback of `0` covers desktop, tablets (navbar `display: none`), and non-floating phones (`.is-phone` sets `--view-bottom-spacing: 0`; the navbar is in flow there), so all of them keep `height: 100%`.

**D4 — Over-reserving a pixel or two beats under-reserving.** A reserved strip shows the root/view background in the same `--background-primary` as the navbar, so a small gap is invisible; any shortfall is the reported bug.

## Risks / Trade-offs

- [Obsidian renames the navbar CSS variables or class names in a future release] → `var(..., 0px)` fallbacks degrade to today's layout (bug present, nothing breaks); the verification task re-checks on the installed version.
- [D2 formula assumes floating mode's margin formula and border-box height] → flush-fit verified on device; if off, correct the constant in one place, or fall back to Option C's measurement.
- [Transient bogus `--keyboard-height` / `--safe-area-inset-bottom` observed at startup on the test device (both read 271.08px before settling to 0px / 16px)] → the clearance self-corrects when the vars settle (50px → 66px observed); worst case is a briefly over-reserved strip at app start, covered by D4's over-reserve-is-invisible argument.
- [Root height changes instantly while the navbar's keyboard transition animates (0.25s)] → transient overlap only while the keyboard opens/closes over a dialog, not during list browsing; acceptable for a non-goal.
- [Reserved strip visible above the navbar when it auto-hides (`.is-hidden-nav`)] → consistent with Obsidian's own views, which keep `--view-bottom-spacing` regardless; accepted.

## Migration Plan

CSS-only, additive: no data or API changes. Deploy = ship `styles.css`; rollback = remove the two rules.

## Open Questions

None — device verification may adjust constants (D2) without changing the approach or specs.
