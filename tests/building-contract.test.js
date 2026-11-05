import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as original from './fixtures/legacy-simulation.js';
import * as coverage from './fixtures/pre-tradeoffs-simulation.js';
import * as tradeoffs from './fixtures/pre-handoff-simulation.js';
import * as handoff from './fixtures/pre-aftermath-simulation.js';
import * as aftermath from './fixtures/pre-recruitment-simulation.js';
import * as recruitment from './fixtures/pre-recovery-simulation.js';
import * as recovery from './fixtures/pre-port-access-simulation.js';
import * as before from './fixtures/pre-staffing-simulation.js';
import { BUILDING_ACTION_IDS, getBuildingContract } from '../src/building-contract.js';
import { restoreSave } from '../src/save.js';

const engines = [
  ['original', original], ['coverage', coverage], ['tradeoffs', tradeoffs], ['handoff', handoff],
  ['aftermath', aftermath], ['recruitment', recruitment], ['recovery', recovery], ['pre-staffing', before], ['current', sim],
];
const copy = structuredClone;
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function submit(api, state, actionId) {
  if (actionId) {
    const action = api.getActions(state, 'D4').find(action => action.id === actionId);
    assert.ok(action, `real ${actionId} contract available at year ${state.year}`);
    if (api.usesTradeoffs?.(state)) for (const evidenceId of action.requireEvidence) {
      if (!api.getInvestigation(state, 'protagonist', 'D4').evidence.includes(evidenceId)) api.investigate(state, 'protagonist', 'D4', evidenceId);
    }
    api.lockTask(state, 'protagonist', 'D4', actionId, action.requireEvidence);
  }
  for (const actor of api.getActors(state)) if (!state.drafts[actor.id]) api.passTask(state, actor.id);
  api.commitWindow(state);
}
function advance(api, state, year, atTen) {
  while (state.year < year) {
    if (state.phase === 'planning') submit(api, state, state.year === 10 ? atTen : undefined);
    api.advanceYear(state);
  }
  return state;
}
function route(api, actionId, seed, year = 16, atTen) {
  const state = api.createRun(seed), contract = getBuildingContract(state, actionId);
  submit(api, state, actionId);
  advance(api, state, year, atTen);
  return { state, contract };
}
function findRoute(api, actionId, success, year = 16, atTen) {
  for (let seed = 0; seed < 100; seed++) {
    const result = route(api, actionId, seed, 3);
    if (result.state.events[0].status === (success ? 'success' : 'failed')) {
      advance(api, result.state, year, atTen);
      return result;
    }
  }
  throw new Error('No actual simulated route matched the test case');
}
function assertSource(state, institution, actionId, eventId, year, annualSource) {
  const sourceId = `action:0:protagonist:D4:${actionId}`;
  assert.ok(institution);
  assert.equal(institution.sourceActionId, sourceId);
  assert.equal(institution.sourceEventId, eventId);
  assert.equal(institution.startYear, year);
  assert.deepEqual(institution.annualSource, annualSource);
  const event = state.events.find(event => event.id === eventId);
  assert.equal(event.sourceActionId, sourceId);
  assert.equal(event.resolvedYear, year);
  const origin = state.history.find(entry => entry.id === sourceId);
  assert.equal(origin.kind, 'action');
  const outcome = state.history.find(entry => entry.id === `resolved:${eventId}`);
  assert.equal(outcome.parentId, eventId);
  assert.equal(outcome.sourceActionId, sourceId);
  assert.equal(outcome.status, event.status);
}
function assertRoute(state, contract, actionId, legacyBranch = false) {
  const eventId = `event:action:0:protagonist:D4:${actionId}`;
  const event = state.events.find(event => event.id === eventId);
  const success = event.status === 'success';
  assert.equal(event.year, contract.dueYear);
  assert.equal(event.probability, contract.probability);
  assert.equal(state.promises[0].dueYear, contract.maintenance.decisionYear);
  const carrier = state.institutions.find(institution => institution.cellId === 'D4');
  assert.equal(carrier.kind, success ? contract.success.kind : contract.failure.kind);
  assertSource(state, carrier, actionId, eventId, contract.dueYear, contract.annualSources[carrier.kind]);
  if (success) {
    for (const cellId of ['E4', 'D5']) {
      const training = state.institutions.find(institution => institution.cellId === cellId && institution.kind === 'training');
      assertSource(state, training, actionId, `${eventId}:training`, 7, contract.annualSources.training);
    }
    const branch = state.institutions.find(institution => institution.cellId === 'F6' && institution.kind === 'branch');
    assertSource(state, branch, actionId, `${eventId}:training:branch`, 12, contract.annualSources.branch);
    assert.equal(branch.open, legacyBranch || contract.futureBranchAccess.open);
    const training = state.events.find(event => event.id === `${eventId}:training`);
    assert.equal(training.parentId, eventId);
    assert.equal(training.requiresInstitution, carrier.id);
    const branching = state.events.find(event => event.id === `${eventId}:training:branch`);
    assert.equal(branching.parentId, training.id);
    assert.equal(branching.requiresInstitution, state.institutions.find(institution => institution.cellId === 'E4').id);
    if (state.year >= 16) {
      assert.equal(carrier.maintenance, contract.maintenance.lapseMultiplier);
      assert.equal(carrier.open, contract.maintenance.openAfterLapse);
      assert.ok(state.history.some(entry => entry.id === 'charter-lapsed'));
    }
  } else {
    assert.equal(carrier.maintenance, 1, 'failed archive is not a lapsed station');
    assert.equal(state.institutions.length, 1);
    assert.equal(state.events.length, 1);
    assert.equal(state.history.some(entry => entry.id === 'charter-lapsed'), false);
    const origin = state.history.find(entry => entry.id === event.sourceActionId);
    assert.deepEqual(origin.cost, contract.cost, 'failure still paid the same actual contract');
  }
}

