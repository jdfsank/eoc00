import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as published from './fixtures/pre-archive-upgrade-simulation.js';
import * as older from './fixtures/pre-future-check-simulation.js';
import { getDecadeReview } from '../src/decade-review.js';
import { characterEpilogue } from '../src/story.js';

const ID = 'establish_future_check';
const copy = structuredClone;
function choose(api, state, actor, cell, id, extra = []) {
  const action = api.getActions(state, cell, actor).find(a => a.id === id);
  assert.ok(action, `${state.year}/${actor}/${cell}/${id}`);
  for (const evidence of [...action.requireEvidence, ...extra]) {
    if (!api.getInvestigation(state, actor, cell).evidence.includes(evidence)) api.investigate(state, actor, cell, evidence);
  }
  api.lockTask(state, actor, cell, id);
}
function submit(api, state, tasks = []) {
  for (const task of tasks) choose(api, state, ...task);
  for (const actor of api.getActors(state)) if (!state.drafts[actor.id]) api.passTask(state, actor.id);
  api.commitWindow(state);
}
function decade(api, state, tasks = []) {
  submit(api, state, tasks);
  api.advanceToNextWindow(state);
  return state;
}
function at30({ staff = true, api = sim } = {}) {
  const state = api.createRun(0);
  decade(api, state);
  decade(api, state, [['protagonist', 'D4', 'recruit_volunteer']]);
  decade(api, state, [['protagonist', 'B4', 'local_veto', ['evacuation_routes']],
    ...(staff ? [['linche', 'E4', 'train_network']] : [])]);
  return state;
}
function finish({ staff = true, actor = 'linche', other = 'withdraw', api = sim } = {}) {
  const state = at30({ staff, api }), before = copy(state);
  const peer = actor === 'linche' ? 'protagonist' : 'linche';
  decade(api, state, [[actor, 'B4', ID],
    ...(other ? [[peer, other === 'train_network' ? 'E4' : 'D4', other]] : [])]);
  return { state, before };
}
const futureEvent = state => state.events.find(event => event.actionId === ID);
const futureSource = state => state.history.find(row => row.id === futureEvent(state).sourceActionId);
const futureOutcome = state => state.history.find(row => row.id === `resolved:${futureEvent(state).id}`);
const cardFor = (state, actor = 'linche') => getDecadeReview(state).cards.find(card => card.actorId === actor);
const codaFor = state => characterEpilogue(state).find(person => person.name === '林澈');
const ownCoda = state => codaFor(state).paragraphs.filter(text => text.startsWith('同行以后')).join('\n');
const cardText = card => [card.choice, card.outcome, card.responsibility].join('');
function oldHistory(state, reference = state, year = 30) {
  return { history: state.history.filter(row => reference.history.some(original => original.id === row.id)), events: state.events.filter(row => reference.events.some(original => original.id === row.id)),
    crisis: state.flags.crisis, snapshots: Object.fromEntries(Object.entries(state.snapshots).filter(([key]) => Number(key) <= year)) };
}
function checkSources(state, card) {
  assert.equal(new Set(card.sourceIds).size, card.sourceIds.length);
  for (const id of card.sourceIds) {
    assert.equal(state.history.filter(row => row.id === id).length, 1, id);
    assert.ok(sim.traceEvent(state, id).length, id);
  }
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}

