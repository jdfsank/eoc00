// Independent round-17 acceptance audit. Actual investigate/lock/settle paths
// are the oracle; the API under test may never call those mutating paths.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as original from './fixtures/pre-tradeoffs-simulation.js';
import { getInvestigationComparison } from '../src/investigation-comparison.js';
import { getCrisisOutlook } from '../src/crisis-outlook.js';
import { investigateAndLock } from './helpers/play.js';

const copy = structuredClone;
function next(state, api = sim) {
  for (const actor of api.getActors(state)) if (!state.drafts[actor.id]) api.passTask(state, actor.id);
  api.commitWindow(state); api.advanceToNextWindow(state); return state;
}
function at20({ seed = 12, opening = null, warning = true } = {}) {
  const state = sim.createRun(seed);
  if (opening) investigateAndLock(state, 'protagonist', opening === 'preserve_records' ? 'B4' : 'D4', opening);
  next(state);
  investigateAndLock(state, 'protagonist', 'D4', opening?.startsWith('build_') ? 'recruit_successor' : 'recruit_volunteer');
  next(state);
  if (warning) investigateAndLock(state, 'linche', 'D4', 'free_warning');
  return state;
}
function option(view, id) { return view.options.find(row => row.id === id); }
function lockOption(state, id, actor = 'protagonist', cell = 'B4') {
  if (id === 'surveyed_veto') sim.investigate(state, actor, cell, 'evacuation_routes');
  investigateAndLock(state, actor, cell, id === 'review' ? 'independent_review' : 'local_veto');
  return state;
}
function settled(state) {
  sim.commitWindow(state);
  while (state.year < 23) sim.advanceYear(state);
  return state.flags.crisis;
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}
function objectReferences(value, refs = new Set()) {
  if (value && typeof value === 'object' && !refs.has(value)) {
    refs.add(value); for (const item of Object.values(value)) objectReferences(item, refs);
  }
  return refs;
}
function assertNoNumbers(view) {
  assert.ok(view);
  assert.equal(view.options.length, 3);
  for (const row of view.options) {
    assert.equal(row.ready, false);
    assert.equal(row.outlook, null);
    assert.ok(row.issues.length, `${row.id} must explain why its outcome is unknown`);
  }
}

for (const [label, setup, probability, fallback, surveyed, basic] of [
  ['seed1 archive → voluntary', { seed: 1, opening: 'preserve_records' }, .8, .9431, .1886, .2830],
  ['seed12 pass → voluntary', { seed: 12 }, .55, .9431, .1886, .2830],
  ['seed12 joint station → successor', { seed: 12, opening: 'build_joint' }, 1, null, .1239, .1859],
]) test(`audit ${label}: three untouched alternatives equal real contracts and settlement`, () => {
  const state = at20(setup), before = JSON.stringify(state), view = getInvestigationComparison(freeze(copy(state)), 'B4');
  assert.equal(view.hypothetical, true); assert.equal(view.budget, 3);
  assert.deepEqual(view.options.map(row => row.id), ['review', 'surveyed_veto', 'basic_veto']);
  assert.equal(option(view, 'review').probability, probability);
  assert.equal(option(view, 'review').dueYear, 22);
  assert.equal(option(view, 'surveyed_veto').dueYear, 21);
  assert.equal(option(view, 'basic_veto').dueYear, 21);
  assert.deepEqual(option(view, 'review').cost, { science: 3, economy: 4 });
  assert.deepEqual(option(view, 'surveyed_veto').cost, { politics: 4 });
  assert.deepEqual(view.options.map(row => row.investigationCost), [2, 2, 0]);
  assert.deepEqual(view.options.map(row => row.budgetAfter), [1, 1, 3]);
  assert.equal(view.retained.find(row => row.actorId === 'linche').actionId, 'free_warning');
  const review = option(view, 'review').outlook;
  assert.equal(review.success.damage, 0); assert.equal(review.fallback.possible, probability < 1);
  if (fallback !== null) assert.equal(review.fallback.damage, fallback);
  assert.equal(option(view, 'surveyed_veto').outlook.fallback.damage, surveyed);
  assert.equal(option(view, 'basic_veto').outlook.fallback.damage, basic);
  for (const row of view.options) {
    assert.equal(row.ready, true); assert.equal(row.reachable, true);
    const actualState = lockOption(copy(state), row.id), actualOutlook = getCrisisOutlook(actualState);
    const { notes: hypotheticalNotes, ...hypotheticalFacts } = row.outlook;
    const { notes: lockedNotes, ...lockedFacts } = actualOutlook;
    assert.deepEqual(hypotheticalFacts, lockedFacts, `${row.id} has no separate projection math`);
    assert.ok(hypotheticalNotes.length && lockedNotes.length);
    const actual = settled(actualState), expected = actual.damage === 0 ? row.outlook.success : row.outlook.fallback;
    assert.equal(actual.damage, expected.damage); assert.deepEqual(actual.damageByCell, expected.damageByCell);
  }
  assert.equal(JSON.stringify(state), before);
});

