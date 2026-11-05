import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import * as priorPlanning from './fixtures/pre-tradeoffs-simulation.js';
import { getCrisisOutlook } from '../src/crisis-outlook.js';
import { restoreSave } from '../src/save.js';
import { investigateAndLock as lock } from './helpers/play.js';

const copy = structuredClone;
const round = value => Math.round(value * 10000) / 10000;
function finishDrafts(s, api = sim) {
  for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id);
}
function decade(s, api = sim) {
  finishDrafts(s, api); api.commitWindow(s); api.advanceToNextWindow(s); return s;
}
function twoActors({ seed = 12, records = false, build = null, risk = false } = {}) {
  const s = sim.createRun(seed);
  if (records) lock(s, 'protagonist', 'B4', 'preserve_records');
  if (build) lock(s, 'protagonist', 'D4', `build_${build}`);
  decade(s);
  lock(s, 'protagonist', 'D4', build ? (risk ? 'recruit_risk' : 'recruit_successor') : 'recruit_volunteer');
  decade(s); return s;
}
function impact(s, api = sim) {
  finishDrafts(s, api); api.commitWindow(s);
  while (s.year < 23) api.advanceYear(s);
  return s.flags.crisis;
}
function frozen(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); for (const item of Object.values(value)) frozen(item);
  }
  return value;
}
function region(outlook, id) { return outlook.regions.find(item => item.cellId === id); }
function assertActualBranch(s, outlook) {
  const actual = impact(copy(s));
  const expected = actual.damage === 0 ? outlook.success : outlook.fallback;
  assert.equal(expected.available ?? expected.possible, true);
  assert.equal(actual.damage, expected.damage);
  assert.deepEqual(actual.damageByCell, expected.damageByCell);
  if (!outlook.legacy) {
    assert.deepEqual(actual.coverageByCell, Object.fromEntries(outlook.regions.map(r => [r.cellId, r.coverage])));
    assert.deepEqual(actual.protectionByCell, Object.fromEntries(outlook.regions.map(r => [r.cellId, r.protection])));
  }
}
function oldLock(api, s, actorId, cellId, actionId) {
  const action = api.getActions(s, cellId, actorId).find(a => a.id === actionId);
  api.lockTask(s, actorId, cellId, actionId, action.requireEvidence);
}
function genuineOldAt20(api = legacy) {
  const s = api.createRun(12); decade(s, api);
  oldLock(api, s, 'protagonist', 'D4', 'recruit_risk'); decade(s, api); return s;
}

test('outlook exists only during the unsubmitted year20 planning window', () => {
  const s = sim.createRun(12);
  assert.equal(getCrisisOutlook(s), null);
  decade(s); assert.equal(getCrisisOutlook(s), null);
  decade(s); assert.notEqual(getCrisisOutlook(s), null);
  finishDrafts(s); sim.commitWindow(s); assert.equal(getCrisisOutlook(s), null);
  sim.advanceYear(s); assert.equal(getCrisisOutlook(s), null);
  sim.advanceToNextWindow(s); assert.equal(getCrisisOutlook(s), null);
  decade(s); assert.equal(getCrisisOutlook(s), null);
});

test('outlook is pure, seed-independent, and neither reveals nor reads resolved random rolls', () => {
  const s = twoActors();
  lock(s, 'protagonist', 'F6', 'independent_review');
  lock(s, 'linche', 'B4', 'local_veto');
  const before = JSON.stringify(s), expected = getCrisisOutlook(frozen(copy(s)));
  assert.equal(expected.ready, true);
  assert.equal(JSON.stringify(s), before);
  for (const seed of ['not-the-original-seed', '0', '987654321']) {
    const otherSeed = copy(s); otherSeed.seed = seed;
    assert.deepEqual(getCrisisOutlook(otherSeed), expected);
  }
  const privateRolls = copy(s);
  for (const event of privateRolls.events) Object.defineProperty(event, 'roll', {
    enumerable: true, configurable: true, get() { throw new Error('Outlook must not read random rolls'); },
  });
  assert.deepEqual(getCrisisOutlook(privateRolls), expected);
  assert.doesNotMatch(JSON.stringify(expected), /"(?:seed|roll|resolvedYear)"/);
  const detached = getCrisisOutlook(s);
  try { detached.attempts[0].probability = 0; detached.regions[0].coverage = 0; detached.notes.push('changed'); } catch (error) { assert.ok(error instanceof TypeError); }
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(getCrisisOutlook(s), expected);
});

