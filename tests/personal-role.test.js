import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from './fixtures/pre-recruitment-simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import { sceneFor, sulanIdentity, characterEpilogue, evidenceFor } from '../src/story.js';

function lock(s, id, api = sim, actor = 'protagonist', cell = 'D4') {
  const action = api.getActions(s, cell, actor).find(a => a.id === id);
  assert.ok(action, id);
  if (api.investigate) for (const evidence of action.requireEvidence) {
    if (!api.getInvestigation(s, actor, cell).evidence.includes(evidence)) api.investigate(s, actor, cell, evidence);
  }
  api.lockTask(s, actor, cell, id, action.requireEvidence);
}
function submit(s, api = sim) {
  for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id);
  api.commitWindow(s);
}
function next(s, api = sim) { submit(s, api); api.advanceToNextWindow(s); return s; }
function at20({ seed = 0, build = 'build_joint', choice = 'recruit_successor', api = sim } = {}) {
  const s = api.createRun(seed);
  if (build) lock(s, build, api);
  next(s, api);
  if (choice) lock(s, choice, api);
  return next(s, api);
}
function at30(choice, options = {}) {
  const api = options.api || sim, s = at20(options);
  if (choice) lock(s, choice, api);
  return next(s, api);
}
const body = (s, actor = 'protagonist') => sceneFor(s, 'D4', actor).body.join('\n');
const coda = s => characterEpilogue(s).find(p => p.name === '苏岚').paragraphs.join('\n');
const successor = s => s.events.find(e => e.actionId === 'recruit_successor');

for (const [seed, kind, title] of [[0, 'station', '苏岚 · 河港的维护者'], [6, 'archive', '苏岚 · 河港档案保管员']]) {
  test(`verified ${kind} succession identifies the actual personal job, not its capability flag`, () => {
    const s = at20({ seed }), before = structuredClone(s);
    assert.equal(sulanIdentity(s).kind, kind);
    assert.equal(sceneFor(s, 'D4').speaker, title);
    assert.match(body(s), kind === 'station' ? /同意接过测站维护/ : /接过的是档案保管工作/);
    assert.deepEqual(s, before);
    s.flags.successor = false;
    assert.equal(sceneFor(s, 'D4').speaker, title);
    for (const source of sulanIdentity(s).sources) {
      assert.ok(s.history.some(h => h.id === source));
      assert.ok(sim.traceEvent(s, source).length);
    }
  });
  test(`a stopped ${kind} retains its real succession history without claiming a current job`, () => {
    const s = at20({ seed });
    s.institutions.find(i => i.kind === kind).active = false;
    assert.equal(sulanIdentity(s).kind, 'resident');
    assert.match(body(s), /苏岚同意接过/);
    assert.match(body(s), /不是今天仍在原岗位工作的证明/);
    s.institutions.find(i => i.kind === kind).active = true;
    s.institutions.find(i => i.kind === kind).maintenance = 0;
    assert.equal(sulanIdentity(s).kind, 'resident');
  });
}

for (const [name, options] of [
  ['unbuilt', { build: null, choice: null }],
  ['failed archive without recruitment', { seed: 6, choice: null }],
  ['failed archive with risky recruitment', { seed: 6, choice: 'recruit_risk' }],
  ['station with risky recruitment', { choice: 'recruit_risk' }],
  ['volunteer without a job', { build: null, choice: 'recruit_volunteer' }],
  ['rebuilding after failed construction', { seed: 6, choice: 'restore_archive' }],
  ['rebuilding without any initial station', { build: null, choice: 'restore_archive' }],
  ['renewing Linche’s public charter', { choice: 'renew_charter' }],
]) test(`${name} never assigns an anonymous or nonexistent job to Sulan`, () => {
  const s = at20(options);
  s.flags.successor = true;
  const before = structuredClone(s);
  for (const actor of ['protagonist', 'linche']) {
    assert.equal(sceneFor(s, 'D4', actor).speaker, '苏岚 · 河港居民');
    assert.doesNotMatch(body(s, actor), /苏岚把小型档案站里的散页重新编号|苏岚同意接过/);
  }
  if (options.choice === 'restore_archive') {
    assert.match(body(s), /新的维护小组，没有指定苏岚接班/);
    assert.match(body(s), /测站仍在运转/);
    assert.equal(s.institutions.some(i => i.kind === 'training'), false);
  }
  if (options.choice === 'renew_charter') assert.match(body(s), /林澈留下带教.*没有记录苏岚接任/);
  assert.deepEqual(s, before);
});

test('the year10 investigation describes local teaching without inventing Sulan’s completed training', () => {
  const s = sim.createRun(0); lock(s, 'build_joint'); next(s);
  const evidence = evidenceFor(s, 'successor_consent');
  assert.equal(evidence.title, '与苏岚商量培训与接班');
  assert.match(evidence.text, /苏岚愿意商量自己需要完成的培训/);
  assert.doesNotMatch(evidence.text, /苏岚带着已经完成的读尺记录/);
});

