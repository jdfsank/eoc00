import test from 'node:test';
import assert from 'node:assert/strict';
import * as current from '../src/simulation.js';
import * as original from './fixtures/legacy-simulation.js';
import * as preTradeoffs from './fixtures/pre-tradeoffs-simulation.js';
import * as preHandoff from './fixtures/pre-handoff-simulation.js';
import * as preAftermath from './fixtures/pre-aftermath-simulation.js';
import * as preRecruitment from './fixtures/pre-recruitment-simulation.js';
import * as preStaffing from './fixtures/pre-staffing-simulation.js';
import * as preRecovery from './fixtures/pre-recovery-simulation.js';
import * as prePort from './fixtures/pre-port-access-simulation.js';
import { characterEpilogue } from '../src/story.js';

const engines = { current, original, preTradeoffs, preHandoff, preAftermath, preRecruitment, preStaffing, preRecovery, prePort };
function lock(s, actionId, api = current, cellId = 'D4', actorId = 'protagonist') {
  const action = api.getActions(s, cellId, actorId).find(a => a.id === actionId);
  assert.ok(action, `${actionId} is available at ${s.year}`);
  if (api.investigate) for (const evidence of action.requireEvidence) {
    if (!api.getInvestigation(s, actorId, cellId).evidence.includes(evidence)) api.investigate(s, actorId, cellId, evidence);
  }
  api.lockTask(s, actorId, cellId, actionId, action.requireEvidence);
}
function next(s, api = current) {
  for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id);
  api.commitWindow(s); api.advanceToNextWindow(s); return s;
}
function route({ api = current, seed = 12, build = 'build_joint', choice = 'renew_charter', later = 'present_archive' } = {}) {
  const s = api.createRun(seed);
  if (build) lock(s, build, api); next(s, api);
  if (choice) lock(s, choice, api); next(s, api);
  if (later) lock(s, later, api); next(s, api); next(s, api);
  return s;
}
const coda = s => characterEpilogue(s).find(person => person.name === '林澈');
const body = s => coda(s).paragraphs.join('\n');
const copy = s => structuredClone(s);
function freeze(s) { if (s && typeof s === 'object') { Object.values(s).forEach(freeze); Object.freeze(s); } return s; }
function eventParts(s, actionId) {
  const event = s.events.find(e => e.actionId === actionId);
  return { event, action: s.history.find(h => h.id === event?.sourceActionId), outcome: s.history.find(h => h.id === `resolved:${event?.id}`) };
}

for (const [label, api] of Object.entries(engines)) {
  test(`${label}: staying with a renewed station and later forced shutdown have distinct truthful codas`, () => {
    const stayed = route({ api }), stopped = route({ api, later: 'relocate_teacher' });
    for (const s of [stayed, stopped]) {
      assert.equal(s.actors.some(actor => actor.id === 'linche'), false);
      assert.match(body(s), /第11年的章程.*林澈愿意带教/);
      assert.match(body(s), /没有期限的劳动承诺/);
      assert.doesNotMatch(body(s), /林澈原谅|林澈仍在值班|苏岚同意接班后离开|第16年的停运告示/);
    }
    assert.match(body(stayed), /第40年，河港测站仍在运转，基本预警向不缴费家庭开放/);
    assert.match(body(stopped), /第40年，河港测站已没有有效运转/);
    assert.match(body(stopped), /第21年迁任兑现.*河港测站.*停用范围/);
    assert.match(body(stopped), /停用属于第21年由主角执行的迁任合同的制度后果/);
    assert.match(body(stopped), /具体维护中断过程没有记载/);
    assert.notDeepEqual(coda(stayed), coda(stopped));
    for (const s of [stayed, stopped]) {
      const before = copy(s), ending = api.getEnding(s), currentEnding = current.getEnding(s);
      const view = coda(freeze(s));
      assert.deepEqual(coda(JSON.parse(JSON.stringify(s))), view);
      for (const id of view.sources) {
        assert.equal(s.history.filter(h => h.id === id).length, 1, id);
        assert.equal(s.events.some(e => e.id === id), false, id);
        assert.ok(current.traceEvent(s, id).length, id);
      }
      assert.deepEqual(s, before);
      assert.deepEqual(api.getEnding(s), ending); assert.deepEqual(current.getEnding(s), currentEnding);
    }
  });
  test(`${label}: restoration of access preserves fee16 and never assigns anonymous rebuilding to a person`, () => {
    const fee = route({ api, seed: 1, build: 'build_merchant', choice: null, later: null });
    const repaired = route({ api, seed: 1, build: 'build_merchant', choice: null, later: 'free_warning' });
    const rebuilt = route({ api, build: null, choice: 'restore_archive', later: 'relocate_teacher' });
    assert.match(body(fee), /基本预警仍有收费门槛.*维护仍有缺口/);
    assert.match(body(fee), /第2年启用的商会测站原本就有收费门槛.*第16年/);
    assert.match(body(repaired), /第40年.*基本预警向不缴费家庭开放/);
    assert.match(body(repaired), /第21年的免费预警协议另行补足/);
    assert.match(body(repaired), /第16年的经费缺口仍留在原页/);
    assert.doesNotMatch(body(repaired), /恢复公开服务/);
    assert.match(body(rebuilt), /第12年重建.*新的维护小组，没有给这组人署上林澈或苏岚的姓名/);
    assert.match(body(rebuilt), /第21年迁任兑现/);
    assert.doesNotMatch(body(rebuilt), /林澈愿意带教|苏岚同意接班/);
    for (const s of [fee, repaired, rebuilt]) {
      const before = copy(s), ending = api.getEnding(s), currentEnding = current.getEnding(s); coda(freeze(s));
      assert.deepEqual(s, before); assert.deepEqual(api.getEnding(s), ending); assert.deepEqual(current.getEnding(s), currentEnding);
    }
  });
}

