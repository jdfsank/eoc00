import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import * as prior from './fixtures/pre-recovery-simulation.js';
import { restoreSave } from '../src/save.js';
import { getReviewHistory } from '../src/review-history.js';
import { sceneFor, evidenceFor } from '../src/story.js';

function lock(s, actor, cell, id, api = sim) {
  const action = api.getActions(s, cell, actor).find(action => action.id === id);
  assert.ok(action, `${s.year}/${actor}/${cell}/${id}`);
  if (api.usesTradeoffs?.(s)) for (const evidence of action.requireEvidence) {
    if (!api.getInvestigation(s, actor, cell).evidence.includes(evidence)) api.investigate(s, actor, cell, evidence);
  }
  api.lockTask(s, actor, cell, id, action.requireEvidence);
}
function submit(s, api = sim) {
  for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id);
  api.commitWindow(s);
}
function decade(s, api = sim) { submit(s, api); api.advanceToNextWindow(s); return s; }
function at20(seed = 5, api = sim) {
  const s = api.createRun(seed);
  lock(s, 'protagonist', 'D4', 'build_merchant', api); decade(s, api);
  assert.equal(s.events.find(event => event.actionId === 'build_merchant').status, 'success');
  lock(s, 'protagonist', 'D4', 'recruit_successor', api); decade(s, api);
  return s;
}
function at30(seed = 5, second = 'independent_review', api = sim) {
  const s = at20(seed, api);
  lock(s, 'protagonist', 'B4', 'independent_review', api);
  lock(s, 'linche', 'F6', second, api); decade(s, api);
  return s;
}
const eventAt = (s, cell = 'B4', action = 'independent_review') => s.events.find(event => event.cellId === cell && event.actionId === action);
const sourceAt = (s, cell = 'B4', action) => s.history.find(item => item.id === eventAt(s, cell, action).sourceActionId);
const outcomeAt = (s, cell = 'B4', action) => s.history.find(item => item.id === `resolved:${eventAt(s, cell, action).id}`);
const text = view => [view.summary, view.explanation, ...view.detail].join('\n');
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function links(s, view) {
  for (const id of view.sourceIds) assert.equal(s.history.filter(item => item.id === id).length, 1);
  for (const response of view.responses) for (const record of response.chain) assert.deepEqual(record, s.history.find(item => item.id === record.id));
}

test('natural seed5 separates B4 failure, F6 success and zero shared damage without changing story history', () => {
  const s = at30(), before = structuredClone(s), view = getReviewHistory(freeze(s), null, 'B4');
  assert.equal(eventAt(s).status, 'failed');
  assert.equal(eventAt(s, 'F6').status, 'success');
  assert.equal(eventAt(s).probability, .8);
  assert.equal(eventAt(s, 'F6').probability, .8);
  assert.equal(view.status, 'zero'); assert.equal(view.damage, 0);
  assert.deepEqual(view.localReviews.map(response => [response.cellId, response.status]), [['B4', 'failed']]);
  assert.deepEqual(view.responses.map(response => [response.cellId, response.status]), [['F6', 'success'], ['B4', 'failed']]);
  assert.match(view.summary, /整体损失系数为0.*本地复核失败不等于全局已经受损/);
  const scene = sceneFor(s, 'B4').body.join('\n'), evidence = evidenceFor(s, 'anomaly_records', 'B4').text;
  for (const prose of [scene, evidence]) {
    assert.match(prose, /整体损失系数为0/);
    assert.doesNotMatch(prose, /记录旁也没有抹去第23年的损失|原失败与已经发生的损失不能改写/);
  }
  assert.match(scene, /第22年 · F6：已在冲击前成功识别/);
  assert.match(scene, /第22年 · B4：复核失败/);
  links(s, view); assert.deepEqual(s, before);
});

test('action, event and outcome selectors retain exact originals and unrelated records get no annotation', () => {
  const s = at30(), event = eventAt(s);
  for (const id of [event.sourceActionId, event.id, `resolved:${event.id}`]) {
    const view = getReviewHistory(s, id);
    assert.equal(view.status, 'zero'); assert.equal(view.localReviews.length, 1);
    assert.deepEqual(view.original, [...s.history, ...s.events].find(item => item.id === id));
    assert.equal(view.originalLabel, '原始复核记录（保留原文）');
    assert.match(view.explanation, /已核实的成败保留/);
    assert.doesNotMatch(view.explanation, /通用模板/);
  }
  for (const id of ['crisis-impact', 'charter-lapsed', 'unrelated', 'event:action:30:protagonist:B4:complete_review']) assert.equal(getReviewHistory(s, id), null);
  assert.equal(getReviewHistory(sim.createRun()), null);
});

