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
import * as preStaffing from './fixtures/pre-staffing-simulation.js';
import * as preBranch from './fixtures/pre-branch-access-simulation.js';
import { getRelocationDestination, getRelocationHistory } from '../src/relocation-history.js';
import { sceneFor } from '../src/story.js';

const engines = { current, original, preTradeoffs, preHandoff, preAftermath, preRecruitment, preRecovery, prePort, preStaffing, preBranch };
const recordId = 'resolved:event:action:20:protagonist:D4:relocate_teacher';
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
function at20({ api = current, build = null, choice = null, cellId = 'D4' } = {}) {
  const state = api.createRun(12);
  if (build) lock(state, build, api);
  next(state, api);
  if (choice) lock(state, choice, api, 'protagonist', cellId);
  return next(state, api);
}
function relocated(options = {}) {
  const api = options.api || current, state = at20(options);
  lock(state, 'relocate_teacher', api, options.actorId || 'protagonist');
  return next(state, api);
}
function parts(state) {
  const event = state.events.find(item => item.actionId === 'relocate_teacher');
  return { event, action: state.history.find(item => item.id === event?.sourceActionId),
    outcome: state.history.find(item => item.id === `resolved:${event?.id}`),
    school: state.institutions.find(item => item.sourceEventId === event?.id),
    actor: state.actors.find(item => item.id === event?.sourceActionId.split(':')[2]) };
}
const body = state => sceneFor(state, 'E4').body.join('\n');
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('natural seed12 pass/pass/relocation reaches E4 without a companion or invented D4 station', () => {
  const state = relocated(), before = structuredClone(state), view = getRelocationDestination(freeze(state));
  assert.equal(view.status, 'recorded');
  assert.equal(view.activity, 'active');
  assert.equal(view.schoolId, 'institution:event:action:20:protagonist:D4:relocate_teacher:E4');
  assert.deepEqual(view.sources.map(({ recordId, cellId, year }) => ({ recordId, cellId, year })), [{ recordId, cellId: 'D4', year: 21 }]);
  assert.match(view.summary, /第21年，主角执行的河港迁任在东岸留下了这所学校.*目前仍在运转/);
  assert.match(body(state), /苏岚反对自己的意愿被一份旧履历替代/);
  assert.ok(view.paragraphs.every(text => body(state).includes(text)));
  assert.equal(sceneFor(state, 'E4').relationship, null);
  assert.equal(state.history.filter(item => item.id === recordId).length, 1);
  assert.equal(state.history.find(item => item.id === recordId).cellId, 'D4');
  assert.deepEqual(state, before);
});

test('draft, locked contract and unresolved event do not anticipate the destination response', () => {
  const state = at20();
  assert.equal(getRelocationDestination(state), null);
  lock(state, 'relocate_teacher');
  assert.equal(getRelocationDestination(state), null);
  submit(state);
  assert.equal(getRelocationDestination(state), null);
  assert.doesNotMatch(body(state), /河港迁任在东岸留下|原迁任记录仍记着/);
  current.advanceYear(state);
  assert.equal(state.year, 21);
  assert.equal(getRelocationDestination(state).status, 'recorded');
});

for (const action of ['fund_school', 'train_network']) test(`${action} and convenient flags never assign an anonymous school to Sulan`, () => {
  const state = action === 'fund_school' ? at20({ choice: action, cellId: 'E4' }) : at20();
  if (action === 'train_network') { lock(state, action, current, 'protagonist', 'E4'); next(state); }
  Object.assign(state.flags, { forced: true, trust: false });
  state.institutions[0].name = '迁任标准学校';
  assert.equal(getRelocationDestination(state), null);
  assert.doesNotMatch(body(state), /苏岚|原迁任|河港迁任在东岸留下/);
});

test('a prior night school and the relocation school coexist without merging their origins', () => {
  const state = relocated({ choice: 'fund_school', cellId: 'E4' });
  const view = getRelocationDestination(state);
  assert.equal(state.institutions.filter(item => item.cellId === 'E4' && item.kind === 'school').length, 2);
  assert.match(view.paragraphs.join(''), /东岸还有其他教学载体在运转.*各自的来处/);
  assert.deepEqual(view.sources.map(item => item.recordId), [recordId]);
  assert.equal(state.history.find(item => item.id === 'resolved:event:action:10:protagonist:E4:fund_school').cellId, 'E4');
});