test('audit actual successful and failed review seeds both match the disclosed branch', () => {
  const outcomes = [];
  for (const [seed, damage] of [[0, .9431], [1, 0]]) {
    const state = at20({ seed }), view = getInvestigationComparison(state, 'B4'), branch = option(view, 'review').outlook;
    const actual = settled(lockOption(copy(state), 'review'));
    assert.equal(actual.damage, damage);
    assert.deepEqual(actual.damageByCell, (damage === 0 ? branch.success : branch.fallback).damageByCell);
    outcomes.push(actual.damage);
  }
  assert.deepEqual(outcomes, [.9431, 0]);
});

test('audit no seed, hidden roll, saved snapshot or promised private text is read', () => {
  const state = at20({ seed: 1, opening: 'preserve_records' });
  const expected = getInvestigationComparison(state, 'B4');
  for (const key of ['seed', 'snapshots', 'baseline', 'promises']) Object.defineProperty(state, key, {
    enumerable: true, configurable: true, get() { throw Error(`Private state read: ${key}`); },
  });
  for (const event of state.events) Object.defineProperty(event, 'roll', {
    enumerable: true, configurable: true, get() { throw Error('Hidden resolved roll read'); },
  });
  for (const record of [...state.events, ...state.history]) for (const key of ['text', 'description', 'reason']) Object.defineProperty(record, key, {
    enumerable: true, configurable: true, get() { throw Error(`Hidden narrative read: ${key}`); },
  });
  state.flags.crisis ||= {};
  for (const key of ['damage', 'damageByCell']) Object.defineProperty(state.flags.crisis, key, {
    enumerable: true, configurable: true, get() { throw Error(`Future crisis outcome read: ${key}`); },
  });
  for (const entries of Object.values(state.investigations)) for (const entry of entries) Object.defineProperty(entry, 'hiddenText', {
    enumerable: true, configurable: true, get() { throw Error('Hidden investigation text read'); },
  });
  assert.deepEqual(getInvestigationComparison(state, 'B4'), expected);
  assert.doesNotMatch(JSON.stringify(expected), /"(?:seed|roll|snapshots|baseline|promises)"/);
});

test('audit returned data has no object aliases, no commit draft, and cannot change later reads', () => {
  const state = at20(), before = JSON.stringify(state), view = getInvestigationComparison(state, 'B4');
  const stateRefs = objectReferences(state);
  for (const ref of objectReferences(view)) assert.equal(stateRefs.has(ref), false);
  assert.doesNotMatch(JSON.stringify(view), /"(?:draft|drafts|investigations|requireEvidence)":/);
  for (const row of view.options) {
    try { row.cost.science = 999; row.evidence.push({ id: 'fake' }); row.outlook.regions[0].coverage = 999; } catch (error) { assert.ok(error instanceof TypeError); }
  }
  assert.equal(JSON.stringify(state), before);
  assert.equal(option(getInvestigationComparison(state, 'B4'), 'review').cost.science, 3);
  assert.throws(() => sim.lockTask(state, 'protagonist', 'B4', 'independent_review', ['anomaly_records']), /证据/);
  assert.equal(JSON.stringify(state), before);
});

test('audit spending two rounds never refunds or makes the alternate two-round route reachable', () => {
  const state = at20(); sim.investigate(state, 'protagonist', 'B4', 'anomaly_records');
  const before = JSON.stringify(state);
  for (let i = 0; i < 3; i++) {
    const view = getInvestigationComparison(state, i % 2 ? 'F6' : 'B4');
    assert.equal(view.budget, 1);
    assert.equal(option(view, 'review').investigationCost, 0); assert.equal(option(view, 'review').reachable, true);
    assert.equal(option(view, 'surveyed_veto').investigationCost, 2); assert.equal(option(view, 'surveyed_veto').reachable, false);
    assert.equal(option(view, 'surveyed_veto').outlook, null);
    assert.equal(option(view, 'basic_veto').reachable, true);
  }
  assert.throws(() => sim.investigate(state, 'protagonist', 'B4', 'evacuation_routes'), /不足/);
  assert.equal(JSON.stringify(state), before);
});

