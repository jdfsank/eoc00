import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as sim from '../src/simulation.js';
// Published round8, blob 34ec88cb44e1df40b46f97a501c16fc32248d60c.
// The fixture changes only the relative board import. Old saves come from the
// genuine engine, never by stripping a version field from a current run.
import * as prior from './fixtures/pre-port-access-simulation.js';
import { restoreSave } from '../src/save.js';
import { getHandoffOutlook } from '../src/handoff-outlook.js';

const copy = structuredClone;
const at = (s, id) => s.cells.find(c => c.id === id);
const branch = s => s.institutions.find(i => i.kind === 'branch' && i.cellId === 'F6');
const portEvent = s => s.events.find(e => e.actionId === 'open_port_warning');
const portChoice = (s, cell = 'F6', actor = 'protagonist') => sim.getActions(s, cell, actor).find(a => a.id === 'open_port_warning');
const reload = s => restoreSave(JSON.parse(JSON.stringify({ state: s }))).state;
const rounded = n => Math.round(n * 10000) / 10000;

function choose(api, s, actor, cell, id) {
  const action = api.getActions(s, cell, actor).find(a => a.id === id);
  assert.ok(action, `${id} is offered at ${s.year}/${cell}/${actor}`);
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
function at30({ seed = 1, build = 'build_merchant', recruit = 'recruit_successor', warning = true, review = true } = {}, api = sim) {
  const s = api.createRun(seed);
  decade(api, s, build ? [['protagonist', 'D4', build]] : []);
  decade(api, s, [['protagonist', 'D4', build ? recruit : 'recruit_volunteer']]);
  const tasks = warning ? [['protagonist', 'D4', 'free_warning']] : [];
  if (review && api.getActors(s).some(a => a.id === 'linche')) tasks.push(['linche', 'F6', 'independent_review']);
  decade(api, s, tasks);
  assert.equal(s.year, 30);
  return s;
}
function pending(options = {}, actor = 'protagonist') {
  const s = at30(options);
  submit(sim, s, [[actor, 'F6', 'open_port_warning']]);
  return s;
}
function historicalFacts(s) {
  return { crisis: copy(s.flags.crisis), snapshots: copy(Object.fromEntries(Object.entries(s.snapshots).filter(([year]) => Number(year) <= 30))),
    events: copy(s.events.filter(e => e.year <= 30)), history: copy(s.history.filter(h => h.year < 30)),
    reviews: copy(s.institutions.filter(i => i.kind === 'independent')) };
}
function assertUncommittable(s) {
  const before = copy(s);
  assert.equal(sim.getWindowReview(s).ready, false);
  assert.throws(() => sim.commitWindow(s));
  assert.deepEqual(s, before, 'rejection never charges a cost or changes the world');
}
function assertInvalid(s) {
  const before = copy(s);
  assert.equal(sim.validateState(s).valid, false);
  assert.throws(() => reload(s));
  if (s.phase === 'planning') assertUncommittable(s);
  if (s.phase === 'playback') assert.throws(() => sim.advanceYear(s));
  assert.deepEqual(s, before, 'invalid import/settlement is rejected atomically');
}

test('published round8 compatibility fixture has the exact original Git blob', () => {
  const fixture = readFileSync(new URL('./fixtures/pre-port-access-simulation.js', import.meta.url), 'utf8');
  const bytes = Buffer.from(fixture.replace("import board from '../../src/data/board.json'", "import board from './data/board.json'"));
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), '34ec88cb44e1df40b46f97a501c16fc32248d60c');
});

test('port access is an explicit new-run rule, round-trips and rejects unknown versions', () => {
  const s = sim.createRun(1);
  assert.equal(sim.PORT_ACCESS_RULES.version, 'port-access-v1');
  assert.equal(s.portAccessRulesVersion, sim.PORT_ACCESS_RULES.version);
  assert.equal(sim.usesPortAccessRules(s), true);
  assert.deepEqual(reload(s), s);
  s.portAccessRulesVersion = 'port-access-unknown';
  assertInvalid(s);
});