test('existing training and a companion’s separate training choice are not attributed to relocation', () => {
  const state = at20({ build: 'build_joint', choice: 'recruit_successor' });
  lock(state, 'relocate_teacher'); lock(state, 'train_network', current, 'linche', 'E4'); next(state);
  const view = getRelocationDestination(state);
  assert.equal(view.status, 'recorded');
  assert.match(view.summary, /主角执行/);
  assert.match(view.paragraphs.join(''), /其他教学载体在运转/);
  assert.deepEqual(view.sources.map(item => item.recordId), [recordId]);
  assert.match(sceneFor(state, 'E4').relationship.text, /我同意同行，不等于认可/);
  assert.equal(state.history.find(item => item.id === 'resolved:event:action:20:linche:E4:train_network').cellId, 'E4');
});

for (const companion of [false, true]) test(`protagonist responsibility stays the same with companion=${companion}`, () => {
  const state = relocated(companion ? { choice: 'recruit_volunteer' } : {});
  for (const actor of ['protagonist', 'linche']) {
    assert.match(sceneFor(state, 'E4', actor).body.join(''), /主角执行的河港迁任/);
    assert.doesNotMatch(sceneFor(state, 'E4', actor).body.join(''), /林澈执行的河港迁任/);
  }
});

for (const api of [original, preTradeoffs, preHandoff, preAftermath]) test(`${api === original ? 'original' : api === preTradeoffs ? 'preTradeoffs' : api === preHandoff ? 'preHandoff' : 'preAftermath'} genuine companion-executed migration keeps the real actor`, () => {
  const state = relocated({ api, build: 'build_joint', choice: 'recruit_successor', actorId: 'linche' });
  const view = getRelocationDestination(state);
  assert.equal(view.status, 'recorded');
  assert.match(view.summary, /林澈执行的河港迁任/);
  assert.doesNotMatch(view.summary, /主角执行/);
  assert.deepEqual(view.sources.map(item => item.recordId), ['resolved:event:action:20:linche:D4:relocate_teacher']);
  assert.match(body(state), /苏岚拒绝把这称为被拯救/);
});

for (const [name, api] of Object.entries(engines)) test(`${name}: actual producer records, subsequent simulation and ending stay unchanged`, () => {
  const state = relocated({ api }), control = structuredClone(state), previousHistory = getRelocationHistory(state);
  const view = getRelocationDestination(freeze(state));
  assert.equal(view.status, 'recorded');
  assert.deepEqual(getRelocationHistory(state), previousHistory);
  assert.deepEqual(getRelocationDestination(JSON.parse(JSON.stringify(state))), view);
  assert.deepEqual(state, control);
  const continuation = structuredClone(state);
  next(continuation, api); next(control, api);
  assert.equal(continuation.year, 40);
  assert.deepEqual(continuation, control);
  assert.deepEqual(api.getEnding(continuation), api.getEnding(control));
  const final = getRelocationDestination(continuation);
  assert.equal(final.status, 'recorded');
  assert.deepEqual(final.sources.map(item => item.recordId), [recordId]);
  final.sources[0].recordId = 'not a historical edit'; final.paragraphs[0] = 'not a historical edit';
  assert.deepEqual(continuation, control);
});

for (const mutate of [school => { school.active = false; }, school => { school.maintenance = 0; }]) test('stopped relocation carrier does not stop the other E4 school or erase the objection', () => {
  const state = relocated({ choice: 'fund_school', cellId: 'E4' });
  mutate(parts(state).school);
  const view = getRelocationDestination(state);
  assert.equal(view.activity, 'stopped');
  assert.match(view.summary, /这所学校目前已经停运/);
  assert.match(body(state), /其他教学载体在运转/);
  assert.match(body(state), /苏岚反对/);
  assert.equal(view.sources[0].recordId, recordId);
});

test('only the relocation carrier stopped means the generic classroom also stops', () => {
  const state = relocated(); parts(state).school.active = false;
  assert.match(body(state), /课已经停下/);
  assert.match(body(state), /这所学校目前已经停运/);
  assert.doesNotMatch(body(state), /学员把旧水尺与当天的记录放在一起练习/);
});

