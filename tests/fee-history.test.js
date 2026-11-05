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
import { getFeeHistory } from '../src/fee-history.js';
import { sceneFor, sulanIdentity } from '../src/story.js';

// Every historical fixture is an actual earlier engine, not a modern run with
// version markers deleted. Reading the annotation must not upgrade any of them.
const engines = { current, original, preTradeoffs, preHandoff, preAftermath, preRecruitment, preRecovery, prePort };
const rawText = '没有长期经费，继任者开始收费填补欠薪。测站仍运转，但并非所有人都收到预警。';
const body = s => sceneFor(s, 'D4').body.join('\n');
function lock(s, actionId, api = current, cellId = 'D4') {
  const action = api.getActions(s, cellId).find(a => a.id === actionId);
  assert.ok(action, `Expected ${actionId} at ${s.year}/${cellId}`);
  if (api.investigate) for (const id of action.requireEvidence) {
    if (!api.getInvestigation(s, 'protagonist', cellId).evidence.includes(id)) api.investigate(s, 'protagonist', cellId, id);
  }
  api.lockTask(s, 'protagonist', cellId, actionId, action.requireEvidence);
}
function submit(s, api = current) {
  for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id);
  api.commitWindow(s);
}
function next(s, api = current) { submit(s, api); api.advanceToNextWindow(s); return s; }
function at20({ api = current, seed = 1, build = 'build_merchant', choice = 'fund_school' } = {}) {
  const s = api.createRun(seed);
  if (build) lock(s, build, api);
  next(s, api);
  if (choice) lock(s, choice, api, choice === 'fund_school' ? 'E4' : 'D4');
  return next(s, api);
}
function parts(s) {
  const milestone = s.history.find(h => h.id === 'charter-lapsed');
  const event = s.events.find(e => e.id === milestone?.parentId);
  const action = s.history.find(h => h.id === event?.sourceActionId);
  const outcome = s.history.find(h => h.id === `resolved:${event?.id}`);
  const station = s.institutions.find(i => i.kind === 'station');
  return { milestone, event, action, outcome, station };
}
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}

test('seed1 merchant → E4 night school retains year2 fees and explains year16 maintenance separately', () => {
  const s = at20(), before = structuredClone(s), view = getFeeHistory(freeze(s));
  assert.equal(s.flags.recruited, undefined);
  assert.equal(view.status, 'merchant-retained');
  assert.deepEqual(view.origin, { kind: 'merchant', year: 2, recordId: 'resolved:event:action:0:protagonist:D4:build_merchant' });
  assert.match(view.summary, /第2年.*原本就有收费门槛/);
  assert.match(view.summary, /第16年.*经费缺口与维护下降.*不是首次开始收费/);
  assert.match(view.detail.join('\n'), /不能.*补出苏岚或另一位继任者/);
  assert.equal(view.original.text, rawText);
  assert.ok(view.detail.includes(view.summary));
  assert.equal(sceneFor(s, 'D4').speaker, '苏岚 · 河港居民');
  assert.ok(body(s).includes(view.summary));
  assert.doesNotMatch(body(s), /苏岚同意接过|继任者开始收费/);
  assert.deepEqual(s, before);
  for (const source of view.sources) {
    assert.deepEqual(source, s.history.find(h => h.id === source.id));
    assert.ok(current.traceEvent(s, source.id).length);
  }
  // Returned records must not expose writable aliases to frozen world data.
  view.sources[0].text = 'changed presentation copy';
  view.original.text = 'changed presentation copy';
  view.origin.year = 99;
  assert.deepEqual(s, before);
});

for (const build of ['build_joint', 'build_state']) test(`${build} distinguishes original public service from year16 restriction`, () => {
  const s = at20({ seed: 0, build }), before = structuredClone(s), view = getFeeHistory(s);
  assert.equal(view.status, 'public-restricted');
  assert.equal(view.origin.kind, build.slice(6));
  assert.equal(view.origin.year, 3);
  assert.match(view.summary, /第3年.*原本公开服务.*第16年.*服务转为收费/);
  assert.ok(body(s).includes(view.summary));
  assert.equal(sulanIdentity(s).kind, 'resident');
  assert.equal(view.original.text, rawText);
  assert.deepEqual(s, before);
});

