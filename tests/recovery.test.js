import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as sim from '../src/simulation.js';
// Published 76dfe4d engine, simulation blob 8b6870eeed3e738b1730e3bb827596e3ac6aa883.
// Only the board import path differs. Old saves are created by that real engine.
import * as prior from './fixtures/pre-recovery-simulation.js';
import { restoreSave } from '../src/save.js';

const copy = structuredClone;
const at = (s, id) => s.cells.find(c => c.id === id);
const reload = s => restoreSave(JSON.parse(JSON.stringify({ state: s }))).state;
const reviewEvent = s => s.events.find(e => e.actionId === 'independent_review');
const recoveryEvent = s => s.events.find(e => e.actionId === 'complete_review');
const recoveryChoice = (s, site = 'B4', actor = 'protagonist') => sim.getActions(s, site, actor).find(a => a.id === 'complete_review');
function choose(api, s, actor, cell, id) {
  const action = api.getActions(s, cell, actor).find(a => a.id === id);
  assert.ok(action, `${id} is available at ${s.year}/${cell} for ${actor}`);
  for (const evidence of action.requireEvidence) {
    if (!api.getInvestigation(s, actor, cell).evidence.includes(evidence)) api.investigate(s, actor, cell, evidence);
  }
  api.lockTask(s, actor, cell, id);
}
function submit(api, s, tasks = []) {
  for (const task of tasks) if (!s.drafts[task[0]]) choose(api, s, ...task);
  for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id);
  api.commitWindow(s);
}
function decade(api, s, tasks = []) { submit(api, s, tasks); api.advanceToNextWindow(s); return s; }
function at20({ seed = 6 } = {}, api = sim) {
  const s = api.createRun(seed);
  decade(api, s);
  decade(api, s, [['protagonist', 'D4', 'recruit_volunteer']]);
  return s;
}
function failedAt30({ site = 'B4', staff = false, trust = true, seed = 6 } = {}, api = sim) {
  const s = at20({ seed }, api);
  const tasks = [['protagonist', site, 'independent_review']];
  if (staff) tasks.push(['linche', 'E4', 'train_network']);
  else if (trust) tasks.push(['linche', 'D4', 'free_warning']);
  decade(api, s, tasks);
  assert.equal(reviewEvent(s).status, 'failed', `${site}, seed ${seed} is a real failed review`);
  return s;
}
function pendingRecovery(options = {}, tasks = []) {
  const s = failedAt30(options);
  submit(sim, s, [['protagonist', options.site || 'B4', 'complete_review'], ...tasks]);
  return s;
}
function assertRejected(s) {
  const before = copy(s);
  assert.equal(sim.validateState(s).valid, false);
  assert.throws(() => reload(s), /存档|复核|规则|来源|合同/);
  if (s.phase === 'playback') assert.throws(() => sim.advanceYear(s), /存档|复核|规则|来源|合同/);
  if (s.phase === 'planning') {
    assert.equal(sim.getWindowReview(s).ready, false);
    assert.throws(() => sim.commitWindow(s), /草稿|复核|条件|规则|来源|合同/);
  }
  assert.deepEqual(s, before, 'invalid imports and settlement do not mutate world, costs or history');
}
function historicalFacts(s) {
  return { crisis: copy(s.flags.crisis), snapshots: Object.fromEntries(Object.entries(s.snapshots).filter(([year]) => Number(year) <= 30).map(([year, value]) => [year, copy(value)])),
    review: copy(reviewEvent(s)), failure: copy(s.history.find(h => h.id === `resolved:${reviewEvent(s).id}`)),
    carrier: copy(s.institutions.find(i => i.sourceEventId === reviewEvent(s).id)) };
}
function assertHistoryUnchanged(s, before) { assert.deepEqual(historicalFacts(s), before); }

test('frozen 76dfe4d recovery baseline has the exact published source bytes', () => {
  const fixture = readFileSync(new URL('./fixtures/pre-recovery-simulation.js', import.meta.url), 'utf8');
  const source = fixture.replace("import board from '../../src/data/board.json'", "import board from './data/board.json'");
  const blob = Buffer.from(source);
  assert.equal(createHash('sha1').update(`blob ${blob.length}\0`).update(blob).digest('hex'), '8b6870eeed3e738b1730e3bb827596e3ac6aa883');
  assert.equal(createHash('sha256').update(blob).digest('hex'), '13fba94b8ca7fafd931d01cddf7cbf963c0cd9c2c03635f97b7cfabd7b69ad0b');
});

test('recovery rules are explicit, round-trip and reject an unknown version', () => {
  const s = sim.createRun(6);
  assert.equal(sim.RECOVERY_RULES.version, 'recovery-v1');
  assert.equal(s.recoveryRulesVersion, sim.RECOVERY_RULES.version);
  assert.equal(sim.usesRecoveryRules(s), true);
  assert.deepEqual(reload(s), s);
  s.recoveryRulesVersion = 'recovery-unknown';
  assertRejected(s);
});

