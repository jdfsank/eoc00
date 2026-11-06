# Round 25 independent QA

## Scope and oracle

Independent tests use the actual public simulation API and genuine saved-world producers from `tests/fixtures/pre-decision-flow-producer`, `pre-training-workload-producer`, and `pre-tradeoffs-simulation.js`. Browser tests import these producers' JSON through the real settings file input. No browser world replacement, fabricated evidence, forced future outcomes, screenshot stitching, or image scaling is used. Deliberately malformed **DOM action targets** test handler rejection without changing the world; corrupt public records are isolated unit-test inputs only.

The natural Chromium control route starts a seed-0 run, builds the joint station, recruits the successor, signs free warning and trains the network, then signs shared power and establishes Linche's future-check seat. Every lock, submit, and annual step through year 40 compares the complete in-memory and localStorage world byte-for-byte against the independent historical producer. Unit tests repeat annual differential checks for seeds 0, 6, 12, and 42 against two real producers.

## Commands

- `node --test tests/round25-world-planning-flow.test.js`
- `node scripts/round25-world-planning-flow-test.mjs`

The browser command writes raw reports, genuine import files, and original screenshots under `playtest-output/round25-world-planning-flow/`. `ROUND25_QA_OUTPUT` can select a separate exploratory output location. Curated documentation images are copied manually into `docs/screenshots/round-25-qa/`, never overwritten by running the script.

## Coverage

- Exact public local-contract counts for every available role and all 64 cells at each planning year across four producers; unknown, inactive, malformed role/location inputs.
- Zero-contract Linche at year-30 D4 receives the intentional protagonist entry. Repeated activation changes the UI role and opens free reading without changing a draft, cost, investigation, or saved world.
- One actor control per available actor; selected `aria-pressed`; actual selected-role shared budget; honest original per-scene budget wording for genuine legacy imports.
- Locked/pass/unknown draft distinctions; irreversible evidence spending and independent role budgets; unread evidence absent from the DOM; exhausted protagonist evidence cannot be bypassed through preview.
- Frozen input, detached output, and traps on seed, baseline, snapshots, outcome rolls, and historical material prose.
- Original scene bodies retained. The new paragraph and question match the bounded public-contract reader exactly. Contract-compatible modern crisis saves remain eligible even if their unrelated training version is older. Genuine per-scene or legacy overall-crisis rules do not acquire this context.
- Direct preview and confirmation return focus; settings, refresh, replacement import, and new-run reset; no new planning summary or alternative action in playback/ended states; ordinary history fallback where all roles lack contracts.
- Real 320×568 and 390×844 Chromium viewports at native 16px/32px root text. No horizontal overflow; full primary CTA first-screen visibility; actor controls immediately after the CTA and before the map; visible keyboard outline, minimum 44px targets, and scroll preservation for already-visible role changes.
- SHA-256 equality of protected simulation, save, and story source against independently captured main `6f84bb067f325cd7375ef209be7efb624d9bcde3`.

## Exploratory findings and corrections

1. An initial test assumed all older producer saves should omit the scene context. That expectation was corrected after checking the scope: compatibility is defined by the actual public investigation and local crisis contracts, not by an unrelated training marker. The old body, history, contracts, and saved world remain unchanged.
2. A test initially required the actor picker itself to begin in the first viewport. That exceeded the agreed design, which preserves the main CTA in the first viewport and lets the picker naturally continue immediately below it. The failed measurement is retained: at 320/200 the picker began at y593.109 and ended at y853.703. The replacement assertion checks actual adjacency, bounded gap, map order, focus, and scroll rather than shrinking text.
3. That measurement exposed a genuine separate issue: the **primary CTA** at 320×568 / 32px extended from y509.109 to y579.109, below the viewport by 11.109px. It was reported independently, with a direct actual-DOM reproduction, before formal acceptance. The parent removed the redundant selected-role no-contract phrase only for the alternative entry; the zero count remains in the role control and summary. Independent retest measured the full CTA at y460.313–530.313 with the same 320×568 viewport and native 32px text. No type shrinking or content truncation was used.

## Formal status

**Frozen focused run passed.** The independent unit suite passed 13/13. The complete browser run passed 371/371 assertions, generated 16 original screenshots, and recorded no page, network, or HMR errors. It ran from 2026-11-06T15:17:10.070Z to 15:18:53.580Z on Chromium 138.0.7204.0. Source SHA-256 before and after was identical: `595c509f70aeabe700b83710a0a88620803b7491b6963c64064900ad15a6de2f`.

Six focused screenshots were reviewed as actual image pixels and copied without alteration to `docs/screenshots/round-25-qa/`. Their provenance, bytes, and SHA-256 values are in `selected-manifest.json`. The 320/200 primary CTA is wholly visible; keyboard focus is visibly outlined; the 390/200 role controls retain their names and exact contract counts; the year-20 B4 paragraph sits after the unchanged original body; the returned policy card remains readable. Longer native doubled-text content continues vertically rather than being compressed.