for (const [name, api] of engines) test(`${name} public contracts preserve actual costs, timing, odds and evidence requirements`, () => {
  const state = api.createRun(0), saved = copy(state);
  for (const actionId of BUILDING_ACTION_IDS) {
    const actual = api.getActions(state, 'D4').find(action => action.id === actionId);
    const contract = getBuildingContract(freeze(state), actionId);
    assert.deepEqual(contract.cost, actual.cost);
    assert.equal(contract.probability, actual.probability);
    assert.equal(contract.dueIn, actual.dueIn);
    assert.equal(contract.dueYear, actual.dueIn);
    assert.deepEqual(contract.requiredEvidence, actual.requireEvidence);
    assert.deepEqual(contract.missing, actual.requireEvidence);
    assert.equal(contract.canLock, actual.requireEvidence.length === 0);
    assert.equal(contract.model, name === 'original' ? 'legacy-overall' : sim.COVERAGE_RULES.version);
    assert.equal(contract.readOnly, true);
  }
  assert.deepEqual(state, saved);
});

test('coverage-rule reward and risk display preserve the live action text exactly', () => {
  for (const [, api] of engines.filter(([name]) => name !== 'original')) {
    const state = freeze(api.createRun(0));
    for (const actionId of BUILDING_ACTION_IDS) {
      const action = sim.getActions(state, 'D4').find(action => action.id === actionId);
      const contract = getBuildingContract(state, actionId);
      assert.equal(contract.displayReward, action.reward);
      assert.equal(contract.displayRisk, action.risk);
    }
  }
});

test('original-rule display clarifies service, source and conditional chain without inventing new protection', () => {
  for (const explicitLegacyTag of [false, true]) {
    const state = original.createRun(0);
    if (explicitLegacyTag) state.crisisRulesVersion = 'legacy-v1';
    const saved = copy(state), originalActions = sim.getActions(state, 'D4');
    for (const actionId of BUILDING_ACTION_IDS) {
      const contract = getBuildingContract(freeze(state), actionId);
      const text = `${contract.displayReward} ${contract.displayRisk}`;
      assert.match(contract.displayReward, /若成功.*启用.*测站.*足额维护、人手齐备.*年度源项/);
      assert.match(contract.displayReward, /若各步来源仍运转.*第7年.*E4\/D5.*第12年.*F6/);
      assert.match(contract.displayRisk, /失败成本不退.*小型档案站.*原教学链不启动/);
      assert.match(contract.displayRisk, /旧版整体公式/);
      assert.doesNotMatch(text, /较小.*保护|有限保护|覆盖.*减损|减少.*损失|0\.45|10%|15%/);
      if (actionId === 'build_merchant') {
        assert.match(contract.displayReward, /第2年启用收费测站/);
        assert.match(contract.displayRisk, /启用即有缴费门槛.*第16年.*继续收费/);
      } else {
        assert.match(contract.displayReward, /第3年启用公开测站/);
        assert.match(contract.displayRisk, /由公开转为收费/);
      }
    }
    assert.deepEqual(sim.getActions(state, 'D4'), originalActions, 'display clarification does not alter live actions');
    assert.deepEqual(state, saved);
  }
});