for (const site of ['B4', 'F6']) test(`${site}: recovery is an optional paid year30 contract based on an actual failed review`, () => {
  const s = failedAt30({ site });
  const before = copy(s);
  const a = recoveryChoice(s, site);
  assert.ok(a);
  assert.deepEqual(a.cost, { economy: 4, science: 3 });
  assert.equal(a.dueIn, 2);
  assert.equal(a.probability, 1);
  assert.deepEqual(a.requireEvidence, ['anomaly_records']);
  assert.match(`${a.description} ${a.risk} ${a.reward} ${a.modelNote}`, /32/);
  assert.equal(sim.getRecoveryWorkforce(s).length, 0, 'warning crews and failed review records are not trained measurement staff');
  assert.ok(sim.getRecoverySource(s, site));
  assert.equal(recoveryChoice(s, site === 'B4' ? 'F6' : 'B4'), undefined);
  assert.deepEqual(s, before, 'reading the source, workforce and contract changes nothing');
  assert.throws(() => sim.lockTask(s, 'protagonist', site, 'complete_review'), /证据|材料|取证/);
  assert.deepEqual(s, before);
  sim.investigate(s, 'protagonist', site, 'anomaly_records');
  assert.equal(sim.getInvestigation(s, 'protagonist', site).budget, 1);
  sim.lockTask(s, 'protagonist', site, 'complete_review');
  assert.deepEqual(at(s, site).channels, at(before, site).channels, 'locking is not payment');
  submit(sim, s);
  assert.equal(at(s, site).channels.economy, Math.round((at(before, site).channels.economy - 4) * 10000) / 10000);
  assert.equal(at(s, site).channels.science, Math.round((at(before, site).channels.science - 3) * 10000) / 10000);
  assert.equal(recoveryEvent(s).year, 32);
  assert.equal(recoveryEvent(s).status, 'pending');
  assert.equal(s.institutions.length, before.institutions.length);
  assert.deepEqual(reload(s), s);
});

for (const site of ['B4', 'F6']) test(`${site}: simultaneous year30 training enables year32 repair but consumes both policy slots`, () => {
  const s = failedAt30({ site });
  const historical = historicalFacts(s);
  const priorFlags = copy(s.flags);
  submit(sim, s, [['protagonist', site, 'complete_review'], ['linche', 'E4', 'train_network']]);
  assert.equal(sim.getRecoveryWorkforce(s).length, 0);
  assert.equal(sim.getHandoffReadiness(s).checks.length, 0);
  sim.advanceYear(s);
  assert.equal(s.year, 31);
  assert.equal(recoveryEvent(s).status, 'pending');
  assert.equal(sim.getRecoveryWorkforce(s).length, 1);
  assert.equal(sim.getHandoffReadiness(s).checks.length, 0);
  sim.advanceYear(s);
  assert.equal(recoveryEvent(s).status, 'success');
  assert.equal(recoveryEvent(s).resolvedYear, 32);
  assert.equal(sim.getHandoffReadiness(s).checks.length, 1);
  assert.equal(sim.getHandoffReadiness(s).canWithdraw, true);
  assert.equal(sim.getHandoffReadiness(s).canShare, true, 'earlier free warning supplied the cooperation, not recovery');
  assert.notEqual(s.flags.review, true);
  assert.equal(s.flags.policy, undefined);
  assert.equal(s.flags.trust, priorFlags.trust);
  assertHistoryUnchanged(s, historical);
  sim.advanceToNextWindow(s);
  assert.equal(s.year, 40);
  assert.equal(sim.getEnding(s).policy, null);
  assert.notEqual(sim.getEnding(s).title, '没有唯一守夜人');
  assert.notEqual(sim.getEnding(s).title, '许多人签署的历史');
  assert.equal(s.events.filter(e => e.actionId === 'train_network').length, 1);
  assert.equal(s.institutions.filter(i => i.kind === 'school').length, 1, 'recovery does not award another teaching carrier');
  assert.equal(s.institutions.filter(i => i.sourceEventId === recoveryEvent(s).id).length, 1);
  assertHistoryUnchanged(s, historical);
  assert.deepEqual(reload(s), s);
});

for (const site of ['B4', 'F6']) for (const policy of ['withdraw', 'share_power']) test(`${site}: existing staff permits recovery plus ${policy}, with independent trust requirements`, () => {
  const s = failedAt30({ site, staff: true });
  const historical = historicalFacts(s);
  assert.equal(sim.getRecoveryWorkforce(s).length, 1);
  assert.equal(sim.getHandoffReadiness(s).checks.length, 0);
  submit(sim, s, [['protagonist', 'D4', policy], ['linche', site, 'complete_review']]);
  sim.advanceToNextWindow(s);
  assert.equal(recoveryEvent(s).status, 'success');
  assert.equal(s.flags.policy, policy);
  assert.notEqual(s.flags.review, true);
  assert.equal(sim.getHandoffReadiness(s).canWithdraw, true);
  assert.equal(sim.getHandoffReadiness(s).canShare, false, 'a technical repair is not local cooperation');
  assert.equal(sim.getEnding(s).title, policy === 'withdraw' ? '没有唯一守夜人' : '纸上的共同作者');
  assertHistoryUnchanged(s, historical);
  assert.deepEqual(reload(s), s);
});

