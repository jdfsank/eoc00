# Crisis-map records

## Scope and provenance

Round 16 connects the existing, previously unpublished `getCrisisRegions` presentation model to map drawing, a separate record legend, selected-region text, and the coordinate directory. The published baseline board (`../eoc00-baseline-board.js` during review) had no crisis drawing or crisis-model import. This is a visible map/display change, not a simulation rewrite or new crisis mechanic.

The source model checks the saved milestone identity, kind, year, reality, confirmation, D4 storage coordinate, and exact affected-region scope. Current institutions, global outcome labels, years alone, other regions' values, and future fields cannot fill a missing local result. It additionally validates navigable source chains before offering a trace link. Its strict four-region scope suppresses geographic placement when the stored scope cannot be verified.

- Triangle/exclamation: actual year-14 warning, not future losses.
- Folded page/solid diamond: actual year-23 tally with a positive stored local loss coefficient.
- Folded page/open circle: actual year-23 tally with an explicit stored local zero.
- Dashed box/question: missing/inconsistent milestone or missing local detail, including older saves without per-place coefficients.

The existing model was retained rather than changing its data contract. No simulation, RNG, actions, world facts, or saves are migrated or recalculated.

## Presentation and interaction

Badges are drawn above scenery, on the left side of each affected tile. Institutions remain unchanged. Dispatch and pending-hourglass chips stay above roofs. The record offset is (-21, -15): the extra vertical separation prevents the E4 page from touching the F6 pending chip. The selected coordinate label moves to the right of its tile: actual mobile grayscale inspection found that its former bottom-center position overlapped the neighboring F6 record when D5 was selected.

The separate legend states that badges describe historical records, not damaged buildings or present coverage. Selected-region text gives the full status, stored coefficients where supported, and safe source navigation. The coordinate directory uses the same model, includes D4/E4/D5/F6, names its filter by the record stage, and retains full text without reliance on color. It replaces the previous hardcoded D4/F6/year-only warning filter.

Overview badges are compact location cues; focus at 2.5×, the legend, and equivalent coordinate/selected text provide detailed reading on small screens. At 200% app text size, the map controls and legend wrap without horizontal overflow. Focus and drag remain inspection only.

## Verification

- `node --test tests/crisis-regions.test.js tests/local-crisis-record.test.js tests/crisis-history.test.js`: 40 passed.
- `node scripts/crisis-map-test.mjs`: real headless Chromium at 320/390 CSS-pixel widths, 100%/200% app text setting, warning/loss/explicit-zero/legacy-unknown/draft/pending fixtures, focused grayscale captures, source navigation, keyboard coordinate selection, map pan, read-only state comparison and reload.
- Browser output and screenshots: `playtest-output/round16-crisis-*`; final assertion count is recorded in `round16-crisis-map-report.json`.
- Physical devices and native browser page zoom were not certified; 200% is the application's accessible text-size setting.