Measured initial CTA bounds (top–bottom): 320/100: 194.266–246.266; 320/200: 460.313–530.313; 390/100: 194.969–246.969; 390/200: 390.719–460.719. The picker starts 14px after the CTA in every combination. Both keyboard focus and strict scroll preservation for already-visible controls passed.

The focused raw report, original UTC times, six original images, and selected-image manifest were separately archived before aggregate runs overwrote the default output. They remain preserved.

**The third complete aggregate attempt passed: exit 0, all 48 suites, 12,782/12,782 checks, fresh reports and no reported errors.** All 332 production files and 48 test scripts remained frozen throughout that successful aggregate, as verified by the aggregate coordinator. The first attempt failed and the second was intentionally interrupted; only this third run establishes the full aggregate result.

This independent suite was number 47 and again passed 371/371 checks with zero errors, from 2026-11-06T16:56:23.497Z to 16:57:15.426Z. Its report SHA-256 was independently verified as `899dcf823949f4906e8976dab8f5f260de1d04423b6d5982c4b5bf84357dbb10`; source hash before/after remained `595c509f70aeabe700b83710a0a88620803b7491b6963c64064900ad15a6de2f`.

The six selected images now refer to this final aggregate run. Five are byte-identical to their focused originals. The 320/100 returned-card image differs within the card area and was viewed alongside the focused original before replacement; the card title/content and layout remain readable. No image was resized, combined, or retouched. The updated selected manifest records both final provenance and the original focused hashes/times.

## First aggregate attempt and legacy navigation adapter

The first complete aggregate attempt exited **1**: scripts 1–36 completed consecutively, and script 37 (`round19-investigation-choices-test.mjs`) failed at `390px100% D4/linche: unavailable actor/site safely offers no planning or paid material controls`. This is a failed aggregate attempt, not a green full run. The original script, failure report, full log, exit code, and script hashes were preserved before adaptation.

Independent diff review found one changed helper only: `select()` previously clicked the primary action blindly after selecting a requested actor. At year-30 D4, the new primary action explicitly offers the protagonist's scene when Linche has no local contract. Clicking that opt-in correctly changed the actual UI role to protagonist, while the old test continued asserting Linche's null plan. The adapter now leaves that explicit opt-in unactivated **only if** the target is a different currently available actor, the requested actor has zero local contracts, the target has actual contracts, the visible button identifies the target, the accessible name promises free viewing, and the UI still shows the requested actor on the world screen. It also verifies the complete world and save remain unchanged. All original no-plan/no-paid-controls assertions and the other helpers remain intact. No production change was made for this adaptation.

An independent short real-UI run passed **70/70 checks** at 320×568 and 390×844 with native 16px/32px text, from 2026-11-06T15:51:41.489Z to 15:51:53.239Z. It used genuine producer imports and actual role/list/location navigation. Before explicit activation, Linche remained selected in the world, no planning or paid material controls existed, and the entire state/save stayed exact. Explicit activation alone opened the protagonist's free scene. Negative controls rejected a nonexistent target, self-target, wrong requested-role argument, an already-actionable protagonist, and a forged `plan-as` on that already-actionable role. Production handler rejection also preserved the complete world. There were zero runtime errors, and `main.js` remained SHA-identical throughout.

The adapter is a narrowly validated navigation compatibility fix, not a skipped behavioral assertion. Its reviewed SHA-256 is `2c314908cdd60898a2b5dfbb9226e89aecda485d037fda1874efb0a75794a8ec`. The final aggregate subsequently restarted from script 1 and completed all 48 suites; focused passes and the earlier green tail were not used as a substitute.

## Interrupted second attempt and strict scene capture

The second aggregate attempt was deliberately stopped with exit **130** to investigate the independently retrieved remote round-24 CI scene-comparison failure. It is not counted as an aggregate pass. The unchanged-loss reproduction yielded both exact CI PNG variants, demonstrating that the recorded history was not required to produce the observed difference; no specific internal GPU cause was claimed proven.

The chosen suite-20 repair retained strict PNG equality, all 46 original assertion-bearing source lines, and the original 384 checks. It added a suite-local software-rasterization launch flag, image decoding/font readiness, real page-top positioning, stable visible-frame assertions, and four real aid-only/closed negative controls. Negative inputs require nonempty screenshot strings. No production styles/assets, pixel tolerances, masks, or image postprocessing were introduced. The alternative rendering-input oracle was not adopted. Independent read-only review approved final suite-20 SHA-256 `5a0dbd8560c02ff474ce197709c6da3c30f37941b3745032713355b9bc6de318`. The third complete aggregate, rather than either earlier attempt, supplies the final exit-0 result.

## Limits

Chromium automation and visual review do not certify physical mobile devices, browser/OS page zoom, assistive technology announcements, or subjective narrative/balance quality. Native doubled root text is tested, not simulated zoom. No production files, existing tests, or package scripts are owned by this independent QA change.
