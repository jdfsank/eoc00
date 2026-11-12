# Rebuilt iteration49 acceptance

This auditor is newly reconstructed, not recovered bytes of the lost auditor. Iteration48 verification provides historical schemas and minimum counts only. Fresh results are required after the final source freeze.

```
node round49-rebuild/acceptance-rebuilt49.mjs \
 --repo eoc00-round49-rebuilt \
 --freeze round49-rebuild/validation/freeze.json \
 --stages round49-rebuild/validation \
 --baseline round49-rebuild/base-files.json \
 --catalog round49-rebuild/browser-catalog.json \
 --output round49-rebuild/validation/acceptance.json
```

Freeze `startedAt` is Unix seconds. `hashes` maps relative paths to SHA-256 for every regular file under src, tests, scripts, public, .github, plus index.html, package.json, package-lock.json, vite.config.js. Inventory and bytes must remain unchanged through execution and audit.

Each sequential stage needs `<name>.started`, `.finished` (Unix seconds), `.exit` (zero), `.command` (exact below), and complete `.log`:

- unit: npm test
- build: npm run build
- browser: npm run test:browser
- teaching: npm run test:teaching-timing
- matrix: npm run test:outlook-matrix
- tradeoffs: node scripts/round21-training-choice-balance.mjs
- roles: node scripts/round22-role-opportunity-audit.mjs

Unit count comes from the new log and must exceed baseline3068, without fail/cancel/skip/todo. Lost-version3092 is not assumed.

All274 baseline tests/scripts must match original Git blob SHA. Existing runtime changes allowed only in src/main.js, src/style.css, package.json and .github/workflows/verify.yml. New inputs are exactly src/teaching-timing-context.js, src/teaching-timing-view.js, tests/teaching-timing-context.test.js, scripts/round49-teaching-timing-test.mjs. Review any scope change before freeze.

Original81 ordered browser suites and81 separate report paths are required. Fresh report mtime and embedded timestamps must lie within the single complete browser stage. Each check strictly passes and historical minimum counts remain. 56 suites require recomputed intrinsic hashes;25 have no intrinsic hash, and that limitation remains disclosed.

Teaching report: playtest-output/round49-teaching-timing/report.json, nonempty all-passed checks, empty errors, no failure. inputsBefore/inputsAfter are SHA-256 of JSON.stringify(rows), with rows [relativePath,fileSHA256] generated recursively through src then tests then scripts, sorting each directory using JavaScript localeCompare. Embedded timestamps must lie within the teaching stage.

Matrix, tradeoffs and role checks use raw rows, not only summaries. The sampled balance audits must retain balanced:false and are not global or human-tested balance certification.

Two known optional round27 genuine historical actual-play checks remain missing. A489-check report is recognized only with the exact original omission reason, missing optional file and absent imported actual-play row. If every other check is valid, result is evidenceValid:true, baselineCoverageEquivalent:false, passed:false, exit1. Never call this strict coverage completion. Any unexplained missing checks or unfinished stages produce evidenceValid:false.

Preparation verification: node --check passed. Missing-freeze negative control correctly returned exit1/evidenceValid:false, recorded in auditor-negative-control.json. No game test was run during preparation. Final acceptance awaits fresh execution.