test('three options share failure, conditional teaching and maintenance terms without erasing differences', () => {
  const contracts = BUILDING_ACTION_IDS.map(id => getBuildingContract(sim.createRun(), id));
  for (const contract of contracts) {
    assert.deepEqual(contract.commonTerms, contracts[0].commonTerms);
    const text = contract.commonTerms.join(' ');
    assert.match(text, /若失败.*小型档案站.*成本不退.*原教学与分站链不启动/);
    assert.match(text, /若建站成功.*来源机构.*仍在运转.*第7年.*E4.*D5.*第12年.*F6/);
    assert.match(text, /第10年.*一次介入.*经济3.*第11年/);
    assert.match(text, /未续约.*第16年.*未先因缺继任停运.*0\.70/);
    assert.match(text, /商会站从启用时就收费.*不是首次收费/);
    assert.match(contract.differenceTerms.join(' '), /年度源项.*不是.*净增预测/);
    assert.match(contract.prototypeNote, /原型假设.*不是历史测量/);
    assert.deepEqual(contract.chain.map(step => step.year), [7, 12]);
    assert.deepEqual(contract.failure, { probability: Math.round((1 - contract.probability) * 100) / 100, year: contract.dueYear, cellId: 'D4', kind: 'archive', name: '小型档案站', refund: false, startsOriginalChain: false });
  }
  assert.deepEqual(contracts.map(contract => contract.cost), [{ economy: 3 }, { politics: 3, economy: 4 }, { economy: 6 }]);
  assert.deepEqual(contracts.map(contract => contract.probability), [.85, .8, .7]);
  assert.deepEqual(contracts.map(contract => contract.dueYear), [2, 3, 3]);
  assert.deepEqual(contracts.map(contract => contract.coverage.station), [.45, 1, 1]);
  assert.deepEqual(contracts.map(contract => contract.coverage.sourceProtection), [0, .1, .15]);
  assert.deepEqual(contracts.map(contract => contract.success.open), [false, true, true]);
});

test('300 real current-engine runs verify all build outcomes and source chains through year16', () => {
  for (const actionId of BUILDING_ACTION_IDS) {
    const outcomes = { success: 0, failed: 0 };
    for (let seed = 0; seed < 100; seed++) {
      const { state, contract } = route(sim, actionId, seed);
      outcomes[state.events[0].status]++;
      assertRoute(state, contract, actionId);
    }
    assert.ok(outcomes.success > 0 && outcomes.failed > 0, `${actionId} covered both actual outcomes`);
  }
});

for (const [name, api] of engines.slice(0, -1)) test(`${name} true producer routes verify shared terms and version-specific branch access`, () => {
  for (const actionId of BUILDING_ACTION_IDS) for (const success of [true, false]) {
    const { state, contract } = findRoute(api, actionId, success);
    assertRoute(state, contract, actionId, name === 'original');
    if (name === 'original') {
      assert.equal(contract.coverage, null);
      assert.match(contract.compatibilityNote, /公开分站规则.*F6分站公开.*商会来源也不设缴费门槛/);
      assert.match(contract.compatibilityNote, /不是对曾用引擎的鉴别.*可能已经混合续跑/);
    } else {
      const current = api.getWarningCoverage(state);
      assert.equal(current.D4.coverage, success ? .315 : 0);
      assert.equal(current.D4.protection, success ? Math.round(contract.coverage.sourceProtection * .7 * 10000) / 10000 : 0);
    }
  }
});

test('true original crisis outcomes do not acquire new governance or coverage benefits', () => {
  for (const actionId of BUILDING_ACTION_IDS) {
    const { state, contract } = findRoute(original, actionId, true, 23);
    assert.equal(contract.model, 'legacy-overall');
    assert.equal(contract.coverage, null);
    assert.equal(state.flags.crisis.damage, 1);
    assert.equal(state.flags.crisis.coverageByCell, undefined);
    const visible = [...contract.differenceTerms, contract.compatibilityNote].join(' ');
    assert.doesNotMatch(visible, /0\.45|10%|15%/);
    assert.match(visible, /旧版整体危机公式/);
  }
});