test('an original renewed merchant station stays paid; its later opening is a distinct recorded contract', () => {
  const paid = route({ api: original, seed: 1, build: 'build_merchant' });
  const opened = route({ api: original, seed: 1, build: 'build_merchant', later: 'free_warning' });
  assert.match(body(paid), /第11年的章程.*林澈愿意带教/);
  assert.match(body(paid), /第40年.*基本预警仍有收费门槛/);
  assert.match(body(opened), /第40年.*基本预警向不缴费家庭开放/);
  assert.match(body(opened), /第21年的免费预警协议/);
  assert.doesNotMatch(body(opened), /第16年的经费缺口/);
  assert.equal(paid.history.some(h => h.id === 'charter-lapsed'), false);
});

test('a failed build remains an archive and a new resident team is not Linche’s water station', () => {
  const s = route({ seed: 6, choice: null, later: 'free_warning' }), before = copy(s);
  assert.match(body(s), /建站未成.*小型档案站/);
  assert.match(body(s), /第21年另建的居民传讯队目前仍在服务/);
  assert.match(body(s), /不能把居民轮值署作林澈个人的工作/);
  assert.doesNotMatch(body(s), /第40年，河港测站仍在运转/);
  assert.deepEqual(s, before);
  const old = route({ api: original, seed: 6, choice: null, later: 'free_warning' });
  assert.match(body(old), /没有可核实的新传讯队来源/);
  assert.doesNotMatch(body(old), /另建的居民传讯队目前仍在服务/);
});

const corruptions = [
  ['missing event', (s, p) => { s.events = s.events.filter(e => e !== p.event); }],
  ['missing action', (s, p) => { s.history = s.history.filter(h => h !== p.action); }],
  ['missing outcome', (s, p) => { s.history = s.history.filter(h => h !== p.outcome); }],
  ['failed status', (s, p) => { p.event.status = 'failed'; }],
  ['pending status', (s, p) => { p.event.status = 'pending'; }],
  ['wrong event date', (s, p) => { p.event.resolvedYear += 1; }],
  ['wrong action year', (s, p) => { p.action.year += 1; }],
  ['wrong action actor', (s, p) => { p.action.actorId = 'linche'; }],
  ['wrong outcome reality', (s, p) => { p.outcome.reality = 'R0'; }],
  ['wrong outcome cell', (s, p) => { p.outcome.cellId = 'E4'; }],
  ['wrong event parent', (s, p) => { p.event.parentId = 'arrival'; }],
  ['wrong action identity', (s, p) => { p.action.actionId = 'build_state'; }],
  ['string evidence', (s, p) => { p.action.evidence = ''; }],
  ['duplicate event', (s, p) => { s.events.push(copy(p.event)); }],
  ['duplicate action', (s, p) => { s.history.push(copy(p.action)); }],
  ['duplicate outcome', (s, p) => { s.history.push(copy(p.outcome)); }],
  ['event history collision', (s, p) => { s.history.push(copy(p.event)); }],
  ['action event collision', (s, p) => { s.events.push(copy(p.action)); }],
  ['outcome event collision', (s, p) => { s.events.push(copy(p.outcome)); }],
  ['conflicting pass', (s, p) => { s.history.push({ id: `pass:${p.action.year}:protagonist`, kind: 'pass' }); }],
  ['duplicate actor', s => { s.actors.push(copy(s.actors[0])); }],
];
for (const [label, mutate] of corruptions) {
  test(`${label}: renewal does not establish an unverified personal stay`, () => {
    const s = route(); mutate(s, eventParts(s, 'renew_charter')); const before = copy(s);
    assert.doesNotMatch(body(freeze(s)), /章程留下林澈愿意带教|第11年留下带教的约定/);
    assert.match(body(s), /是否完成续约仍未知/);
    assert.deepEqual(s, before);
  });
  test(`${label}: relocation does not establish an unverified reason for shutdown`, () => {
    const s = route({ later: 'relocate_teacher' }); mutate(s, eventParts(s, 'relocate_teacher')); const before = copy(s);
    assert.doesNotMatch(body(freeze(s)), /第21年迁任兑现|停用属于第21年由主角执行的迁任合同的制度后果/);
    assert.match(body(s), /缺少|缺失|不一致|未知/);
    assert.deepEqual(s, before);
  });
}