test('year30 F6 contract costs economy4/politics2 and one local investigation, with conditional year31 delivery', () => {
  const s = at30();
  const before = copy(s), a = portChoice(s);
  assert.ok(a);
  assert.deepEqual(a.cost, { economy: 4, politics: 2 });
  assert.deepEqual(a.requireEvidence, ['resident_testimony']);
  assert.equal(a.dueIn, 1);
  assert.equal(a.probability, 1);
  assert.equal(a.conditional, true);
  assert.match(`${a.description} ${a.risk} ${a.reward} ${a.modelNote}`, /31/);
  assert.match(`${a.risk} ${a.modelNote}`, /取消|未完成/);
  assert.match(`${a.risk} ${a.modelNote}`, /不退/);
  assert.deepEqual(sim.getPortWarningTargets(s).map(i => i.id), [branch(s).id]);
  assert.deepEqual(s, before, 'reading targets and contracts is pure');
  assert.throws(() => sim.lockTask(s, 'protagonist', 'F6', a.id, ['resident_testimony']), /证据/);
  assert.deepEqual(s, before, 'caller-supplied evidence cannot bypass investigation');
  sim.investigate(s, 'protagonist', 'F6', 'resident_testimony');
  assert.equal(sim.getInvestigation(s, 'protagonist', 'F6').budget, 2);
  sim.lockTask(s, 'protagonist', 'F6', a.id);
  assert.deepEqual(at(s, 'F6').channels, at(before, 'F6').channels, 'locking is not payment');
  submit(sim, s);
  assert.equal(at(s, 'F6').channels.economy, rounded(at(before, 'F6').channels.economy - 4));
  assert.equal(at(s, 'F6').channels.politics, rounded(at(before, 'F6').channels.politics - 2));
  assert.equal(at(s, 'F6').channels.science, at(before, 'F6').channels.science);
  assert.equal(at(s, 'F6').channels.religion, at(before, 'F6').channels.religion);
  assert.equal(branch(s).open, false);
  assert.equal(portEvent(s).status, 'pending');
  assert.equal(portEvent(s).year, 31);
  assert.deepEqual(s.institutions, before.institutions);
  assert.deepEqual(reload(s), s);
  const submitted = copy(s);
  assert.throws(() => sim.commitWindow(s));
  assert.deepEqual(s, submitted, 'submission cannot pay twice');
});

for (const actor of ['protagonist', 'linche']) for (const seed of [1, 2]) test(`seed${seed}/${actor}: opening changes only the original branch access and preserves past review/crisis`, () => {
  const s = at30({ seed }), before = copy(s), past = historicalFacts(s);
  const readiness = copy(sim.getHandoffReadiness(s));
  const control = copy(s);
  at(control, 'F6').channels.economy = rounded(at(control, 'F6').channels.economy - 4);
  at(control, 'F6').channels.politics = rounded(at(control, 'F6').channels.politics - 2);
  submit(sim, control);
  submit(sim, s, [[actor, 'F6', 'open_port_warning']]);
  const e = portEvent(s), source = s.history.find(h => h.id === e.sourceActionId);
  assert.deepEqual(e.portBranchIds, [branch(before).id]);
  assert.deepEqual(source.portBranchIds, e.portBranchIds);
  assert.deepEqual(source.evidence, e.evidence);
  assert.match(source.text, /第31年/);
  assert.match(source.text, /条件|仍|核对/);
  assert.match(source.text, /取消|未完成/);
  assert.match(source.text, /不退/);
  assert.doesNotMatch(source.text, /确定在第31年兑现/);
  sim.advanceYear(s); sim.advanceYear(control);
  assert.equal(e.status, 'success');
  assert.equal(e.resolvedYear, 31);
  assert.deepEqual(s.history.find(h => h.id === `resolved:${e.id}`).portBranchIds, e.portBranchIds);
  assert.deepEqual(s.institutions, before.institutions.map(i => i.id === branch(before).id ? { ...i, open: true } : i));
  assert.deepEqual(s.cells, control.cells, 'opening never adds production or refunds costs');
  assert.deepEqual(s.flags, before.flags, 'opening is not trust, review, authorization or a signed policy');
  assert.deepEqual(s.actors, before.actors);
  assert.deepEqual(sim.getHandoffReadiness(s), readiness);
  assert.equal(sim.getWarningCoverage(s).F6.coverage, branch(s).maintenance);
  assert.equal(sim.getWarningCoverage(control).F6.coverage, rounded(.45 * branch(control).maintenance));
  assert.deepEqual(historicalFacts(s), past);
  assert.deepEqual(reload(s), s);
  sim.advanceToNextWindow(s);
  assert.equal(sim.getEnding(s).policy, null);
  assert.equal(sim.getEnding(s).title, '未签署的下一页');
  assert.deepEqual(historicalFacts(s), past);
});