const mutations = [
  ['missing event', (s, e) => { s.events = s.events.filter(x => x !== e); }],
  ['missing action', (s, e, a) => { s.history = s.history.filter(x => x !== a); }],
  ['missing outcome', (s, e, a, o) => { s.history = s.history.filter(x => x !== o); }],
  ['wrong event date', (s, e) => { e.year = e.resolvedYear = 12; }],
  ['wrong action date', (s, e, a) => { a.year = 0; }],
  ['wrong action parent', (s, e, a) => { a.parentId = 'arrival'; }],
  ['missing personal consent evidence', (s, e, a) => { a.evidence = []; }],
  ['mismatched personal consent evidence', (s, e) => { e.evidence = []; }],
  ['unconfirmed action', (s, e, a) => { a.status = 'pending'; }],
  ['wrong event actor', (s, e) => { e.actorId = 'linche'; }],
  ['wrong outcome date', (s, e, a, o) => { o.year = 12; }],
  ['wrong outcome kind', (s, e, a, o) => { o.kind = 'failure'; }],
  ['wrong outcome place', (s, e, a, o) => { o.cellId = 'E4'; }],
  ['wrong outcome source', (s, e, a, o) => { o.sourceActionId = 'action:10:protagonist:D4:restore_archive'; }],
  ['pending event', (s, e) => { e.status = 'pending'; }],
  ['failed event', (s, e) => { e.status = 'failed'; }],
  ['undated event', (s, e) => { delete e.resolvedYear; }],
  ['duplicate event', (s, e) => { s.events.push(structuredClone(e)); }],
  ['duplicate action', (s, e, a) => { s.history.push(structuredClone(a)); }],
  ['duplicate outcome', (s, e, a, o) => { s.history.push(structuredClone(o)); }],
  ['action and pass', s => { s.history.push({ id: 'pass:10:protagonist', kind: 'pass' }); }],
  ['missing snapshot', (s, e) => { delete e.departureRoleIds; }],
  ['mismatched snapshot', (s, e, a) => { a.departureRoleIds = []; }],
  ['empty snapshot', (s, e, a) => { e.departureRoleIds = a.departureRoleIds = []; }],
  ['wrong role place', s => { s.institutions.find(i => i.kind === 'station').cellId = 'E4'; }],
  ['wrong role source', s => { s.institutions.find(i => i.kind === 'station').sourceActionId = 'unknown'; }],
  ['wrong role event', s => { s.institutions.find(i => i.kind === 'station').sourceEventId = 'unknown'; }],
  ['wrong role date', s => { s.institutions.find(i => i.kind === 'station').startYear = 12; }],
  ['missing build outcome', s => { s.history = s.history.filter(h => h.id !== 'resolved:event:action:0:protagonist:D4:build_joint'); }],
  ['duplicate role', s => { s.institutions.push(structuredClone(s.institutions.find(i => i.kind === 'station'))); }],
];
for (const [name, mutate] of mutations) test(`${name} cannot become a verified personal job`, () => {
  const s = at20(), e = successor(s), a = s.history.find(h => h.id === e.sourceActionId), o = s.history.find(h => h.id === `resolved:${e.id}`);
  mutate(s, e, a, o);
  const before = structuredClone(s);
  assert.equal(sulanIdentity(s).kind, 'resident');
  assert.equal(sceneFor(s, 'D4').speaker, '苏岚 · 河港居民');
  assert.doesNotMatch(body(s), /苏岚同意接过测站维护/);
  assert.doesNotMatch(body(s, 'linche'), /苏岚同意接班后才入局/);
  assert.deepEqual(s, before);
});

test('missing carrier provenance preserves a recorded promise instead of calling the old job nonexistent', () => {
  const s = at20(); s.institutions.find(i => i.kind === 'station').sourceEventId = 'missing';
  assert.match(body(s), /继任合同仍保留着苏岚的同意.*来源缺失或不一致/);
  assert.doesNotMatch(body(s), /当时没有运转中的河港岗位/);
  next(s); next(s);
  assert.match(coda(s), /继任合同仍记录着苏岚的同意.*岗位来源缺失或不一致/);
});

for (const [name, options] of [
  ['unbuilt community warning', { build: null, choice: null }],
  ['reopened risky station', { choice: 'recruit_risk' }],
  ['warning beside a closed archive', { seed: 6, choice: 'recruit_risk' }],
  ['rebuilt station', { seed: 6, choice: 'restore_archive' }],
]) test(`${name} is community participation, not automatic appointment`, () => {
  const s = at20(options); lock(s, 'free_warning'); submit(s); sim.advanceYear(s);
  const before = structuredClone(s);
  assert.equal(sceneFor(s, 'D4').speaker, '苏岚 · 河港居民');
  assert.deepEqual(s, before);
  sim.advanceToNextWindow(s);
  assert.match(body(s), /苏岚愿意讨论下一次交班/);
  next(s);
  assert.match(coda(s), /苏岚与居民参与了免费预警和值班安排/);
  assert.doesNotMatch(coda(s), /她同意承担接班/);
});

