import test from 'node:test';
import assert from 'node:assert/strict';
import * as current from '../src/simulation.js';
import * as original from './fixtures/legacy-simulation.js';
import * as preTradeoffs from './fixtures/pre-tradeoffs-simulation.js';
import * as preHandoff from './fixtures/pre-handoff-simulation.js';
import * as preAftermath from './fixtures/pre-aftermath-simulation.js';
import * as preRecruitment from './fixtures/pre-recruitment-simulation.js';
import * as preRecovery from './fixtures/pre-recovery-simulation.js';
import * as prePort from './fixtures/pre-port-access-simulation.js';
import { getRelocationContract, getRelocationHistory } from '../src/relocation-history.js';
import { sceneFor, sulanIdentity } from '../src/story.js';

const engines = { current, original, preTradeoffs, preHandoff, preAftermath, preRecruitment, preRecovery, prePort };
const resolutionId = 'resolved:event:action:20:protagonist:D4:relocate_teacher';
const body = state => sceneFor(state, 'D4').body.join('\n');
function lock(state, actionId, api = current, actorId = 'protagonist', cellId = 'D4') {
  const action = api.getActions(state, cellId, actorId).find(item => item.id === actionId);
  assert.ok(action, `Missing ${actionId}`);
  if (api.investigate) for (const id of action.requireEvidence) {
    if (!api.getInvestigation(state, actorId, cellId).evidence.includes(id)) api.investigate(state, actorId, cellId, id);
  }
  api.lockTask(state, actorId, cellId, actionId, action.requireEvidence);
}
function submit(state, api = current) {
  for (const actor of api.getActors(state)) if (!state.drafts[actor.id]) api.passTask(state, actor.id);
  api.commitWindow(state);
}
function next(state, api = current) { submit(state, api); api.advanceToNextWindow(state); return state; }
function at20({ api = current, seed = 12, build = 'build_joint', choice = 'renew_charter' } = {}) {
  const state = api.createRun(seed);
  if (build) lock(state, build, api);
  next(state, api);
  if (choice) lock(state, choice, api);
  return next(state, api);
}
function at30(options = {}) {
  const api = options.api || current, state = at20(options);
  lock(state, 'relocate_teacher', api);
  return next(state, api);
}
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function parts(state) {
  const event = state.events.find(item => item.actionId === 'relocate_teacher');
  return { event, action: state.history.find(item => item.id === event?.sourceActionId),
    outcome: state.history.find(item => item.id === resolutionId),
    station: state.institutions.find(item => item.kind === 'station'),
    school: state.institutions.find(item => item.sourceEventId === event?.id) };
}

test('seed12 joint charter keeps Linche and resident Sulan separate from the whole-contract shutdown', () => {
  const state = at20(), before = structuredClone(state);
  assert.equal(sulanIdentity(state).kind, 'resident');
  const contract = getRelocationContract(freeze(state));
  assert.equal(contract.status, 'recorded');
  assert.match(contract.summary, /同时停用河港当时已有的制度/);
  assert.match(contract.summary, /不以苏岚是否担任维护者为条件/);
  assert.match(contract.summary, /林澈留下带教，没有指定苏岚接任/);
  assert.deepEqual(contract.targets.map(target => target.kind), ['station']);
  assert.deepEqual(state, before);
  const progressed = structuredClone(state); lock(progressed, 'relocate_teacher'); submit(progressed); current.advanceYear(progressed);
  assert.equal(parts(progressed).station.active, false);
  const view = getRelocationHistory(progressed), post = structuredClone(progressed);
  assert.equal(view.status, 'recorded');
  assert.match(view.summary, /第21年迁任兑现.*河港测站.*停用范围/);
  assert.match(view.context, /林澈留下带教/);
  assert.match(view.processNote, /旧记录没有交代具体维护中断过程/);
  assert.ok(body(progressed).includes(view.summary));
  assert.ok(body(progressed).includes(view.context));
  assert.equal(view.original.text, '迁任完成，学校多了教师，河港现有制度失去维护。苏岚拒绝把这称为被拯救。');
  assert.ok(view.sources.every(source => source.id !== view.original.id));
  for (const source of view.sources) {
    assert.deepEqual(source, progressed.history.find(item => item.id === source.id));
    assert.ok(current.traceEvent(progressed, source.id).length);
  }
  assert.deepEqual(progressed, post);
});

test('rebuilding without an original station names the recorded anonymous team, never appoints Sulan', () => {
  const state = at20({ build: null, choice: 'restore_archive' });
  assert.equal(sulanIdentity(state).kind, 'resident');
  assert.match(getRelocationContract(state).summary, /新的维护小组，没有指定苏岚接班/);
  lock(state, 'relocate_teacher'); next(state);
  const view = getRelocationHistory(state), before = structuredClone(state);
  assert.equal(view.status, 'recorded');
  assert.match(view.context, /第12年重建.*新的维护小组，没有指定苏岚接班/);
  assert.doesNotMatch(view.detail.join(''), /苏岚同意接过|苏岚离开后无人维护/);
  assert.ok(body(state).includes(view.summary));
  assert.ok(body(state).includes(view.processNote));
  assert.deepEqual(state, before);
});

