# Round 38: succession fork browser evidence

Run from the project root with `node scripts/round38-succession-fork-test.mjs`. Optional `AW_OUTPUT` selects a separate evidence directory. The default is `playtest-output/round38-succession-fork`.

The test makes year-10 saves by running the genuine current, archived pre-staffing and original legacy simulation producers. Seed 0 produces a successful station, seed 6 a failed-build archive, and an explicit pass produces no institution. It does not inspect future rolls or inject browser state or DOM. Imports use the real file control.

Current routes cover all combinations of 320×568, 390×844 and 1280×900 viewports with native 100% and 200% text. Assertions compare the visible fork against the actual available action IDs and resolved jobs, and preserve original button title/ARIA/action identifiers, full card tradeoffs, research markup and original preview descriptions. The checks also exercise repeated pointer activation, keyboard navigation, real evidence detours and investigation payment, an existing reversible draft, preview return/reload, and unsupported legacy/place/year boundaries.

Each free navigation checks the entire live world and autosave against its genuine producer snapshot. Paid investigation and draft creation are mirrored by the actual engine and checked exactly. All actions retain the default 12-second timeout. The report includes recursive source hashes before/after, raw viewport PNG hashes/dimensions, layout measurements and browser/network/hot-update errors. A changed source hash fails the run. Original PNGs are not composited or resized. These results are headless Chromium evidence, not physical-device, screen-reader or human playtest certification.