test('partial maintenance is retained rather than silently repaired by public access', () => {
  const s = at30();
  branch(s).maintenance = .4;
  const target = copy(branch(s));
  submit(sim, s, [['protagonist', 'F6', 'open_port_warning']]);
  sim.advanceYear(s);
  assert.deepEqual(branch(s), { ...target, open: true });
  assert.equal(sim.getWarningCoverage(s).F6.coverage, .4);
});

for (const reason of ['inactive', 'zero maintenance', 'already open']) test(`${reason} after submission cancels at31 without refund, revival or substitution`, () => {
  const s = pending();
  const target = branch(s), ids = copy(portEvent(s).portBranchIds);
  if (reason === 'inactive') target.active = false;
  if (reason === 'zero maintenance') target.maintenance = 0;
  if (reason === 'already open') target.open = true;
  const before = copy(s), past = historicalFacts(s), paid = copy(s);
  // A control without the contract uses the same already-paid channels. Its
  // natural annual drift establishes that cancellation performs no refund.
  const e = portEvent(paid);
  paid.events = paid.events.filter(x => x !== e);
  paid.history = paid.history.filter(h => h.id !== e.sourceActionId);
  assert.equal(sim.validateState(s).valid, true);
  sim.advanceYear(s); sim.advanceYear(paid);
  assert.equal(portEvent(s).status, 'cancelled');
  assert.equal(portEvent(s).resolvedYear, 31);
  assert.deepEqual(portEvent(s).portBranchIds, ids);
  assert.deepEqual(s.history.find(h => h.id === `resolved:${portEvent(s).id}`).portBranchIds, ids);
  assert.deepEqual(s.institutions, before.institutions);
  assert.deepEqual(s.cells, paid.cells);
  assert.deepEqual(s.flags, before.flags);
  assert.deepEqual(historicalFacts(s), past);
  assert.deepEqual(reload(s), s);
  sim.advanceToNextWindow(s);
  assert.equal(portEvent(s).status, 'cancelled');
});

test('local evidence cannot be borrowed from another actor or from another location', () => {
  const s = at30();
  sim.investigate(s, 'protagonist', 'D4', 'resident_testimony');
  sim.investigate(s, 'linche', 'F6', 'resident_testimony');
  assert.deepEqual(sim.getInvestigation(s, 'protagonist', 'F6').evidence, []);
  const before = copy(s);
  assert.throws(() => sim.lockTask(s, 'protagonist', 'F6', 'open_port_warning', ['resident_testimony']), /证据/);
  assert.deepEqual(s, before);
  sim.investigate(s, 'protagonist', 'F6', 'resident_testimony');
  assert.equal(sim.getInvestigation(s, 'protagonist', 'F6').budget, 1);
  sim.lockTask(s, 'protagonist', 'F6', 'open_port_warning');
  delete s.investigations['30:protagonist'];
  sim.passTask(s, 'linche');
  assertUncommittable(s);
});

test('genuinely investigated portable evidence can accompany the required local testimony', () => {
  const s = at30();
  sim.investigate(s, 'protagonist', 'D4', 'old_reality_record');
  sim.investigate(s, 'protagonist', 'F6', 'resident_testimony');
  assert.equal(sim.getInvestigation(s, 'protagonist', 'F6').budget, 1);
  sim.lockTask(s, 'protagonist', 'F6', 'open_port_warning');
  submit(sim, s);
  const e = portEvent(s), evidence = ['old_reality_record', 'resident_testimony'];
  assert.deepEqual(e.evidence, evidence);
  assert.deepEqual(s.history.find(h => h.id === e.sourceActionId).evidence, evidence);
  assert.deepEqual(reload(s), s);
  sim.advanceYear(s);
  assert.equal(e.status, 'success');
  assert.deepEqual(e.evidence, evidence);
  assert.deepEqual(reload(s), s);
});