for (const [name, seed, second] of [['double failures', 2, 'independent_review'], ['failure and veto', 5, 'local_veto']]) {
  test(`${name} reads actual settlement, not one failure as an assumed total disaster`, () => {
    const s = at30(seed, second), view = getReviewHistory(s, null, 'B4');
    assert.equal(eventAt(s).status, 'failed');
    if (second === 'independent_review') assert.equal(eventAt(s, 'F6').status, 'failed');
    else assert.equal(eventAt(s, 'F6', 'local_veto').status, 'success');
    assert.equal(view.status, 'loss'); assert.equal(view.damage, s.flags.crisis.damage);
    assert.ok(view.damage > 0 && view.damage < 1);
    assert.match(view.summary, /原始清点记有实际损失.*不会抹去/);
    assert.match(sceneFor(s, 'B4').body[0], /原始清点记有实际损失/);
    assert.match(evidenceFor(s, 'anomaly_records', 'B4').text, /原始清点记有实际损失/);
  });
}

const impactChanges = [
  ['missing', s => { s.history = s.history.filter(item => item.id !== 'crisis-impact'); }],
  ['duplicate', s => { s.history.push(structuredClone(s.history.find(item => item.id === 'crisis-impact'))); }],
  ['cross-table collision', s => { s.events.push({ id: 'crisis-impact', kind: 'event' }); }],
  ...Object.entries({ year: 22, cellId: 'F6', parentId: null, sourceActionId: 'action:20:protagonist:B4:independent_review', kind: 'outcome', status: 'success', reality: 'R0' })
    .map(([key, value]) => [`wrong ${key}`, s => { s.history.find(item => item.id === 'crisis-impact')[key] = value; }]),
];
for (const [name, mutate] of impactChanges) test(`${name} shared settlement is unknown despite zero flags and successful review`, () => {
  const s = at30(); mutate(s); const before = structuredClone(s), view = getReviewHistory(freeze(s), null, 'B4');
  assert.equal(view.status, 'unknown'); assert.equal(view.damage, null); assert.equal(view.impact, null);
  assert.match(view.summary, /整体损失未知.*不能从本地复核失败推定全局受损/);
  assert.equal(view.responses.length, 2, 'independent review facts do not depend on an intact global milestone');
  assert.match(sceneFor(s, 'B4').body[0], /整体损失未知/);
  assert.match(evidenceFor(s, 'anomaly_records', 'B4').text, /整体损失未知/);
  assert.deepEqual(s, before);
});

for (const value of [undefined, null, '0', NaN, Infinity, -1, 1.01]) test(`invalid saved damage ${String(value)} stays unknown`, () => {
  const s = at30(); s.flags.crisis.damage = value;
  const view = getReviewHistory(s); assert.equal(view.status, 'unknown'); assert.equal(view.damage, null);
});
for (const [name, mutate] of [
  ['warning date', s => { s.flags.crisis.warningYear = 13; }],
  ['settlement date', s => { s.flags.crisis.irreversibleYear = 24; }],
  ['missing scope', s => { delete s.flags.crisis.affectedCells; }],
  ['partial scope', s => { s.flags.crisis.affectedCells.pop(); }],
  ['duplicate scope', s => { s.flags.crisis.affectedCells[3] = 'D4'; }],
  ['wrong scope', s => { s.flags.crisis.affectedCells[3] = 'B4'; }],
]) test(`${name} cannot lend unrelated settlement data to the review`, () => {
  const s = at30(); mutate(s); assert.equal(getReviewHistory(s).status, 'unknown');
});
test('a tiny recorded loss remains exact and lack of local detail does not erase a valid global record', () => {
  const s = at30(); s.flags.crisis.damage = .0001; delete s.flags.crisis.damageByCell;
  const view = getReviewHistory(s); assert.equal(view.status, 'loss'); assert.equal(view.damage, .0001);
  assert.match(view.summary, /整体损失系数为0.0001/); assert.match(text(view), /逐地损失明细未完整保存/);
});

