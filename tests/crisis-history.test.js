import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import { getCrisisHistory } from '../src/crisis-history.js';
import { investigateAndLock as lock } from './helpers/play.js';

function submit(state, api = sim) {
  for (const actor of api.getActors(state)) if (!state.drafts[actor.id]) api.passTask(state, actor.id);
  api.commitWindow(state);
}
function decade(state, api = sim) { submit(state, api); api.advanceToNextWindow(state); }
function advance(state, year, api = sim) { while (state.year < year) api.advanceYear(state); }
function builtAt20() {
  const state = sim.createRun(12);
  lock(state, 'protagonist', 'D4', 'build_joint'); decade(state);
  lock(state, 'protagonist', 'D4', 'renew_charter'); decade(state);
  assert.equal(state.events.find(event => event.actionId === 'branch').status, 'success');
  return state;
}
function reviewedAt23() {
  const state = builtAt20();
  lock(state, 'protagonist', 'F6', 'independent_review'); submit(state); advance(state, 23);
  assert.equal(state.flags.crisis.damage, 0);
  return state;
}
function twoActors(seed = 12) {
  const state = sim.createRun(seed); decade(state);
  lock(state, 'protagonist', 'D4', 'recruit_volunteer'); decade(state);
  return state;
}
const text = view => [view.explanation, ...view.detail, ...view.responses.map(response => response.note)].join('\n');
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}
function assertLinks(state, view) {
  for (const record of [...view.discovery, ...view.responses.flatMap(response => response.chain), ...(view.impact ? [view.impact] : [])]) {
    assert.deepEqual(record, state.history.find(item => item.id === record.id));
    assert.ok(sim.traceEvent(state, record.id).length);
  }
  for (const response of view.responses) {
    assert.ok(state.events.some(event => event.id === response.eventId));
    assert.equal(response.recordId, response.chain.at(-1).id);
    assert.ok(state.history.some(record => record.id === response.recordId));
  }
}

test('natural build, discovery and successful review are separate from the independent crisis', () => {
  const state = reviewedAt23(), view = getCrisisHistory(state, 'crisis-impact');
  assert.match(view.explanation, /独立于玩家建站/);
  assert.match(view.explanation, /不建站也会/);
  assert.deepEqual(view.discovery.map(record => record.id), [
    'action:0:protagonist:D4:build_joint',
    'resolved:event:action:0:protagonist:D4:build_joint',
    'resolved:event:action:0:protagonist:D4:build_joint:training',
    'resolved:event:action:0:protagonist:D4:build_joint:training:branch',
    'crisis-warning',
  ]);
  const review = sim.fulfilledEvent(state, 'independent_review');
  assert.equal(view.responses.length, 1);
  assert.equal(view.responses[0].eventId, review.id);
  assert.equal(view.responses[0].recordId, `resolved:${review.id}`);
  assert.equal(view.responses[0].status, 'success');
  assert.equal(view.responses[0].chain[0].year, 20);
  assert.equal(view.responses[0].chain[1].year, 22);
  assert.match(view.responses[0].note, /修正共同标准偏差/);
  assert.equal(view.impact.id, 'crisis-impact');
  assert.match(text(view), /第23年 D4：已存覆盖系数1.00；已存损失系数0.00/);
  assertLinks(state, view);

  const passed = sim.createRun(12); decade(passed); decade(passed); submit(passed); advance(passed, 23);
  const control = getCrisisHistory(passed, 'crisis-impact');
  assert.deepEqual(control.discovery.map(record => record.id), ['crisis-warning']);
  assert.equal(control.responses.length, 0);
  assert.equal(passed.flags.crisis.damage, 1);
  assert.equal(control.explanation, view.explanation);
  assert.match(text(control), /已存损失系数1.00/);
  assertLinks(passed, control);
});

test('ordinary event traces remain ordinary; descendants of the crisis use the crisis view', () => {
  const state = reviewedAt23();
  for (const id of ['arrival', 'missing', state.events[0].id, state.history.find(record => record.kind === 'action').id]) {
    assert.equal(getCrisisHistory(state, id), null);
  }
  assert.ok(getCrisisHistory(state, 'crisis-warning'));
  state.history.push({ id: 'later-report', parentId: 'crisis-impact', year: 23, kind: 'history' });
  assert.ok(getCrisisHistory(state, 'later-report'));
  state.history.push({ id: 'unrelated-cycle', parentId: 'unrelated-cycle' });
  assert.equal(getCrisisHistory(state, 'unrelated-cycle'), null);
});