for (const [channel, amount] of [['economy', 3.9999], ['politics', 1.9999]]) test(`insufficient ${channel} blocks every task before charging anything`, () => {
  const s = at30();
  choose(sim, s, 'protagonist', 'D4', 'withdraw');
  choose(sim, s, 'linche', 'F6', 'open_port_warning');
  at(s, 'F6').channels[channel] = amount;
  assertUncommittable(s);
  assert.equal(portEvent(s), undefined);
});

test('two actors cannot spend one F6 target as an undefined joint action', () => {
  const s = at30();
  choose(sim, s, 'protagonist', 'F6', 'open_port_warning');
  choose(sim, s, 'linche', 'F6', 'open_port_warning');
  assert.match(sim.getWindowReview(s).issues.join(' '), /同格.*冲突/);
  assertUncommittable(s);
});

test('a changed target invalidates a locked draft before payment', () => {
  const s = at30();
  choose(sim, s, 'protagonist', 'F6', 'open_port_warning');
  sim.passTask(s, 'linche');
  branch(s).active = false;
  assertUncommittable(s);
  assert.equal(portEvent(s), undefined);
});

test('opening spends an actor slot and cannot by itself sign a policy or repair a failed review', () => {
  const s = at30({ seed: 2 });
  const past = historicalFacts(s), ready = copy(sim.getHandoffReadiness(s));
  choose(sim, s, 'protagonist', 'F6', 'open_port_warning');
  sim.passTask(s, 'linche');
  const before = copy(s), outlook = getHandoffOutlook(s);
  assert.equal(outlook.ready, true);
  assert.equal(outlook.policy, null);
  assert.deepEqual(outlook.projected.staffCells, ready.staffCells);
  assert.deepEqual(outlook.projected.authorizedCells, ready.authorizedCells);
  assert.deepEqual(outlook.projected.checkCells, ready.checkCells);
  assert.equal(outlook.projected.trust, ready.trust);
  assert.equal(outlook.projected.policyStatus, 'no-policy');
  assert.equal(outlook.contracts.find(c => c.actionId === 'open_port_warning').conditional, true);
  assert.deepEqual(s, before, 'preview does not open the real branch');
  submit(sim, s); sim.advanceToNextWindow(s);
  assert.equal(sim.getEnding(s).policy, null);
  assert.deepEqual(sim.getHandoffReadiness(s), ready);
  assert.deepEqual(historicalFacts(s), past);
});

test('a separate protagonist policy remains independent from Linche opening the branch', () => {
  const s = at30({ warning: false, review: false });
  const before = copy(sim.getHandoffReadiness(s));
  assert.equal(before.trust, false);
  submit(sim, s, [['protagonist', 'D4', 'share_power'], ['linche', 'F6', 'open_port_warning']]);
  sim.advanceToNextWindow(s);
  assert.equal(portEvent(s).status, 'success');
  assert.equal(s.flags.policy, 'share_power');
  assert.deepEqual(sim.getHandoffReadiness(s), before);
  assert.equal(sim.getEnding(s).title, '纸上的共同作者');
});

const invalidTargets = [
  ['inactive branch', (s, i) => { i.active = false; }],
  ['zero maintenance', (s, i) => { i.maintenance = 0; }],
  ['already public', (s, i) => { i.open = true; }],
  ['missing carrier', (s, i) => { s.institutions = s.institutions.filter(x => x !== i); }],
  ['wrong carrier kind', (s, i) => { i.kind = 'independent'; }],
  ['wrong carrier cell', (s, i) => { i.cellId = 'B4'; }],
  ['forged carrier identity', (s, i) => { i.id = 'institution:invented'; }],
  ['wrong birth year', (s, i) => { i.startYear = 22; }],
  ['wrong carrier source', (s, i) => { i.sourceActionId = 'action:0:protagonist:D4:build_joint'; }],
  ['missing branch event', (s, i) => { s.events = s.events.filter(e => e.id !== i.sourceEventId); }],
  ['failed branch event', (s, i) => { s.events.find(e => e.id === i.sourceEventId).status = 'failed'; }],
  ['wrong branch parent', (s, i) => { s.events.find(e => e.id === i.sourceEventId).parentId = null; }],
  ['missing branch outcome', (s, i) => { s.history = s.history.filter(h => h.id !== `resolved:${i.sourceEventId}`); }],
  ['missing training outcome', (s, i) => { s.history = s.history.filter(h => h.id !== `resolved:event:${i.sourceActionId}:training`); }],
  ['missing build outcome', (s, i) => { s.history = s.history.filter(h => h.id !== `resolved:event:${i.sourceActionId}`); }],
  ['missing original action', (s, i) => { s.history = s.history.filter(h => h.id !== i.sourceActionId); }],
];
for (const [reason, mutate] of invalidTargets) test(`${reason}: no public-access contract is offered from an unusable or unverified target`, () => {
  const s = at30();
  mutate(s, branch(s));
  const before = copy(s);
  assert.deepEqual(sim.getPortWarningTargets(s), []);
  assert.equal(portChoice(s), undefined);
  assert.throws(() => sim.lockTask(s, 'protagonist', 'F6', 'open_port_warning'));
  assert.deepEqual(s, before);
});

