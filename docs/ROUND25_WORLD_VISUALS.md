# Round 25: world entry and role selection

## Observed problem before this change

A natural seed-0 playthrough reached years 0, 10, 20, 30 and 40 through real controls. At year 30 the first enter-scene button began at document y=195 at 390px, y=194 at 320px, and y=460 at 320px with the application's native 200% text setting. The role picker began at y=1904, y=1945 and y=4624 respectively. Selecting Linche retained the lower scroll position, leaving the enter-scene action thousands of pixels away. No horizontal overflow was needed to reproduce this wayfinding failure.

The old 320px/200% primary button ended at y=530 in a 568px viewport. Adding role controls before it would sacrifice the useful first-screen entry. The change therefore keeps location, actor context and primary button in their existing order, and puts the single planning role picker immediately after that button, before the complete map.

## Visual and interaction contract

- Existing primary entry remains visible in the first viewport at 320px/200% for the normal entry label. Role choices and explanatory status may continue naturally below that viewport.
- The role picker is not sticky and does not cover map, story, or other controls. There is only one planning picker.
- Role names, local contract count and draft status wrap completely. Native 200% uses a single column; no clipping, ellipsis, CSS zoom, screenshot scaling, or hidden status is used.
- Selected role has `aria-pressed`, a border and an inset mark in addition to color. Buttons retain keyboard focus when selected. Native focus outline remains visible.
- Switching roles does not enter a scene, spend investigation rounds, replace drafts, or change world state. Explicitly named alternate-role entry is a separate user action.
- Complete map, scene prose, contract risks, historical outcomes and ending remain intact. Non-planning worlds retain their prior navigation rather than exposing new planning status.

## Reproducible verification

Run from the repository root:

```
node scripts/round25-world-planning-visuals-test.mjs
```

Set `ROUND25_VISUALS_OUTPUT` to choose another evidence directory. The script writes a JSON report, genuine producer/import save fixtures and raw viewport PNGs with SHA-256 digests. It compares the entire live world and persisted save against a real previous producer after each action. It checks source hashes at the beginning and end, and rejects runtime, asset or hot-reload errors.

Coverage includes a natural 0–40 route; desktop, 390px, 320px and native 200% text; keyboard, touch and repeated role selection; a formerly long world page; explicit alternate-role entry; preview return; coordinate selection; settings, reload, new run and actual file import; genuinely older per-scene investigation rules; and locked/passed roles. Automated browser coverage is not physical-device or screen-reader certification.

## Exploratory timing note

Early keyboard exploration observed scroll drift while the test issued Control+Home, focus changes and Enter in immediate succession. A separate capture/animation-frame event probe showed the role handler could preserve its original scroll while the browser's still-running Home movement raced subsequent focus. The test now waits for the actual Home movement to reach the top and settle before testing role activation. This is a test-timing correction, not evidence of an additional gameplay bug. The implemented role handler explicitly restores the activation-time scroll and only brings the role button into view if it is outside the viewport; the final checks retain the strict ±2px activation-time comparison.

## Final verification

Independent frozen-source formal run completed 2026-11-06T15:21:04.717Z: **479/479 checks passed**, 62 original viewport PNGs, zero runtime/asset/HMR errors. Source digest stayed `595c509f70aeabe700b83710a0a88620803b7491b6963c64064900ad15a6de2f` throughout. This independent report, original images and timestamps remain preserved; the manifest retains that run separately from final aggregate evidence. Seven copied, pixel-reviewed screenshots are recorded in [the image manifest](screenshots/round-25-world/manifest.json).

At 320px/native 200%, both normal entry and explicit alternate-role entry start at y=460.3125 and end at y=530.3125 in the 568px viewport. Role selection naturally follows below, rather than being compressed into that viewport. At five viewport/text settings the activated role remains focused, outlined and uncovered, with strict ±2px scroll preservation after the browser's Home movement has settled. The real 0–40 route, whole-world equality, genuine old-save import and all documented interruptions passed.

The locked-policy 390px/200% screenshot shows the complete title and location in the summary, without repeating long titles in both role buttons. The legacy 320px/200% image explicitly retains per-scene investigation semantics. The ending image confirms retained illustration, prose and actual year-31 policy result.

The **third full 48-script aggregate completed with exit 0 and 12,782/12,782 fresh checks passed**, with all 332 production files and 48 scripts unchanged across that run. This visual script was its 48th suite: **479/479**, from **2026-11-06T16:57:15.906Z to 2026-11-06T16:58:21.028Z**, with zero errors and the same source digest. Its final report SHA-256 is `27cc6805339c8c60cd3f44a9241abc9089cfd607b2164626c2dfa7f075d603cb`. This records the successful third aggregate, not a first-attempt pass.

All seven selected final-aggregate PNGs are byte-for-byte identical to the independently focused images already inspected at actual pixel size. No image replacement was needed. The manifest records both run timestamps and report digests, and confirms the seven final image hashes. The aggregate verification record retains the full-run source/script manifests and earlier attempt history.

Selected raw viewport images:

- [390px world and complete map context](screenshots/round-25-world/natural-y30-top.png)
- [320px selected role and free alternate-role guidance](screenshots/round-25-world/320-100-selected-role.png)
- [320px/native 200% first-screen entry](screenshots/round-25-world/320-200-top.png)
- [320px/native 200% selected role](screenshots/round-25-world/320-200-selected-role.png)
- [390px/native 200% complete locked-policy summary](screenshots/round-25-world/390-200-locked-policy-roles.png)
- [Genuine older per-scene save](screenshots/round-25-world/legacy-per-scene-roles.png)
- [Unchanged ending presentation](screenshots/round-25-world/ending-intact.png)