const oldRoutes = [
  { name: 'B4 failed review, no staff', site: 'B4', seed: 6, staff: false },
  { name: 'F6 failed review, no staff', site: 'F6', seed: 6, staff: false },
  { name: 'B4 failed review, real staff', site: 'B4', seed: 6, staff: true },
  { name: 'F6 failed review, real staff', site: 'F6', seed: 6, staff: true },
  { name: 'B4 successful review', site: 'B4', seed: 1, staff: true },
  { name: 'F6 successful review', site: 'F6', seed: 0, staff: true },
];
function oldTasks(s, route) {
  if (s.year === 20) return [['protagonist', route.site, 'independent_review'], ['linche', route.staff ? 'E4' : 'D4', route.staff ? 'train_network' : 'free_warning']];
  if (s.year === 30) return [['protagonist', 'D4', 'withdraw'], ['linche', 'D5', 'mutual_aid']];
  return [];
}
for (const route of oldRoutes) for (const stage of ['planning', 'locked', 'submitted', 'resolved', 'year30', 'ended']) test(`genuine 76dfe4d ${route.name}, ${stage}: old actions, every year and ending are exactly unchanged`, () => {
  const old = at20(route, prior);
  assert.equal(Object.hasOwn(old, 'recoveryRulesVersion'), false);
  if (stage !== 'planning') for (const task of oldTasks(old, route)) choose(prior, old, ...task);
  if (['submitted', 'resolved', 'year30', 'ended'].includes(stage)) submit(prior, old);
  if (['resolved', 'year30', 'ended'].includes(stage)) { prior.advanceYear(old); prior.advanceYear(old); }
  if (['year30', 'ended'].includes(stage)) prior.advanceToNextWindow(old);
  if (stage === 'ended') decade(prior, old, oldTasks(old, route));
  const before = copy(old);
  const loaded = reload(old);
  assert.deepEqual(old, before);
  assert.deepEqual(loaded, old);
  assert.equal(sim.usesRecoveryRules(loaded), false);
  while (old.year < 40) {
    if (old.phase === 'planning') {
      for (const actor of prior.getActors(old)) for (const cell of old.cells) {
        assert.deepEqual(sim.getActions(loaded, cell.id, actor.id), prior.getActions(old, cell.id, actor.id), `year${old.year}/${cell.id}/${actor.id}: action contract preserved`);
      }
      assert.equal(recoveryChoice(loaded, route.site), undefined);
      submit(prior, old, oldTasks(old, route)); submit(sim, loaded, oldTasks(loaded, route));
      assert.deepEqual(loaded, old, `year${old.year}: submission preserves old contract`);
    }
    prior.advanceYear(old); sim.advanceYear(loaded);
    assert.deepEqual(loaded, old, `year${old.year}: complete old world, history, sources and snapshots`);
    assert.deepEqual(sim.getEnding(loaded), prior.getEnding(old), `year${old.year}: old ending output`);
  }
  assert.equal(sim.validateState(loaded).valid, true);
  assert.deepEqual(loaded, old);
  assert.deepEqual(sim.getEnding(loaded), prior.getEnding(old));
  assert.deepEqual(reload(loaded), loaded);
});

for (const site of ['B4', 'F6']) test(`${site}: no year32 workforce cancels without a refund, free check, new staff or historical change`, () => {
  const s = failedAt30({ site });
  const historical = historicalFacts(s);
  const institutions = copy(s.institutions);
  const flags = copy(s.flags);
  const control = copy(s);
  submit(sim, s, [['protagonist', site, 'complete_review']]);
  // A paid-but-unproductive control isolates a possible refund from annual drift.
  at(control, site).channels.economy -= 4;
  at(control, site).channels.science -= 3;
  submit(sim, control);
  sim.advanceYear(s); sim.advanceYear(control);
  assert.equal(recoveryEvent(s).status, 'pending');
  sim.advanceYear(s); sim.advanceYear(control);
  assert.equal(recoveryEvent(s).status, 'cancelled');
  assert.equal(recoveryEvent(s).resolvedYear, 32);
  assert.deepEqual(s.cells, control.cells, 'no paid resources return on cancellation');
  assert.deepEqual(s.institutions, institutions);
  assert.deepEqual(s.flags, flags);
  assert.equal(sim.getHandoffReadiness(s).checks.length, 0);
  assertHistoryUnchanged(s, historical);
  assert.deepEqual(reload(s), s);
  sim.advanceToNextWindow(s);
  assert.equal(recoveryEvent(s).status, 'cancelled');
  assertHistoryUnchanged(s, historical);
});