test('no branch, other sites and earlier windows never gain a port opening contract', () => {
  const absent = at30({ build: null });
  assert.equal(branch(absent), undefined);
  assert.equal(portChoice(absent), undefined);
  const s = sim.createRun(1);
  for (const year of [0, 10, 20]) {
    assert.equal(s.year, year);
    assert.equal(portChoice(s), undefined);
    decade(sim, s, year === 0 ? [['protagonist', 'D4', 'build_merchant']] : []);
  }
  for (const cell of s.cells.filter(c => c.id !== 'F6')) assert.equal(portChoice(s, cell.id), undefined);
  assert.ok(portChoice(s));
});

test('D4 renewal leaves the merchant branch closed until its own later contract', () => {
  const s = at30({ recruit: 'renew_charter', review: false });
  assert.equal(s.institutions.find(i => i.kind === 'station').open, true);
  assert.equal(branch(s).open, false);
  assert.ok(portChoice(s));
  const before = copy(sim.getHandoffReadiness(s));
  decade(sim, s, [['protagonist', 'F6', 'open_port_warning']]);
  assert.deepEqual(sim.getHandoffReadiness(s), before);
  assert.equal(s.flags.policy, undefined);
});

test('an originally public joint branch has no paid opening action', () => {
  const s = at30({ seed: 0, build: 'build_joint' });
  assert.ok(branch(s));
  assert.equal(branch(s).open, true);
  assert.deepEqual(sim.getPortWarningTargets(s), []);
  assert.equal(portChoice(s), undefined);
});

test('a forged branch clone cannot substitute for a stopped frozen target', () => {
  const s = pending(), original = branch(s);
  original.active = false;
  const fake = { ...copy(original), id: 'institution:copied-branch', active: true };
  s.institutions.push(fake);
  assert.deepEqual(sim.getPortWarningTargets(s), []);
  sim.advanceYear(s);
  assert.equal(portEvent(s).status, 'cancelled');
  assert.equal(original.active, false);
  assert.equal(original.open, false);
  assert.equal(fake.open, false);
  assert.deepEqual(portEvent(s).portBranchIds, [original.id]);
});

