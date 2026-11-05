import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
// Published 0bcabc5 kernel, source blob 390577e; only the JSON import path differs.
// Legacy cases execute that kernel rather than deleting fields from new runs.
import * as prior from './fixtures/pre-handoff-simulation.js';
import { restoreSave } from '../src/save.js';
import { investigateAndLock as lock } from './helpers/play.js';

const builds = [
  { action: 'build_joint', seed: 0 },
  { action: 'build_state', seed: 0 },
  { action: 'build_merchant', seed: 1 },
];
const positive = { share_power: '许多人签署的历史', withdraw: '没有唯一守夜人' };
const negative = { share_power: '纸上的共同作者', withdraw: '交班后的空椅子' };
const reload = state => restoreSave(JSON.parse(JSON.stringify({ state }))).state;

function submit(state, api = sim) {
  for (const actor of api.getActors(state)) if (!state.drafts[actor.id]) api.passTask(state, actor.id);
  api.commitWindow(state);
}
function decade(state, api = sim) {
  submit(state, api);
  api.advanceToNextWindow(state);
  return state;
}
function chooseWith(api, state, cellId, actionId, actorId = 'protagonist') {
  if (api === sim) return lock(state, actorId, cellId, actionId);
  const action = api.getActions(state, cellId, actorId).find(candidate => candidate.id === actionId);
  assert.ok(action, `Frozen kernel action exists: ${actionId}`);
  for (const id of action.requireEvidence) {
    if (!api.getInvestigation(state, actorId, cellId).evidence.includes(id)) api.investigate(state, actorId, cellId, id);
  }
  return api.lockTask(state, actorId, cellId, actionId);
}
function builtAt10({ action = 'build_joint', seed = 0 } = {}, api = sim) {
  const state = api.createRun(seed);
  chooseWith(api, state, 'D4', action);
  decade(state, api);
  assert.equal(state.flags.stationBuilt, true, `${action}, seed ${seed} must build successfully`);
  return state;
}
function renewedAt20(build = {}, api = sim) {
  const state = builtAt10(build, api);
  chooseWith(api, state, 'D4', 'renew_charter');
  decade(state, api);
  return state;
}
function readyAt30(build = {}, api = sim) {
  const state = renewedAt20(build, api);
  chooseWith(api, state, 'F6', 'independent_review');
  decade(state, api);
  assert.equal(state.flags.review, true, 'Selected route must complete its review');
  return state;
}
function finish(state, policy) {
  lock(state, 'protagonist', 'D4', policy);
  decade(state);
  assert.equal(state.year, 40);
  assert.equal(sim.validateState(state).valid, true);
  return sim.getEnding(state);
}

for (const build of builds) for (const policy of Object.keys(positive)) {
  test(`${build.action}: renewed training and successful review support ${policy}`, () => {
    const state = readyAt30(build);
    const ready = sim.getHandoffReadiness(state);
    assert.deepEqual(new Set(ready.staffCells), new Set(['E4', 'D5']));
    assert.deepEqual(new Set(ready.authorizedCells), new Set(['E4', 'D5']));
    assert.deepEqual(ready.checkCells, ['F6']);
    assert.equal(ready.staff.length, 2);
    assert.equal(ready.checks.length, 1);
    assert.equal(ready.links.length, 2);
    assert.ok(ready.links.every(link => link.staffCell !== link.checkCell));
    assert.equal(ready.canWithdraw, true);
    assert.equal(ready.canShare, true);
    assert.deepEqual(ready.missing, []);
    assert.deepEqual(ready.shareMissing, []);
    assert.match(sim.handoffSummary(state, policy), /当前交班条件齐备/);
    const renewal = state.events.find(event => event.actionId === 'renew_charter');
    for (const training of state.institutions.filter(i => i.kind === 'training')) {
      assert.deepEqual(training.handoffAuthorization, {
        eventId: renewal.id, year: 11, sourceActionId: training.sourceActionId,
      });
      assert.ok(renewal.authorizedTrainingSources.includes(training.sourceActionId));
    }
    const ending = finish(state, policy);
    assert.equal(ending.title, positive[policy]);
    assert.equal(ending.metrics.networks, 2);
    assert.equal(ending.metrics.delegatedStaff, 2);
    assert.equal(ending.metrics.independentChecks, 1);
    assert.equal(ending.metrics.handoffStatus, '条件齐备');
    assert.equal(state.flags.crisis.damage, 0);
    if (build.action === 'build_merchant') {
      assert.equal(state.institutions.find(i => i.kind === 'branch').open, false);
      assert.match(ending.text, /F6仍有收费门槛/);
    }
  });
}