test('cancelled, failed, late, incomplete or unrelated branch links do not prove a discovery channel', () => {
  const state = sim.createRun(12);
  lock(state, 'protagonist', 'D4', 'build_joint'); decade(state);
  state.institutions.find(item => item.kind === 'training' && item.cellId === 'E4').active = false;
  decade(state);
  assert.equal(state.events.find(event => event.actionId === 'branch').status, 'cancelled');
  const cancelled = getCrisisHistory(state, 'crisis-warning');
  assert.deepEqual(cancelled.discovery.map(record => record.id), ['crisis-warning']);
  assert.match(text(cancelled), /不能把失败、取消或缺失的分站/);

  const original = builtAt20();
  const changes = [
    state => { state.events.find(event => event.actionId === 'branch').status = 'failed'; },
    state => { state.events.find(event => event.actionId === 'branch').resolvedYear = 15; },
    state => { state.events.find(event => event.actionId === 'branch').sourceActionId = 'other'; },
    state => { state.events.find(event => event.actionId === 'training').cellId = 'F6'; },
    state => { state.history = state.history.filter(record => !record.id.endsWith(':branch')); },
    state => { state.history.find(record => record.id === 'crisis-warning').parentId = state.events[0].id; },
  ];
  for (const change of changes) {
    const altered = structuredClone(original); change(altered);
    assert.deepEqual(getCrisisHistory(altered, 'crisis-warning').discovery.map(record => record.id), ['crisis-warning']);
  }
});

test('paid pending review remains a commitment, then the actual year22 outcome appears', () => {
  const state = builtAt20(); lock(state, 'protagonist', 'F6', 'independent_review'); submit(state);
  for (const year of [20, 21]) {
    advance(state, year);
    const view = getCrisisHistory(state, 'crisis-warning'), response = view.responses[0];
    assert.equal(response.status, 'pending');
    assert.equal(response.chain.length, 1);
    assert.equal(response.recordId, response.chain[0].id);
    assert.match(response.note, /尚未产生结果，不能记作危机保护/);
    assert.equal(view.impact, null);
    assert.match(text(view), /损失结果未知/);
    assert.equal(JSON.stringify(view).includes('resolved:event:action:20'), false);
  }
  advance(state, 22);
  const view = getCrisisHistory(state, 'crisis-warning');
  assert.equal(view.responses[0].status, 'success');
  assert.equal(view.impact, null);
  assert.match(text(view), /第23年冲击尚未结算/);
});

test('failed review is retained as failure, never protection, with a genuine veto fallback', () => {
  let state;
  for (let seed = 0; seed < 100; seed++) {
    const candidate = twoActors(seed);
    lock(candidate, 'protagonist', 'F6', 'independent_review');
    lock(candidate, 'linche', 'B4', 'local_veto'); submit(candidate); advance(candidate, 23);
    if (candidate.events.find(event => event.actionId === 'independent_review').status === 'failed') { state = candidate; break; }
  }
  assert.ok(state);
  const view = getCrisisHistory(state, 'crisis-impact');
  const review = view.responses.find(response => response.label === '异源交叉复核');
  assert.equal(review.status, 'failed');
  assert.equal(review.chain.at(-1).kind, 'failure');
  assert.match(review.note, /没有修正共同指令，也不提供本次危机保护/);
  assert.equal(state.flags.crisis.damage, .3);
  assert.match(view.responses.find(response => response.label === '地方停闸与先行撤离').note, /最强的一份0.30/);
  assertLinks(state, view);
});

test('two vetoes show both real sources while using only the strongest verified plan', () => {
  const state = twoActors();
  lock(state, 'protagonist', 'F6', 'local_veto');
  sim.investigate(state, 'linche', 'B4', 'evacuation_routes');
  lock(state, 'linche', 'B4', 'local_veto'); submit(state); advance(state, 23);
  const view = getCrisisHistory(state, 'crisis-impact');
  assert.equal(view.responses.length, 2);
  assert.ok(view.responses.every(response => response.status === 'success' && /最强的一份0.20，不叠加、不相乘/.test(response.note)));
  assert.equal(view.responses.filter(response => /强化停闸/.test(response.note)).length, 1);
  assert.equal(state.flags.crisis.damage, .2);
  assertLinks(state, view);
});

test('successful review supersedes veto and duplicate review does not multiply protection', () => {
  const state = twoActors(12);
  lock(state, 'protagonist', 'F6', 'independent_review');
  lock(state, 'linche', 'B4', 'local_veto'); submit(state); advance(state, 23);
  assert.equal(state.flags.review, true);
  const view = getCrisisHistory(state, 'crisis-impact');
  assert.match(view.responses.find(response => response.label === '地方停闸与先行撤离').note, /不再额外减损/);
  assert.match(view.responses.find(response => response.label === '异源交叉复核').note, /重复成功复核不叠加/);
});

