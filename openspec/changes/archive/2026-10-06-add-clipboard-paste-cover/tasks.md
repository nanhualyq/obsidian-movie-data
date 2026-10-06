## 1. CoverPicker input refactor

- [x] 1.1 Extract the file-bytes staging logic from `CoverPicker.onPick` into a shared `handleImageFile(file: File)` (read `arrayBuffer` -> `store.stageCover` -> set preview -> `onChange`), keeping `onPick`'s `e.target.value = ""` reset; verify existing tests in `test/ui-forms.test.tsx` still pass (`npm test`)
- [x] 1.2 Make the cover field container focusable (`tabIndex={0}`) and confirm the field shows a focus indicator so paste has a visible focus target (manual check: tab to the field, outline appears)

## 2. Paste support

- [x] 2.1 Add an `onPaste` handler on the cover field container (design D1): extract the first `image/*` from `clipboardData.files`; if found, `preventDefault()` and route to `handleImageFile`; if not, return without consuming the event (design D3)
- [x] 2.2 Add tests in `test/ui-forms.test.tsx` covering the spec scenarios: paste stages an image with preview shown; paste over an existing staged cover replaces it; paste with only text leaves the cover unchanged and does not stage bytes (`fireEvent.paste`); saved pasted cover is written deformed like a picked one; cancel after paste writes nothing
- [x] 2.3 Run full verification: `npm test` passes and `npm run build` (tsc + esbuild) succeeds

## 3. Spec reconciliation

- [x] 3.1 Confirm `openspec validate --change add-clipboard-paste-cover` reports no issues before implementation starts