test('audit later survey preserves actual locked basic snapshot until a real relock', () => {
  const state = at20(); sim.lockTask(state, 'protagonist', 'B4', 'local_veto');
  sim.investigate(state, 'protagonist', 'B4', 'evacuation_routes');
  const before = JSON.stringify(state), locked = getCrisisOutlook(state), view = getInvestigationComparison(state, 'B4');
  assert.equal(locked.vetoBase, .3);
  assert.equal(option(view, 'surveyed_veto').outlook.vetoBase, .2);
  assert.equal(option(view, 'basic_veto').ready, false);
  assert.equal(option(view, 'basic_veto').outlook, null);
  assert.deepEqual(getCrisisOutlook(state), locked); assert.equal(JSON.stringify(state), before);
  sim.lockTask(state, 'protagonist', 'B4', 'local_veto');
  assert.equal(getCrisisOutlook(state).vetoBase, .2);
});

for (const reason of ['missing actor', 'same-cell conflict', 'unfunded retained service', 'unknown pending contract']) test(`audit ${reason} never invents a whole-round loss`, () => {
  const state = at20({ warning: reason !== 'missing actor' });
  if (reason === 'same-cell conflict') sim.lockTask(state, 'linche', 'B4', 'local_veto');
  if (reason === 'unfunded retained service') state.cells.find(cell => cell.id === 'D4').channels.economy = 0;
  if (reason === 'unknown pending contract') state.events.push({ id: 'future-extension', actionId: 'future_extension', year: 22, cellId: 'D4', probability: 1, status: 'pending' });
  const before = JSON.stringify(state); assertNoNumbers(getInvestigationComparison(state, 'B4')); assert.equal(JSON.stringify(state), before);
});

test('audit selected action poverty blocks just that alternative, not another payable action', () => {
  const state = at20(); state.cells.find(cell => cell.id === 'B4').channels.science = 0;
  const view = getInvestigationComparison(state, 'B4');
  assert.equal(option(view, 'review').ready, false); assert.equal(option(view, 'review').outlook, null);
  assert.equal(option(view, 'basic_veto').ready, true); assert.equal(option(view, 'surveyed_veto').ready, true);
});

test('audit same-window training and multiple reviews preserve real conditional meaning', () => {
  const training = at20({ warning: false }); sim.lockTask(training, 'linche', 'E4', 'train_network');
  const review = option(getInvestigationComparison(training, 'B4'), 'review');
  assert.equal(review.probability, .55); assert.equal(review.outlook.regions.find(row => row.cellId === 'E4').coverage, .55);
  const duplicate = at20({ warning: false }); investigateAndLock(duplicate, 'linche', 'F6', 'independent_review');
  const outlook = option(getInvestigationComparison(duplicate, 'B4'), 'review').outlook;
  assert.equal(outlook.attempts.length, 2); assert.deepEqual(outlook.attempts.map(row => row.probability), [.55, .55]);
  assert.equal(outlook.combinedProbability, undefined);
});

test('audit repeated veto uses the strongest contract rather than multiplying', () => {
  const state = at20({ warning: false }); sim.lockTask(state, 'linche', 'F6', 'local_veto');
  const view = getInvestigationComparison(state, 'B4');
  assert.equal(option(view, 'basic_veto').outlook.vetoBase, .3);
  assert.equal(option(view, 'surveyed_veto').outlook.vetoBase, .2);
});

test('audit original saves and unsupported windows/places remain outside the new feature', () => {
  const historical = original.createRun(12); next(historical, original); next(historical, original);
  const before = JSON.stringify(historical); assert.equal(getInvestigationComparison(historical, 'B4'), null); assert.equal(JSON.stringify(historical), before);
  assert.equal(getInvestigationComparison(sim.createRun(12), 'B4'), null);
  const current = at20(); assert.equal(getInvestigationComparison(current, 'D4'), null);
  lockOption(current, 'basic_veto'); sim.commitWindow(current); assert.equal(getInvestigationComparison(current, 'B4'), null);
});