for (const [label, api] of [['new run', sim], ['actual published future-check-v1 producer', published]]) {
  test(`${label}: actual year34 success with withdrawal is explicit, actor-owned and preserves23`, () => {
    const { state, before } = finish({ api }), saved = copy(state), ending = api.getEnding(state);
    const card = cardFor(state);
    assert.match(card.choice, /第30年，林澈在B4.*建立未来校验席/);
    assert.match(card.outcome, /第34年.*未来校验席在实际测量或教学人手支持下完成.*只新增面向未来/);
    assert.match(card.responsibility, /不等于完成交班或共享.*不附送地方授权、信任或交班方针.*跨地承接.*第23年已记录的损失仍在/);
    assert.doesNotMatch(cardText(card), /这项安排已有成功兑现记录|遗留校验|原来的复核失败/);
    assert.match(ownCoda(state), new RegExp(card.outcome));
    assert.ok(codaFor(state).sources.includes(`resolved:${futureEvent(state).id}`));
    assert.equal(ending.title, '没有唯一守夜人');
    assert.equal(state.flags.policy, 'withdraw');
    assert.equal(state.flags.trust, undefined);
    assert.equal(state.flags.review, undefined);
    assert.equal(state.flags.crisis.damage, .1904);
    assert.deepEqual(oldHistory(state, before), oldHistory(before));
    assert.deepEqual(state, saved);
    assert.deepEqual(sim.getEnding(state), ending);
    checkSources(state, card);
  });

  test(`${label}: no workforce is recorded as unfulfilled conditions and nonrefundable costs`, () => {
    const { state, before } = finish({ api, staff: false }), saved = copy(state), card = cardFor(state);
    assert.equal(futureEvent(state).status, 'cancelled');
    assert.match(card.outcome, /第34年.*没有实际测量或教学人手.*未来校验席取消.*未完成连续比对/);
    assert.match(card.responsibility, /已付材料与场地成本不退.*没有因此取得校验能力、地方授权、信任或交班方针.*第23年已记录的损失仍在/);
    assert.doesNotMatch(card.outcome, /行动取消|成功|支持下完成/);
    assert.ok(ownCoda(state).includes(card.outcome));
    assert.equal(api.getEnding(state).title, '交班后的空椅子');
    assert.deepEqual(oldHistory(state, before), oldHistory(before));
    assert.deepEqual(state, saved);
    checkSources(state, card);
  });

  test(`${label}: year31 training supports34 but is not credited as a signed policy`, () => {
    const { state, before } = finish({ api, staff: false, other: 'train_network' }), saved = copy(state);
    const training = state.events.find(event => event.actionId === 'train_network');
    assert.equal(training.resolvedYear, 31);
    assert.equal(futureEvent(state).status, 'success');
    assert.equal(futureEvent(state).futureCheckWorkforceIds.length, 1);
    assert.ok(futureEvent(state).futureCheckWorkforceIds[0].includes(training.id));
    assert.match(cardFor(state).outcome, /第34年.*实际测量或教学人手支持下完成/);
    assert.match(cardFor(state, 'protagonist').outcome, /第31年.*轮值维护网络/);
    assert.doesNotMatch(ownCoda(state), /第31年.*轮值维护网络/);
    assert.equal(state.flags.policy, undefined);
    assert.equal(state.flags.trust, undefined);
    assert.equal(api.getEnding(state).title, '未签署的下一页');
    assert.deepEqual(oldHistory(state, before), oldHistory(before));
    assert.deepEqual(state, saved);
    for (const card of getDecadeReview(state).cards) checkSources(state, card);
  });
}

test('protagonist future work is not assigned to Linche by shared global capacity or ending flags', () => {
  const { state } = finish({ actor: 'protagonist', other: null });
  assert.match(cardFor(state, 'protagonist').outcome, /第34年.*未来校验席.*完成/);
  assert.match(cardFor(state).choice, /第30年，林澈明确放弃/);
  assert.doesNotMatch(ownCoda(state), /第34年|未来校验席/);
  assert.ok(!codaFor(state).sources.some(id => id.endsWith(`protagonist:B4:${ID}`)));
});

test('draft and true pending contracts are not retrospective success, even at a fake final boundary', () => {
  const state = at30(), before = JSON.stringify(getDecadeReview(state));
  choose(sim, state, 'linche', 'B4', ID);
  assert.equal(JSON.stringify(getDecadeReview(state)), before);
  assert.deepEqual(characterEpilogue(state), []);
  submit(sim, state);
  while (state.year < 33) sim.advanceYear(state);
  assert.equal(futureEvent(state).status, 'pending');
  assert.equal(futureOutcome(state), undefined);
  assert.equal(getDecadeReview(state), null);
  assert.deepEqual(characterEpilogue(state), []);
  const fakeBoundary = { ...state, year: 40, phase: 'ended' };
  assert.match(cardFor(fakeBoundary).outcome, /结果未知/);
  assert.doesNotMatch(ownCoda(fakeBoundary), /第34年.*支持下完成/);
  assert.equal(futureOutcome(state), undefined);
});