for (const [name, options, probability] of [
  ['no preparation', {}, .55],
  ['archives only', { records: true }, .8],
  ['workforce only', { build: 'state' }, .8],
  ['archives and workforce', { build: 'joint' }, 1],
]) test(`outlook preserves the ${probability} review contract with ${name}`, () => {
  const s = twoActors(options);
  assert.equal(sim.reviewPreparation(s).probability, probability);
  lock(s, 'protagonist', 'F6', 'independent_review'); finishDrafts(s);
  const outlook = getCrisisOutlook(s);
  assert.equal(outlook.ready, true);
  assert.deepEqual(outlook.attempts.map(({ actorId, cellId, probability, dueYear }) => ({ actorId, cellId, probability, dueYear })), [
    { actorId: 'protagonist', cellId: 'F6', probability, dueYear: 22 },
  ]);
  assert.equal(outlook.guaranteedReview, probability === 1);
  assert.equal(outlook.success.available, true);
  assert.equal(outlook.success.damage, 0);
  assert.deepEqual(outlook.success.damageByCell, Object.fromEntries(sim.FLOOD_REGIONS.map(id => [id, 0])));
  assert.equal(outlook.fallback.possible, probability < 1);
  assertActualBranch(s, outlook);
});

test('all-pass is a valid unprotected outlook, not an implicit review or veto', () => {
  const s = twoActors(); finishDrafts(s);
  const outlook = getCrisisOutlook(s);
  assert.equal(outlook.ready, true); assert.deepEqual(outlook.attempts, []);
  assert.equal(outlook.guaranteedReview, false); assert.equal(outlook.success.available, false);
  assert.equal(outlook.vetoBase, 1); assert.equal(outlook.fallback.base, 1);
  assert.equal(outlook.fallback.possible, true); assert.equal(outlook.fallback.damage, 1);
  assert.deepEqual(outlook.regions.map(r => r.cellId), sim.FLOOD_REGIONS);
  assertActualBranch(s, outlook);
});

test('missing, conflicting, unfunded, and invalid-evidence drafts never produce an executable prediction', () => {
  const missing = twoActors(); lock(missing, 'protagonist', 'F6', 'independent_review');
  const conflict = twoActors(); lock(conflict, 'protagonist', 'F6', 'independent_review'); lock(conflict, 'linche', 'F6', 'local_veto');
  const unfunded = twoActors(); lock(unfunded, 'protagonist', 'F6', 'independent_review'); finishDrafts(unfunded); unfunded.cells.find(c => c.id === 'F6').channels.science = 0;
  const badEvidence = twoActors(); lock(badEvidence, 'protagonist', 'F6', 'independent_review'); finishDrafts(badEvidence); badEvidence.investigations = {};
  for (const s of [missing, conflict, unfunded, badEvidence]) {
    const before = JSON.stringify(s), outlook = getCrisisOutlook(s);
    assert.equal(outlook.ready, false); assert.ok(outlook.issues.length);
    assert.ok(outlook.success == null); assert.ok(outlook.fallback == null);
    assert.equal(JSON.stringify(s), before);
  }
});

