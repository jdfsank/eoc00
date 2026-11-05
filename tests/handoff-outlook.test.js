import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as original from './fixtures/legacy-simulation.js';
import * as beforeTradeoffs from './fixtures/pre-tradeoffs-simulation.js';
import * as beforeMandates from './fixtures/pre-handoff-simulation.js';
import * as beforeRecovery from './fixtures/pre-recovery-simulation.js';
import { getHandoffOutlook } from '../src/handoff-outlook.js';
import { restoreSave } from '../src/save.js';

const copy = structuredClone;
const sorted = values => [...values].sort();
function choose(s, actorId, cellId, actionId, api = sim) {
  const action = api.getActions(s, cellId, actorId).find(a => a.id === actionId);
  assert.ok(action, `${actionId} must exist at year ${s.year}, ${cellId}, ${actorId}`);
  if (s.planningRulesVersion) for (const id of action.requireEvidence) {
    if (!api.getInvestigation(s, actorId, cellId).evidence.includes(id)) api.investigate(s, actorId, cellId, id);
  }
  api.lockTask(s, actorId, cellId, actionId, action.requireEvidence);
}
function finishDrafts(s, api = sim) {
  for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id);
}
function decade(s, api = sim) {
  finishDrafts(s, api); api.commitWindow(s); api.advanceToNextWindow(s); return s;
}
function frozen(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); for (const item of Object.values(value)) frozen(item);
  }
  return value;
}
// Natural seed1 route: both independent sources and cooperation exist, but
// neither a community warning team nor a review station is teaching staff.
function archiveAt30() {
  const s = sim.createRun(1);
  choose(s, 'protagonist', 'B4', 'preserve_records'); decade(s);
  choose(s, 'protagonist', 'D4', 'recruit_volunteer'); decade(s);
  choose(s, 'protagonist', 'D4', 'free_warning');
  choose(s, 'linche', 'F6', 'independent_review'); decade(s);
  assert.equal(s.flags.review, true);
  assert.deepEqual(sim.getHandoffReadiness(s).staffCells, []);
  return s;
}
function failedAt30({ staff = false, api = sim } = {}) {
  const s = api.createRun(6); decade(s, api);
  choose(s, 'protagonist', 'D4', 'recruit_volunteer', api); decade(s, api);
  choose(s, 'protagonist', 'B4', 'independent_review', api);
  choose(s, 'linche', staff ? 'E4' : 'D4', staff ? 'train_network' : 'free_warning', api);
  decade(s, api);
  assert.equal(s.events.find(e => e.actionId === 'independent_review').status, 'failed');
  return s;
}
function actual40(s) {
  const actual = decade(copy(s)); assert.equal(actual.year, 40); return actual;
}
function matchesActualMandates(s, capability) {
  const actual = actual40(s), readiness = sim.getHandoffReadiness(actual), ending = sim.getEnding(actual);
  for (const key of ['staffCells', 'authorizedCells', 'checkCells']) assert.deepEqual(sorted(capability[key]), sorted(readiness[key]), key);
  for (const key of ['trust', 'canWithdraw', 'canShare']) assert.equal(capability[key], readiness[key], key);
  assert.equal(capability.networks, ending.metrics.networks);
  assert.equal(capability.autonomy, ending.metrics.autonomy);
  return { actual, readiness, ending };
}

test('handoff outlook only exists in the unsubmitted year30 planning window', () => {
  const s = sim.createRun(1);
  assert.equal(getHandoffOutlook(s), null);
  decade(s); assert.equal(getHandoffOutlook(s), null);
  decade(s); assert.equal(getHandoffOutlook(s), null);
  decade(s); assert.notEqual(getHandoffOutlook(s), null);
  finishDrafts(s); sim.commitWindow(s); assert.equal(getHandoffOutlook(s), null);
  sim.advanceYear(s); assert.equal(getHandoffOutlook(s), null);
  sim.advanceToNextWindow(s); assert.equal(getHandoffOutlook(s), null);
});