test('inconsistent veto evidence cannot invent a basic or strengthened historical coefficient', () => {
  const original = twoActors();
  lock(original, 'protagonist', 'F6', 'local_veto');
  sim.investigate(original, 'linche', 'B4', 'evacuation_routes');
  lock(original, 'linche', 'B4', 'local_veto'); submit(original); advance(original, 23);
  for (const value of [undefined, [], 'evacuation_routes']) {
    const state = structuredClone(original);
    const event = state.events.find(item => item.actionId === 'local_veto' && item.cellId === 'B4');
    state.history.find(item => item.id === event.sourceActionId).evidence = value;
    const view = getCrisisHistory(state, 'crisis-impact');
    assert.equal(view.responses.length, 2);
    assert.ok(view.responses.every(response => /最强方案系数未知/.test(response.note)));
    assert.match(view.responses.find(response => response.eventId === event.id).note, /具体损失基数未知/);
  }
});

test('pre-crisis aid and warning have exact sources; later aid cannot take credit for old losses', () => {
  const state = sim.createRun(12); decade(state);
  lock(state, 'protagonist', 'D5', 'mutual_aid'); decade(state);
  lock(state, 'protagonist', 'D4', 'free_warning'); decade(state);
  const before = getCrisisHistory(state, 'crisis-impact');
  assert.deepEqual(before.responses.map(response => response.label), ['南岸互助', '基本免费预警']);
  assert.match(before.responses[0].note, /仅在南岸D5/);
  assert.match(before.responses[1].note, /河港D4/);
  const damage = structuredClone(state.flags.crisis);
  lock(state, 'protagonist', 'D5', 'mutual_aid'); decade(state);
  const after = getCrisisHistory(state, 'crisis-impact');
  assert.deepEqual(after.responses, before.responses);
  assert.deepEqual(after.impact, before.impact);
  assert.deepEqual(state.flags.crisis, damage);
  assert.match(text(after), /后续生计/);
  assert.ok(after.responses.every(response => !response.eventId.includes('action:30:')));
  assertLinks(state, after);

  const lateOnly = sim.createRun(12); decade(lateOnly); decade(lateOnly); decade(lateOnly);
  lock(lateOnly, 'protagonist', 'D5', 'mutual_aid'); decade(lateOnly);
  assert.equal(lateOnly.flags.aid, true);
  assert.equal(getCrisisHistory(lateOnly, 'crisis-impact').responses.length, 0);
});

test('inconsistent source, event or outcome metadata cannot earn protection', () => {
  const original = reviewedAt23();
  const find = state => state.events.find(event => event.actionId === 'independent_review');
  const changes = [
    state => { state.history = state.history.filter(record => record.id !== find(state).sourceActionId); },
    state => { state.history = state.history.filter(record => record.id !== `resolved:${find(state).id}`); },
    state => { state.history.find(record => record.id === find(state).sourceActionId).year = 10; },
    state => { state.history.find(record => record.id === find(state).sourceActionId).kind = 'history'; },
    state => { state.history.find(record => record.id === find(state).sourceActionId).cellId = 'B4'; },
    state => { state.history.find(record => record.id === find(state).sourceActionId).sourceActionId = 'unrelated'; },
    state => { state.history.find(record => record.id === find(state).sourceActionId).actionId = 'local_veto'; },
    state => { find(state).parentId = 'crisis-warning'; },
    state => { find(state).kind = 'history'; },
    state => { find(state).resolvedYear = 21; },
    state => { find(state).status = 'pending'; },
    state => { state.history.find(record => record.id === `resolved:${find(state).id}`).parentId = 'crisis-warning'; },
    state => { state.history.find(record => record.id === `resolved:${find(state).id}`).status = 'failed'; },
    state => { state.history.find(record => record.id === `resolved:${find(state).id}`).kind = 'failure'; },
    state => { state.history.find(record => record.id === `resolved:${find(state).id}`).cellId = 'B4'; },
    state => { state.history.find(record => record.id === `resolved:${find(state).id}`).year = 21; },
    state => { state.history.find(record => record.id === `resolved:${find(state).id}`).actionId = 'free_warning'; },
    state => { state.events.push(structuredClone(find(state))); },
    state => { state.history.push(structuredClone(state.history.find(record => record.id === find(state).sourceActionId))); },
    state => { state.actors[0].availableFrom = 30; },
  ];
  for (const change of changes) {
    const state = structuredClone(original); change(state);
    const view = getCrisisHistory(state, 'crisis-impact');
    assert.equal(state.flags.review, true);
    assert.equal(view.responses.length, 0);
    assert.match(text(view), /效果未知，未计作成功保护/);
  }
});