test('unrecognized pending events block projection without consuming or resolving them', () => {
  const s = twoActors(); finishDrafts(s);
  s.events.push({ id: 'future-extension', actionId: 'future_extension', year: 22, cellId: 'D4', probability: 1, status: 'pending' });
  assert.equal(sim.validateState(s).valid, true);
  const before = JSON.stringify(s), outlook = getCrisisOutlook(s);
  assert.equal(outlook.ready, false); assert.ok(outlook.issues.length);
  assert.ok(outlook.success == null); assert.ok(outlook.fallback == null);
  assert.equal(JSON.stringify(s), before);
});

for (const enhanced of [false, true]) test(`${enhanced ? 'surveyed' : 'basic'} veto gives a certain fallback without pretending review success`, () => {
  const s = twoActors(); lock(s, 'protagonist', 'F6', 'independent_review');
  if (enhanced) sim.investigate(s, 'linche', 'B4', 'evacuation_routes');
  lock(s, 'linche', 'B4', 'local_veto');
  const outlook = getCrisisOutlook(s), base = enhanced ? .2 : .3;
  assert.equal(outlook.ready, true); assert.equal(outlook.vetoBase, base);
  assert.equal(outlook.fallback.base, base); assert.equal(outlook.fallback.damage, base);
  assert.equal(outlook.fallback.possible, true); assert.equal(outlook.success.available, true);
  assert.equal(outlook.attempts[0].probability, .55);
  assertActualBranch(s, outlook);
});

test('investigation after locking does not silently turn basic veto into surveyed veto', () => {
  const s = twoActors(); lock(s, 'protagonist', 'B4', 'local_veto'); finishDrafts(s);
  sim.investigate(s, 'protagonist', 'B4', 'evacuation_routes');
  assert.equal(getCrisisOutlook(s).vetoBase, .3);
  assert.equal(getCrisisOutlook(s).fallback.base, .3);
  assert.deepEqual(s.drafts.protagonist.evidence, []);
  lock(s, 'protagonist', 'B4', 'local_veto');
  assert.equal(getCrisisOutlook(s).vetoBase, .2);
});

test('duplicate veto takes the strongest locked contract instead of adding or multiplying', () => {
  const s = twoActors(); lock(s, 'protagonist', 'B4', 'local_veto'); lock(s, 'linche', 'F6', 'local_veto');
  assert.equal(getCrisisOutlook(s).fallback.base, .3);
  sim.investigate(s, 'linche', 'F6', 'evacuation_routes'); lock(s, 'linche', 'F6', 'local_veto');
  const outlook = getCrisisOutlook(s);
  assert.equal(outlook.vetoBase, .2); assert.equal(outlook.fallback.damage, .2);
  assertActualBranch(s, outlook);
});

for (const [options, probability] of [[{}, .55], [{ records: true }, .8], [{ build: 'joint' }, 1]]) test(`double ${probability} reviews retain separate attempts without claiming combined independent odds`, () => {
  const s = twoActors(options); lock(s, 'protagonist', 'B4', 'independent_review'); lock(s, 'linche', 'F6', 'independent_review');
  const outlook = getCrisisOutlook(s);
  assert.equal(outlook.ready, true); assert.equal(outlook.attempts.length, 2);
  assert.deepEqual(outlook.attempts.map(a => a.probability), [probability, probability]);
  assert.equal(outlook.success.damage, 0); assert.equal(outlook.fallback.possible, probability < 1);
  for (const key of ['reviewSuccessProbability', 'reviewFailureProbability', 'combinedProbability']) assert.equal(Object.hasOwn(outlook, key), false);
  assertActualBranch(s, outlook);
});

test('same-window school improves projected coverage but cannot raise an already locked review probability', () => {
  const s = twoActors(); lock(s, 'protagonist', 'F6', 'independent_review'); lock(s, 'linche', 'E4', 'train_network');
  const outlook = getCrisisOutlook(s);
  assert.equal(outlook.attempts[0].probability, .55);
  assert.equal(region(outlook, 'E4').currentCoverage, 0); assert.equal(region(outlook, 'E4').coverage, .55);
  assert.equal(outlook.fallback.damageByCell.E4, .8075);
  assert.equal(sim.getWarningCoverage(s).E4.coverage, 0);
  assert.equal(s.institutions.length, 0);
  assertActualBranch(s, outlook);
});

