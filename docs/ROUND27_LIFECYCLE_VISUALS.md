# ROUND27 lifecycle visual regression

## Reproduce

Run `node scripts/round27-lifecycle-visuals-test.mjs` from the repository root. The dedicated Vite server uses port 4226. Results default to `playtest-output/round27-lifecycle-visuals/results.json`; `ROUND27_VISUALS_OUTPUT` overrides the directory. Do not run two instances on that port. The script exits nonzero on failed assertions and records the actual exit status, browser/network errors, screenshots, asset decodes, layout measurements, and recursive source manifests.

## Evidence boundaries

The regression imports unmodified, genuine current-engine and original pre-handoff-engine producer saves through the real settings file input. It never writes browser state, patches simulation fields, or chooses actions using private future values. Fixed producer routes deliberately exercise branch coverage; they are **not** presented as a new manual 0–40-year playthrough. Successful and failed build fixtures select a seed only after the producer has actually settled year 3. The cancellation route reaches year 34 through actual engine transitions. The separate ROUND27 functional flow owns the full annual UI route.

When `../round27-visual-audit/actual-year40-storage.json` is available, the regression additionally imports that unchanged genuine baseline UI save. This is accurately identified as a reused baseline route. Earlier baseline ending screenshots with missing public assets are not regression evidence. The valid reference audit is `../round27-visual-audit/report.md`; the actual source-chain reference is `../round27-story-audit/068-y40-source-trace.*`.

## Coverage

At 320, 390, 430, and 1280 CSS pixels with standard text, plus 320 and 390 with the app's native 200% setting (computed root font 32px):

- Planning, playback, and ended world cards show the correct phase. Draft counts and impossible planning instructions disappear after submission. Reading and returning preserves exact world and autosave state.
- Submitted action, contract node, actual success, actual failure, and actual cancellation use explicit text labels and notes rather than color alone. Original source-chain prose is checked in full against the imported records.
- Shared-power, weak shared-power, and genuine old-rule endings show the exact existing year-40 opening assessment next to the unchanged original signing outcome and ongoing responsibility. Keyboard source links return to the original focused source.
- Measured panels cannot overflow the viewport horizontally or conceal paragraphs in clipped containers. Vertical scrolling is expected, especially with native 200% text. Viewport screenshots and full-element screenshots have separate filenames and metadata.
- Every public image asset is independently decoded; all page exceptions, failed network requests, and HTTP errors are reported. Recursive source manifests record every src path, byte count, and SHA-256 before and after.

The keyboard helper first enters keyboard modality using Tab, then targets the intended control and verifies its visible outline before Enter. Programmatic focus while still in pointer modality is not mistaken for a product focus defect.

## Run record and visual review

Final focused attempt 4 passed: **491 checks**, actual **exit 0**, **0 page/network/HTTP errors**, **279/279 public images decoded**, **61 unchanged save imports**, **61 layout inspections**, and **122 original PNG captures**. All **56 src files** retained identical recursive path, byte-count, and SHA-256 manifests. The final report is `../round27-visual-focused/results.json`; actual shell exit is `../round27-visual-focused-attempt4.exit`.

Pixel review covered all six viewport/font combinations for the phase card, lifecycle source chain, and ending checkpoint. The 26 curated originals include viewport evidence at every requested size and separate full-element evidence for long 200% text, cancellation, weak/old endings, and the actual baseline import. Text wraps rather than truncates; the long native 200% source chain requires ordinary vertical scrolling. The unchanged actual baseline training ending correctly receives no invented governance checkpoint. The manifest records exact original dimensions, byte sizes, hashes, and review notes.

No production defect or production edit was required by this regression. First focused attempt is preserved outside the repository at `../round27-visual-focused-attempt1`: it exited 1 at a test-only keyboard-modality assertion. Production sources remained unchanged and all 279 public images decoded. No product fix was made in response. Attempt 2 is preserved at `../round27-visual-focused-attempt2` (47 checks, then an ambiguous duplicate source-button selector). Attempt 3 is preserved at `../round27-visual-focused-attempt3` (11 checks, then Playwright's 12-second scroll stability timeout). Both retained unchanged source hashes and zero page/network errors. The harness now selects the visible source button explicitly, uses native instant scrolling, and allows 30-second browser actions.

This is Chromium responsive and keyboard coverage, not physical-device, screen-reader, or human usability certification. Original PNGs are never resized, cropped, or edited; selected originals and hashes are recorded in `docs/screenshots/round-27-lifecycle/manifest.json`.