test('unversioned original identity applies public future branch policy without rewriting its paid contract', () => {
  const { state: oldState } = findRoute(original, 'build_merchant', true, 3);
  // Use an actual producer state before play, not a newly created state with a
  // removed version tag. Its already-paid pending contract continues in the
  // current engine after the real import path, without resubmitting it.
  const legacy = original.createRun(oldState.seed), contract = getBuildingContract(legacy, 'build_merchant');
  submit(original, legacy, 'build_merchant');
  const paidSource = copy(legacy.history.find(entry => entry.kind === 'action'));
  const result = restoreSave(copy({ state: legacy })).state;
  assert.deepEqual(result, legacy);
  advance(sim, result, 16);
  assert.equal(oldState.year, 3);
  assert.equal(contract.futureBranchAccess.engine, 'current-runtime');
  assert.equal(contract.coverage, null);
  assert.equal(result.events[0].status, 'success');
  assert.equal(result.institutions.find(institution => institution.kind === 'branch').open, true);
  assert.equal(contract.futureBranchAccess.rulesVersion, 'public-branch-v1');
  assert.equal(contract.futureBranchAccess.explicit, false);
  assert.deepEqual(result.history.find(entry => entry.kind === 'action'), paidSource);
  assert.match(contract.compatibilityNote, /不是完整回滚旧引擎/);
});

test('a real original public merchant branch stays public when imported after it already exists', () => {
  const { state } = findRoute(original, 'build_merchant', true, 12);
  const branch = copy(state.institutions.find(institution => institution.kind === 'branch'));
  assert.equal(branch.open, true);
  const imported = restoreSave(copy({ state })).state;
  assert.equal(getBuildingContract(imported, 'build_merchant'), null, 'prospective contracts do not rewrite a historical carrier');
  advance(sim, imported, 16);
  assert.deepEqual(imported.institutions.find(institution => institution.kind === 'branch'), branch);
});

test('preview is evidence-free and supplied evidence cannot bypass new-run investigation', () => {
  const state = sim.createRun(), saved = copy(state);
  const required = ['independent_flood_records', 'unfunded_maintenance'];
  const contract = getBuildingContract(state, 'build_joint', { legacyEvidence: required });
  assert.deepEqual(contract.missing, required);
  assert.equal(contract.canLock, false);
  assert.equal(sim.getInvestigation(state, 'protagonist', 'D4').budget, 3);
  assert.deepEqual(state, saved);
  assert.throws(() => sim.lockTask(state, 'protagonist', 'D4', 'build_joint'), /证据/);
  for (const id of required) sim.investigate(state, 'protagonist', 'D4', id);
  const afterEvidence = copy(state);
  assert.equal(getBuildingContract(freeze(state), 'build_joint').canLock, true);
  assert.deepEqual(state, afterEvidence);
});

test('legacy evidence remains the scene record; reading neither acquires nor fabricates it', () => {
  const state = original.createRun(), saved = copy(state), evidence = ['independent_flood_records', 'unfunded_maintenance'];
  assert.equal(getBuildingContract(state, 'build_joint').canLock, false);
  assert.equal(getBuildingContract(state, 'build_joint', { legacyEvidence: evidence }).canLock, true);
  assert.deepEqual(state, saved);
  assert.deepEqual(evidence, ['independent_flood_records', 'unfunded_maintenance']);
});

test('free preview and locked task use the same detached contract without modifying the draft', () => {
  const state = sim.createRun();
  sim.investigate(state, 'protagonist', 'D4', 'independent_flood_records');
  sim.investigate(state, 'protagonist', 'D4', 'unfunded_maintenance');
  const before = getBuildingContract(state, 'build_joint');
  sim.lockTask(state, 'protagonist', 'D4', 'build_joint');
  const saved = copy(state), task = sim.getWindowReview(state).tasks[0];
  const locked = getBuildingContract(freeze(state), task.a.id, { cellId: task.d.cellId, actorId: task.d.actorId, legacyEvidence: task.d.evidence });
  assert.deepEqual(locked, before);
  locked.cost.economy = 999;
  locked.annualSources.station.science = 999;
  locked.chain[0].cellIds.push('A1');
  locked.maintenance.renewalCost.economy = 999;
  locked.commonTerms.length = 0;
  locked.missing.push('invented');
  assert.deepEqual(getBuildingContract(state, 'build_joint'), before);
  assert.deepEqual(state, saved);
});

test('seed, stored random rolls and unretrieved evidence contents are never consulted', () => {
  for (const api of [sim, original]) {
    const state = api.createRun();
    const deny = name => ({ enumerable: true, get() { throw new Error(`${name} read`); } });
    Object.defineProperty(state, 'seed', deny('seed'));
    Object.defineProperty(state, 'randomResults', deny('random result'));
    Object.defineProperty(state, 'evidenceContents', deny('evidence contents'));
    const event = { actionId: 'build_joint', status: 'pending' };
    Object.defineProperty(event, 'roll', deny('roll'));
    state.events.push(event);
    for (const id of BUILDING_ACTION_IDS) {
      const result = getBuildingContract(state, id);
      assert.ok(result);
      const text = JSON.stringify(result);
      assert.doesNotMatch(text, /randomResults|evidenceContents|"roll"|"seed"/);
    }
  }
});