test('missing or colliding institution provenance is unknown rather than a fabricated continuing job', () => {
  for (const mutate of [
    s => { s.history = s.history.filter(h => h.id !== eventParts(s, 'build_joint').outcome.id); },
    s => { s.events.push(copy(eventParts(s, 'build_joint').action)); },
    s => { s.institutions = s.institutions.filter(i => i.cellId !== 'D4'); },
    s => { s.institutions.push(copy(s.institutions.find(i => i.cellId === 'D4'))); },
    s => { const i = s.institutions.find(i => i.cellId === 'D4'); s.institutions.push({ ...i, id: 'other' }); },
    s => { s.institutions.find(i => i.cellId === 'D4').startYear = 7; },
  ]) {
    const s = route(); mutate(s); const before = copy(s);
    assert.match(body(freeze(s)), /建成来源缺失或不一致.*未知/);
    assert.doesNotMatch(body(s), /第40年，河港测站仍在运转/);
    assert.deepEqual(s, before);
  }
});

test('flags and an unexplained closure cannot invent a relocation or Linche’s departure', () => {
  const s = route(); s.flags.forced = true; s.flags.recruited = true;
  s.institutions.find(i => i.cellId === 'D4').active = false;
  assert.match(body(s), /第40年.*已没有有效运转/);
  assert.match(body(s), /停运原因缺少可核实/);
  assert.doesNotMatch(body(s), /第21年迁任兑现|林澈入局时留下/);
});

test('the existing recruited11/16 shutdown and21 repair history remains intact', () => {
  for (const api of [current, preRecruitment, original]) {
    const s = route({ api, choice: 'recruit_risk', later: 'free_warning' });
    assert.match(body(s), /第11年，林澈入局时/);
    assert.match(body(s), /第16年的停运告示/);
    assert.match(body(s), /第21年.*补足河港维护/);
    assert.match(body(s), /恢复不等于从未停过/);
    assert.doesNotMatch(body(s), /第11年留下带教的约定/);
  }
});

for (const [label, mutate] of corruptions) test(`${label}: current open access does not prove a missing restoration contract`, () => {
  const s = route({ seed: 1, build: 'build_merchant', choice: null, later: 'free_warning' });
  mutate(s, eventParts(s, 'free_warning')); const before = copy(s);
  assert.doesNotMatch(body(freeze(s)), /第21年的免费预警协议另行补足/);
  assert.match(body(s), /免费预警协议的行动或兑现来源缺失或不一致/);
  assert.ok(!coda(s).sources.includes('resolved:event:action:20:protagonist:D4:free_warning'));
  assert.deepEqual(s, before);
});

test('malformed current institution fields remain unknown rather than open or closed service', () => {
  for (const [key, value] of [['active', 'true'], ['open', null], ['maintenance', NaN], ['maintenance', 2]]) {
    const s = route(); s.institutions.find(i => i.cellId === 'D4')[key] = value; const before = copy(s);
    assert.match(body(freeze(s)), /第40年，河港测站的运行或准入记录不完整，当前服务状态未知/);
    assert.doesNotMatch(body(s), /第40年，河港测站仍在运转|第40年，河港测站已没有有效运转/);
    assert.deepEqual(s, before);
  }
});