for (const reason of ['inactive', 'zero maintenance']) test(`year31 training ${reason} at year32 is not usable workforce`, () => {
  const s = pendingRecovery({}, [['linche', 'E4', 'train_network']]);
  sim.advanceYear(s);
  const school = s.institutions.find(i => i.kind === 'school');
  if (reason === 'inactive') school.active = false;
  else school.maintenance = 0;
  assert.equal(sim.getRecoveryWorkforce(s).length, 0);
  sim.advanceYear(s);
  assert.equal(recoveryEvent(s).status, 'cancelled');
  assert.equal(sim.getHandoffReadiness(s).checks.length, 0);
});

test('two actors cannot use a shared failed record as an undefined same-cell joint action', () => {
  const s = failedAt30();
  choose(sim, s, 'protagonist', 'B4', 'complete_review');
  choose(sim, s, 'linche', 'B4', 'complete_review');
  const before = copy(s);
  assert.equal(sim.getWindowReview(s).ready, false);
  assert.match(sim.getWindowReview(s).issues.join('；'), /同格.*冲突/);
  assert.throws(() => sim.commitWindow(s), /同格.*冲突/);
  assert.deepEqual(s, before);
  assert.equal(recoveryEvent(s), undefined);
});

for (const [channel, amount] of [['economy', 3.9999], ['science', 2.9999]]) test(`insufficient ${channel} rejects the whole repair window before any write`, () => {
  const s = failedAt30();
  at(s, 'B4').channels[channel] = amount;
  choose(sim, s, 'protagonist', 'B4', 'complete_review');
  choose(sim, s, 'linche', 'E4', 'train_network');
  const before = copy(s);
  assert.equal(sim.getWindowReview(s).ready, false);
  assert.throws(() => sim.commitWindow(s), /不足/);
  assert.deepEqual(s, before);
});

test('recovery requires two investigation rounds and cannot borrow another actor’s evidence', () => {
  const s = failedAt30();
  sim.investigate(s, 'protagonist', 'B4', 'resident_testimony');
  sim.investigate(s, 'protagonist', 'B4', 'old_reality_record');
  assert.equal(sim.getInvestigation(s, 'protagonist', 'B4').budget, 1);
  const before = copy(s);
  assert.throws(() => sim.investigate(s, 'protagonist', 'B4', 'anomaly_records'), /轮次不足/);
  assert.deepEqual(s, before);
  sim.investigate(s, 'linche', 'B4', 'anomaly_records');
  assert.throws(() => sim.lockTask(s, 'protagonist', 'B4', 'complete_review', ['anomaly_records']), /证据/);
  assert.equal(s.drafts.protagonist, undefined);
});

const invalidSources = [
  ['no carrier', (s, e, i) => { s.institutions = s.institutions.filter(x => x !== i); }],
  ['inactive carrier', (s, e, i) => { i.active = false; }],
  ['zero maintenance', (s, e, i) => { i.maintenance = 0; }],
  ['wrong carrier kind', (s, e, i) => { i.kind = 'archive'; }],
  ['forged carrier ID', (s, e, i) => { i.id = 'institution:forged'; }],
  ['wrong carrier cell', (s, e, i) => { i.cellId = 'F6'; }],
  ['wrong carrier birth year', (s, e, i) => { i.startYear = 21; }],
  ['wrong carrier source action', (s, e, i) => { i.sourceActionId = 'action:20:linche:B4:independent_review'; }],
  ['missing source event', (s, e) => { s.events = s.events.filter(x => x !== e); }],
  ['forged event identity', (s, e) => { e.id = 'event:forged'; }],
  ['forged event actor', (s, e) => { e.sourceActionId = 'action:20:unknown:B4:independent_review'; }],
  ['wrong event parent', (s, e) => { e.parentId = null; }],
  ['wrong event year', (s, e) => { e.year = 21; e.resolvedYear = 21; }],
  ['missing resolution year', (s, e) => { delete e.resolvedYear; }],
  ['successful event', (s, e) => { e.status = 'success'; }],
  ['pending event', (s, e) => { e.status = 'pending'; }],
  ['cancelled event', (s, e) => { e.status = 'cancelled'; }],
  ['missing submitted action', (s, e) => { s.history = s.history.filter(h => h.id !== e.sourceActionId); }],
  ['missing failed outcome', (s, e) => { s.history = s.history.filter(h => h.id !== `resolved:${e.id}`); }],
  ['outcome marked successful', (s, e) => { s.history.find(h => h.id === `resolved:${e.id}`).status = 'success'; }],
];
for (const [reason, mutate] of invalidSources) test(`${reason}: no repair action is offered from an unverified source`, () => {
  const s = failedAt30();
  const e = reviewEvent(s);
  const i = s.institutions.find(i => i.sourceEventId === e.id);
  mutate(s, e, i);
  const before = copy(s);
  assert.ok(!sim.getRecoverySource(s, 'B4'));
  assert.equal(recoveryChoice(s), undefined);
  assert.throws(() => sim.lockTask(s, 'protagonist', 'B4', 'complete_review'), /不可用|来源|复核/);
  assert.deepEqual(s, before);
});