for (const support of ['train_network', 'mutual_aid', 'pass']) {
  test(`seed1: shared power plus ${support} distinguishes future handoff from current capacity`, () => {
    const s = archiveAt30(), historical = copy(s.flags.crisis);
    choose(s, 'protagonist', 'D4', 'share_power');
    if (support === 'pass') sim.passTask(s, 'linche');
    else choose(s, 'linche', support === 'train_network' ? 'E4' : 'D5', support);
    const outlook = getHandoffOutlook(s), trained = support === 'train_network';
    assert.equal(outlook.ready, true); assert.equal(outlook.model, 'mandate');
    assert.deepEqual(outlook.policy, { actionId: 'share_power', actorId: 'protagonist', dueYear: 31 });
    assert.deepEqual(outlook.current.staffCells, []); assert.deepEqual(outlook.current.authorizedCells, []);
    assert.deepEqual(sorted(outlook.current.checkCells), ['B4', 'F6']);
    assert.equal(outlook.current.trust, true); assert.equal(outlook.current.canShare, false);
    assert.deepEqual(outlook.projected.staffCells, trained ? ['E4'] : []);
    assert.deepEqual(outlook.projected.authorizedCells, trained ? ['E4'] : []);
    assert.equal(outlook.projected.canShare, trained);
    assert.equal(outlook.projected.policyStatus, trained ? 'share-ready' : 'incomplete');
    assert.equal(outlook.projected.links.length > 0, trained);
    const { actual, ending } = matchesActualMandates(s, outlook.projected);
    assert.equal(ending.title, trained ? '许多人签署的历史' : '纸上的共同作者');
    assert.deepEqual(actual.flags.crisis, historical, 'future capabilities do not rewrite year23');
  });
}

test('unlocking or replacing the support assignment never leaves its promised training in the outlook', () => {
  const s = archiveAt30();
  choose(s, 'protagonist', 'D4', 'share_power'); choose(s, 'linche', 'E4', 'train_network');
  assert.equal(getHandoffOutlook(s).projected.canShare, true);
  sim.unlockTask(s, 'linche');
  assert.equal(getHandoffOutlook(s).ready, false); assert.ok(getHandoffOutlook(s).projected == null);
  sim.passTask(s, 'linche');
  assert.equal(getHandoffOutlook(s).ready, true); assert.equal(getHandoffOutlook(s).projected.canShare, false);
  assert.deepEqual(getHandoffOutlook(s).projected.staffCells, []);
  choose(s, 'linche', 'E4', 'train_network');
  assert.equal(getHandoffOutlook(s).projected.canShare, true);
  assert.deepEqual(sim.getHandoffReadiness(s).staffCells, [], 'repeated previews never create actual staff');
});

test('new E4 training authorizes its own staff, not every existing same-source apprentice', () => {
  const s = sim.createRun(0);
  choose(s, 'protagonist', 'D4', 'build_joint'); decade(s);
  assert.equal(s.flags.stationBuilt, true);
  choose(s, 'protagonist', 'D4', 'recruit_successor'); decade(s);
  choose(s, 'protagonist', 'F6', 'independent_review');
  choose(s, 'linche', 'D4', 'free_warning'); decade(s);
  choose(s, 'protagonist', 'D4', 'share_power'); choose(s, 'linche', 'E4', 'train_network');
  const outlook = getHandoffOutlook(s);
  assert.equal(outlook.ready, true);
  assert.deepEqual(sorted(outlook.current.staffCells), ['D5', 'E4']);
  assert.deepEqual(outlook.current.authorizedCells, []);
  assert.deepEqual(sorted(outlook.projected.staffCells), ['D5', 'E4']);
  assert.deepEqual(outlook.projected.authorizedCells, ['E4']);
  assert.equal(outlook.projected.canShare, true);
  matchesActualMandates(s, outlook.projected);
});

test('a genuinely renewed teaching chain retains its existing cross-region authority in the outlook', () => {
  const s = sim.createRun(0);
  choose(s, 'protagonist', 'D4', 'build_joint'); decade(s);
  choose(s, 'protagonist', 'D4', 'renew_charter'); decade(s);
  choose(s, 'protagonist', 'F6', 'independent_review'); decade(s);
  choose(s, 'protagonist', 'D4', 'share_power');
  const outlook = getHandoffOutlook(s);
  assert.equal(outlook.ready, true); assert.deepEqual(outlook.conditional, []);
  assert.deepEqual(sorted(outlook.current.staffCells), ['D5', 'E4']);
  assert.deepEqual(sorted(outlook.current.authorizedCells), ['D5', 'E4']);
  assert.deepEqual(outlook.current.checkCells, ['F6']); assert.equal(outlook.current.links.length, 2);
  assert.equal(outlook.current.canShare, true); assert.equal(outlook.projected.policyStatus, 'share-ready');
  assert.deepEqual(outlook.projected, outlook.current);
  matchesActualMandates(s, outlook.projected);
});