test('rebuilding has its own year12 public origin without inheriting a failed merchant contract', () => {
  let seed = 0;
  while (current.randomFor(seed, 'event:action:0:protagonist:D4:build_merchant') < .85) seed++;
  const s = at20({ seed, choice: 'restore_archive' }), view = getFeeHistory(s);
  assert.equal(s.events.find(e => e.actionId === 'build_merchant').status, 'failed');
  assert.equal(view.status, 'public-restricted');
  assert.equal(view.origin.kind, 'rebuilt');
  assert.equal(view.origin.year, 12);
  assert.match(view.summary, /第12年.*重建测站原本公开服务/);
  assert.ok(view.sources.every(h => h.sourceActionId.endsWith(':restore_archive')));
  assert.equal(sulanIdentity(s).kind, 'resident');
  assert.match(body(s), /新的维护小组，没有指定苏岚接班/);
});

test('valid succession stays a separately sourced personal job, not a claim inferred from the fee milestone', () => {
  const s = at20({ choice: 'recruit_successor' }), before = structuredClone(s);
  assert.equal(getFeeHistory(s).status, 'merchant-retained');
  assert.equal(sulanIdentity(s).kind, 'station');
  assert.match(body(s), /苏岚同意接过测站维护/);
  assert.deepEqual(s, before);
  const recruit = s.events.find(e => e.actionId === 'recruit_successor');
  s.history = s.history.filter(h => h.id !== `resolved:${recruit.id}`);
  assert.equal(getFeeHistory(s).status, 'merchant-retained');
  assert.equal(sulanIdentity(s).kind, 'resident');
  assert.doesNotMatch(body(s), /苏岚同意接过测站维护/);
});

test('flags, present access and maintenance cannot supply or rewrite an original fee history', () => {
  const s = at20(), baseline = getFeeHistory(s);
  Object.assign(s.flags, { governance: 'joint', renewed: true, successor: true, recruited: true });
  Object.assign(parts(s).station, { open: true, maintenance: 1, active: false });
  assert.deepEqual(getFeeHistory(s), baseline);
  s.history = s.history.filter(h => h.id !== baseline.origin.recordId);
  assert.equal(getFeeHistory(s).status, 'unknown');
  assert.deepEqual(getFeeHistory(s).sources, []);
});

test('future, unbuilt, failed, unattended and genuinely renewed histories do not invent a year16 lapse', () => {
  const fresh = current.createRun(1);
  assert.equal(getFeeHistory(fresh), null);
  lock(fresh, 'build_merchant'); next(fresh); submit(fresh);
  while (fresh.year < 15) current.advanceYear(fresh);
  assert.equal(getFeeHistory(fresh), null);
  current.advanceYear(fresh);
  assert.equal(getFeeHistory(fresh).status, 'merchant-retained');
  for (const options of [
    { build: null }, { build: 'build_joint', seed: 6 },
    { choice: 'recruit_risk' }, { choice: 'renew_charter' },
  ]) {
    const s = at20(options), before = structuredClone(s);
    assert.equal(getFeeHistory(s), null);
    assert.doesNotMatch(body(s), /第16年的记录反映/);
    assert.deepEqual(s, before);
  }
  assert.equal(getFeeHistory(at20(), 'arrival'), null);
  assert.equal(getFeeHistory(at20(), 'crisis-impact'), null);
  assert.equal(getFeeHistory(null), null);
  assert.equal(getFeeHistory({ history: null }), null);
});

for (const actionId of ['free_warning', 'relocate_teacher', 'present_archive']) test(`${actionId} cannot rewrite earlier fees or year16 maintenance`, () => {
  const s = at20(), before = getFeeHistory(s);
  lock(s, actionId); submit(s); current.advanceYear(s);
  assert.deepEqual(getFeeHistory(s), before);
  if (actionId === 'free_warning') {
    assert.equal(parts(s).station.open, true);
    assert.equal(parts(s).station.maintenance, 1);
    assert.doesNotMatch(body(s), /收费牌也还挂着/);
  }
  if (actionId === 'relocate_teacher') {
    assert.equal(parts(s).station.active, false);
    assert.match(body(s), /她寄来的信/);
  }
  current.advanceToNextWindow(s); next(s);
  assert.deepEqual(getFeeHistory(s), before);
});