test('no failed review and year20 planning do not gain a repair contract', () => {
  const s = at20();
  assert.equal(recoveryChoice(s), undefined);
  decade(sim, s);
  assert.equal(sim.getRecoverySource(s, 'B4'), null);
  assert.equal(recoveryChoice(s), undefined);
  assert.equal(recoveryChoice(s, 'F6'), undefined);
});

for (const [reason, mutate] of [
  ['inactive', (s, i) => { i.active = false; }],
  ['zero maintenance', (s, i) => { i.maintenance = 0; }],
  ['warning instead of teacher', (s, i) => { i.kind = 'warning'; }],
  ['fake identity', (s, i) => { i.id = 'institution:forged'; }],
  ['missing source event', (s, i) => { s.events = s.events.filter(e => e.id !== i.sourceEventId); }],
  ['missing action source', (s, i) => { s.history = s.history.filter(h => h.id !== i.sourceActionId); }],
  ['missing outcome source', (s, i) => { s.history = s.history.filter(h => h.id !== `resolved:${i.sourceEventId}`); }],
  ['wrong event success status', (s, i) => { s.events.find(e => e.id === i.sourceEventId).status = 'failed'; }],
]) test(`${reason}: recovery workforce needs a genuine live measurement or teaching carrier`, () => {
  const s = failedAt30({ staff: true });
  const school = s.institutions.find(i => i.kind === 'school');
  mutate(s, school);
  const before = copy(s);
  assert.equal(sim.getRecoveryWorkforce(s).length, 0);
  assert.deepEqual(s, before);
});

for (const reason of ['inactive', 'zero maintenance']) test(`failed-record carrier ${reason} after submission cancels year32 rather than rewriting the contract`, () => {
  const s = pendingRecovery({ staff: true });
  const carrier = s.institutions.find(i => i.sourceEventId === reviewEvent(s).id);
  const contract = copy(recoveryEvent(s));
  if (reason === 'inactive') carrier.active = false;
  else carrier.maintenance = 0;
  assert.equal(sim.validateState(s).valid, true, 'a real shutdown is not malformed historical identity');
  sim.advanceYear(s); sim.advanceYear(s);
  assert.equal(recoveryEvent(s).status, 'cancelled');
  assert.equal(recoveryEvent(s).recoverySourceId, contract.recoverySourceId);
  assert.equal(recoveryEvent(s).recoveryInstitutionId, contract.recoveryInstitutionId);
  assert.equal(sim.getHandoffReadiness(s).checks.length, 0);
  assert.deepEqual(reload(s), s);
});

test('the submitted action and scheduled event freeze the same verified source IDs', () => {
  const s = failedAt30({ staff: true });
  const failed = sim.getRecoverySource(s, 'B4');
  submit(sim, s, [['protagonist', 'B4', 'complete_review']]);
  const e = recoveryEvent(s);
  const action = s.history.find(h => h.id === e.sourceActionId);
  assert.equal(e.recoverySourceId, failed.eventId);
  assert.equal(action.recoverySourceId, failed.eventId);
  assert.equal(e.recoveryInstitutionId, failed.institutionId);
  assert.equal(action.recoveryInstitutionId, failed.institutionId);
  assert.equal(e.recoveryWorkforceIds, undefined, 'workforce is tested at32, not granted at30');
  sim.advanceYear(s); sim.advanceYear(s);
  assert.deepEqual(e.recoveryWorkforceIds, sim.getRecoveryWorkforce(s).map(i => i.id));
  assert.deepEqual(reload(s), s);
});