test('no assignments, conflicting sites, insufficient capacity and missing evidence never promise a projection', () => {
  const missing = archiveAt30(); choose(missing, 'protagonist', 'D4', 'share_power');
  const conflict = archiveAt30(); choose(conflict, 'protagonist', 'E4', 'train_network'); choose(conflict, 'linche', 'E4', 'train_network');
  const unfunded = archiveAt30(); choose(unfunded, 'protagonist', 'D4', 'share_power'); choose(unfunded, 'linche', 'E4', 'train_network');
  unfunded.cells.find(c => c.id === 'E4').channels.economy = 0;
  const evidence = failedAt30(); choose(evidence, 'protagonist', 'B4', 'complete_review'); sim.passTask(evidence, 'linche');
  delete evidence.investigations['30:protagonist'];
  for (const s of [missing, conflict, unfunded, evidence]) {
    const before = JSON.stringify(s), outlook = getHandoffOutlook(s);
    assert.equal(outlook.ready, false); assert.ok(outlook.issues.length > 0);
    assert.ok(outlook.projected == null); assert.ok(outlook.withoutRecovery == null);
    assert.equal(JSON.stringify(s), before);
  }
});

test('an existing unresolved future contract blocks a single asserted handoff projection', () => {
  const s = archiveAt30(); finishDrafts(s);
  s.events.push({ id: 'future-extension', actionId: 'future_extension', year: 35, cellId: 'D4', probability: 1, status: 'pending' });
  assert.equal(sim.validateState(s).valid, true);
  const before = JSON.stringify(s), outlook = getHandoffOutlook(s);
  assert.equal(outlook.ready, false); assert.ok(outlook.issues.length > 0);
  assert.ok(outlook.projected == null); assert.equal(JSON.stringify(s), before);
});

test('all-pass preserves current abilities without inventing a signed ending policy', () => {
  const s = archiveAt30(); finishDrafts(s);
  const outlook = getHandoffOutlook(s);
  assert.equal(outlook.ready, true); assert.equal(outlook.policy, null);
  assert.equal(outlook.projected.policyStatus, 'no-policy');
  assert.deepEqual(outlook.projected.staffCells, outlook.current.staffCells);
  assert.deepEqual(outlook.projected.checkCells, outlook.current.checkCells);
  assert.equal(actual40(s).flags.policy, undefined);
});

test('policy plus late review without real measurement staff cannot manufacture a future check', () => {
  const s = failedAt30(), history = copy(s.flags.crisis);
  assert.equal(sim.getRecoveryWorkforce(s).length, 0);
  choose(s, 'protagonist', 'D4', 'share_power'); choose(s, 'linche', 'B4', 'complete_review');
  const outlook = getHandoffOutlook(s);
  assert.equal(outlook.ready, true); assert.equal(outlook.conditional.length, 1);
  assert.equal(outlook.conditional[0].supported, false); assert.equal(outlook.conditional[0].dueYear, 32);
  assert.deepEqual(outlook.projected.checkCells, []); assert.deepEqual(outlook.withoutRecovery.checkCells, []);
  assert.equal(outlook.projected.canShare, false); assert.equal(outlook.projected.policyStatus, 'incomplete');
  const { actual, ending } = matchesActualMandates(s, outlook.projected);
  assert.equal(actual.events.find(e => e.actionId === 'complete_review').status, 'cancelled');
  assert.equal(ending.title, '纸上的共同作者'); assert.deepEqual(actual.flags.crisis, history);
});

test('same-window training may support year32 review but spends both slots without signing a policy', () => {
  const s = failedAt30(), history = copy(s.flags.crisis);
  choose(s, 'protagonist', 'B4', 'complete_review'); choose(s, 'linche', 'E4', 'train_network');
  const outlook = getHandoffOutlook(s);
  assert.equal(outlook.ready, true); assert.equal(outlook.policy, null);
  assert.equal(outlook.conditional[0].supported, true); assert.equal(outlook.conditional[0].dueYear, 32);
  assert.deepEqual(outlook.current.staffCells, []); assert.deepEqual(outlook.current.checkCells, []);
  assert.deepEqual(outlook.projected.staffCells, ['E4']); assert.deepEqual(outlook.projected.authorizedCells, ['E4']);
  assert.deepEqual(outlook.projected.checkCells, ['B4']); assert.equal(outlook.projected.canShare, true);
  assert.equal(outlook.projected.policyStatus, 'no-policy');
  assert.deepEqual(outlook.withoutRecovery.staffCells, ['E4']); assert.deepEqual(outlook.withoutRecovery.checkCells, []);
  assert.equal(outlook.withoutRecovery.canWithdraw, false);
  const { actual, ending } = matchesActualMandates(s, outlook.projected);
  assert.equal(actual.events.find(e => e.actionId === 'complete_review').status, 'success');
  assert.equal(ending.title, '未签署的下一页'); assert.deepEqual(actual.flags.crisis, history);
});