const mutations = [
  ['missing station', (s, p) => { s.institutions = s.institutions.filter(i => i !== p.station); }],
  ['wrong station kind', (s, p) => { p.station.kind = 'archive'; }],
  ['wrong station place', (s, p) => { p.station.cellId = 'F6'; }],
  ['wrong station id', (s, p) => { p.station.id += ':extra'; }],
  ['wrong station event', (s, p) => { p.station.sourceEventId = 'missing'; }],
  ['wrong station action', (s, p) => { p.station.sourceActionId = 'missing'; }],
  ['wrong station date', (s, p) => { p.station.startYear = 3; }],
  ['duplicate station', (s, p) => { s.institutions.push(structuredClone(p.station)); }],
  ['duplicate origin carrier', (s, p) => { s.institutions.push({ ...p.station, id: 'another-station' }); }],
  ['missing event', (s, p) => { s.events = s.events.filter(e => e !== p.event); }],
  ['pending event', (s, p) => { p.event.status = 'pending'; }],
  ['failed event', (s, p) => { p.event.status = 'failed'; }],
  ['cancelled event', (s, p) => { p.event.status = 'cancelled'; }],
  ['wrong event kind', (s, p) => { p.event.kind = 'outcome'; }],
  ['wrong event id', (s, p) => { p.event.id += ':extra'; }],
  ['wrong event action', (s, p) => { p.event.actionId = 'build_joint'; }],
  ['inherited event action key', (s, p) => { p.event.actionId = '__proto__'; }],
  ['object prototype event action key', (s, p) => { p.event.actionId = 'toString'; }],
  ['wrong event place', (s, p) => { p.event.cellId = 'F6'; }],
  ['wrong event year', (s, p) => { p.event.year = p.event.resolvedYear = 3; }],
  ['wrong event resolution', (s, p) => { p.event.resolvedYear = 16; }],
  ['missing resolution date', (s, p) => { delete p.event.resolvedYear; }],
  ['wrong event parent', (s, p) => { p.event.parentId = 'arrival'; }],
  ['wrong event source', (s, p) => { p.event.sourceActionId = 'missing'; }],
  ['wrong event actor', (s, p) => { p.event.actorId = 'linche'; }],
  ['wrong event reality', (s, p) => { p.event.reality = 'R0'; }],
  ['duplicate event', (s, p) => { s.events.push(structuredClone(p.event)); }],
  ['event-history id collision', (s, p) => { s.history.push(structuredClone(p.event)); }],
  ['missing action', (s, p) => { s.history = s.history.filter(h => h !== p.action); }],
  ['wrong action kind', (s, p) => { p.action.kind = 'outcome'; }],
  ['wrong action year', (s, p) => { p.action.year = 10; }],
  ['wrong action status', (s, p) => { p.action.status = 'pending'; }],
  ['wrong action place', (s, p) => { p.action.cellId = 'E4'; }],
  ['wrong action source', (s, p) => { p.action.sourceActionId = 'missing'; }],
  ['wrong action parent', (s, p) => { p.action.parentId = 'arrival'; }],
  ['wrong action actor', (s, p) => { p.action.actorId = 'linche'; }],
  ['wrong action identity', (s, p) => { p.action.actionId = 'build_state'; }],
  ['wrong action reality', (s, p) => { p.action.reality = 'R0'; }],
  ['wrong action evidence type', (s, p) => { p.action.evidence = ''; }],
  ['duplicate action', (s, p) => { s.history.push(structuredClone(p.action)); }],
  ['action-event id collision', (s, p) => { s.events.push(structuredClone(p.action)); }],
  ['conflicting same-window action', s => { s.history.push({ kind: 'action', id: 'action:0:protagonist:B4:preserve_records' }); }],
  ['conflicting same-window pass', s => { s.history.push({ kind: 'pass', id: 'pass:0:protagonist' }); }],
  ['missing outcome', (s, p) => { s.history = s.history.filter(h => h !== p.outcome); }],
  ['wrong outcome kind', (s, p) => { p.outcome.kind = 'failure'; }],
  ['wrong outcome status', (s, p) => { p.outcome.status = 'failed'; }],
  ['wrong outcome year', (s, p) => { p.outcome.year = 3; }],
  ['wrong outcome place', (s, p) => { p.outcome.cellId = 'F6'; }],
  ['wrong outcome parent', (s, p) => { p.outcome.parentId = 'arrival'; }],
  ['wrong outcome source', (s, p) => { p.outcome.sourceActionId = 'missing'; }],
  ['wrong outcome actor', (s, p) => { p.outcome.actorId = 'linche'; }],
  ['wrong outcome reality', (s, p) => { p.outcome.reality = 'R0'; }],
  ['duplicate outcome', (s, p) => { s.history.push(structuredClone(p.outcome)); }],
  ['missing protagonist', s => { s.actors = []; }],
  ['unavailable protagonist', s => { s.actors[0].availableFrom = 10; }],
  ['duplicate protagonist', s => { s.actors.push(structuredClone(s.actors[0])); }],
  ['wrong milestone kind', (s, p) => { p.milestone.kind = 'outcome'; }],
  ['wrong milestone year', (s, p) => { p.milestone.year = 15; }],
  ['wrong milestone place', (s, p) => { p.milestone.cellId = 'F6'; }],
  ['wrong milestone parent', (s, p) => { p.milestone.parentId = 'missing'; }],
  ['wrong milestone source', (s, p) => { p.milestone.sourceActionId = p.action.id; }],
  ['wrong milestone status', (s, p) => { p.milestone.status = 'pending'; }],
  ['wrong milestone reality', (s, p) => { p.milestone.reality = 'R0'; }],
  ['duplicate milestone', (s, p) => { s.history.push(structuredClone(p.milestone)); }],
  ['milestone-event id collision', (s, p) => { s.events.push(structuredClone(p.milestone)); }],
  ['future milestone', s => { s.year = 15; }],
];
for (const [label, mutate] of mutations) test(`${label} leaves fee provenance unknown without repair or invented links`, () => {
  const s = at20(); mutate(s, parts(s));
  const before = structuredClone(s), view = getFeeHistory(freeze(s));
  assert.equal(view.status, 'unknown');
  assert.equal(view.origin, null);
  assert.deepEqual(view.sources, []);
  assert.match(view.summary, /未知/);
  assert.doesNotMatch(view.summary, /原本就有收费门槛|原本公开服务/);
  assert.deepEqual(s, before);
});