test('two authorized same-source training regions and another school are still not independent checks', () => {
  const state = renewedAt20();
  lock(state, 'protagonist', 'E4', 'train_network');
  decade(state);
  const ready = sim.getHandoffReadiness(state);
  assert.equal(ready.staff.length, 3);
  assert.equal(ready.staffCells.length, 2);
  assert.equal(ready.authorizedStaff.length, 3);
  assert.equal(ready.authorizedCells.length, 2);
  assert.equal(ready.checks.length, 0);
  assert.equal(sim.getEnding(state).metrics.autonomy, 2, 'Display count is not a readiness score');
  assert.equal(ready.canWithdraw, false);
  assert.equal(ready.canShare, false);
  assert.match(ready.missing.join('；'), /异源校验/);
  assert.equal(finish(state, 'share_power').title, negative.share_power);
});

for (const action of ['build_state', 'build_merchant']) {
  test(`${action}: failed review cannot turn its retained institution into a real check`, () => {
    const state = renewedAt20({ action, seed: 6 });
    lock(state, 'protagonist', 'F6', 'independent_review');
    decade(state);
    const review = state.events.find(event => event.actionId === 'independent_review');
    assert.equal(review.status, 'failed');
    assert.ok(state.institutions.some(i => i.kind === 'independent' && i.active));
    assert.equal(sim.getHandoffReadiness(state).checks.length, 0);
    const originalDamage = state.flags.crisis.damage;
    assert.ok(originalDamage > 0);
    assert.equal(finish(state, 'withdraw').title, negative.withdraw);
    assert.equal(state.flags.crisis.damage, originalDamage);
  });
}

test('successful review and riverport cooperation cannot authorize unrenewed distant trainees', () => {
  const state = builtAt10();
  lock(state, 'protagonist', 'D4', 'recruit_successor');
  decade(state);
  lock(state, 'protagonist', 'F6', 'independent_review');
  lock(state, 'linche', 'D4', 'free_warning');
  decade(state);
  const ready = sim.getHandoffReadiness(state);
  assert.equal(ready.trust, true);
  assert.equal(ready.staff.length, 2);
  assert.equal(ready.checks.length, 1);
  assert.equal(ready.authorizedStaff.length, 0);
  assert.equal(ready.canWithdraw, false);
  assert.equal(ready.canShare, false);
  assert.match(ready.missing.join('；'), /承接授权/);
  assert.equal(finish(state, 'share_power').title, negative.share_power);
});

test('archive and voluntary night school remain a valid no-station withdrawal route', () => {
  const state = sim.createRun(6);
  lock(state, 'protagonist', 'B4', 'preserve_records'); decade(state);
  lock(state, 'protagonist', 'E4', 'fund_school'); decade(state);
  lock(state, 'protagonist', 'B4', 'independent_review'); decade(state);
  const ready = sim.getHandoffReadiness(state);
  assert.deepEqual(ready.authorizedCells, ['E4']);
  assert.deepEqual(ready.checkCells, ['B4']);
  assert.equal(ready.checks.length, 2, 'Archive and review remain separate institutions in one region');
  assert.equal(ready.canWithdraw, true);
  assert.equal(ready.canShare, false, 'Local school permission is not riverport cooperation');
  assert.match(ready.shareMissing.join('；'), /河港/);
  assert.equal(finish(state, 'withdraw').title, positive.withdraw);
  assert.equal(state.institutions.some(i => i.kind === 'station'), false);
});

test('a forced relocation adds technical staff, not permission or cooperation', () => {
  const state = sim.createRun(0);
  lock(state, 'protagonist', 'B4', 'preserve_records'); decade(state);
  decade(state);
  lock(state, 'protagonist', 'D4', 'relocate_teacher'); decade(state);
  const ready = sim.getHandoffReadiness(state);
  assert.deepEqual(ready.staffCells, ['E4']);
  assert.equal(ready.authorizedStaff.length, 0);
  assert.deepEqual(ready.checkCells, ['B4']);
  assert.equal(ready.trust, false);
  assert.equal(ready.canWithdraw, false);
  assert.equal(ready.canShare, false);
  assert.match(ready.shareMissing.join('；'), /明确拒绝/);
  assert.equal(finish(state, 'withdraw').title, negative.withdraw);
});

