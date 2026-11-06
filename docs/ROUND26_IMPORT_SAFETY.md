# Round 26 import-order safety

## Independently reproduced baseline failure

The authoritative baseline was remote commit `f781b25e0b03aa550540b8f9fb631943078fe461`, tree `8de0c209b15a7a1c199178deb77a91bb7f6c8d8a`. An independent comparison matched all 1,109 local files' Git blob hashes against that tree; the old local Git HEAD was not used as an oracle.

Two real-control races were reproduced without changing the game's world, production code, file bytes, rules or save schema. An explicit test-only Promise held the completion of `File.text()` after it had read a genuine producer file:

1. Slow file A (seed 101), then fast file B (seed 202). B's complete in-memory world and localStorage world matched its genuine producer. Releasing A replaced both with A's entire world.
2. Slow file A, then an actually confirmed new game (seed 303). The confirmed world's full memory/save matched the producer. Releasing A replaced both with A's entire world.

Normal import of the same genuine file twice succeeded with exact full memory/save equality. The timing probe completed with no page errors and unchanged main.js SHA-256 `7f1eb43a90d55d19053d540c2594174fc7e88da76402076c2cb812e44fb91af5`.

This establishes a deterministic asynchronous-order defect, not frequent natural file latency. An earlier exploratory run completed the first case but lost its browser during second-context creation; that partial report was retained and was not counted as the completed probe. A fresh full run completed all three cases.

## Request ownership

`createImportRequestGuard()` exposes `begin()`, `isCurrent(token)` and `invalidate()`. A request token is a unique frozen object, not an incrementing numeric ID. The guard is transient UI state and is never serialized or included in rule versions.

Only selecting an actual file begins a request. A newer actual file supersedes the previous request even if the new file later fails validation. A chooser cancellation that supplies no file does not supersede an existing read. Navigation and an executed new-game confirmation invalidate pending work. Simply displaying the new-game confirmation does not itself create a new world.

Every asynchronous completion checks whether it still owns the request. Stale valid bytes, malformed JSON and read failures are discarded without changing world, save, navigation or status. Text-size changes and exporting while remaining in settings are read-only with respect to the world and do not cancel the read. The user can leave settings without waiting; subsequent investigation, locking, submission and annual progression cannot be overwritten by the abandoned read.

## Independent regression

- `node --test tests/import-request-guard.test.js`
- `node scripts/round26-import-safety-test.mjs`

The unit suite checks initial rejection, unique immutable identities across 10,000 requests, invalidation, separate guards, destructured methods, no-file cancellation, and out-of-order success/error callbacks.

The browser suite uses actual file inputs and controls. Selected genuine `File.text()` completions are held, including deliberate rejection of a held read. The existing board-readiness test plugin exposes the actual Phaser instance only to await its load completion and postrender event; it does not change renderer behavior. It does not set the application's world, call its navigation API, fabricate rules, replace content bytes, inject styles, simulate screen zoom, or edit screenshots. It covers:

- Slow A / fast B, slow A / invalid B, stale JSON and read errors after B, current read errors, oversized files and invalid worlds.
- Actual new game versus merely opening its confirmation.
- No-file chooser cancellation and normal repeated import of one file.
- Leave and re-enter settings, including stale successful/failed reads; a separately labeled synthetic pagehide handler check; actual external navigation/Back with recorded same-document versus fresh-document status (not general BFCache certification).
- Text-size change and export while pending.
- Real investigation, lock, submit and annual advance after leaving a pending import.
- Genuine round-21, round-20 and original per-scene producer imports at years 0, 20 and 30, then real reload with complete memory/save equality.
- Native 320/390px viewports with 200% root text, complete loading instructions, horizontal bounds and original screenshots.

`ROUND26_IMPORT_QA_OUTPUT` selects isolated output; the default is `playtest-output/round26-import-safety`. `ROUND26_IMPORT_QA_PORT` defaults to 4214. Generated reports state source hashes before/after, exact assertions, errors, capture paths and scope.