test('no-build warning and mutual aid are pending local effects, not invented current carriers or global bonuses', () => {
  const s = twoActors(); lock(s, 'protagonist', 'D4', 'free_warning'); lock(s, 'linche', 'D5', 'mutual_aid');
  const before = JSON.stringify(s), outlook = getCrisisOutlook(s);
  assert.equal(outlook.ready, true);
  assert.equal(region(outlook, 'D4').currentCoverage, 0); assert.equal(region(outlook, 'D4').coverage, .65);
  assert.equal(region(outlook, 'D5').aid, true);
  assert.equal(region(outlook, 'D4').aid, false); assert.equal(region(outlook, 'E4').aid, false); assert.equal(region(outlook, 'F6').aid, false);
  assert.deepEqual(outlook.fallback.damageByCell, { D4: .7725, E4: 1, D5: .7, F6: 1 });
  assert.equal(outlook.fallback.damage, round((.7725 + 1 + .7 + 1) / 4));
  assert.equal(s.institutions.length, 0); assert.equal(JSON.stringify(s), before);
  assertActualBranch(s, outlook);
});

test('free warning restores a halted source station, retaining real provenance protection', () => {
  const s = twoActors({ build: 'joint', risk: true });
  assert.equal(sim.getWarningCoverage(s).D4.coverage, 0);
  lock(s, 'protagonist', 'D4', 'free_warning'); lock(s, 'linche', 'B4', 'local_veto');
  const outlook = getCrisisOutlook(s);
  assert.equal(region(outlook, 'D4').currentCoverage, 0);
  assert.equal(region(outlook, 'D4').coverage, 1); assert.equal(region(outlook, 'D4').protection, .15);
  assert.equal(outlook.fallback.damageByCell.D4, .1658);
  assertActualBranch(s, outlook);
});

test('paid maintenance and source protection stay distinct in the four-region projection', () => {
  const s = twoActors({ build: 'state' }); finishDrafts(s);
  const outlook = getCrisisOutlook(s);
  assert.equal(region(outlook, 'D4').currentCoverage, .315);
  assert.equal(region(outlook, 'D4').coverage, .315); assert.equal(region(outlook, 'D4').protection, .07);
  assert.equal(region(outlook, 'E4').coverage, .55); assert.equal(region(outlook, 'D5').coverage, .55);
  assert.equal(region(outlook, 'F6').coverage, 1); assert.equal(region(outlook, 'F6').protection, .1);
  assertActualBranch(s, outlook);
});

test('forced relocation projects loss of D4 coverage without duplicating existing teaching reach', () => {
  const s = twoActors({ build: 'joint' });
  lock(s, 'protagonist', 'D4', 'relocate_teacher'); lock(s, 'linche', 'E4', 'train_network');
  const outlook = getCrisisOutlook(s);
  assert.equal(region(outlook, 'D4').currentCoverage, .315);
  assert.equal(region(outlook, 'D4').coverage, 0); assert.equal(region(outlook, 'D4').protection, 0);
  assert.equal(region(outlook, 'E4').coverage, .55);
  assertActualBranch(s, outlook);
});

test('extra mutual-aid shifts do not multiply protection and current inactive carriers do not count', () => {
  const s = sim.createRun(12); decade(s);
  lock(s, 'protagonist', 'D5', 'mutual_aid'); decade(s);
  lock(s, 'protagonist', 'D5', 'mutual_aid'); finishDrafts(s);
  assert.equal(sim.validateState(s).valid, true);
  assert.equal(getCrisisOutlook(s).fallback.damageByCell.D5, .7);
  assertActualBranch(s, getCrisisOutlook(s));
  const inactive = copy(s); inactive.institutions[0].active = false; sim.passTask(inactive, 'protagonist');
  assert.equal(getCrisisOutlook(inactive).fallback.damageByCell.D5, 1);
  const unfunded = copy(s); unfunded.institutions[0].maintenance = 0; sim.passTask(unfunded, 'protagonist');
  assert.equal(getCrisisOutlook(unfunded).fallback.damageByCell.D5, 1);
});