test('a previously verified successor remains identifiable after warning repairs, without deleting the maintenance gap', () => {
  const s = at20(); assert.equal(s.flags.successor, true);
  lock(s, 'free_warning'); submit(s); sim.advanceYear(s);
  assert.equal(sulanIdentity(s).kind, 'station');
  assert.ok(s.history.some(h => h.id === 'charter-lapsed'));
});

for (const choice of ['present_archive', 'relocate_teacher']) test(`${choice} keeps the real personal decision despite contradictory flags`, () => {
  const s = at20(); lock(s, choice); submit(s); sim.advanceYear(s);
  Object.assign(s.flags, { respected: choice !== 'present_archive', forced: choice !== 'relocate_teacher', trust: choice === 'relocate_teacher' });
  if (choice === 'relocate_teacher') {
    assert.equal(sulanIdentity(s).kind, 'relocated');
    assert.match(body(s), /第21年的迁任已经把苏岚带到东岸/);
    assert.doesNotMatch(body(s), /苏岚站在停运告示旁/);
    assert.match(body(s), /同意接过测站维护/);
  } else assert.equal(sulanIdentity(s).kind, 'station');
  sim.advanceToNextWindow(s);
  assert.match(body(s), choice === 'relocate_teacher' ? /苏岚从东岸寄来的信/ : /苏岚自己写下的选择/);
  next(s);
  assert.match(coda(s), choice === 'relocate_teacher' ? /迁任命令把苏岚带到东岸/ : /保留了决定今天生活的权利/);
});

for (const choice of ['present_archive', 'relocate_teacher', 'free_warning']) test(`missing ${choice} outcome cannot be recreated from its global flags`, () => {
  const s = at30(choice, { build: null, choice: 'recruit_volunteer' });
  const e = s.events.find(e => e.actionId === choice);
  s.history = s.history.filter(h => h.id !== `resolved:${e.id}`);
  const before = structuredClone(s);
  assert.doesNotMatch(body(s), /苏岚从东岸寄来的信|苏岚自己写下的选择|苏岚愿意讨论下一次交班/);
  assert.deepEqual(s, before);
});

for (const api of [old, legacy]) {
  for (const [name, options, kind] of [
    ['real successor', {}, 'station'],
    ['real archive successor', { seed: 6 }, 'archive'],
    ['no-job old promise', { build: null }, 'resident'],
    ['anonymous rebuilding', { seed: 6, choice: 'restore_archive' }, 'resident'],
    ['Linche’s renewal', { choice: 'renew_charter' }, 'resident'],
  ]) test(`${api === old ? 'pre-recruitment' : 'original'} engine: ${name} keeps historical identity without upgrading contracts`, () => {
    const s = at20({ ...options, api }), before = structuredClone(s);
    assert.equal(sulanIdentity(s).kind, kind);
    sceneFor(s, 'D4'); evidenceFor(s, 'successor_consent');
    assert.deepEqual(s, before);
    if (name === 'no-job old promise') assert.match(body(s), /旧合同记录过苏岚的继任安排.*当时没有运转中的河港岗位/);
    next(s, api); next(s, api);
    const end = structuredClone(s), ending = api.getEnding(s);
    characterEpilogue(s);
    assert.deepEqual(s, end); assert.deepEqual(api.getEnding(s), ending);
  });
}

test('original no-carrier warning preserves its fulfilled agreement without inventing a present institution or job', () => {
  const s = at30('free_warning', { build: null, choice: null, api: legacy });
  assert.equal(s.institutions.length, 0);
  assert.match(body(s), /旧档保留了免费预警协议，却缺少当前载体的明细/);
  assert.equal(sulanIdentity(s).kind, 'resident');
  next(s, legacy); assert.match(coda(s), /参与了免费预警和值班安排/);
});

test('personal projections are read-only across routes, viewpoints, reload-like copies and ending scores', () => {
  for (const options of [{}, { seed: 6 }, { seed: 6, choice: 'restore_archive' }, { choice: 'renew_charter' }, { build: null, choice: 'recruit_volunteer' }]) {
    const s = at30('present_archive', options); next(s);
    const before = structuredClone(s), ending = sim.getEnding(s);
    for (let n = 0; n < 3; n++) {
      for (const actor of ['protagonist', 'linche']) sceneFor(s, 'D4', actor);
      sulanIdentity(s); characterEpilogue(s);
      assert.deepEqual(characterEpilogue(structuredClone(s)), characterEpilogue(s));
    }
    assert.deepEqual(s, before); assert.deepEqual(sim.getEnding(s), ending);
  }
});

for (const api of [old, legacy]) test('genuine older succession with a missing original carrier remains uncertain, not a no-job contract', () => {
  const s = at20({ api }); s.institutions = s.institutions.filter(i => i.kind !== 'station');
  assert.equal(sulanIdentity(s).kind, 'resident');
  assert.match(body(s), /岗位的来源缺失或不一致/);
  assert.doesNotMatch(body(s), /当时没有运转中的河港岗位/);
});
