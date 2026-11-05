import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as sim from '../src/simulation.js';
import { getCrisisOutlook } from '../src/crisis-outlook.js';

// Reproducible prototype-model verification, not a balance study or human playtest.
// The outlook is read before submission. Only the independent control copy is
// committed and advanced, so future event outcomes cannot inform its projection.
const repository = new URL('../', import.meta.url);
const output = new URL('playtest-output/round6-outlook-matrix.json', repository);
const seeds = [0, 1, 12];
const buildKinds = [null, 'state', 'joint', 'merchant'];
const cases = [], failures = [], skipped = [];

function lock(state, actorId, cellId, actionId) {
  const action = sim.getActions(state, cellId, actorId).find(a => a.id === actionId);
  assert.ok(action, `${actionId} is available to ${actorId} at ${cellId}`);
  for (const evidenceId of action.requireEvidence) {
    if (!sim.getInvestigation(state, actorId, cellId).evidence.includes(evidenceId)) sim.investigate(state, actorId, cellId, evidenceId);
  }
  sim.lockTask(state, actorId, cellId, actionId);
}
function submit(state) {
  for (const actor of sim.getActors(state)) if (!state.drafts[actor.id]) sim.passTask(state, actor.id);
  sim.commitWindow(state);
}
function decade(state) { submit(state); sim.advanceToNextWindow(state); }
function plans(state, actorId) {
  return [{ cellId: null, actionId: null }, ...state.cells.flatMap(cell =>
    sim.getActions(state, cell.id, actorId).map(action => ({ cellId: cell.id, actionId: action.id })))];
}
function sourceHash(path) { return createHash('sha256').update(readFileSync(new URL(path, repository))).digest('hex'); }

for (const build of buildKinds) for (const seed of seeds) {
  const base = sim.createRun(seed);
  if (build) lock(base, 'protagonist', 'D4', `build_${build}`);
  decade(base);
  const recruitment = sim.getRecruitmentRoles(base).length ? 'recruit_risk' : 'recruit_volunteer';
  lock(base, 'protagonist', 'D4', recruitment); decade(base);
  for (const protagonist of plans(base, 'protagonist')) for (const linche of plans(base, 'linche')) {
    if (protagonist.cellId && protagonist.cellId === linche.cellId) continue;
    const state = structuredClone(base), context = { build: build || 'none', seed, recruitment, protagonist, linche };
    try {
      for (const [actorId, plan] of Object.entries({ protagonist, linche })) {
        if (plan.actionId) lock(state, actorId, plan.cellId, plan.actionId);
        else sim.passTask(state, actorId);
      }
      const before = JSON.stringify(state), outlook = getCrisisOutlook(state);
      assert.equal(JSON.stringify(state), before, 'Outlook must not mutate the run');
      if (!outlook.ready) { skipped.push({ ...context, issues: outlook.issues }); continue; }
      const control = structuredClone(state);
      submit(control); while (control.year < 23) sim.advanceYear(control);
      const actual = control.flags.crisis;
      const branch = actual.damage === 0 ? 'success' : 'fallback';
      const expected = outlook[branch];
      assert.equal(expected.available ?? expected.possible, true, 'Actual branch must be available in the outlook');
      assert.equal(actual.damage, expected.damage, 'Average loss coefficient');
      assert.deepEqual(actual.damageByCell, expected.damageByCell, 'Per-region loss coefficients');
      assert.deepEqual(actual.coverageByCell, Object.fromEntries(outlook.regions.map(r => [r.cellId, r.coverage])), 'Per-region warning coverage');
      assert.deepEqual(actual.protectionByCell, Object.fromEntries(outlook.regions.map(r => [r.cellId, r.protection])), 'Per-region source protection');
      assert.equal(JSON.stringify(state), before, 'Control settlement must not affect the planning run');
      cases.push({ ...context, branch, reviewProbabilities: outlook.attempts.map(a => a.probability), damage: actual.damage, damageByCell: actual.damageByCell, coverageByCell: actual.coverageByCell, protectionByCell: actual.protectionByCell });
    } catch (error) {
      failures.push({ ...context, error: error.message });
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  purpose: 'Compare read-only year20 conditional projections with the same prototype model\'s actual year23 settlement.',
  limits: [
    'This is deterministic automated model verification, not human playtesting, real-device certification, or evidence of historical accuracy.',
    'The selected histories use three fixed seeds, four build choices, and risky recruitment when a real post exists. Legal year20 actor plans at distinct cells are enumerated, including explicit passes.',
    'Individual review contracts are retained; this check does not infer independence or combine their probabilities.',
    'Optional surveyed veto, true legacy rules, unresolved drafts, and hidden-roll access are covered separately by tests/crisis-outlook.test.js.',
  ],
  sourceHashes: Object.fromEntries(['src/simulation.js', 'src/crisis-outlook.js'].map(path => [path, sourceHash(path)])),
  seeds, buildKinds: buildKinds.map(kind => kind || 'none'),
  checked: cases.length,
  failed: failures.length,
  skipped: skipped.length,
  branches: Object.fromEntries(['success', 'fallback'].map(branch => [branch, cases.filter(item => item.branch === branch).length])),
  failures, skippedCases: skipped, cases,
};
mkdirSync(new URL('playtest-output/', repository), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: fileURLToPath(output), checked: report.checked, failed: report.failed, skipped: report.skipped, branches: report.branches }, null, 2));
if (failures.length || !cases.length) process.exitCode = 1;