test('genuine legacy contracts retain global warning and aid, with no invented local measurements', () => {
  const old = genuineOldAt20();
  oldLock(legacy, old, 'protagonist', 'D4', 'free_warning'); oldLock(legacy, old, 'linche', 'D5', 'mutual_aid');
  const loaded = restoreSave({ state: copy(old) }).state, before = JSON.stringify(loaded), outlook = getCrisisOutlook(loaded);
  assert.equal(loaded.crisisRulesVersion, undefined); assert.equal(outlook.legacy, true); assert.equal(outlook.ready, true);
  assert.equal(outlook.regions?.length ?? 0, 0);
  assert.ok(outlook.fallback.damageByCell == null); assert.ok(outlook.success.damageByCell == null);
  assert.equal(outlook.fallback.damage, .7 * .8);
  assert.equal(JSON.stringify(loaded), before);
  const actual = impact(copy(loaded)), original = impact(copy(old), legacy);
  assert.equal(actual.damage, outlook.fallback.damage); assert.deepEqual(actual, original);
  for (const key of ['model', 'damageByCell', 'coverageByCell', 'protectionByCell']) assert.equal(Object.hasOwn(actual, key), false);
});

test('genuine legacy review is certain and due21 without borrowing new preparation requirements', () => {
  const old = genuineOldAt20(); oldLock(legacy, old, 'protagonist', 'B4', 'independent_review'); oldLock(legacy, old, 'linche', 'F6', 'local_veto');
  const loaded = restoreSave({ state: copy(old) }).state, outlook = getCrisisOutlook(loaded);
  assert.equal(outlook.ready, true); assert.equal(outlook.attempts[0].probability, 1); assert.equal(outlook.attempts[0].dueYear, 21);
  assert.equal(outlook.guaranteedReview, true); assert.equal(outlook.vetoBase, .3);
  assert.equal(outlook.success.damage, 0); assert.equal(outlook.fallback.possible, false);
  assert.equal(impact(copy(loaded)).damage, 0);
});

test('true pre-tradeoffs coverage save keeps certain old review timing while retaining local carrier rules', () => {
  const old = genuineOldAt20(priorPlanning);
  oldLock(priorPlanning, old, 'protagonist', 'B4', 'independent_review'); oldLock(priorPlanning, old, 'linche', 'D4', 'free_warning');
  const loaded = restoreSave({ state: copy(old) }).state, outlook = getCrisisOutlook(loaded);
  assert.equal(loaded.planningRulesVersion, undefined); assert.equal(outlook.legacy, false);
  assert.equal(outlook.attempts[0].probability, 1); assert.equal(outlook.attempts[0].dueYear, 21);
  assert.equal(region(outlook, 'D4').currentCoverage, 0); assert.equal(region(outlook, 'D4').coverage, .65);
  assertActualBranch(loaded, outlook);
});

test('both conditional review branches agree with actual year23 results across fixed seeds', () => {
  const seen = new Set();
  for (let seed = 0; seed < 24; seed++) {
    const s = twoActors({ seed }); lock(s, 'protagonist', 'F6', 'independent_review');
    sim.investigate(s, 'linche', 'B4', 'evacuation_routes'); lock(s, 'linche', 'B4', 'local_veto');
    const outlook = getCrisisOutlook(s), actual = impact(copy(s));
    seen.add(actual.damage === 0 ? 'success' : 'fallback');
    assertActualBranch(s, outlook);
  }
  assert.deepEqual([...seen].sort(), ['fallback', 'success']);
});