for (const policy of ['share_power', 'withdraw', 'central_review']) {
  test(`existing staff plus late review keeps ${policy} conditional and respects independent consent`, () => {
    const s = failedAt30({ staff: true }), history = copy(s.flags.crisis);
    assert.equal(sim.getHandoffReadiness(s).trust, false);
    choose(s, 'protagonist', 'D4', policy); choose(s, 'linche', 'B4', 'complete_review');
    const outlook = getHandoffOutlook(s);
    assert.equal(outlook.ready, true); assert.equal(outlook.conditional[0].supported, true);
    assert.deepEqual(outlook.current.checkCells, []); assert.deepEqual(outlook.projected.checkCells, ['B4']);
    assert.deepEqual(outlook.withoutRecovery.checkCells, []);
    assert.equal(outlook.projected.trust, false); assert.equal(outlook.projected.canWithdraw, true);
    assert.equal(outlook.projected.canShare, false);
    assert.equal(outlook.projected.policyStatus, policy === 'withdraw' ? 'withdraw-ready' : policy === 'central_review' ? 'central' : 'incomplete');
    const { actual, ending } = matchesActualMandates(s, outlook.projected);
    assert.equal(ending.title, { share_power: '纸上的共同作者', withdraw: '没有唯一守夜人', central_review: '仍亮着灯的续史局' }[policy]);
    assert.deepEqual(actual.flags.crisis, history);
  });
}

test('training alone does not create the independent correction promised by central review', () => {
  const s = failedAt30();
  choose(s, 'protagonist', 'D4', 'central_review'); choose(s, 'linche', 'E4', 'train_network');
  const outlook = getHandoffOutlook(s);
  assert.equal(outlook.ready, true); assert.deepEqual(outlook.projected.checkCells, []);
  assert.equal(outlook.projected.policyStatus, 'central');
  assert.equal(matchesActualMandates(s, outlook.projected).ending.title, '更安静的警报室');
});

for (const [name, api, model, count, ready] of [
  ['original aggregate', original, 'legacy', 2, true],
  ['pre-tradeoffs coverage', beforeTradeoffs, 'legacy', 2, true],
  ['pre-handoff regional', beforeMandates, 'regional', 1, false],
]) test(`genuine ${name} save retains its own repeated-school rule`, () => {
  const old = api.createRun(12); decade(old, api);
  choose(old, 'protagonist', 'D4', 'recruit_risk', api); decade(old, api);
  choose(old, 'protagonist', 'E4', 'train_network', api); decade(old, api);
  choose(old, 'protagonist', 'D4', 'withdraw', api); choose(old, 'linche', 'E4', 'train_network', api);
  const loaded = restoreSave({ state: copy(old) }).state, before = JSON.stringify(loaded), outlook = getHandoffOutlook(loaded);
  assert.equal(loaded.handoffRulesVersion, undefined); assert.equal(outlook.ready, true); assert.equal(outlook.model, model);
  assert.equal(outlook.current.networks, 1); assert.equal(outlook.projected.networks, count);
  assert.equal(outlook.projected.autonomy, count); assert.equal(outlook.projected.canWithdraw, ready);
  assert.equal(outlook.projected.authorizedCells, null); assert.equal(outlook.projected.links, null);
  assert.equal(outlook.projected.policyStatus, ready ? 'withdraw-ready' : 'incomplete');
  assert.equal(JSON.stringify(loaded), before);
  const actual = actual40(loaded), historical = decade(copy(old), api);
  const result = sim.getEnding(actual), originalResult = api.getEnding(historical);
  // Original aggregate saves predate explanatory coverage paragraphs. Preserve
  // their scoring and actual history, without forbidding honest newer labels.
  assert.equal(result.title, originalResult.title); assert.equal(result.policy, originalResult.policy);
  for (const key of ['networks', 'autonomy', 'trust']) assert.equal(result.metrics[key], originalResult.metrics[key], key);
  assert.deepEqual(actual.cells, historical.cells); assert.deepEqual(actual.flags.crisis, historical.flags.crisis);
  assert.equal(result.metrics.networks, outlook.projected.networks);
  assert.equal(result.metrics.autonomy, outlook.projected.autonomy);
  assert.equal(result.title, ready ? '没有唯一守夜人' : '交班后的空椅子');
});