for (const location of ['action', 'event']) test(`joint public provenance requires its actual ${location} evidence, not a string or a flag`, () => {
  for (const evidence of [[], 'independent_flood_records,unfunded_maintenance']) {
    const s = at20({ seed: 0, build: 'build_joint' }); parts(s)[location].evidence = evidence;
    assert.equal(getFeeHistory(s).status, 'unknown');
  }
});

test('a lapse conflicting with an actually fulfilled renewal stays uncertain, rather than blaming renewal', () => {
  const lapsed = at20(), renewed = at20({ choice: 'renew_charter' });
  renewed.history.push(structuredClone(parts(lapsed).milestone));
  const before = structuredClone(renewed), view = getFeeHistory(renewed);
  assert.equal(view.status, 'unknown');
  assert.match(view.summary, /已兑现的公开续约来源不一致/);
  assert.deepEqual(view.sources, []);
  assert.deepEqual(renewed, before);
});

for (const [name, api] of Object.entries(engines)) {
  test(`${name}: true engine histories preserve original records and fee timing across routes and JSON round trips`, () => {
    for (const build of ['build_merchant', 'build_state', 'build_joint']) {
      for (const choice of ['fund_school', null, 'recruit_successor', 'recruit_risk', 'renew_charter']) {
        const s = at20({ api, seed: 1, build, choice }), before = structuredClone(s);
        const view = getFeeHistory(s);
        if (['renew_charter', 'recruit_risk'].includes(choice)) {
          assert.equal(view, null, `${build}/${choice}`);
          if (choice === 'renew_charter') assert.equal(parts(s).station.maintenance, 1);
        } else {
          assert.equal(view.status, build === 'build_merchant' ? 'merchant-retained' : 'public-restricted', `${build}/${choice}`);
          assert.equal(view.origin.year, build === 'build_merchant' ? 2 : 3);
          assert.equal(view.original.text, rawText);
          assert.equal(sulanIdentity(s).kind, choice === 'recruit_successor' ? 'station' : 'resident');
        }
        assert.deepEqual(getFeeHistory(JSON.parse(JSON.stringify(s))), view);
        sceneFor(s, 'D4');
        assert.deepEqual(s, before);
        const expected = structuredClone(s);
        next(s, api); getFeeHistory(s); next(s, api); getFeeHistory(s);
        next(expected, api); next(expected, api);
        assert.deepEqual(s, expected);
        assert.deepEqual(api.getEnding(s), api.getEnding(expected));
      }
    }
  });
  test(`${name}: true older missing source remains unknown without migration`, () => {
    const s = at20({ api });
    const outcomeId = parts(s).outcome.id;
    s.history = s.history.filter(h => h.id !== outcomeId);
    const before = structuredClone(s);
    assert.equal(getFeeHistory(s).status, 'unknown');
    assert.deepEqual(getFeeHistory(s).sources, []);
    assert.deepEqual(s, before);
  });
}

test('the original engine’s renewed merchant station is not silently reopened by annotation or dialogue', () => {
  const s = at20({ api: original, choice: 'renew_charter' }), before = structuredClone(s);
  assert.equal(parts(s).station.open, false);
  assert.equal(parts(s).station.maintenance, 1);
  assert.equal(getFeeHistory(s), null);
  assert.doesNotMatch(body(s), /第16年的记录反映|维护经费不足/);
  assert.match(body(s), /收费牌也还挂着/);
  assert.deepEqual(s, before);
});