const reviewChanges = [
  ['missing source', s => { s.history = s.history.filter(item => item.id !== eventAt(s).sourceActionId); }],
  ['missing outcome', s => { s.history = s.history.filter(item => item.id !== `resolved:${eventAt(s).id}`); }],
  ['duplicate source', s => { s.history.push(structuredClone(sourceAt(s))); }],
  ['duplicate event', s => { s.events.push(structuredClone(eventAt(s))); }],
  ['duplicate outcome', s => { s.history.push(structuredClone(outcomeAt(s))); }],
  ['source in events', s => { s.events.push(structuredClone(sourceAt(s))); }],
  ['event in history', s => { s.history.push(structuredClone(eventAt(s))); }],
  ['outcome in events', s => { s.events.push(structuredClone(outcomeAt(s))); }],
  ['wrong source cell', s => { sourceAt(s).cellId = 'F6'; }],
  ['wrong event cell', s => { eventAt(s).cellId = 'F6'; }],
  ['wrong outcome cell', s => { outcomeAt(s).cellId = 'F6'; }],
  ['unconfirmed source', s => { sourceAt(s).status = 'pending'; }],
  ['wrong action', s => { sourceAt(s).actionId = 'local_veto'; }],
  ['wrong source year', s => { sourceAt(s).year = 10; }],
  ['wrong outcome year', s => { outcomeAt(s).year = 21; }],
  ['missing evidence', s => { delete sourceAt(s).evidence; }],
  ['different issued evidence', s => { eventAt(s).evidence = []; }],
  ['wrong resolution', s => { eventAt(s).resolvedYear = 23; }],
  ['wrong reality', s => { outcomeAt(s).reality = 'R0'; }],
  ['wrong actor', s => { outcomeAt(s).actorId = 'linche'; }],
  ['duplicate actor', s => { s.actors.push(structuredClone(s.actors[0])); }],
  ['contradictory pass', s => { s.history.push({ id: 'pass:20:protagonist', year: 20 }); }],
];
for (const [name, mutate] of reviewChanges) test(`${name} does not prove B4 failure or alter independently saved zero damage`, () => {
  const s = at30(); mutate(s); const before = structuredClone(s), view = getReviewHistory(freeze(s), null, 'B4');
  assert.equal(view.status, 'zero'); assert.equal(view.localReviews.length, 0);
  assert.deepEqual(view.responses.map(item => item.cellId), ['F6']);
  assert.match(text(view), /来源或兑现记录缺失、不唯一或不一致/);
  assert.deepEqual(s, before);
});

test('a consistent-looking review relocated to an impossible region is not a historical response', () => {
  const s = at30(), event = eventAt(s), source = sourceAt(s), outcome = outcomeAt(s);
  const sourceId = event.sourceActionId.replace(':B4:', ':D5:'), eventId = `event:${sourceId}`;
  Object.assign(source, { id: sourceId, sourceActionId: sourceId, cellId: 'D5' });
  Object.assign(event, { id: eventId, sourceActionId: sourceId, parentId: sourceId, cellId: 'D5' });
  Object.assign(outcome, { id: `resolved:${eventId}`, sourceActionId: sourceId, parentId: eventId, cellId: 'D5' });
  assert.equal(getReviewHistory(s).responses.length, 1);
});

test('missing both crisis pages does not erase independently sourced local outcomes or invent the global result', () => {
  const s = at30(); s.history = s.history.filter(item => !['crisis-warning', 'crisis-impact'].includes(item.id));
  const view = getReviewHistory(s); assert.equal(view.status, 'unknown');
  assert.deepEqual(view.responses.map(response => response.status), ['success', 'failed']);
});
test('current flags, carriers, channels and snapshots do not determine a historical explanation', () => {
  const s = at30(), before = getReviewHistory(s);
  s.institutions = []; s.snapshots = {}; s.cells = []; s.flags.review = false; s.flags.veto = true;
  assert.deepEqual(getReviewHistory(s), before);
});
test('future settlement and unresolved review results are never disclosed before their actual date', () => {
  const s = at20(); lock(s, 'protagonist', 'B4', 'independent_review'); submit(s);
  const future = at30(); s.flags.crisis = structuredClone(future.flags.crisis);
  s.history.push(structuredClone(future.history.find(item => item.id === 'crisis-impact')));
  const view = getReviewHistory(s); assert.equal(view.status, 'pending'); assert.equal(view.damage, null);
  assert.equal(view.responses[0].status, 'pending'); assert.match(view.summary, /尚未结算/);
});

for (const [name, api] of [['original legacy engine', legacy], ['published pre-recovery engine', prior]]) test(`${name} uses its true saved settlement without new contracts or invented local detail`, () => {
  const original = at30(5, 'independent_review', api), s = restoreSave({ state: structuredClone(original) }).state;
  const before = structuredClone(s), view = getReviewHistory(freeze(s));
  assert.equal(view.status, original.flags.crisis.damage === 0 ? 'zero' : 'loss');
  assert.equal(view.responses.length, 2); assert.equal(view.damage, original.flags.crisis.damage);
  if (api === legacy) assert.match(text(view), /逐地损失明细未完整保存/);
  assert.deepEqual(s, before); assert.deepEqual(s, original);
  const continued = structuredClone(s); decade(continued); decade(original, api); assert.deepEqual(continued, original);
});