test('a genuine regional save with two successful check sites still needs a school to share power', () => {
  const api = beforeMandates, old = api.createRun(1);
  choose(old, 'protagonist', 'B4', 'preserve_records', api); decade(old, api);
  choose(old, 'protagonist', 'D4', 'recruit_risk', api); decade(old, api);
  choose(old, 'protagonist', 'D4', 'free_warning', api); choose(old, 'linche', 'F6', 'independent_review', api);
  decade(old, api); assert.equal(old.flags.review, true);
  choose(old, 'protagonist', 'D4', 'share_power', api); finishDrafts(old, api);
  const loaded = restoreSave({ state: copy(old) }).state, outlook = getHandoffOutlook(loaded);
  assert.equal(outlook.ready, true); assert.equal(outlook.model, 'regional');
  assert.deepEqual(sorted(outlook.current.checkCells), ['B4', 'F6']);
  assert.equal(outlook.current.trust, true); assert.equal(outlook.current.autonomy, 2);
  assert.equal(outlook.current.networks, 0); assert.equal(outlook.projected.canWithdraw, false);
  assert.equal(outlook.projected.canShare, false); assert.equal(outlook.projected.policyStatus, 'incomplete');
  assert.ok(outlook.projected.missing.some(text => /学校|轮值/.test(text)));
  assert.equal(sim.getEnding(actual40(loaded)).title, '纸上的共同作者');
  assert.equal(api.getEnding(decade(copy(old), api)).title, '纸上的共同作者');
});

test('a genuine pre-recovery mandate save does not receive a new late-review contract', () => {
  const old = failedAt30({ api: beforeRecovery });
  choose(old, 'protagonist', 'D4', 'share_power', beforeRecovery);
  choose(old, 'linche', 'E4', 'train_network', beforeRecovery);
  const loaded = restoreSave({ state: copy(old) }).state, outlook = getHandoffOutlook(loaded);
  assert.equal(loaded.recoveryRulesVersion, undefined); assert.equal(outlook.model, 'mandate');
  assert.equal(outlook.ready, true); assert.deepEqual(outlook.conditional, []);
  assert.deepEqual(outlook.projected.checkCells, []); assert.equal(outlook.projected.canShare, false);
  assert.equal(sim.getActions(loaded, 'B4', 'linche').some(a => a.id === 'complete_review'), false);
  matchesActualMandates(loaded, outlook.projected);
});

test('outlook is detached and pure, does not inspect random rolls, and is independent of the future seed', () => {
  const cases = [archiveAt30(), failedAt30({ staff: true })];
  choose(cases[0], 'protagonist', 'D4', 'share_power'); choose(cases[0], 'linche', 'E4', 'train_network');
  choose(cases[1], 'protagonist', 'D4', 'withdraw'); choose(cases[1], 'linche', 'B4', 'complete_review');
  for (const s of cases) {
    const before = JSON.stringify(s), expected = getHandoffOutlook(frozen(copy(s)));
    assert.equal(expected.ready, true); assert.equal(JSON.stringify(s), before);
    for (const seed of ['0', '987654321', 'different-seed']) {
      const changed = copy(s); changed.seed = seed;
      assert.deepEqual(getHandoffOutlook(changed), expected);
    }
    const hidden = copy(s);
    for (const event of hidden.events) Object.defineProperty(event, 'roll', {
      enumerable: true, configurable: true, get() { throw new Error('An outlook must not read random rolls'); },
    });
    assert.deepEqual(getHandoffOutlook(hidden), expected);
    assert.doesNotMatch(JSON.stringify(expected), /"(?:seed|roll)"\s*:/);
    const detached = getHandoffOutlook(s);
    try { detached.projected.staffCells.push('A1'); detached.current.checkCells.length = 0; detached.notes.push('changed'); }
    catch (error) { assert.ok(error instanceof TypeError); }
    assert.equal(JSON.stringify(s), before); assert.deepEqual(getHandoffOutlook(s), expected);
  }
});