const invalidContracts = [
  ['missing rules version', s => { delete s.portAccessRulesVersion; }],
  ['missing event targets', (s, e) => { delete e.portBranchIds; }],
  ['missing action targets', (s, e, h) => { delete h.portBranchIds; }],
  ['empty targets', (s, e, h) => { e.portBranchIds = h.portBranchIds = []; }],
  ['duplicate targets', (s, e, h) => { e.portBranchIds = h.portBranchIds = [branch(s).id, branch(s).id]; }],
  ['different action/event targets', (s, e, h) => { h.portBranchIds = ['institution:invented']; }],
  ['coordinated nonexistent target', (s, e, h) => { e.portBranchIds = h.portBranchIds = ['institution:invented']; }],
  ['target is the real D4 station', (s, e, h) => { e.portBranchIds = h.portBranchIds = [s.institutions.find(i => i.kind === 'station').id]; }],
  ['wrong due year', (s, e) => { e.year = 32; }],
  ['wrong probability', (s, e) => { e.probability = .5; }],
  ['wrong event identity', (s, e) => { e.id = 'event:invented'; }],
  ['wrong event parent', (s, e) => { e.parentId = null; }],
  ['wrong event site', (s, e) => { e.cellId = 'B4'; }],
  ['disguised action ID', (s, e) => { e.actionId = 'free_warning'; }],
  ['missing submitted action', (s, e) => { s.history = s.history.filter(h => h.id !== e.sourceActionId); }],
  ['missing scheduled event', (s, e) => { s.events = s.events.filter(x => x !== e); }],
  ['erased original carrier identity', s => { s.institutions = s.institutions.filter(i => i !== branch(s)); }],
  ['missing event evidence', (s, e) => { e.evidence = []; }],
  ['missing action evidence', (s, e, h) => { h.evidence = []; }],
  ['coordinated missing evidence', (s, e, h) => { e.evidence = h.evidence = []; }],
  ['coordinated uninvestigated extra evidence', (s, e, h) => { e.evidence = h.evidence = ['resident_testimony', 'old_reality_record']; }],
  ['coordinated duplicate evidence', (s, e, h) => { e.evidence = h.evidence = ['resident_testimony', 'resident_testimony']; }],
  ['erased actor investigation', s => { delete s.investigations['30:protagonist']; }],
  ['testimony moved to D4', s => { s.investigations['30:protagonist'][0].cellId = 'D4'; }],
  ['testimony moved to Linche', s => { s.investigations['30:linche'] = s.investigations['30:protagonist']; delete s.investigations['30:protagonist']; }],
  ['pending event claims resolution', (s, e) => { e.resolvedYear = 31; }],
  ['pending event already has an outcome', (s, e) => { s.history.push({ id: `resolved:${e.id}`, year: 30, cellId: 'F6', parentId: e.id, sourceActionId: e.sourceActionId, kind: 'outcome', status: 'success', portBranchIds: copy(e.portBranchIds) }); }],
  ['wrong action cost', (s, e, h) => { h.cost.economy = 0; }],
  ['erased original branch outcome', s => { s.history = s.history.filter(h => h.id !== `resolved:${branch(s).sourceEventId}`); }],
];
for (const [reason, mutate] of invalidContracts) test(`${reason}: malformed access contract rejects before settlement or import`, () => {
  const s = pending(), e = portEvent(s), h = s.history.find(h => h.id === e.sourceActionId);
  mutate(s, e, h);
  assertInvalid(s);
});

for (const [reason, mutate] of [
  ['missing outcome', (s, e) => { s.history = s.history.filter(h => h.id !== `resolved:${e.id}`); }],
  ['wrong resolved year', (s, e) => { e.resolvedYear = 30; }],
  ['missing outcome targets', (s, e) => { delete s.history.find(h => h.id === `resolved:${e.id}`).portBranchIds; }],
  ['substituted outcome targets', (s, e) => { s.history.find(h => h.id === `resolved:${e.id}`).portBranchIds = ['institution:invented']; }],
  ['success did not open its target at31', s => { branch(s).open = false; }],
]) test(`${reason}: completed access has a verifiable outcome, not merely a public flag`, () => {
  const s = pending();
  sim.advanceYear(s);
  mutate(s, portEvent(s));
  assertInvalid(s);
});

test('reload and reversed annual traversal preserve access outcome and frozen sources', () => {
  const a = pending(), b = reload(a);
  while (a.year < 40) { sim.advanceYear(a); sim.advanceYear(b, { reverse: true }); assert.deepEqual(b, a); }
  assert.equal(portEvent(a).status, 'success');
  assert.deepEqual(reload(a), a);
});

test('a later shutdown does not erase an authentic public-access outcome or revive its branch', () => {
  const s = pending();
  sim.advanceYear(s); sim.advanceYear(s);
  const result = copy(portEvent(s));
  branch(s).active = false; branch(s).maintenance = 0;
  assert.equal(sim.validateState(s).valid, true);
  assert.deepEqual(reload(s), s);
  sim.advanceToNextWindow(s);
  assert.deepEqual(portEvent(s), result);
  assert.equal(branch(s).active, false);
  assert.equal(branch(s).maintenance, 0);
  assert.equal(sim.getWarningCoverage(s).F6.coverage, 0);
});