test('explicit refusal overrides old renewal but does not erase other local succession rights', () => {
  const state = readyAt30();
  state.flags.trust = false;
  const ready = sim.getHandoffReadiness(state);
  assert.equal(state.flags.renewed, true);
  assert.equal(ready.canWithdraw, true);
  assert.equal(ready.canShare, false);
  assert.deepEqual(ready.missing, []);
  assert.match(sim.handoffSummary(state, 'share_power'), /明确拒绝/);
  assert.match(sim.handoffSummary(state, 'withdraw'), /条件齐备/);
  assert.equal(finish(state, 'share_power').title, negative.share_power);
});

for (const role of ['training', 'independent']) for (const change of ['inactive', 'unmaintained']) {
  test(`${change} ${role} cannot satisfy the handoff even while historical flags remain true`, () => {
    const state = readyAt30();
    for (const institution of state.institutions.filter(i => i.kind === role)) {
      if (change === 'inactive') institution.active = false;
      else institution.maintenance = 0;
    }
    assert.equal(state.flags.renewed, true);
    assert.equal(state.flags.review, true);
    assert.equal(sim.getHandoffReadiness(state).canWithdraw, false);
    assert.equal(sim.getHandoffReadiness(state).canShare, false);
    assert.equal(finish(state, 'withdraw').title, negative.withdraw);
  });
}

test('closing the mother station does not revoke existing training, checks or signed authority', () => {
  const state = readyAt30();
  const original = sim.getHandoffReadiness(state);
  state.institutions.find(i => i.kind === 'station').active = false;
  assert.deepEqual(sim.getHandoffReadiness(state), original);
  assert.deepEqual(sim.getHandoffReadiness(reload(state)), original);
  const ending = finish(state, 'withdraw');
  assert.equal(ending.title, positive.withdraw);
  assert.match(ending.text, /D4仍没有运转中的预警载体/);
});

test('capability fixture: independently sourced roles in one region do not supply a cross-region link', () => {
  const state = readyAt30();
  // Isolate the geography condition without inventing an unavailable player action.
  for (const institution of state.institutions.filter(i => i.kind === 'training')) institution.cellId = 'F6';
  const ready = sim.getHandoffReadiness(state);
  assert.equal(ready.authorizedStaff.length, 2);
  assert.equal(ready.checks.length, 1);
  assert.deepEqual(ready.links, []);
  assert.equal(ready.canWithdraw, false);
  assert.match(ready.missing.join('；'), /同一地域/);
});

test('flags and a policy declaration cannot fabricate institutions, source evidence or permission', () => {
  const state = sim.createRun(0);
  for (let window = 0; window < 3; window++) decade(state);
  Object.assign(state.flags, { networks: 99, renewed: true, review: true, independentArchive: true, trust: true });
  const ready = sim.getHandoffReadiness(state);
  assert.deepEqual(ready.staff, []);
  assert.deepEqual(ready.authorizedStaff, []);
  assert.deepEqual(ready.checks, []);
  assert.equal(ready.canShare, false);
  const ending = finish(state, 'share_power');
  assert.equal(ending.title, negative.share_power);
  assert.equal(ending.metrics.networks, 0);
  assert.equal(ending.metrics.independentChecks, 0);
});

test('permission must match the successful renewal event and its recorded source roster', () => {
  const original = readyAt30();
  const mutations = [
    state => { for (const i of state.institutions.filter(i => i.kind === 'training')) i.handoffAuthorization.eventId = 'missing-renewal'; },
    state => { for (const i of state.institutions.filter(i => i.kind === 'training')) i.handoffAuthorization.year = 12; },
    state => { for (const i of state.institutions.filter(i => i.kind === 'training')) i.handoffAuthorization.sourceActionId = 'unrelated-source'; },
    state => { state.events.find(e => e.actionId === 'renew_charter').authorizedTrainingSources = []; },
  ];
  for (const mutate of mutations) {
    const state = structuredClone(original); mutate(state);
    assert.equal(sim.getHandoffReadiness(state).authorizedStaff.length, 0);
    assert.equal(sim.getHandoffReadiness(state).canWithdraw, false);
    assert.equal(sim.validateState(state).valid, false);
    assert.throws(() => reload(state), /不兼容或损坏/);
  }
});

test('an institution needs matching successful source evidence, not just an independent name', () => {
  const original = readyAt30();
  for (const mutate of [
    state => { state.institutions.find(i => i.kind === 'independent').sourceEventId = 'missing-source'; },
    state => { state.institutions.find(i => i.kind === 'independent').sourceActionId = 'wrong-action'; },
    state => { state.events.find(e => e.actionId === 'independent_review').status = 'failed'; },
    state => { state.events.find(e => e.actionId === 'independent_review').actionId = 'local_veto'; },
  ]) {
    const state = structuredClone(original); mutate(state);
    assert.equal(sim.getHandoffReadiness(state).checks.length, 0);
    assert.equal(sim.getHandoffReadiness(state).canWithdraw, false);
  }
});

