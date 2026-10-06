## Context

The cover pipeline is already byte-oriented and format-agnostic: `CoverPicker.onPick` reads the picked file to a `Uint8Array` and hands it to `store.stageCover(entityId, bytes)`, which handles stamping, preview URL, and (on save) binary write. Clipboard images arrive as `File` objects with the same `arrayBuffer()` API, so paste support is purely an additional input source feeding the same handler — no store or persistence changes.

Paste events fire on the focused element and bubble. Scoping the listener to the cover field therefore means both (a) attaching `onPaste` to the field container and (b) making that container focusable so the event can land there.

## Goals / Non-Goals

**Goals:**
- Paste an image from the clipboard into the cover field with the same staging/preview/save/cancel behavior as file picking.
- Zero new dependencies; standard `paste` event only.

**Non-Goals:**
- Drag & drop (explicitly out of scope per decision).
- A "Paste" button using `navigator.clipboard.read()` (permission prompts, async denial handling — not needed when the event path exists).
- Paste outside the cover field (e.g. arbitrary form-wide paste capture).

## Decisions

**D1: `onPaste` on the cover field container, container made focusable (`tabIndex={0}`).**
- Paste targets the focused node and bubbles; only events originating inside the container reach it, which enforces the "cover field only" scope structurally instead of via a focus-membership check.
- Alternatives considered:
  - *Document-level listener + "is cover field focused?" check*: works but duplicates focus bookkeeping and risks leaking listeners on form unmount; rejected as more complex for the same behavior.
  - *Listener on the `<input type=file>` only*: narrow — users often click the field label/area, not the button; rejected for UX.

**D2: Extract one shared handler (e.g. `handleImageFile(file: File)`); `onPick` and `onPaste` both call it.**
- `onChange={...}` still resets `e.target.value` after pick (re-picking the same file); paste has no equivalent state to reset.
- Prevents the two input paths from drifting apart.

**D3: `e.preventDefault()` only when an image was actually extracted; otherwise return without consuming the event.**
- Guarantees text paste inside the field (e.g. into a focused input) keeps default behavior; the cover picker never hijacks non-image paste.

**D4: Take the first `image/*` entry from `clipboardData.files` (clipboard items with `kind === "file"` map to these files in Chromium/Electron).**
- A screenshot (PNG) and a copied image (often WebP/JPEG/PNG) both surface here; `stageCover` is format-agnostic so no type branching is needed.

**D5: Paste over an already-staged cover replaces it silently, matching `onPick`'s existing implicit replace.** (Spec scenario "Paste replaces an already staged cover".)

## Risks / Trade-offs

- [Focus discoverability: user pastes without the cover field focused → nothing happens] → The field container shows a focus outline (default/`:focus-visible`), and the file input inside it is also focusable; both route the event to the same handler.
- [Multiple images in clipboard] → Only the first is staged; covers are single-image by data model, so this is consistent rather than a defect.
- [Non-image paste does nothing in the field] → Intended (D3); text paste still behaves normally wherever the caret is.
- [Paste staged but never saved] → Reuses the existing staged-cover lifecycle (`discardStaged` on cancel/unload) — no new leak surface.

## Open Questions

None — scope (cover field only, no drag) confirmed by the user.
