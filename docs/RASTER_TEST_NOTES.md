# Exact image identity and SVG screenshots

Round 12 CI failed only the unchanged-image half of a combined near-scene assertion. The actual fee/public screenshot comparison passed. Its 390px paid/control PNGs were both 356×179; their decoded images differed at six internal crisp-edge pixels. Fee/public differed at 810 pixels in the entrance region. This was not a rounded-corner crop.

A read-only browser diagnostic (`scripts/diagnose-access-raster.mjs`) uses the real decoded scene image and the same Noto Sans/Serif CJK fonts as CI. At the normal DOM rectangle x=17, y=449.953125, width=356, height=178, the local screenshot exactly matched the CI control. The same image's native 1000×500 RGBA remained identical when its subpixel position or compositor layer was changed:

- Moving by 1/64 CSS pixel changed 139 screenshot pixels.
- Giving the same image an identity `translateZ(0)` or `will-change: transform` changed nine crisp-edge pixels. Every one of the CI's six changed coordinates and resulting RGB values was reproduced, plus three extra differences.
- Identity opacity/grayscale filters changed ten pixels; restoring the normal styles restored the original screenshot exactly.

These experiments reproduce the class of rasterization change and all six observed pixel transitions, not the exact CI compositor history. No runtime CSS or asset was changed to make the test pass, and no pixel tolerance or crop is used.

The regression now separates two requirements:

1. Different access arrangements must differ in the real displayed screenshot and in the actual decoded image. Existing grayscale and map differences remain checked.
2. An unchanged scene must have exactly the same SHA-256 of every native RGBA byte, native dimensions, actual rendered width/height, opacity, filter, transform, object-fit, object-position, image-rendering, visibility, display and parent filter/opacity/transform. The sample is drawn from the currently displayed `<img>`, not fetched from an expected filename.

The report stores rectangles, scroll offsets, current source and native RGBA hashes. A negative control replaces the actual image with the wrong access artwork while retaining labels, state and display geometry; the strict RGBA comparison must reject it, then accept the exactly restored image. This avoids mistaking a compositor-dependent SVG rasterization choice for changed game artwork without weakening the actual fee/public distinction.

A second, separately labelled negative control changes only the actual image-rendering style. Native RGBA and game state must stay equal while the strict display comparison rejects the style; restoring it must restore all display fields and the exact native pixels. Neither diagnostic style injections nor negative controls are presented as normal UI evidence.

## Verification and publication boundary

The failed baseline is `fa213a00185867e5d85b5cfaa9e98c43f929a1fc`, Actions run `42062064479`; unit tests and build passed, the browser aggregate stopped at this assertion, and the matrix was skipped. Artifact `13433174635` preserves the original failure. Its ZIP SHA-256 is `cc173541e3f2b001dce47395c176845db907a4f28584bec776a94bf574c143bd`.

The repaired dedicated suite passed 352 checks locally with zero page/resource errors, including wrong-image and wrong-image-rendering negative controls and exact restoration. The independent review verified the six matching transitions and independently passed both negative controls. This is evidence for the narrower test repair, not a claim that the failed remote run passed; a new exact-commit CI run is required. The narrow repair commit changes only this test, the standalone diagnostic, and these notes, with no game source, asset, probability, history or score changes.