const invalidContracts = [
  ['missing rule version', (s) => { delete s.recoveryRulesVersion; }],
  ['event has no source', (s, e) => { delete e.recoverySourceId; }],
  ['event has another institution', (s, e) => { e.recoveryInstitutionId = 'institution:forged'; }],
  ['action has no source', (s, e, h) => { delete h.recoverySourceId; }],
  ['action has another institution', (s, e, h) => { h.recoveryInstitutionId = 'institution:forged'; }],
  ['coordinated fake source IDs', (s, e, h) => { e.recoverySourceId = h.recoverySourceId = 'event:forged'; }],
  ['coordinated fake institution IDs', (s, e, h) => { e.recoveryInstitutionId = h.recoveryInstitutionId = 'institution:forged'; }],
  ['wrong event due year', (s, e) => { e.year = 31; }],
  ['wrong event probability', (s, e) => { e.probability = 0.5; }],
  ['wrong event parent', (s, e) => { e.parentId = null; }],
  ['wrong event identity', (s, e) => { e.id = 'event:forged'; }],
  ['event pretends to be independent_review', (s, e) => { e.actionId = 'independent_review'; }],
  ['event pretends to be build_joint', (s, e) => { e.actionId = 'build_joint'; }],
  ['missing action', (s, e) => { s.history = s.history.filter(h => h.id !== e.sourceActionId); }],
  ['missing event evidence', (s, e) => { e.evidence = []; }],
  ['missing action evidence', (s, e, h) => { h.evidence = []; }],
  ['pending invented workforce', (s, e) => { e.recoveryWorkforceIds = ['institution:forged']; }],
  ['original failed outcome erased', (s) => { s.history = s.history.filter(h => h.id !== `resolved:${reviewEvent(s).id}`); }],
  ['original failure changed to success', (s) => { reviewEvent(s).status = 'success'; }],
];
for (const [reason, mutate] of invalidContracts) test(`${reason}: malformed recovery is rejected before year31 or any settlement`, () => {
  const s = pendingRecovery({ staff: true });
  const e = recoveryEvent(s);
  const h = s.history.find(h => h.id === e.sourceActionId);
  mutate(s, e, h);
  assertRejected(s);
});

test('a warning crew renamed school cannot manufacture successful recovery workforce', () => {
  const s = pendingRecovery();
  const warning = s.institutions.find(i => i.kind === 'warning');
  assert.ok(warning);
  warning.kind = 'school';
  assert.deepEqual(sim.getRecoveryWorkforce(s), []);
  sim.advanceYear(s); sim.advanceYear(s);
  assert.equal(recoveryEvent(s).status, 'cancelled');
  assert.equal(sim.hasCompletedRecovery(s), false);
});

for (const [reason, mutate] of [
  ['empty workforce', (s, e) => { e.recoveryWorkforceIds = []; }],
  ['nonexistent workforce', (s, e) => { e.recoveryWorkforceIds = ['institution:forged']; }],
  ['duplicate workforce', (s, e) => { e.recoveryWorkforceIds.push(e.recoveryWorkforceIds[0]); }],
  ['failed records as workforce', (s, e) => { e.recoveryWorkforceIds = [e.recoveryInstitutionId]; }],
  ['missing repaired carrier', (s, e) => { s.institutions = s.institutions.filter(i => i.sourceEventId !== e.id); }],
  ['forged repaired carrier ID', (s, e) => { s.institutions.find(i => i.sourceEventId === e.id).id = 'institution:forged'; }],
  ['missing success outcome', (s, e) => { s.history = s.history.filter(h => h.id !== `resolved:${e.id}`); }],
  ['wrong resolved year', (s, e) => { e.resolvedYear = 31; }],
]) test(`${reason}: a resolved repair cannot be imported as a real independent check`, () => {
  const s = pendingRecovery({ staff: true });
  sim.advanceYear(s); sim.advanceYear(s);
  const e = recoveryEvent(s);
  assert.equal(e.status, 'success');
  mutate(s, e);
  assertRejected(s);
  assert.equal(sim.hasCompletedRecovery(s), false);
  assert.equal(sim.getHandoffReadiness(s).checks.length, 0);
});

for (const kind of ['station', 'training', 'branch']) test(`authentic ${kind} can do technical recovery but does not gain local handoff authorization`, () => {
  const s = sim.createRun(6);
  decade(sim, s, [['protagonist', 'D4', 'build_state']]);
  decade(sim, s, [['protagonist', 'D4', 'recruit_successor']]);
  decade(sim, s, [['protagonist', 'F6', 'independent_review'], ['linche', 'D4', 'free_warning']]);
  assert.equal(reviewEvent(s).status, 'failed');
  for (const i of s.institutions) if (['station', 'training', 'branch'].includes(i.kind) && i.kind !== kind) i.active = false;
  assert.ok(sim.getRecoveryWorkforce(s).some(i => i.kind === kind));
  if (kind === 'training') assert.deepEqual(sim.getRecoveryWorkforce(s).map(i => i.cellId).sort(), ['D5', 'E4'], 'D5 training legitimately shares the E4 training event');
  const authorizations = s.institutions.map(i => i.handoffAuthorization);
  decade(sim, s, [['protagonist', 'D4', 'withdraw'], ['linche', 'F6', 'complete_review']]);
  assert.equal(recoveryEvent(s).status, 'success');
  assert.equal(sim.getHandoffReadiness(s).checks.length, 1);
  assert.equal(sim.getHandoffReadiness(s).authorizedStaff.length, 0);
  assert.equal(sim.getHandoffReadiness(s).canWithdraw, false);
  assert.equal(sim.getEnding(s).title, '交班后的空椅子');
  assert.deepEqual(s.institutions.slice(0, authorizations.length).map(i => i.handoffAuthorization), authorizations);
  assert.deepEqual(reload(s), s);
});