test('active-source conditions prevent cancelled teaching from becoming a guaranteed outcome', () => {
  const { state, contract } = findRoute(sim, 'build_joint', true, 3);
  state.institutions.find(institution => institution.kind === 'station').active = false;
  advance(sim, state, 12);
  assert.equal(state.events.find(event => event.actionId === 'training').status, 'cancelled');
  assert.equal(state.institutions.some(institution => ['training', 'branch'].includes(institution.kind)), false);
  assert.ok(contract.chain.every(step => /仍运转/.test(step.condition)));
});

test('real renewal avoids lapse, while real vacant recruitment shuts down instead of applying 0.70', () => {
  for (const actionId of BUILDING_ACTION_IDS) {
    const renewed = findRoute(sim, actionId, true, 16, 'renew_charter').state;
    const station = renewed.institutions.find(institution => institution.kind === 'station');
    assert.equal(station.maintenance, 1);
    assert.equal(renewed.history.some(entry => entry.id === 'charter-lapsed'), false);
    const vacant = findRoute(sim, actionId, true, 16, 'recruit_risk').state;
    assert.equal(vacant.institutions.find(institution => institution.kind === 'station').active, false);
    assert.equal(vacant.history.some(entry => entry.id === 'charter-lapsed'), false);
    assert.equal(vacant.institutions.filter(institution => ['training', 'branch'].includes(institution.kind)).length, 3);
  }
});

test('unavailable contracts, actors, places and phases remain unavailable', () => {
  const state = sim.createRun();
  assert.equal(getBuildingContract(null, 'build_joint'), null);
  for (const id of ['preserve_records', 'build_invented', '__proto__']) assert.equal(getBuildingContract(state, id), null);
  assert.equal(getBuildingContract(state, 'build_joint', { cellId: 'B4' }), null);
  assert.equal(getBuildingContract(state, 'build_joint', { actorId: 'linche' }), null);
  submit(sim, state);
  assert.equal(getBuildingContract(state, 'build_joint'), null);
  advance(sim, state, 10);
  assert.equal(getBuildingContract(state, 'build_joint'), null);
});

test('renewal disclosure explicitly requires a built operating station',()=>{for(const id of BUILDING_ACTION_IDS){const terms=getBuildingContract(sim.createRun(12),id).commonTerms;assert.ok(terms.some(t=>t.startsWith('若测站建成并仍在运转，第10年')));}});


test('explicit branch creation policy is independent of station access and crisis accounting', () => {
  for (const api of [original, sim]) for (const [version, open] of [['public-branch-v1', true], ['source-branch-v1', false]]) {
    const state = api.createRun(1);state.branchAccessRulesVersion = version;
    const before = copy(state), contract = getBuildingContract(freeze(state), 'build_merchant');
    assert.equal(contract.success.open, false, 'D4 merchant station remains paid');
    assert.equal(contract.futureBranchAccess.open, open);
    assert.equal(contract.futureBranchAccess.explicit, true);
    assert.equal(contract.futureBranchAccess.rulesVersion, version);
    assert.match(contract.compatibilityNote, /已明确保存独立分站准入版本/);
    assert.match(contract.differenceTerms.join(' '), open ? /同源F6分站公开服务/ : /同源F6分站沿用商会收费准入/);
    if (contract.coverage) {assert.equal(contract.coverage.station, .45);assert.equal(contract.coverage.branch, open ? 1 : .45);}
    else assert.equal(contract.model, 'legacy-overall');
    assert.deepEqual(state, before);
  }
});

test('a locked original merchant contract discloses the same future public default for both views', () => {
  const state = original.createRun(1), before = getBuildingContract(state, 'build_merchant');
  original.lockTask(state, 'protagonist', 'D4', 'build_merchant');
  const snapshot = copy(state), draft = state.drafts.protagonist;
  const locked = getBuildingContract(state, 'build_merchant', {actorId:draft.actorId,cellId:draft.cellId,legacyEvidence:draft.evidence});
  assert.deepEqual(locked, before);
  assert.equal(locked.futureBranchAccess.open, true);
  assert.match(locked.compatibilityNote, /只用于尚未兑现.*已存准入.*历史不重算/);
  assert.deepEqual(state, snapshot);
});