for (const [seed, kind] of [[12, 'station'], [6, 'archive']]) test(`verified ${kind} succession survives the explanation without becoming a sole-maintainer claim`, () => {
  const state = at20({ seed, choice: 'recruit_successor' });
  assert.equal(sulanIdentity(state).kind, kind);
  lock(state, 'relocate_teacher'); next(state);
  const view = getRelocationHistory(state);
  assert.equal(view.status, 'recorded');
  assert.deepEqual(view.targets.map(target => target.kind), [kind]);
  assert.match(view.detail.join(''), /不能把苏岚写成唯一维护者/);
  const year21 = structuredClone(state); year21.year = 21;
  assert.match(body(year21), kind === 'station' ? /苏岚同意接过测站维护/ : /苏岚同意接过档案保管/);
});

test('a failed build is an archive target, and the annotation does not invent a station', () => {
  const state = at30({ seed: 6, choice: null }), view = getRelocationHistory(state);
  assert.equal(view.status, 'recorded');
  assert.deepEqual(view.targets.map(target => target.kind), ['archive']);
  assert.match(view.summary, /河港档案站/);
  assert.doesNotMatch(view.summary, /河港测站/);
});

test('rebuilding beside an existing failed archive includes both real D4 targets', () => {
  const state = at30({ seed: 6, choice: 'restore_archive' }), view = getRelocationHistory(state);
  assert.equal(view.status, 'recorded');
  assert.deepEqual(view.targets.map(target => target.kind).sort(), ['archive', 'station']);
  assert.ok(state.institutions.filter(item => item.cellId === 'D4').every(item => !item.active));
  assert.match(view.context, /新的维护小组，没有指定苏岚接班/);
});

test('an already stopped carrier is in the contract scope without attributing its first shutdown to relocation', () => {
  const state = at20({ choice: 'recruit_risk' });
  assert.equal(state.institutions.find(item => item.kind === 'station').active, false);
  assert.match(getRelocationContract(state).summary, /已停运的制度不会被算作一次新的停运/);
  lock(state, 'relocate_teacher'); next(state);
  assert.match(getRelocationHistory(state).summary, /不证明它们此前都在运行/);
  assert.ok(state.history.some(item => item.id === 'station-unattended'));
});

test('an unbuilt route has no invented shutdown and an empty list alone is insufficient proof', () => {
  const state = at20({ build: null, choice: null });
  assert.equal(getRelocationContract(state).status, 'recorded');
  assert.match(getRelocationContract(state).summary, /没有河港测站或档案站/);
  lock(state, 'relocate_teacher'); next(state);
  const view = getRelocationHistory(state);
  assert.equal(view.status, 'recorded');
  assert.deepEqual(view.targets, []);
  assert.match(view.summary, /不能把这次迁任记成一座测站的停运/);
  state.history = state.history.filter(item => item.id !== 'pass:10:protagonist');
  assert.equal(getRelocationHistory(state).status, 'unknown');
  assert.doesNotMatch(getRelocationHistory(state).summary, /没有河港测站/);
});

for (const [name, api] of Object.entries(engines)) test(`${name}: actual producer archive retains original text, ids, costs, outcomes, snapshots and continuation`, () => {
  const state = at20({ api }), untouched = structuredClone(state), actions = structuredClone(api.getActions(state, 'D4'));
  getRelocationContract(state);
  assert.deepEqual(state, untouched);
  assert.deepEqual(api.getActions(state, 'D4'), actions);
  lock(state, 'relocate_teacher', api); lock(untouched, 'relocate_teacher', api);
  next(state, api); next(untouched, api);
  const before = structuredClone(state), view = getRelocationHistory(freeze(state));
  assert.equal(view.status, 'recorded');
  assert.deepEqual(view.original, state.history.find(item => item.id === resolutionId));
  assert.match(view.context, /林澈留下带教/);
  assert.match(view.processNote, /旧记录没有交代具体维护中断过程/);
  assert.deepEqual(state, before);
  const continuing = structuredClone(state); next(continuing, api); next(untouched, api);
  assert.deepEqual(continuing, untouched);
  assert.deepEqual(api.getEnding(continuing), api.getEnding(untouched));
  const detached = getRelocationHistory(continuing);
  detached.sources[0].text = 'not a historical edit'; detached.original.text = 'not a historical edit'; detached.targets[0].kind = 'changed';
  assert.deepEqual(continuing, untouched);
});

test('an original-engine Linche relocation retains its actual actor instead of borrowing the protagonist’s choice', () => {
  const state = at20({ api: original, choice: 'recruit_successor' });
  lock(state, 'relocate_teacher', original, 'linche'); next(state, original);
  const id = 'resolved:event:action:20:linche:D4:relocate_teacher', view = getRelocationHistory(state, id);
  assert.equal(view.status, 'recorded');
  assert.equal(view.original.id, id);
  assert.ok(view.sources.some(source => source.id === 'action:20:linche:D4:relocate_teacher'));
  assert.equal(getRelocationHistory(state, resolutionId), null);
});