test('year31 reload and reversed board iteration cannot reroll or reorder repair conditions', () => {
  const a = pendingRecovery({}, [['linche', 'E4', 'train_network']]);
  sim.advanceYear(a);
  const b = reload(a);
  sim.advanceYear(a); sim.advanceYear(b, { reverse: true });
  assert.deepEqual(a, b);
  const successful = copy(recoveryEvent(a));
  while (a.year < 40) { sim.advanceYear(a); sim.advanceYear(b, { reverse: true }); }
  assert.deepEqual(a, b);
  assert.deepEqual(recoveryEvent(a), successful);
});

test('a completed repair remains a historical fact after later technical staff stop, but cannot grant a handoff alone', () => {
  const s = pendingRecovery({ staff: true });
  sim.advanceYear(s); sim.advanceYear(s); sim.advanceYear(s);
  assert.equal(s.year, 33);
  const event = copy(recoveryEvent(s));
  for (const i of s.institutions) if (i.kind === 'school') i.active = false;
  assert.equal(sim.validateState(s).valid, true, 'later stop does not erase staff who actually performed the year32 work');
  assert.equal(sim.hasCompletedRecovery(s), true);
  assert.equal(sim.getHandoffReadiness(s).canWithdraw, false);
  sim.advanceToNextWindow(s);
  assert.deepEqual(recoveryEvent(s), event);
  assert.equal(sim.getHandoffReadiness(s).checks.length, 1);
  assert.equal(sim.getHandoffReadiness(s).staff.length, 0);
  assert.deepEqual(reload(s), s);
});

test('a future check that later stops is not counted as an active handoff method', () => {
  const s = pendingRecovery({ staff: true });
  sim.advanceYear(s); sim.advanceYear(s); sim.advanceYear(s);
  const check = s.institutions.find(i => i.sourceEventId === recoveryEvent(s).id);
  check.active = false;
  assert.equal(sim.validateState(s).valid, true);
  assert.equal(sim.hasCompletedRecovery(s), false);
  assert.equal(sim.getHandoffReadiness(s).checks.length, 0);
  assert.equal(sim.getHandoffReadiness(s).canWithdraw, false);
  assert.deepEqual(reload(s), s);
});

test('the submitted repair describes year32 conditions rather than an unconditional success', () => {
  const s = pendingRecovery({ staff: true });
  const action = s.history.find(h => h.id === recoveryEvent(s).sourceActionId);
  assert.match(action.text, /第32年/);
  assert.match(action.text, /条件|人手/);
  assert.match(action.text, /取消|未完成/);
  assert.match(action.text, /不退/);
  assert.doesNotMatch(action.text, /确定在第32年兑现/);
});

test('coordinated false year21 timing cannot make a tradeoffs year22 failure eligible for repair', () => {
  const s = failedAt30();
  const e = reviewEvent(s);
  const i = s.institutions.find(i => i.sourceEventId === e.id);
  const h = s.history.find(h => h.id === `resolved:${e.id}`);
  assert.equal(e.planningRulesVersion, sim.PLANNING_RULES.version);
  e.year = e.resolvedYear = i.startYear = h.year = 21;
  assert.equal(sim.getRecoverySource(s, 'B4'), null);
  assert.equal(recoveryChoice(s), undefined);
});

test('a failed review without its event evidence is not a completed investigation source', () => {
  const s = failedAt30();
  reviewEvent(s).evidence = [];
  assert.equal(sim.getRecoverySource(s, 'B4'), null);
  assert.equal(recoveryChoice(s), undefined);
});

for (const stopOriginal of [false, true]) test(`a cloned recovery carrier cannot ${stopOriginal ? 'revive a stopped check' : 'invent an additional check region'}`, () => {
  const s = pendingRecovery({ staff: true });
  sim.advanceYear(s); sim.advanceYear(s); sim.advanceYear(s);
  const e = recoveryEvent(s);
  const genuine = s.institutions.find(i => i.sourceEventId === e.id);
  const fake = { ...copy(genuine), id: 'institution:forged-copy', cellId: 'F6' };
  s.institutions.push(fake);
  if (stopOriginal) genuine.active = false;
  assertRejected(s);
  assert.equal(sim.getHandoffReadiness(s).checks.some(i => i.id === fake.id), false);
  if (stopOriginal) assert.equal(sim.hasCompletedRecovery(s), false);
});