const corruptions = [
  ['missing choice', state => state.history = state.history.filter(row => row !== futureSource(state))],
  ['missing outcome', state => state.history = state.history.filter(row => row !== futureOutcome(state))],
  ['wrong source actor', state => futureSource(state).actorId = 'protagonist'],
  ['wrong event actor', state => futureEvent(state).actorId = 'protagonist'],
  ['wrong outcome actor', state => futureOutcome(state).actorId = 'protagonist'],
  ['wrong outcome parent', state => futureOutcome(state).parentId = 'crisis-warning'],
  ['wrong outcome year', state => futureOutcome(state).year = 33],
  ['wrong outcome cell', state => futureOutcome(state).cellId = 'F6'],
  ['wrong event source', state => futureEvent(state).sourceActionId = 'pass:30:linche'],
  ['wrong event reality', state => futureEvent(state).reality = 'R0'],
  ['wrong outcome kind', state => futureOutcome(state).kind = 'failure'],
  ['missing workforce proof', state => delete futureEvent(state).futureCheckWorkforceIds],
  ['outcome workforce mismatch', state => futureOutcome(state).futureCheckWorkforceIds = []],
  ['missing workforce origin', state => { const origin = state.institutions.find(row => row.id === futureEvent(state).futureCheckWorkforceIds[0]).sourceActionId; state.history = state.history.filter(row => row.id !== origin); }],
  ['missing future carrier', state => state.institutions = state.institutions.filter(row => row.sourceEventId !== futureEvent(state).id)],
  ['duplicate outcome', state => state.history.push(copy(futureOutcome(state)))],
  ['duplicate event', state => state.events.push(copy(futureEvent(state)))],
  ['conflicting explicit pass', state => state.history.push({ id: 'pass:30:linche', year: 30, cellId: 'B4', kind: 'pass', parentId: null, sourceActionId: null, status: 'confirmed' })],
];
for (const [name, mutate] of corruptions) test(`${name}: only the unproven future result becomes unknown`, () => {
  const { state } = finish(); mutate(state);
  const before = copy(state), card = cardFor(state);
  assert.match(cardText(card), /缺失|不一致|未知/);
  assert.doesNotMatch(card.outcome, /第34年.*支持下完成|未来校验席取消/);
  assert.doesNotMatch(ownCoda(state), /第34年.*支持下完成|未来校验席取消/);
  assert.match(cardFor(state, 'protagonist').outcome, /结束独占控制的方针已经签署/);
  assert.deepEqual(state, before);
});

test('post-settlement shutdown does not erase real year34 work or imply it still operates', () => {
  const { state } = finish(), expected = cardFor(state);
  for (const institution of state.institutions) { institution.active = false; institution.maintenance = 0; }
  assert.deepEqual(cardFor(state), expected);
  assert.doesNotMatch(cardFor(state).outcome, /仍在运行|当前.*工作/);
});

test('older actual producer retains old action wording and gains no fabricated future contract', () => {
  const state = at30({ api: older });
  decade(older, state, [['linche', 'E4', 'train_network'], ['protagonist', 'D4', 'withdraw']]);
  const saved = copy(state), [protagonist, linche] = getDecadeReview(state).cards;
  assert.equal(linche.outcome, '第31年，新的轮值维护网络开始工作。');
  assert.equal(protagonist.outcome, '第31年，结束独占控制的方针已经签署。');
  assert.doesNotMatch(ownCoda(state), /未来校验席|第34年/);
  assert.deepEqual(state, saved);
  assert.equal(state.futureCheckRulesVersion, undefined);
});

test('retrospective views are frozen-input safe, deterministic and never consult hidden rolls', () => {
  const { state } = finish();
  for (const row of [...state.events, ...state.history]) Object.defineProperty(row, 'roll', { get() { throw new Error('hidden roll read'); }, enumerable: false });
  const saved = JSON.stringify(state);
  const expected = getDecadeReview(freeze(state));
  assert.deepEqual(getDecadeReview(state), expected);
  assert.doesNotThrow(() => characterEpilogue(state));
  assert.equal(JSON.stringify(state), saved);
  expected.cards[1].sourceIds.push('not-recorded');
  assert.ok(!cardFor(state).sourceIds.includes('not-recorded'));
});

test('an actor unavailable at30 receives no invented deployment card', () => {
  const { state } = finish();
  state.actors.find(actor => actor.id === 'linche').availableFrom = 31;
  assert.equal(cardFor(state), undefined);
  assert.doesNotMatch(ownCoda(state), /第34年.*支持下完成/);
});