test('an unknown current activity retains proven historical origin without inventing current teaching', () => {
  const state = relocated(); delete parts(state).school.maintenance;
  const view = getRelocationDestination(state);
  assert.equal(view.status, 'recorded');
  assert.equal(view.activity, 'unknown');
  assert.match(view.summary, /运转记录不完整/);
  assert.equal(view.sources[0].recordId, recordId);
  assert.match(body(state), /当前运转情况缺页/);
  assert.doesNotMatch(body(state), /课已经停下|学员把旧水尺与当天的记录放在一起练习/);
});

test('missing earlier D4 targets do not erase independently verified E4 origin', () => {
  const state = relocated({ build: 'build_joint', choice: 'renew_charter' });
  state.institutions = state.institutions.filter(item => item.cellId !== 'D4');
  assert.equal(getRelocationHistory(state).status, 'unknown');
  assert.equal(getRelocationDestination(state).status, 'recorded');
});

const broken = [
  ['missing event', (state, p) => { state.events = state.events.filter(item => item !== p.event); }],
  ['missing action', (state, p) => { state.history = state.history.filter(item => item !== p.action); }],
  ['missing outcome', (state, p) => { state.history = state.history.filter(item => item !== p.outcome); }],
  ['missing school', (state, p) => { state.institutions = state.institutions.filter(item => item !== p.school); }],
  ['duplicate event', (state, p) => { state.events.push(structuredClone(p.event)); }],
  ['duplicate action', (state, p) => { state.history.push(structuredClone(p.action)); }],
  ['duplicate outcome', (state, p) => { state.history.push(structuredClone(p.outcome)); }],
  ['duplicate school', (state, p) => { state.institutions.push(structuredClone(p.school)); }],
  ['event also in history', (state, p) => { state.history.push(structuredClone(p.event)); }],
  ['outcome also in events', (state, p) => { state.events.push(structuredClone(p.outcome)); }],
  ['action also in institutions', (state, p) => { state.institutions.push(structuredClone(p.action)); }],
  ['school also in history', (state, p) => { state.history.push(structuredClone(p.school)); }],
  ['second school same event', (state, p) => { state.institutions.push({ ...p.school, id: 'second-school' }); }],
  ['second carrier wrong cell', (state, p) => { state.institutions.push({ ...p.school, id: 'another-carrier', cellId: 'F6' }); }],
  ['wrong event parent', (state, p) => { p.event.parentId = 'arrival'; }],
  ['wrong event source', (state, p) => { p.event.sourceActionId = 'action:20:linche:D4:relocate_teacher'; }],
  ['wrong event reality', (state, p) => { p.event.reality = 'R0'; }],
  ['wrong event actor', (state, p) => { p.event.actorId = 'linche'; }],
  ['wrong event action', (state, p) => { p.event.actionId = 'train_network'; }],
  ['failed event', (state, p) => { p.event.status = 'failed'; }],
  ['pending event', (state, p) => { p.event.status = 'pending'; delete p.event.resolvedYear; }],
  ['wrong event date', (state, p) => { p.event.year = 22; p.event.resolvedYear = 22; }],
  ['wrong action reality', (state, p) => { p.action.reality = 'R0'; }],
  ['wrong action cell', (state, p) => { p.action.cellId = 'E4'; }],
  ['wrong action status', (state, p) => { p.action.status = 'pending'; }],
  ['wrong action source', (state, p) => { p.action.sourceActionId = 'missing'; }],
  ['wrong outcome reality', (state, p) => { p.outcome.reality = 'R0'; }],
  ['wrong outcome actor', (state, p) => { p.outcome.actorId = 'linche'; }],
  ['wrong outcome kind', (state, p) => { p.outcome.kind = 'action'; }],
  ['wrong outcome date', (state, p) => { p.outcome.year = 20; }],
  ['wrong outcome cell', (state, p) => { p.outcome.cellId = 'E4'; }],
  ['wrong outcome parent', (state, p) => { p.outcome.parentId = 'missing'; }],
  ['wrong school kind', (state, p) => { p.school.kind = 'training'; }],
  ['wrong school date', (state, p) => { p.school.startYear = 22; }],
  ['wrong school cell', (state, p) => { p.school.cellId = 'D4'; }],
  ['wrong school source', (state, p) => { p.school.sourceActionId = 'missing'; }],
  ['wrong school reality', (state, p) => { p.school.reality = 'R0'; }],
  ['wrong school actor', (state, p) => { p.school.actorId = 'linche'; }],
  ['wrong world reality', state => { state.reality = 'R0'; }],
  ['missing actor', state => { state.actors = []; }],
  ['duplicate actor', (state, p) => { state.actors.push(structuredClone(p.actor)); }],
  ['unavailable actor', (state, p) => { p.actor.availableFrom = 30; }],
  ['action plus pass', state => { state.history.push({ id: 'pass:20:protagonist' }); }],
  ['competing actor action', state => { state.history.push({ id: 'action:20:protagonist:E4:train_network', kind: 'action' }); }],
];
for (const [name, mutate] of broken) test(`${name}: incomplete provenance has no link or invented attributed destination`, () => {
  const state = relocated(); mutate(state, parts(state)); const before = structuredClone(state);
  const view = getRelocationDestination(freeze(state));
  assert.equal(view.status, 'unknown');
  assert.equal(view.schoolId, null);
  assert.deepEqual(view.sources, []);
  assert.match(view.summary, /来源缺失或不一致/);
  assert.doesNotMatch(view.paragraphs.join(''), /主角执行的|林澈执行的|原迁任记录仍记着/);
  assert.deepEqual(state, before);
});