const brokenRelocations = [
  ['missing event', (state, p) => { state.events = state.events.filter(item => item !== p.event); }],
  ['missing action', (state, p) => { state.history = state.history.filter(item => item !== p.action); }],
  ['wrong event parent', (state, p) => { p.event.parentId = 'arrival'; }],
  ['wrong action source', (state, p) => { p.action.sourceActionId = 'missing'; }],
  ['wrong actor', (state, p) => { p.event.actorId = 'linche'; }],
  ['wrong outcome source', (state, p) => { p.outcome.sourceActionId = 'missing'; }],
  ['wrong outcome date', (state, p) => { p.outcome.year = 22; }],
  ['wrong outcome kind', (state, p) => { p.outcome.kind = 'failure'; }],
  ['unresolved event', (state, p) => { delete p.event.resolvedYear; }],
  ['failed event', (state, p) => { p.event.status = 'failed'; }],
  ['inherited action name', (state, p) => { p.event.actionId = 'toString'; }],
  ['constructor action name', (state, p) => { p.event.actionId = 'constructor'; }],
  ['prototype action name', (state, p) => { p.event.actionId = '__proto__'; }],
  ['object action name', (state, p) => { p.event.actionId = { toString: null }; }],
  ['wrong reality', (state, p) => { p.outcome.reality = 'R0'; }],
  ['duplicate event', (state, p) => { state.events.push(structuredClone(p.event)); }],
  ['duplicate action', (state, p) => { state.history.push(structuredClone(p.action)); }],
  ['duplicate outcome', (state, p) => { state.history.push(structuredClone(p.outcome)); }],
  ['missing school', (state, p) => { state.institutions = state.institutions.filter(item => item !== p.school); }],
  ['wrong school source', (state, p) => { p.school.sourceActionId = 'missing'; }],
  ['wrong school date', (state, p) => { p.school.startYear = 22; }],
  ['duplicate school', (state, p) => { state.institutions.push(structuredClone(p.school)); }],
  ['action plus pass', state => { state.history.push({ id: 'pass:20:protagonist' }); }],
  ['future outcome', state => { state.year = 20; }],
];
for (const [name, mutate] of brokenRelocations) test(`${name} cannot assign any current shutdown to migration`, () => {
  const state = at30(); mutate(state, parts(state)); const before = structuredClone(state);
  const view = getRelocationHistory(state);
  assert.equal(view.status, 'unknown');
  assert.deepEqual(view.sources, []); assert.deepEqual(view.targets, []);
  assert.match(view.summary, /不能仅凭原文或今天河港停运/);
  assert.deepEqual(state, before);
});

for (const [name, mutate] of [
  ['missing station', (state, p) => { state.institutions = state.institutions.filter(item => item !== p.station); }],
  ['wrong station origin', (state, p) => { p.station.sourceEventId = 'missing'; }],
  ['wrong station date', (state, p) => { p.station.startYear = 5; }],
  ['missing construction outcome', state => { state.history = state.history.filter(item => item.id !== 'resolved:event:action:0:protagonist:D4:build_joint'); }],
  ['duplicate station', (state, p) => { state.institutions.push(structuredClone(p.station)); }],
]) test(`${name} preserves the verified relocation but makes the target history unknown`, () => {
  const state = at30(); mutate(state, parts(state)); const before = structuredClone(state);
  const view = getRelocationHistory(state);
  assert.equal(view.status, 'unknown');
  assert.match(view.summary, /迁任兑现与东岸学校可以核实.*来源不完整/);
  assert.doesNotMatch(view.summary, /没有河港测站/);
  assert.deepEqual(state, before);
});

test('missing renewal provenance never supplies Linche’s role from a convenient flag', () => {
  const state = at30();
  state.history = state.history.filter(item => item.id !== 'resolved:event:action:10:protagonist:D4:renew_charter');
  state.flags.renewed = true; state.flags.successor = true;
  assert.doesNotMatch(getRelocationHistory(state).context, /林澈留下带教/);
});

test('current stopped or restored service and later years cannot rewrite the historical annotation', () => {
  const state = at30(), before = getRelocationHistory(state);
  // A deliberately varied current-state boundary, not an invented recovery
  // event or a claim that the playable year30 window has such an action.
  Object.assign(parts(state).station, { active: true, open: true, maintenance: 1 });
  Object.assign(state.flags, { forced: false, freeWarning: true, successor: false });
  state.year = 40;
  assert.deepEqual(getRelocationHistory(state), before);
  assert.match(before.detail.join(''), /后来恢复的服务也不删除/);
});

test('absent or unrelated history does not manufacture relocation from stopped institutions', () => {
  const state = at20({ choice: 'recruit_risk' });
  assert.equal(getRelocationHistory(state), null);
  assert.equal(getRelocationHistory(state, 'station-unattended'), null);
  assert.equal(getRelocationContract(current.createRun(0)), null);
  assert.equal(getRelocationHistory(null), null);
  assert.equal(getRelocationHistory({ year: 30, history: [], institutions: [{ active: false, cellId: 'D4' }] }), null);
});