test('true old engine history stays byte-for-byte unchanged and missing detail stays unknown', () => {
  const state = legacy.createRun(12);
  decade(state, legacy); decade(state, legacy);
  legacy.lockTask(state, 'protagonist', 'D4', 'free_warning', Object.keys(legacy.EVIDENCE));
  submit(state, legacy); advance(state, 23, legacy);
  assert.equal(state.crisisRulesVersion, undefined);
  assert.equal(state.flags.crisis.damageByCell, undefined);
  const bytes = JSON.stringify(state); freeze(state);
  const view = getCrisisHistory(state, 'crisis-impact');
  assert.equal(JSON.stringify(state), bytes);
  assert.equal(view.responses[0].status, 'success');
  assert.match(view.responses[0].note, /旧版合同.*0.80/);
  assert.ok(view.detail.includes('第23年已存整体损失系数：0.80。'));
  assert.match(text(view), /缺项未知/);
  assert.equal(view.detail.some(line => /已存损失系数/.test(line)), false);
  assertLinks(state, view);
  view.impact.title = 'changed output'; view.responses[0].chain[0].text = 'changed output'; view.discovery[0].text = 'changed output';
  assert.equal(JSON.stringify(state), bytes);

  const incomplete = JSON.parse(bytes);
  incomplete.history = incomplete.history.filter(record => record.id !== 'crisis-impact');
  incomplete.flags.review = true; incomplete.flags.crisis = { status: 'averted' };
  const unknown = getCrisisHistory(incomplete, 'crisis-warning');
  assert.equal(unknown.impact, null);
  assert.match(text(unknown), /历史结果未知/);
  assert.equal(unknown.responses.some(response => response.label === '异源交叉复核'), false);
});

test('current institutions and flags never reconstruct frozen crisis details', () => {
  const state = reviewedAt23(), original = getCrisisHistory(state, 'crisis-impact');
  state.institutions = [];
  state.flags.review = false; state.flags.veto = true; state.flags.freeWarning = true; state.flags.aid = true;
  state.flags.crisis.status = 'disaster';
  assert.deepEqual(getCrisisHistory(state, 'crisis-impact'), original);
  delete state.flags.crisis.damageByCell.D4;
  state.flags.crisis.coverageByCell.E4 = NaN;
  const partial = getCrisisHistory(state, 'crisis-impact');
  assert.match(text(partial), /D4：已存覆盖系数1.00；已存损失系数未知/);
  assert.match(text(partial), /E4：已存覆盖系数未知；已存损失系数0.00/);
  assert.match(text(partial), /缺项未知/);
});

test('saved aggregate loss is shown only when finite, bounded and backed by the impact record', () => {
  const state = reviewedAt23();
  assert.ok(getCrisisHistory(state, 'crisis-impact').detail.includes('第23年已存整体损失系数：0.00。'));
  for (const value of [undefined, null, NaN, Infinity, -1, 1.1, '0']) {
    const altered = structuredClone(state); altered.flags.crisis.damage = value;
    altered.flags.crisis.status = 'averted';
    assert.equal(getCrisisHistory(altered, 'crisis-impact').detail.some(line => line.includes('已存整体损失系数')), false);
  }
  state.history = state.history.filter(record => record.id !== 'crisis-impact');
  assert.equal(getCrisisHistory(state, 'crisis-warning').detail.some(line => line.includes('已存整体损失系数')), false);
});

test('view reads are pure for current states, stable across repeated calls, and fully detached', () => {
  const state = reviewedAt23(), bytes = JSON.stringify(state); freeze(state);
  const first = getCrisisHistory(state, 'crisis-impact');
  assert.deepEqual(getCrisisHistory(state, 'crisis-impact'), first);
  assert.equal(JSON.stringify(state), bytes);
  for (const record of first.discovery) record.title = 'output only';
  for (const record of first.responses.flatMap(response => response.chain)) record.year = 999;
  first.detail.push('output only'); first.impact.text = 'output only';
  assert.equal(JSON.stringify(state), bytes);
});

test('an anomalous action parent cannot manufacture a verified response that loops into the crisis view', () => {
  const state=reviewedAt23();
  const source=state.history.find(h=>h.id==='action:20:protagonist:F6:independent_review');
  source.parentId='crisis-warning';
  assert.equal(sim.validateState(state).valid,true);
  const before=JSON.stringify(state),view=getCrisisHistory(state,'crisis-impact');
  assert.ok(!view.responses.some(r=>r.eventId==='event:'+source.id));
  assert.match(view.detail.join(' '),/来源或兑现记录.*未知/);
  assert.equal(JSON.stringify(state),before);
});
