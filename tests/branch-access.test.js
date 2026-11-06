import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as original from './fixtures/legacy-simulation.js';
import * as coverage from './fixtures/pre-tradeoffs-simulation.js';
import * as tradeoffs from './fixtures/pre-handoff-simulation.js';
import * as handoff from './fixtures/pre-aftermath-simulation.js';
import * as aftermath from './fixtures/pre-recruitment-simulation.js';
import * as recruitment from './fixtures/pre-recovery-simulation.js';
import * as recovery from './fixtures/pre-port-access-simulation.js';
import * as staffing from './fixtures/pre-staffing-simulation.js';
import * as before from './fixtures/pre-branch-access-simulation.js';
import { BRANCH_ACCESS_RULES, getBranchAccessRulesVersion, getBranchAccessRulesDescription, getFutureBranchAccess } from '../src/branch-access.js';
import { restoreSave } from '../src/save.js';

const copy = structuredClone;
const IMPORT_YEARS = [0, 1, 2, 6, 7, 10, 11, 12, 13, 16, 20, 30];
const laterEngines = [['coverage', coverage], ['tradeoffs', tradeoffs], ['handoff', handoff], ['aftermath', aftermath], ['recruitment', recruitment], ['recovery', recovery], ['staffing', staffing], ['before', before]];
const branch = state => state.institutions.find(i => i.kind === 'branch' && i.cellId === 'F6');
const branchEvent = state => state.events.find(e => e.actionId === 'branch');
const reload = state => restoreSave(JSON.parse(JSON.stringify({ state }))).state;
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function submit(api, state, actionId) {
  if (actionId) {
    const action = api.getActions(state, 'D4').find(a => a.id === actionId);
    assert.ok(action, `${actionId} exists at ${state.year}`);
    if (api.usesTradeoffs?.(state)) for (const evidence of action.requireEvidence) {
      if (!api.getInvestigation(state, 'protagonist', 'D4').evidence.includes(evidence)) api.investigate(state, 'protagonist', 'D4', evidence);
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
function sourceAt(api, year, { seed = 1, build = 'build_merchant', atTen } = {}) {
  const state = api.createRun(seed);
  submit(api, state, build);
  return advance(api, state, year, atTen);
}
function mechanics(state) {
  return { cells: state.cells, institutions: state.institutions, events: state.events, flags: state.flags, snapshots: state.snapshots,
    actors: state.actors, promises: state.promises, committedWindows: state.committedWindows, year: state.year, phase: state.phase, drafts: state.drafts };
}
function assertPast(state, saved) {
  assert.deepEqual(state.history.slice(0, saved.history.length), saved.history, 'all original history remains immutable');
  for (const [year, snapshot] of Object.entries(saved.snapshots)) assert.deepEqual(state.snapshots[year], snapshot, `past snapshot ${year}`);
  for (const event of saved.events.filter(e => e.status !== 'pending')) assert.deepEqual(state.events.find(e => e.id === event.id), event, 'resolved event is not rewritten');
}
function continuePair(api, source, loaded, { atTen, fullState = false } = {}) {
  const saved = copy(loaded);
  while (source.year < 40) {
    if (source.phase === 'planning') {
      submit(api, source, source.year === 10 ? atTen : undefined);
      submit(sim, loaded, loaded.year === 10 ? atTen : undefined);
    }
    api.advanceYear(source); sim.advanceYear(loaded);
    assert.deepEqual(mechanics(loaded), mechanics(source), `same annual mechanics at ${source.year}`);
    if (fullState) assert.deepEqual(loaded, source, `same complete later-engine state at ${source.year}`);
  }
  assertPast(loaded, saved);
}

test('three compatibility fixture blobs are exact published engines apart from their board import paths', () => {
  for (const [file, blob] of [
    ['legacy-simulation.js', 'fd04a8b66e52568f29e1f8272b6478736df2b0a9'],
    ['pre-tradeoffs-simulation.js', 'faa7c6f60cc42c3accfdbb41e0051ce55b5d6d25'],
    ['pre-branch-access-simulation.js', '13fba0e9ad50df2c4581cdd8ef757b0933890265'],
  ]) {
    const bytes = Buffer.from(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8').replace("'../../src/data/board.json'", "'./data/board.json'"));
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), blob, file);
  }
});

test('new runs explicitly pin source access and future checks; only explicit tags differ from the frozen factory', () => {
  const state = sim.createRun(1), expected = before.createRun(1);
  expected.branchAccessRulesVersion = BRANCH_ACCESS_RULES.source;
  expected.futureCheckRulesVersion = sim.FUTURE_CHECK_RULES.version;
  expected.archiveUpgradeRulesVersion = sim.ARCHIVE_UPGRADE_RULES.version;
  expected.trainingAuthorizationRulesVersion = sim.TRAINING_AUTHORIZATION_RULES.version;
  expected.trainingWorkloadRulesVersion = sim.TRAINING_WORKLOAD_RULES.version;
  assert.deepEqual(state, expected);
  assert.deepEqual(reload(state), state);
  submit(before, expected, 'build_merchant'); submit(sim, state, 'build_merchant');
  continuePair(before, expected, state, { fullState: true });
  assert.equal(branch(state).open, false);
});

test('missing tags choose a future policy without stamping or claiming producer identity', () => {
  for (const api of [original, coverage, before]) {
    const state = sourceAt(api, 11), saved = copy(state), loaded = reload(state);
    assert.deepEqual(loaded, saved);
    assert.equal(loaded.branchAccessRulesVersion, undefined);
    assert.equal(getBranchAccessRulesVersion(loaded), api === original ? BRANCH_ACCESS_RULES.public : BRANCH_ACCESS_RULES.source);
    assert.match(getBranchAccessRulesDescription(loaded), /之后结算的兼容默认.*不是对曾用引擎的鉴别.*混合续跑/);
    assert.match(getBranchAccessRulesDescription(loaded), /已存准入.*不重算.*不会因此复活.*不是完整回滚/);
    assert.deepEqual(loaded, saved);
  }
  const state = original.createRun(1); state.crisisRulesVersion = 'legacy-v1';
  assert.equal(getBranchAccessRulesVersion(state), BRANCH_ACCESS_RULES.public);
});

for (const year of IMPORT_YEARS) test(`true ef841e8 merchant imported at ${year}: original future mechanics through40, immutable past`, () => {
  const source = sourceAt(original, year), loaded = reload(source);
  assert.deepEqual(loaded, source);
  continuePair(original, source, loaded);
  assert.equal(branch(loaded).open, true);
  assert.equal(loaded.branchAccessRulesVersion, undefined);
});

// These engines all explicitly identify coverage-v1. Equality here is not a
// claim that every untagged/mixed old-identity save was created by one of them.
for (const [name, api] of laterEngines) for (const year of IMPORT_YEARS) test(`${name} coverage identity merchant imported at ${year}: later mechanics remain unchanged`, () => {
  const source = sourceAt(api, year), loaded = reload(source);
  assert.deepEqual(loaded, source);
  continuePair(api, source, loaded, { fullState: api === before });
  assert.equal(branch(loaded).open, false);
  assert.equal(loaded.branchAccessRulesVersion, undefined);
});

for (const api of [original, before]) for (const version of [BRANCH_ACCESS_RULES.public, BRANCH_ACCESS_RULES.source]) test(`${api === original ? 'original' : 'later'} identity explicitly pinned ${version} determines only future creation`, () => {
  const state = sourceAt(api, 11), saved = copy(state);
  state.branchAccessRulesVersion = version;
  const loaded = reload(state), pending = copy(branchEvent(state));
  assert.deepEqual(loaded, state);
  assert.equal(getBranchAccessRulesVersion(loaded), version);
  sim.advanceYear(loaded);
  assert.equal(branch(loaded).open, version === BRANCH_ACCESS_RULES.public);
  assert.equal(branchEvent(loaded).id, pending.id);
  assert.equal(branchEvent(loaded).sourceActionId, pending.sourceActionId);
  assert.equal(branchEvent(loaded).year, pending.year);
  assert.equal(branchEvent(loaded).probability, pending.probability);
  assertPast(loaded, saved);
  const control = copy(state); api.advanceYear(control);
  assert.deepEqual(loaded.cells, control.cells, 'access does not alter year12 source production');
  assert.deepEqual(loaded.snapshots, control.snapshots);
  assert.deepEqual(loaded.flags, control.flags);
});

for (const year of [11, 12, 23, 30]) test(`mixed original identity continued by pre-fix engine until ${year}: no claim of restoring producer history`, () => {
  const mixed = sourceAt(original, 6);
  advance(before, mixed, year);
  assert.equal(mixed.crisisRulesVersion, undefined);
  assert.equal(mixed.branchAccessRulesVersion, undefined);
  const saved = copy(mixed), loaded = reload(mixed);
  assert.deepEqual(loaded, saved);
  if (year < 12) {
    const priorFuture = copy(mixed); before.advanceYear(priorFuture);
    sim.advanceYear(loaded);
    assert.equal(branch(priorFuture).open, false, 'pre-fix runtime would charge this still-pending branch');
    assert.equal(branch(loaded).open, true, 'compatibility default deliberately changes only prospective access');
    assert.deepEqual(loaded.cells, priorFuture.cells);
  } else {
    const existing = copy(branch(mixed));
    assert.equal(existing.open, false, 'real mixed runtime already created a paid branch');
    advance(sim, loaded, Math.min(40, year + 1));
    assert.deepEqual(branch(loaded), existing, 'the default cannot rewrite the existing paid branch');
  }
  assertPast(loaded, saved);
});

test('explicit source access retains the pre-fix future for a real mixed original-identity pending save', () => {
  const source = sourceAt(original, 6); advance(before, source, 11);
  source.branchAccessRulesVersion = BRANCH_ACCESS_RULES.source;
  continuePair(before, source, reload(source), { fullState: true });
});

for (const api of [original, before]) for (const year of [12, 13, 23, 30]) for (const version of [BRANCH_ACCESS_RULES.public, BRANCH_ACCESS_RULES.source]) test(`fulfilled ${api === original ? 'public' : 'paid'} branch at ${year} ignores later ${version} for existing access`, () => {
  const state = sourceAt(api, year), existing = copy(branch(state)), saved = copy(state);
  state.branchAccessRulesVersion = version;
  const loaded = reload(state);
  advance(sim, loaded, 40);
  assert.deepEqual(branch(loaded), existing);
  assertPast(loaded, saved);
  if (saved.flags.crisis?.resolved) assert.deepEqual(loaded.flags.crisis, saved.flags.crisis);
});

for (const version of [BRANCH_ACCESS_RULES.public, BRANCH_ACCESS_RULES.source]) test(`${version}: failed, cancelled, inactive and zero-maintenance branches are not recreated or repaired`, () => {
  const failed = sourceAt(original, 3, { seed: 0 }); failed.branchAccessRulesVersion = version;
  const failedSource = copy(failed); advance(sim, failed, 40);
  assert.equal(branch(failed), undefined); assertPast(failed, failedSource);
  const cancelled = sourceAt(original, 11); cancelled.branchAccessRulesVersion = version;
  cancelled.institutions.find(i => i.kind === 'training' && i.cellId === 'E4').active = false;
  sim.advanceYear(cancelled);
  assert.equal(branchEvent(cancelled).status, 'cancelled'); assert.equal(branch(cancelled), undefined);
  const cancelledSource = copy(cancelled); advance(sim, cancelled, 40);
  assert.equal(branch(cancelled), undefined); assertPast(cancelled, cancelledSource);
  for (const api of [original, before]) for (const inactive of [true, false]) {
    const state = sourceAt(api, 12); state.branchAccessRulesVersion = version;
    if (inactive) branch(state).active = false; else branch(state).maintenance = 0;
    const target = copy(branch(state)), loaded = reload(state); advance(sim, loaded, 40);
    assert.deepEqual(branch(loaded), target);
    assert.equal(sim.getWarningCoverage(loaded).F6.coverage, 0);
  }
});

for (const api of [original, before]) for (const build of ['build_merchant', 'build_state', 'build_joint']) test(`renewal remains local and both non-merchant sources remain public: ${api === original ? 'original' : 'later'}/${build}`, () => {
  const source = sourceAt(api, 10, { seed: 1, build }), loaded = reload(source);
  if (api === original && build === 'build_merchant') {
    // Original renewal left D4 paid; later/current renewal opens it. This is
    // an existing separate compatibility boundary, not part of branch rules.
    const priorRuntime = copy(source);
    submit(original, source, 'renew_charter'); original.advanceYear(source);
    submit(before, priorRuntime, 'renew_charter'); before.advanceYear(priorRuntime);
    submit(sim, loaded, 'renew_charter'); sim.advanceYear(loaded);
    assert.equal(source.institutions.find(i => i.kind === 'station').open, false);
    assert.deepEqual(mechanics(loaded), mechanics(priorRuntime), 'existing current D4 renewal behavior is unchanged');
    advance(sim, loaded, 40);
  } else continuePair(api, source, loaded, { atTen: 'renew_charter', fullState: api === before });
  assert.equal(loaded.institutions.find(i => i.kind === 'station' && i.cellId === 'D4').open, true);
  assert.equal(branch(loaded).open, build !== 'build_merchant' || api === original);
});

for (const value of [null, '', 'branch-future-v2', 1, {}, []]) test(`unknown branch tag ${JSON.stringify(value)} rejects before any restore, commit or annual writes`, () => {
  for (const api of [original, before]) for (const stage of ['passed', 'locked', 'pending']) {
    const state = stage === 'pending' ? sourceAt(api, 11) : api.createRun(1);
    if (stage === 'passed') api.passTask(state, 'protagonist');
    if (stage === 'locked') api.lockTask(state, 'protagonist', 'D4', 'build_merchant');
    state.branchAccessRulesVersion = value;
    const saved = copy(state);
    assert.equal(sim.validateState(state).valid, false);
    assert.throws(() => reload(state), /分站准入规则版本非法/);
    assert.throws(() => getBranchAccessRulesVersion(state), /分站准入规则版本非法/);
    assert.throws(() => getFutureBranchAccess(state, 'build_merchant'), /分站准入规则版本非法/);
    if (stage === 'pending') assert.throws(() => sim.advanceYear(state), /分站准入规则版本非法/);
    else { assert.equal(sim.getWindowReview(state).ready, false); assert.throws(() => sim.commitWindow(state), /分站准入规则版本非法/); }
    assert.deepEqual(state, saved);
  }
});

test('prospective helper is pure, detached, exact-source and independent of hidden or historical state', () => {
  for (const api of [original, before, sim]) {
    const state = api.createRun(1), saved = copy(state);
    freeze(state);
    for (const actionId of ['build_merchant', 'build_state', 'build_joint']) {
      const result = getFutureBranchAccess(state, actionId);
      assert.deepEqual(result, getFutureBranchAccess(state, `action:0:protagonist:D4:${actionId}`));
      assert.equal(result.sourceKnown, true);
      assert.match(result.description, /若.*第12年仍运转.*未来条件.*不是已经兑现.*既有分站/);
      result.open = 'mutated';
      assert.equal(typeof getFutureBranchAccess(state, actionId).open, 'boolean');
    }
    assert.deepEqual(state, saved);
    const minimal = { crisisRulesVersion: state.crisisRulesVersion, branchAccessRulesVersion: state.branchAccessRulesVersion };
    for (const key of ['seed', 'events', 'history', 'institutions', 'cells', 'snapshots', 'flags']) Object.defineProperty(minimal, key, { get() { throw new Error(`${key} must not be read`); } });
    getFutureBranchAccess(minimal, 'build_merchant'); getBranchAccessRulesDescription(minimal);
  }
  for (const source of [undefined, null, 1, {}, '', 'merchant', 'fake:build_merchant', 'action:0:protagonist:D4:build_merchant:fake', 'action:0:other:D4:build_merchant', 'action:10:protagonist:D4:build_merchant']) {
    const result = getFutureBranchAccess(original.createRun(), source);
    assert.equal(result.open, null); assert.equal(result.merchant, null); assert.equal(result.sourceKnown, false);
    assert.match(result.description, /不能据此说明.*不补写/);
  }
});

test('unknown old pending source keeps prior runtime fallback without a new rejection or provenance claim', () => {
  for (const source of ['unverified:build_merchant', 'unverified:build_state']) for (const api of [original, before]) {
    const state = sourceAt(api, 11); branchEvent(state).sourceActionId = source;
    const saved = copy(state), expected = copy(state), loaded = reload(state);
    assert.equal(sim.validateState(state).valid, true);
    assert.equal(getFutureBranchAccess(state, source).open, null);
    assert.deepEqual(loaded, saved);
    before.advanceYear(expected); sim.advanceYear(loaded);
    assert.equal(branch(loaded).open, !source.endsWith(':build_merchant'));
    assert.equal(branch(loaded).open, branch(expected).open);
    assert.deepEqual(loaded.cells, expected.cells);
    assertPast(loaded, saved);
  }
});

test('merchant action and locked notes use the same helper without rewriting submitted contracts', () => {
  for (const api of [original, before]) for (const version of [undefined, BRANCH_ACCESS_RULES.public, BRANCH_ACCESS_RULES.source]) {
    const state = api.createRun(1);
    if (version !== undefined) state.branchAccessRulesVersion = version;
    const saved = copy(state), control = copy(state), frozen = freeze(copy(state));
    const currentAction = sim.getActions(frozen, 'D4').find(a => a.id === 'build_merchant');
    const priorAction = before.getActions(frozen, 'D4').find(a => a.id === 'build_merchant');
    const future = getFutureBranchAccess(frozen, 'build_merchant');
    assert.ok(currentAction.modelNote.endsWith(future.description));
    if (future.open) assert.match(currentAction.risk, /D4.*缴费门槛.*条件.*F6分站公开/);
    else assert.equal(currentAction.risk, priorAction.risk);
    if (future.open && !sim.usesLegacyCrisisRules(frozen)) assert.match(currentAction.modelNote, /D4.*0\.45.*F6.*为1/);
    for (const key of ['id', 'title', 'description', 'cost', 'probability', 'dueIn', 'requireEvidence', 'reward']) assert.deepEqual(currentAction[key], priorAction[key]);
    assert.deepEqual(frozen, saved);
    sim.lockTask(state, 'protagonist', 'D4', 'build_merchant');
    before.lockTask(control, 'protagonist', 'D4', 'build_merchant');
    assert.equal(sim.getWindowReview(state).tasks[0].a.modelNote, currentAction.modelNote);
    sim.commitWindow(state); before.commitWindow(control);
    assert.deepEqual(state, control, 'display-only changes do not alter paid contract, pending event, source text, history, channels or snapshot');
    assertPast(state, saved);
  }
});

test('a pending year31 opening contract still uses the existing paid branch, not a future creation tag', () => {
  const state = sourceAt(before, 30);
  before.investigate(state, 'protagonist', 'F6', 'resident_testimony');
  before.lockTask(state, 'protagonist', 'F6', 'open_port_warning');
  before.commitWindow(state);
  state.branchAccessRulesVersion = BRANCH_ACCESS_RULES.public;
  const saved = copy(state), expected = copy(state), loaded = reload(state);
  const pending = state.events.find(e => e.actionId === 'open_port_warning');
  assert.equal(branch(loaded).open, false);
  assert.deepEqual(loaded, saved);
  before.advanceYear(expected); sim.advanceYear(loaded);
  assert.deepEqual(loaded, expected);
  assert.equal(loaded.events.find(e => e.id === pending.id).status, 'success');
  assert.equal(branch(loaded).open, true);
  assertPast(loaded, saved);
});

test('changing a fulfilled public branch to source policy cannot offer a paid-branch opening contract', () => {
  const state = before.createRun(1); state.branchAccessRulesVersion = BRANCH_ACCESS_RULES.public;
  submit(sim, state, 'build_merchant'); advance(sim, state, 30);
  const existing = copy(branch(state));
  state.branchAccessRulesVersion = BRANCH_ACCESS_RULES.source;
  assert.equal(getFutureBranchAccess(state, 'build_merchant').open, false);
  assert.equal(sim.getActions(state, 'F6').some(a => a.id === 'open_port_warning'), false);
  assert.deepEqual(branch(reload(state)), existing);
});