for (const seed of [5, 2]) test(`seed${seed}: late completed review preserves original contracts, costs, random outcomes and past loss through year40`, () => {
  const s = at30(seed), original = structuredClone(s), expectedStatus = seed === 5 ? 'zero' : 'loss';
  const local = s.cells.find(cell => cell.id === 'B4'), costBefore = structuredClone(local.channels);
  lock(s, 'protagonist', 'B4', 'complete_review'); submit(s);
  assert.equal(local.channels.economy, Math.round((costBefore.economy - 4) * 10000) / 10000);
  assert.equal(local.channels.science, Math.round((costBefore.science - 3) * 10000) / 10000);
  const recovery = eventAt(s, 'B4', 'complete_review');
  assert.equal(getReviewHistory(s, recovery.id).responses.find(item => item.actionId === 'complete_review').status, 'pending');
  sim.advanceYear(s); sim.advanceYear(s); assert.equal(recovery.status, 'success');
  const outcome = outcomeAt(s, 'B4', 'complete_review'), originalText = outcome.text;
  assert.match(originalText, /第23年的损失没有撤回/, 'old engine template remains byte-for-byte intact');
  assert.match(getReviewHistory(s, outcome.id).originalLabel, /损失措辞来自通用模板.*不作本局灾损断言/);
  assert.match(getReviewHistory(s, outcome.id).explanation, /已核实的复核成败仍按原记录保留/);
  assert.equal(getReviewHistory(s, recovery.sourceActionId).originalLabel, '原始复核记录（保留原文）');
  for (const id of [recovery.sourceActionId, recovery.id, outcome.id]) {
    const view = getReviewHistory(s, id); assert.equal(view.status, expectedStatus);
    assert.match(text(view), /原复核失败与第23年清点各自保留/); links(s, view);
  }
  sim.advanceToNextWindow(s); const frozen = structuredClone(s), view = getReviewHistory(freeze(s));
  assert.equal(view.status, expectedStatus); assert.equal(view.damage, original.flags.crisis.damage);
  assert.deepEqual(s.flags.crisis, original.flags.crisis);
  assert.deepEqual(s.history.slice(0, original.history.length), original.history);
  assert.deepEqual(s.events.filter(event => event.actionId === 'independent_review'), original.events.filter(event => event.actionId === 'independent_review'));
  for (const year of Object.keys(original.snapshots)) assert.deepEqual(s.snapshots[year], original.snapshots[year]);
  assert.equal(outcome.text, originalText); assert.deepEqual(s, frozen);
});
test('broken later-review provenance does not claim successful recovery or change the old settlement', () => {
  const s = at30(); lock(s, 'protagonist', 'B4', 'complete_review'); decade(s);
  const original = structuredClone(s);
  for (const mutate of [
    s => { sourceAt(s, 'B4', 'complete_review').recoverySourceId = eventAt(s, 'F6').id; },
    s => { eventAt(s, 'B4', 'complete_review').recoveryInstitutionId = 'unrelated'; },
    s => { s.events.push(structuredClone(outcomeAt(s, 'B4', 'complete_review'))); },
    s => { outcomeAt(s, 'B4', 'complete_review').cellId = 'F6'; },
  ]) {
    const altered = structuredClone(original); mutate(altered); const view = getReviewHistory(altered);
    assert.equal(view.status, 'zero'); assert.ok(!view.responses.some(item => item.actionId === 'complete_review'));
  }
});

test('orphan original review pages still receive an unknown-source note in the recap', () => {
  const s = at30(); lock(s, 'protagonist', 'B4', 'complete_review'); decade(s);
  const outcome = outcomeAt(s, 'B4', 'complete_review');
  s.events = s.events.filter(event => !['independent_review', 'complete_review'].includes(event.actionId));
  const view = getReviewHistory(s);
  assert.equal(view.status, 'zero'); assert.equal(view.responses.length, 0);
  assert.match(text(view), /部分复核来源或兑现记录缺失/);
  assert.match(getReviewHistory(s, outcome.id).originalLabel, /损失措辞来自通用模板/);
});
test('a cancelled late review retains paid costs and never claims future capacity or changes actual past damage', () => {
  const s = sim.createRun(6); decade(s);
  lock(s, 'protagonist', 'D4', 'recruit_volunteer'); decade(s);
  lock(s, 'protagonist', 'B4', 'independent_review'); decade(s);
  assert.equal(eventAt(s).status, 'failed');
  const past = structuredClone(s.flags.crisis);
  lock(s, 'protagonist', 'B4', 'complete_review'); decade(s);
  const event = eventAt(s, 'B4', 'complete_review'), view = getReviewHistory(s, event.id);
  assert.equal(event.status, 'cancelled'); assert.equal(view.status, 'loss');
  assert.match(view.responses.find(item => item.actionId === 'complete_review').note, /已经取消.*已付成本与取消记录保留/);
  assert.deepEqual(s.flags.crisis, past);
});
