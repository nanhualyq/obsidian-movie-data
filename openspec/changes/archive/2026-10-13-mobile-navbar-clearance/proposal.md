## Why

On phones where Obsidian 1.13's bottom navigation bar (`.mobile-navbar`) is a fixed overlay (`.is-phone.is-floating-nav` or `.is-phone.auto-full-screen`), the plugin's view extends to the screen bottom, so Obsidian's navbar covers the list's fixed footer — the pagination control becomes partially or fully unreachable.

## What Changes

- Reserve a navbar clearance on the list root on affected phones: shrink the root's height by a `--movie-data-navbar-clear` custom property derived from Obsidian's own navbar variables (`--navbar-height`, `--navbar-bottom-offset`, `--keyboard-height`).
- The clearance is defined only for the two body-class scenarios where the navbar is a fixed overlay; everywhere else (desktop, tablet, non-overlay phones) it falls back to `0` and behavior is unchanged.
- CSS-only change (`styles.css`): no React/TypeScript changes, no runtime measurement.
- Side effects that come for free with a shorter root: the overlay footer and the scroll-region padding end above the navbar, and the hidden-on-scroll footer is clipped by the root's `overflow: hidden`.
- Dialogs are explicitly out of scope: they render in the top layer above the navbar (verified on device).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `movie-data-ui`: add a requirement that the list view keeps all of its regions (grid, header, footer/pagination) clear of an overlaying mobile navigation bar.

## Impact

- `styles.css`: `.movie-data-root` height rule plus a scoped `--movie-data-navbar-clear` definition.
- `src/ui/components/ListView.tsx`: no change expected (height is measured/written by CSS only).
- Depends on Obsidian-provided CSS variables (`--navbar-height`, `--navbar-bottom-offset`); if a future Obsidian release renames them, the fallback of `0` degrades to today's behavior rather than breaking layout.
- Needs real-device verification (floating navbar vs. three-button navigation vs. desktop).
