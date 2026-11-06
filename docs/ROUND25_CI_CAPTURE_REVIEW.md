# Round 25: strict scene-capture CI review

## Scope

This is test-environment hardening for `scripts/local-crisis-visuals-test.mjs`, not a production fix. No production source, SVG assets, CSS, fixtures, or pixel data were changed. The suite requests Chromium `--disable-gpu-rasterization`. Only physical `.scene-art img` capture waits for image decoding and fonts, returns through normal scrolling to the page top, requires full visibility, and checks unchanged geometry across two animation frames. Actual source, dimensions, scroll position, decode status and visibility are recorded.

The existing exact PNG-byte equality and all 384 original checks remain. Four checks additionally reject genuinely different aid-only and closed-service illustrations, two per viewport. No threshold, mask, resampling, synthetic image replacement, best-of selection, or retry-until-match is used.

## Exact failure and reproduction

Round24 commit `6f84bb067f325cd7375ef209be7efb624d9bcde3`, CI run `42237967024`, artifact `13518986554`, failed the 320px loss/zero physical-scene comparison. Artifact SHA256: `657451b6d58744219c0667723d1cd5f4cdc1c6f08808711e6e04a2af725104f7`.

The 390px loss/zero decoded images are identical. At320px, both PNGs are286×151 and differ at11 pixels, bounding box `(25,57,140,108)`, maximum channel difference91. These are actual palette-color swaps at diagonal SVG crisp-edge boundaries, not metadata differences. Source, alt and caption equality passed; runtime/asset errors were empty.

Repeated captures of the **same loss state**, after decoding/fonts and with identical final geometry, reproduced both exact CI images: `same-state-variant-zero.png` matches CI zero with zero pixel differences; `same-state-variant-loss.png` matches CI loss with zero pixel differences. History state therefore is not necessary to produce the observed difference. Merely waiting for decoding, or merely returning to page top, did not eliminate it.

## Controlled results

- Original capture under450ms real asset latency also exposes a separate readiness race: some390px images are incomplete/naturalWidth0 and150px tall when captured, versus decoded178px images. Readiness must be checked independently of rasterization.
- One preliminary page-top batch was8/8 identical, but its extended450ms batch was22/24. The preliminary candidate was withdrawn. Its diagnostic exit0 initially reflected recording rather than asserting; this was corrected immediately, reports retained, and subsequent expectations use hard assertions.
- Stable-frame protocol, default GPU/SwiftShader path,450ms real asset latency: **22/24 identical**, two exact11-pixel CI-pattern differences; hard assertion exits1. Aid-only and closed negative controls both reject.
- Same protocol plus software-raster flag,450ms latency and alternating320/390 preparatory viewport: **24/24 identical**; both negative controls reject. Aid-only differs1738pixels and closed differs2133pixels from loss.
- Second software-raster batch,125ms latency and preparatory viewport order320,320,390,390,320,390 repeated: **24/24 identical**; both negative controls reject. Final capture viewport remains320px.
- Complete original suite with software flag and450ms latency: **384/384 original checks passed**. This is separate from an earlier248-check diagnostic that covered only the first viewport/large-text section.

These controls support a raster-path-dependent explanation and an explicit software-raster test environment. They do not prove a particular Chromium internal bug or mathematical determinism for every possible execution.

## Integrated verification

Final frozen-script runs: normal loading **388/388 passed, exit0**;450ms real asset latency **388/388 passed, exit0**. Both preserve the384 original check names and order, have no runtime/asset errors, and record10/10 decoded, fully visible, stable physical captures at scroll0. The delayed run records5012 delayed asset requests. Script SHA256: `5a0dbd8560c02ff474ce197709c6da3c30f37941b3745032713355b9bc6de318`; Git blob: `c07cd6d151dbc49604c77325d44683cafca6dd48`. The full repository browser aggregate and remote CI remain separate gates owned by the parent task; this document does not claim either passed.

## Evidence

Unmodified original and reproduced PNGs are in `docs/screenshots/round-25-ci/`. Its manifest records hashes, counts, retained negative results and final script identity. Failed preliminary and default-path results are retained rather than replaced by passing trials.