test('later retirement of the original failed-record carrier does not erase a real completed repair', () => {
  const s = pendingRecovery({ staff: true });
  sim.advanceYear(s); sim.advanceYear(s); sim.advanceYear(s);
  const oldCarrier = s.institutions.find(i => i.sourceEventId === reviewEvent(s).id);
  oldCarrier.active = false;
  oldCarrier.maintenance = 0;
  assert.equal(sim.getRecoverySource(s, 'B4'), null);
  assert.equal(sim.validateState(s).valid, true);
  assert.equal(sim.hasCompletedRecovery(s), true);
  assert.equal(sim.getHandoffReadiness(s).checks.length, 1);
  assert.deepEqual(reload(s), s);
});

test('a real D4 relocation to the E4 school supplies recovery technicians without consent or handoff authority', () => {
  const s = at20({ seed: 2 });
  decade(sim, s, [['protagonist', 'D4', 'relocate_teacher'], ['linche', 'F6', 'independent_review']]);
  assert.equal(reviewEvent(s).status, 'failed');
  const relocation = s.events.find(e => e.actionId === 'relocate_teacher');
  const school = s.institutions.find(i => i.sourceEventId === relocation.id);
  assert.equal(relocation.status, 'success');
  assert.equal(relocation.cellId, 'D4');
  assert.equal(relocation.resolvedYear, 21);
  assert.equal(school.cellId, 'E4');
  assert.equal(school.kind, 'school');
  assert.deepEqual(sim.getRecoveryWorkforce(s).map(i => i.id), [school.id], 'the real cross-region relocation is measurement capacity');
  assert.equal(s.flags.forced, true);
  assert.equal(s.flags.trust, false);
  assert.equal(sim.getHandoffReadiness(s).authorizedStaff.length, 0);
  const historical = historicalFacts(s);
  const originalRelocation = copy(relocation);
  submit(sim, s, [['protagonist', 'D4', 'central_review'], ['linche', 'F6', 'complete_review']]);
  sim.advanceYear(s);
  assert.equal(recoveryEvent(s).status, 'pending');
  assert.equal(s.flags.policy, 'central_review');
  sim.advanceYear(s);
  assert.equal(recoveryEvent(s).status, 'success');
  assert.equal(recoveryEvent(s).resolvedYear, 32);
  assert.deepEqual(recoveryEvent(s).recoveryWorkforceIds, [school.id]);
  assert.equal(sim.hasCompletedRecovery(s), true);
  assert.equal(sim.getHandoffReadiness(s).authorizedStaff.length, 0);
  assert.equal(sim.getHandoffReadiness(s).canWithdraw, false);
  assert.equal(sim.getHandoffReadiness(s).canShare, false);
  assertHistoryUnchanged(s, historical);
  assert.deepEqual(reload(s), s);
  sim.advanceToNextWindow(s);
  const ending = sim.getEnding(s);
  assert.equal(ending.title, '仍亮着灯的续史局');
  assert.match(ending.text, /未来指令/);
  assert.match(ending.text, /没有赶上第23年|不能.*损失/);
  assert.equal(s.flags.forced, true);
  assert.equal(s.flags.trust, false);
  assert.notEqual(s.flags.review, true);
  assert.equal(school.handoffAuthorization, undefined);
  assert.equal(sim.getHandoffReadiness(s).authorizedStaff.length, 0);
  assert.deepEqual(relocation, originalRelocation);
  assertHistoryUnchanged(s, historical);
  assert.deepEqual(reload(s), s);
});

for (const actionId of ['fund_school', 'train_network']) for (const falsification of ['D4 event to E4 school', 'E4 event to D4 school']) test(`${actionId}: forged ${falsification} cannot borrow the relocation exception`, () => {
  const s = sim.createRun(6);
  decade(sim, s);
  if (actionId === 'train_network') decade(sim, s);
  decade(sim, s, [['protagonist', 'E4', actionId]]);
  const event = s.events.find(e => e.actionId === actionId);
  const school = s.institutions.find(i => i.sourceEventId === event.id);
  assert.deepEqual(sim.getRecoveryWorkforce(s).map(i => i.id), [school.id], 'the original E4 school is a real carrier');
  if (falsification === 'D4 event to E4 school') {
    const oldEventId = event.id;
    const oldSource = event.sourceActionId;
    const source = oldSource.replace(':E4:', ':D4:');
    const origin = s.history.find(h => h.id === oldSource);
    const outcome = s.history.find(h => h.id === `resolved:${oldEventId}`);
    Object.assign(event, { id: `event:${source}`, sourceActionId: source, parentId: source, cellId: 'D4' });
    Object.assign(origin, { id: source, sourceActionId: source, cellId: 'D4' });
    Object.assign(outcome, { id: `resolved:${event.id}`, sourceActionId: source, parentId: event.id, cellId: 'D4' });
    Object.assign(school, { id: `institution:${event.id}:E4`, sourceEventId: event.id, sourceActionId: source });
  } else {
    school.cellId = 'D4';
    school.id = `institution:${event.id}:D4`;
  }
  const before = copy(s);
  assert.deepEqual(sim.getRecoveryWorkforce(s), []);
  assert.deepEqual(s, before);
});