test('a later access restriction preserves the historical opening without reopening it on reload', () => {
  const s = pending();
  sim.advanceYear(s); sim.advanceYear(s);
  assert.equal(s.year, 32);
  const result = copy(portEvent(s));
  branch(s).open = false;
  assert.equal(sim.validateState(s).valid, true);
  assert.deepEqual(reload(s), s);
  sim.advanceToNextWindow(s);
  assert.deepEqual(portEvent(s), result);
  assert.equal(branch(s).open, false);
  assert.equal(sim.getWarningCoverage(s).F6.coverage, rounded(.45 * branch(s).maintenance));
});

const oldRoutes = [
  { name: 'merchant successful review', seed: 1 },
  { name: 'merchant failed review', seed: 2 },
  { name: 'merchant later recovery', seed: 2, lateReview: true },
  { name: 'merchant renewal', seed: 1, recruit: 'renew_charter', review: false },
  { name: 'no original branch', seed: 1, build: null },
];
function oldTasks(s, route) {
  if (s.year === 0) return route.build === null ? [] : [['protagonist', 'D4', 'build_merchant']];
  if (s.year === 10) return [['protagonist', 'D4', route.build === null ? 'recruit_volunteer' : route.recruit || 'recruit_successor']];
  if (s.year === 20) return [['protagonist', 'D4', 'free_warning'], ...(route.review !== false && prior.getActors(s).some(a => a.id === 'linche') ? [['linche', 'F6', 'independent_review']] : [])];
  return [['protagonist', 'D4', 'withdraw'], ...(prior.getActors(s).some(a => a.id === 'linche') ? [route.lateReview ? ['linche', 'F6', 'complete_review'] : ['linche', 'D5', 'mutual_aid']] : [])];
}
for (const route of oldRoutes) for (const stage of ['new', 'planning30', 'locked30', 'submitted30', 'resolved31', 'ended40']) test(`genuine round8 ${route.name}/${stage}: menus, contracts, yearly state and ending are unchanged`, () => {
  const old = prior.createRun(route.seed);
  if (stage !== 'new') while (old.year < 30) decade(prior, old, oldTasks(old, route));
  if (['locked30', 'submitted30', 'resolved31', 'ended40'].includes(stage)) for (const task of oldTasks(old, route)) choose(prior, old, ...task);
  if (['submitted30', 'resolved31', 'ended40'].includes(stage)) submit(prior, old);
  if (['resolved31', 'ended40'].includes(stage)) prior.advanceYear(old);
  if (stage === 'ended40') prior.advanceToNextWindow(old);
  const loaded = reload(old);
  assert.equal(Object.hasOwn(old, 'portAccessRulesVersion'), false);
  assert.equal(sim.usesPortAccessRules(loaded), false);
  assert.deepEqual(loaded, old);
  while (old.year < 40) {
    if (old.phase === 'planning') {
      for (const actor of prior.getActors(old)) for (const cell of old.cells) {
        // Only the new staffing explanation is excluded. Original contractual
        // fields, including risk, remain strict coverage-era equality checks.
        const contracts = sim.getActions(loaded, cell.id, actor.id).map(({ staffingNote, ...contract }) => {
          if (sim.RECRUITMENT_ACTIONS.includes(contract.id)) assert.equal(typeof staffingNote, 'string');
          else assert.equal(staffingNote, undefined);
          return contract;
        });
        assert.deepEqual(contracts, prior.getActions(old, cell.id, actor.id), `${old.year}/${cell.id}/${actor.id}: unchanged menu and contract`);
        assert.deepEqual(sim.getEvidenceIds(loaded, cell.id, actor.id), prior.getEvidenceIds(old, cell.id, actor.id));
      }
      assert.equal(portChoice(loaded), undefined);
      submit(prior, old, oldTasks(old, route)); submit(sim, loaded, oldTasks(loaded, route));
      assert.deepEqual(loaded, old, `unchanged year${old.year} submission`);
    }
    prior.advanceYear(old); sim.advanceYear(loaded);
    assert.deepEqual(loaded, old, `unchanged year${old.year} world, sources, costs and history`);
    assert.deepEqual(sim.getEnding(loaded), prior.getEnding(old));
  }
  assert.equal(sim.validateState(loaded).valid, true);
  assert.deepEqual(reload(loaded), old);
  assert.deepEqual(sim.getEnding(loaded), prior.getEnding(old));
});