## Verification status and limits

The new guard's final-v3 unit run passed 9/9 with no skipped tests. The initial read-only baseline ran five focused existing test files, 60/60 passing; it was not a new full unit or 48-suite browser pass. The fourth complete focused run, against the final v3 production freeze, passed **181/181 with exit 0**, with no page, network or HMR errors. It ran from **2026-11-06T18:03:47.883Z to 18:05:06.774Z**. All 335 frozen production files were independently rehashed before and after with no differences; production hash is `a5b9bb3c078beac986ff539d6003c4447d8a723ae601e3a5537df9f39615cf68`. The focused source hash remained `013ebb32735202d690b7ed6ebe12f5a48d7fce0ba3d3920339a26e0c27c864f8`. Its `requestFailures` and `errors` arrays are both empty, so **no request failure was classified as an allowed download handoff**. The fresh guard unit run passed 9/9.

A third complete run against the earlier v2 focus freeze also passed 181/181, from 18:01:42.892Z to 18:02:06.043Z. It was preserved separately, not promoted into the final-v3 result. The first and second focused attempts each failed 175/176 with exit 1 under the initial freeze; their logs, reports and captures remain retained. The final-v3 pass is a new full focused run, not a union of earlier checks. The parent independently coordinates the subsequent 51-suite aggregate; this focused result does not claim that aggregate passed. Existing historical results are evidence about their own runs, not a substitute for current regression.

The input-order contract does not add multi-tab synchronization, backups for corrupt localStorage, storage-quota recovery, or browser/OS file-picker cancellation events that deliver no `change` event. No claims are made for natural race frequency, physical mobile devices or assistive-technology announcements. The existing normal save-validation, legacy contracts, simulation and original narrative remain separate invariants.

## Preserved exploratory test failures

The first two complete focused attempts each reached all behavior/layout checks, then failed the final error audit (175/176, exit 1). The first test injected a document-ID helper using crypto.randomUUID on about:blank, where that API was unavailable. Both attempts also navigated or reloaded before newly started Phaser texture loads were complete, producing ERR_ABORTED reports. The crypto helper was corrected; a network-idle wait alone did not settle a newly booting game. The replacement waits on the real loader and postrender using the existing read-only board probe. Production was unchanged for those corrections, and every request failure remains recorded.

A successful export is independently recorded by its exact download URL, successful saveAs completion, null download failure and complete exported-world equality. Only an ERR_ABORTED for that exact verified blob URL could be classified as normal download handoff. Unknown blobs, other error types, HTTP resources and unverified contents are explicit rejection controls. The completed v2 run reported **zero request failures**, so no failed resource was exempted in that pass. A small stable-source diagnostic also completed three real imports and verified export without resource failures. An earlier diagnostic encountered the parent's announced production HMR and was retained as exploratory evidence only.

Both final-v3 320/390 native-200% loading-status captures were inspected as actual pixels and copied byte-for-byte into `docs/screenshots/round-26-import/`. They are also SHA-identical to the previously reviewed v2 images; the final copies and [selected-image manifest](screenshots/round-26-import/selected-manifest.json) point to the fourth run. The complete reading/cancellation instruction is visible and wraps naturally without horizontal clipping. The screenshots scroll to the loading status; they do not claim the entire settings page fits in one viewport. A prior import-success toast remains visible in the 390px capture without covering the loading instruction, preserving the existing toast-lifetime behavior. Native browser file-picker labels abbreviate the selected filename; the game's loading instructions are not truncated.

Final browser script SHA-256: `9a89c160b1ca86075b48aac8fe790a7742c9b47d111fe9bd72c7569b8ac3d823`. Final focused report SHA-256: `b80898c77a6d5cecb03c5370cd845f581fd99a0c9798a3a4fff7ec738da8aa17`. The browser script is frozen for the subsequent full aggregate.
