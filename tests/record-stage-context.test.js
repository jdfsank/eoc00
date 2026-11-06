import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import * as prior from './fixtures/pre-future-check-simulation.js';
import { getRecordStageContext as stage } from '../src/record-stage-context.js';
function submit(api, s, tasks = []) {
  for (const [actor, cell, id] of tasks) {
    const action = api.getActions(s, cell, actor).find(a => a.id === id);
    assert.ok(action, `${s.year}/${id}`);
    if (api.usesTradeoffs?.(s)) for (const evidence of action.requireEvidence)
      if (!api.getInvestigation(s, actor, cell).evidence.includes(evidence)) api.investigate(s, actor, cell, evidence);
    api.lockTask(s, actor, cell, id, action.requireEvidence);
  }
  for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id);
  api.commitWindow(s);
}
function until(api, s, year) {
  while (s.year < year) { if (s.phase === 'planning') submit(api, s); api.advanceYear(s); }
  return s;
}
function build(api = sim, success = true, year = 12) {
  for (let seed = 0; seed < 100; seed++) {
    const s = api.createRun(seed); submit(api, s, [['protagonist', 'D4', 'build_merchant']]);
    until(api, s, 3);
    if (s.events[0].status === (success ? 'success' : 'failed')) return until(api, s, year);
  }
  assert.fail('No natural route');
}
const root = s => s.events[0];
const result = (s, event) => s.history.find(h => h.id === `resolved:${event.id}`);
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
for (const [name, api] of [['current', sim], ['legacy', legacy], ['pre-future-check', prior]]) {
  test(`${name}: actual source, root, child training and branch have distinct stages without mutation`, () => {
    const s = build(api), before = JSON.stringify(s); freeze(s);
    const action = s.history.find(h => h.kind === 'action');
    assert.equal(stage(s, structuredClone(action)).kind, 'submitted');
    assert.match(stage(s, action).note, /第0年/);
    for (const event of s.events) {
      assert.equal(stage(s, structuredClone(event)).kind, 'scheduled');
      assert.equal(stage(s, result(s, event)).kind, 'success');
    }
    assert.ok(s.events.some(e => e.actionId === 'training'));
    assert.ok(s.events.some(e => e.actionId === 'branch'));
    assert.equal(JSON.stringify(s), before);
  });
  test(`${name}: natural failure is not success`, () => {
    const s = build(api, false);
    assert.equal(stage(s, root(s)).kind, 'scheduled');
    assert.equal(stage(s, result(s, root(s))).kind, 'failed');
  });
}
test('pending year-zero root and already public future training appointment do not imply success', () => {
  const s = sim.createRun(0); submit(sim, s, [['protagonist', 'D4', 'build_merchant']]);
  assert.equal(stage(s, root(s)).kind, 'scheduled');
  assert.equal(stage(s, { id: `resolved:${root(s).id}` }), null);
  const chain = build(sim, true, 3), training = chain.events.find(e => e.actionId === 'training');
  assert.ok(training.year > chain.year);
  assert.equal(stage(chain, training).kind, 'scheduled');
});
test('actual year10,20,30 sources and natural year34 cancellation remain separate', () => {
  const s = sim.createRun(0);
  submit(sim, s); sim.advanceToNextWindow(s);
  submit(sim, s, [['protagonist', 'D4', 'recruit_volunteer']]); sim.advanceToNextWindow(s);
  submit(sim, s, [['protagonist', 'B4', 'local_veto']]); sim.advanceToNextWindow(s);
  submit(sim, s, [['linche', 'B4', 'establish_future_check'], ['protagonist', 'D4', 'withdraw']]);
  const e = s.events.find(e => e.actionId === 'establish_future_check');
  assert.equal(stage(s, e).kind, 'scheduled'); until(sim, s, 34);
  assert.equal(e.status, 'cancelled');
  assert.equal(stage(s, result(s, e)).kind, 'cancelled');
  for (const h of s.history.filter(h => h.kind === 'action')) assert.equal(stage(s, h).kind, 'submitted');
});
test('inconsistent, foreign, duplicate, cyclic, wrong-year and missing-result chains are refused', () => {
  const baseline = build();
  const mutations = [
    s => { root(s).parentId = root(s).id; },
    s => { root(s).sourceActionId += ':foreign'; },
    s => { root(s).resolvedYear++; },
    s => { root(s).status = 'pending'; },
    s => { root(s).year = 0; },
    s => { root(s).year = '2'; },
    s => { s.events.push(structuredClone(root(s))); },
    s => { const h = result(s, root(s)); s.history.push(structuredClone(h)); },
    s => { result(s, root(s)).parentId = 'foreign'; },
    s => { result(s, root(s)).status = 'failed'; },
    s => { result(s, root(s)).kind = 'failure'; },
    s => { result(s, root(s)).cellId = 'E4'; },
    s => { result(s, root(s)).year = 40; },
    s => { s.history = s.history.filter(h => h !== result(s, root(s))); },
    s => { s.history.find(h => h.kind === 'action').year = 10; },
  ];
  for (const mutate of mutations) { const s = structuredClone(baseline); mutate(s); assert.equal(stage(s, root(s)), null); }
  const changed = structuredClone(root(baseline)); changed.status = 'failed';
  assert.equal(stage(baseline, changed), null);
  const child = structuredClone(baseline); child.events.find(e => e.actionId === 'training').parentId = root(child).sourceActionId;
  assert.equal(stage(child, child.events.find(e => e.actionId === 'branch')), null);
});
test('private fields, prose and future outcomes are never evaluated', () => {
  const s = build(), fail = () => { throw new Error('private field read'); };
  for (const key of ['seed', 'snapshots', 'baseline', 'flags', 'institutions', 'actors', 'rng']) Object.defineProperty(s, key, { get: fail });
  for (const row of [...s.history, ...s.events]) for (const key of ['roll', 'probability', 'text', 'title']) Object.defineProperty(row, key, { get: fail });
  for (const e of s.events) { assert.equal(stage(s, e).kind, 'scheduled'); assert.equal(stage(s, result(s, e)).kind, 'success'); }
  const pending = sim.createRun(0); submit(sim, pending, [['protagonist', 'D4', 'build_merchant']]);
  pending.history.push({ id: `resolved:${root(pending).id}`, year: 2, get status() { return fail(); }, get text() { return fail(); } });
  assert.equal(stage(pending, root(pending)), null);
});
test('child dates, statuses, identities and parent success must be consistent', () => {
  const baseline = build();
  for (const mutate of [
    (s, e) => { e.year = 8; },
    (s, e) => { e.actionId = 'branch'; },
    (s, e) => { e.cellId = 'D5'; },
    (s, e) => { e.sourceActionId = 'action:0:other:D4:build_merchant'; },
    (s, e) => { e.status = 'failed'; },
    (s, e) => { e.parentId = e.id; },
    (s, e) => { s.events.push(structuredClone(e)); },
    (s, e) => { root(s).status = 'failed'; const h = result(s, root(s)); h.status = 'failed'; h.kind = 'failure'; },
    s => { s.year = 6; },
  ]) {
    const s = structuredClone(baseline), e = s.events.find(e => e.actionId === 'training'); mutate(s, e);
    assert.equal(stage(s, e), null);
    assert.equal(stage(s, s.events.find(e => e.actionId === 'branch')), null);
  }
});
test('unknown records and invalid dates do not receive invented stages', () => {
  const s = build();
  for (const record of [null, {}, { id: 'foreign' }, s.history.find(h => h.kind !== 'action' && h.kind !== 'outcome')]) assert.equal(stage(s, record), null);
  for (const date of [-1, 41, NaN, '12', null]) assert.equal(stage({ ...s, year: date }, root(s)), null);
  assert.equal(stage({ year: 0 }, {}), null);
  const pending = sim.createRun(0); submit(sim, pending, [['protagonist', 'D4', 'build_merchant']]);
  const before = JSON.stringify(pending); freeze(pending);
  for (const row of [...pending.history, ...pending.events]) stage(pending, row);
  assert.equal(JSON.stringify(pending), before);
});