test('missing objection text is not reconstructed from flags or a valid school', () => {
  const state = relocated(); delete parts(state).outcome.text;
  const view = getRelocationDestination(state);
  assert.equal(view.status, 'recorded');
  assert.match(view.paragraphs.join(''), /没有保留可核对的个人证词/);
  assert.doesNotMatch(view.paragraphs.join(''), /苏岚反对|苏岚拒绝/);
});

test('an orphan completed event is unknown while a lone pending contract stays unfulfilled', () => {
  const state = relocated(), p = parts(state);
  state.history = state.history.filter(item => item !== p.outcome);
  state.institutions = state.institutions.filter(item => item !== p.school);
  assert.equal(getRelocationDestination(state).status, 'unknown');
  p.event.status = 'pending'; delete p.event.resolvedYear;
  assert.equal(getRelocationDestination(state), null);
});

test('a malformed other school does not acquire an affirmative current-teaching claim', () => {
  const state = relocated({ choice: 'fund_school', cellId: 'E4' });
  state.institutions.find(item => item.startYear === 11).maintenance = 2;
  assert.match(getRelocationDestination(state).paragraphs.join(''), /其他教学载体的记录.*当前状态须另行核对/);
  assert.doesNotMatch(getRelocationDestination(state).paragraphs.join(''), /其他教学载体在运转/);
});

test('future records, unrelated locations and absent data cannot create a destination', () => {
  const state = relocated(); state.year = 20;
  assert.equal(getRelocationDestination(state), null);
  state.year = 30;
  for (const cellId of ['D4', 'F6', 'D5', null]) assert.equal(getRelocationDestination(state, cellId), null);
  assert.equal(getRelocationDestination(null), null);
  assert.equal(getRelocationDestination({ year: 30 }), null);
});

test('reading does not consult random rolls, seed, evidence drafts or a future ending', () => {
  const state = relocated(), before = structuredClone(state), outcome = current.getEnding(state);
  const tested = structuredClone(state);
  Object.defineProperty(tested, 'seed', { get() { throw Error('seed read'); } });
  for (const event of tested.events) Object.defineProperty(event, 'roll', { get() { throw Error('roll read'); } });
  assert.equal(getRelocationDestination(tested).status, 'recorded');
  assert.match(sceneFor(tested, 'E4').body.join(''), /主角执行的河港迁任/);
  const view = getRelocationDestination(state);
  for (const source of view.sources) {
    assert.ok(state.history.some(item => item.id === source.recordId && item.cellId === 'D4'));
    assert.ok(current.traceEvent(state, source.recordId).length >= 2);
  }
  for (let index = 0; index < 3; index++) { getRelocationDestination(state); sceneFor(state, 'E4'); }
  assert.deepEqual(current.getEnding(state), outcome);
  assert.deepEqual(state, before);
});
