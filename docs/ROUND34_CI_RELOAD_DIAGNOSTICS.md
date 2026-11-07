# Round 34: retain the failed reload's evidence

## Exact remote failure

Candidate 3 commit `f967da5e716e41de7709162866d8a386c039853c`, [CI run 42374751474](https://github.com/jdfsank/eoc00/actions/runs/42374751474), failed in browser suite 20, `scripts/local-crisis-visuals-test.mjs`. Its first 48 checks passed. After `390px missing: rendering preserves exact saved facts`, the next fixture was `390px partial`. The original `page.reload()` completed, then the unchanged visible-canvas wait timed out after 30 seconds. The failure screenshot is an entirely white 390 × 844 image, SHA256 `3a4fec990a4a47f1426a212097d2ac542367987be8b1ea2be46141ff15f49750`.

The report's `errors` array was empty. That array observed JavaScript page errors and HTTP failures under `/assets/`; it did not observe failed entry/source/optimized-dependency requests, console load errors, page crashes, or browser disconnection. Empty recorded errors therefore do not establish successful module loading. The later 44 browser suites and the outlook matrix did not run. A passing production smoke is not a replacement for this failed gate.

## What was reproduced

An isolated copy of the exact candidate-3 application ran the complete local-crisis suite with additive event/DOM diagnostics: **388/388 checks and all 58 fixture reloads passed**, including the formerly failing partial fixture. No production source changed. This does not reproduce the spontaneous remote failure and does not identify its cause.

A separate, explicitly injected negative control first loaded the real page successfully, then aborted only `/src/main.js` on one reload. The document response was HTTP 200 and the original canvas wait still rejected at 30 seconds. The original `errors` array remained empty. Its original screenshot has exactly the remote white-image SHA256 above. Added observers recorded `net::ERR_FAILED` for `/src/main.js` and the corresponding console load error. The failure-only DOM snapshot showed `readyState: complete`, an empty `#app`, no injected styles, and no `window.afterwave`.

This proves a concrete diagnostic blind spot: module-load failure can produce the complete observed signature without a fixture/rendering exception. It **does not prove that the remote run had this injected failure**, or assign the incident to the application, Vite, Chromium, or the runner. A production patch would be speculative on the retained evidence.

## Narrow implementation

Only the failed suite and test support change:

- `scripts/helpers/reload-diagnostic.mjs` records a bounded rolling history of document responses, HTTP failures across all paths, failed requests, relevant console messages, page errors, load events, crashes, and disconnection. The newest 120 events are kept, with a dropped-event count. Event callbacks cannot escape into the test, and the observations are separate from the original `errors` array.
- The existing fixture operation is invoked once with the same `page.reload()`, visible-canvas wait, and 130ms post-ready wait. No timeout argument, retry, browser flag, fixture, readiness condition, screenshot comparison, assertion, or exit policy is changed.
- Each operation records its fixture, viewport, last completed check, elapsed time, and outcome. Success records do not inspect the DOM. Only an original rejection triggers one read-only DOM/resource snapshot, bounded by a **600ms host deadline**. Snapshot HTML is capped at 16,000 characters, resource entries at 64, and resource names at 2,048 characters. Unresponsive or disconnected pages produce an unavailable diagnostic. The **same original rejection object** is rethrown regardless of diagnostic outcome.
- `tests/reload-diagnostic.test.js` checks original success/result identity, original failure identity, exactly one invocation, no success DOM observation, observation failure, a hung observation's host deadline, a late rejection, bounded event history, listener disposal, and callback-failure isolation.

Ordinary reloads can cancel old asset requests. The added event log intentionally does not silently turn these observations into a new success/failure policy or replace the original policy. It records evidence for the next genuine failure.

## Verification and limits

The final frozen helper unit tests pass **7/7**. The final frozen browser suite passes **388/388, exit 0**, with exactly the same check names and order as the pre-integration baseline, all **58/58 fixture operations completed**, **zero success DOM snapshots**, and no original runtime/asset errors. The isolated application source has zero file differences from the archived candidate-3 `src` tree. The suite and helper used in this run are byte-identical to the candidate working files.

The separate real injected module-failure control passes its expectations: the original visible-canvas gate rejects after 30 seconds, the operation is invoked once, the wrapper rethrows the identical error, the failure-only snapshot is available, and the white PNG matches the remote hash exactly. No failure is retried until it passes. Local tools were Node 24.22.1, Playwright 1.56.1, Sparticuz Chromium 138.0.2 and Vite 7.2.2; the remote workflow selects Node 22, so this is not a claim of runner-environment equivalence.

The local investigation retains original screenshots, reports, event logs, exact-source provenance, and the original-versus-instrumented suite diff. This is diagnostic coverage, **not a claim that the remote failure is repaired**. Final aggregate tests, the final candidate's exact remote commit, and that commit's CI remain independent required gates. No merge or deployment is implied.