test('positive future handoff never rewrites irreversible crisis damage', () => {
  const state = sim.createRun(0);
  lock(state, 'protagonist', 'B4', 'preserve_records'); decade(state);
  lock(state, 'protagonist', 'E4', 'fund_school'); decade(state);
  lock(state, 'protagonist', 'D4', 'present_archive'); decade(state);
  assert.equal(state.flags.crisis.status, 'disaster');
  const crisis = structuredClone(state.flags.crisis);
  const impact = structuredClone(state.history.find(e => e.id === 'crisis-impact'));
  assert.equal(sim.getHandoffReadiness(state).canShare, true);
  const ending = finish(state, 'share_power');
  assert.equal(ending.title, positive.share_power);
  assert.deepEqual(state.flags.crisis, crisis);
  assert.deepEqual(state.history.find(e => e.id === 'crisis-impact'), impact);
  assert.match(ending.text, /地方灾难无法撤销/);
});

test('previews, final explanation, save reload and playback speed use the same capability facts', () => {
  const state = readyAt30();
  const before = structuredClone(state);
  for (const policy of Object.keys(positive)) {
    const action = sim.getActions(state, 'D4').find(a => a.id === policy);
    assert.ok(action.modelNote.includes(sim.handoffSummary(state, policy)));
  }
  assert.deepEqual(state, before, 'Readiness and action previews are read-only');
  lock(state, 'protagonist', 'D4', 'share_power'); submit(state);
  const restored = reload(state);
  sim.advanceToNextWindow(state);
  while (restored.phase === 'playback') sim.advanceYear(restored);
  assert.deepEqual(restored, state);
  assert.deepEqual(sim.getEnding(restored), sim.getEnding(state));
  assert.ok(sim.getEnding(state).paragraphs.includes(sim.handoffSummary(state, 'share_power')));
  assert.deepEqual(reload(state), state);
});

function finishPriorRoute(state, api, policy) {
  while (state.phase !== 'ended') {
    if (state.phase === 'playback') { api.advanceToNextWindow(state); continue; }
    if (!state.drafts.protagonist) {
      if (state.year === 10) chooseWith(api, state, 'D4', 'renew_charter');
      else if (state.year === 20) chooseWith(api, state, 'F6', 'independent_review');
      else if (state.year === 30) chooseWith(api, state, 'D4', policy);
      else assert.fail(`Unexpected legacy continuation year: ${state.year}`);
    }
    submit(state, api);
  }
}

for (const policy of Object.keys(positive)) for (const stage of ['planning', 'locked', 'submitted', 'ended']) {
  test(`published pre-handoff ${stage} save preserves ${policy} ending and all cells`, () => {
    const source = builtAt10({}, prior);
    if (stage !== 'planning') chooseWith(prior, source, 'D4', 'renew_charter');
    if (stage === 'submitted') submit(source, prior);
    if (stage === 'ended') finishPriorRoute(source, prior, policy);
    assert.equal(source.handoffRulesVersion, undefined);
    assert.equal(source.planningRulesVersion, 'tradeoffs-v1');
    const loaded = reload(source);
    assert.deepEqual(loaded, source, 'Import must not migrate or change a locked contract');
    finishPriorRoute(source, prior, policy);
    finishPriorRoute(loaded, sim, policy);
    assert.equal(loaded.handoffRulesVersion, undefined);
    assert.equal(sim.usesHandoffRules(loaded), false);
    assert.equal(sim.getEnding(loaded).title, negative[policy], 'Published scoring remains frozen');
    assert.deepEqual(sim.getEnding(loaded), prior.getEnding(source));
    assert.deepEqual(loaded.cells, source.cells);
    assert.deepEqual(loaded.flags.crisis, source.flags.crisis);
    assert.deepEqual(loaded.history.find(e => e.id === 'ending'), source.history.find(e => e.id === 'ending'));
    assert.ok(loaded.institutions.every(i => i.handoffAuthorization === undefined));
    assert.equal(sim.validateState(loaded).valid, true);
  });
}

test('unknown handoff versions are rejected rather than silently becoming legacy or current rules', () => {
  const state = sim.createRun(0);
  assert.equal(state.handoffRulesVersion, 'handoff-v1');
  state.handoffRulesVersion = 'handoff-future';
  assert.equal(sim.validateState(state).valid, false);
  assert.throws(() => reload(state), /交班规则版本非法/);
});
