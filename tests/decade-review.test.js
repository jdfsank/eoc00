import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import { getDecadeReview } from '../src/decade-review.js';
import { investigateAndLock as lock } from './helpers/play.js';

function submit(state, api = sim) {
  for (const actor of api.getActors(state)) if (!state.drafts[actor.id]) api.passTask(state, actor.id);
  api.commitWindow(state);
}
function decade(state, api = sim) { submit(state, api); api.advanceToNextWindow(state); }
function built(seed = 12) {
  const state = sim.createRun(seed);
  lock(state, 'protagonist', 'D4', 'build_joint'); decade(state);
  return state;
}
function twoActors(seed = 12) {
  const state = sim.createRun(seed); decade(state);
  lock(state, 'protagonist', 'D4', 'recruit_volunteer'); decade(state);
  return state;
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}
const cardText = card => [card.choice, card.outcome, card.responsibility].join('');
const allText = view => [view.title, view.summary, ...view.cards.map(cardText)].join('\n');
function assertSources(state, view) {
  for (const card of view.cards) {
    assert.equal(new Set(card.sourceIds).size, card.sourceIds.length);
    for (const id of card.sourceIds) {
      assert.equal(state.history.filter(item => item.id === id).length, 1, id);
      assert.ok(sim.traceEvent(state, id).length);
    }
    assert.ok(cardText(card).split('。').filter(Boolean).length <= 4, cardText(card));
  }
}

test('recap exists only at reached intervention boundaries and the actual ending', () => {
  const state = sim.createRun();
  for (const year of [0, 1, 9, 11, 23, 39, 40]) {
    state.year = year; state.phase = 'planning';
    assert.equal(getDecadeReview(state), null);
  }
  for (const year of [10, 20, 30, 40]) {
    state.year = year; state.phase = 'playback';
    assert.equal(getDecadeReview(state), null);
  }
  for (const year of [10, 20, 30]) {
    state.year = year; state.phase = 'planning';
    const view = getDecadeReview(state);
    assert.equal(view.start, year - 10); assert.equal(view.end, year);
  }
  state.year = 40; state.phase = 'ended';
  assert.equal(getDecadeReview(state).start, 30);
  assert.equal(getDecadeReview(null), null);
});

test('the year0 choice appears beside its real success, teaching and still-pending branch', () => {
  const state = built(), view = getDecadeReview(state), card = view.cards[0];
  assert.equal(view.cards.length, 1);
  assert.equal(card.actorId, 'protagonist');
  assert.match(card.choice, /第0年.*联合管理/);
  assert.match(card.outcome, /第3年.*水文站启用.*第7年.*东岸与南岸/);
  assert.match(card.outcome, /第12年兑现，仍待结果/);
  assert.doesNotMatch(card.outcome, /分站.*已建成/);
  assert.match(card.responsibility, /维护与继任/);
  assert.deepEqual(card.sourceIds, ['action:0:protagonist:D4:build_joint',
    'resolved:event:action:0:protagonist:D4:build_joint',
    'resolved:event:action:0:protagonist:D4:build_joint:training']);
  assertSources(state, view);
});

test('failed building recalls the real archive without inventing its teaching chain', () => {
  const state = built(6), view = getDecadeReview(state);
  assert.match(view.cards[0].outcome, /建站未成.*小型档案站.*原培训链没有启动/);
  assert.match(view.cards[0].responsibility, /失败与已付成本/);
  assert.doesNotMatch(view.cards[0].outcome, /水文站启用|培训抵达|分站约定/);
  assert.equal(view.cards[0].sourceIds.length, 2);
  assertSources(state, view);
});

test('a real cancelled descendant is not called fulfilled or silently omitted', () => {
  const state = sim.createRun(12);
  lock(state, 'protagonist', 'D4', 'build_joint'); submit(state);
  while (state.year < 6) sim.advanceYear(state);
  state.institutions.find(item => item.kind === 'station').active = false;
  sim.advanceToNextWindow(state);
  const view = getDecadeReview(state);
  assert.match(view.cards[0].outcome, /水文站启用.*后续培训取消/);
  assert.doesNotMatch(view.cards[0].outcome, /培训抵达|分站/);
  assert.ok(view.cards[0].sourceIds.includes('resolved:event:action:0:protagonist:D4:build_joint:training'));
  assertSources(state, view);
});

test('an explicit pass is remembered, but missing or conflicting choices remain unknown', () => {
  const state = sim.createRun(); decade(state);
  const view = getDecadeReview(state);
  assert.match(view.cards[0].choice, /第0年.*明确放弃/);
  assert.deepEqual(view.cards[0].sourceIds, ['pass:0:protagonist']);
  assertSources(state, view);
  const missing = structuredClone(state); missing.history = missing.history.filter(h => h.kind !== 'pass');
  assert.match(getDecadeReview(missing).cards[0].choice, /记录缺失/);
  assert.doesNotMatch(getDecadeReview(missing).cards[0].choice, /明确放弃/);
  assert.equal(getDecadeReview(missing).cards[0].sourceIds.length, 0);
  for (const mutate of [h => h.year = 10, h => h.kind = 'history', h => h.sourceActionId = 'other', h => h.actorId = 'linche']) {
    const altered = structuredClone(state); mutate(altered.history.find(h => h.kind === 'pass'));
    assert.match(getDecadeReview(altered).cards[0].choice, /记录缺失/);
  }
  const conflict = built(); conflict.history.push(structuredClone(state.history.find(h => h.kind === 'pass')));
  assert.match(getDecadeReview(conflict).cards[0].choice, /记录缺失或不一致/);
  assert.doesNotMatch(getDecadeReview(conflict).cards[0].outcome, /水文站启用/);
});

test('the next decade credits recruitment, not the independent earlier building branch', () => {
  const state = built();
  lock(state, 'protagonist', 'D4', 'recruit_risk'); decade(state);
  const view = getDecadeReview(state), card = view.cards[0];
  assert.equal(view.cards.length, 1, 'Linche did not have a year10 deployment');
  assert.match(card.choice, /第10年.*邀请林澈同行/);
  assert.match(card.outcome, /第11年.*已有岗位没有安排继任/);
  assert.match(card.responsibility, /第16年.*测站停运/);
  assert.ok(card.sourceIds.includes('station-unattended'));
  assert.doesNotMatch(cardText(card), /远港|分站/);
  assert.ok(!card.sourceIds.some(id => id.includes(':training:branch')));
  assertSources(state, view);
});

test('real successor and voluntary recruitment keep consent and long-term costs distinct', () => {
  const state = built(); lock(state, 'protagonist', 'D4', 'recruit_successor'); decade(state);
  const view = getDecadeReview(state);
  assert.match(view.cards[0].outcome, /苏岚同意接下已有岗位/);
  assert.match(view.cards[0].responsibility, /不是长期经费已经充足/);
  assertSources(state, view);
  const volunteer = twoActors(), voluntary = getDecadeReview(volunteer);
  assert.match(voluntary.cards[0].outcome, /当时没有运转中的测站或档案岗位/);
  assert.doesNotMatch(voluntary.cards[0].outcome, /产出减半|苏岚同意接下已有岗位/);
  assert.match(voluntary.cards[0].responsibility, /不等于补建测站/);
  assertSources(volunteer, voluntary);
});

test('older no-job recruitment never repeats a fictional vacant station as fact', () => {
  for (const actionId of ['recruit_risk', 'recruit_successor']) {
    const state = legacy.createRun(12); decade(state, legacy);
    legacy.lockTask(state, 'protagonist', 'D4', actionId, actionId === 'recruit_successor' ? ['successor_consent'] : []);
    decade(state, legacy);
    const before = JSON.stringify(state), view = getDecadeReview(state);
    assert.match(view.cards[0].outcome, /林澈自愿入局/);
    assert.match(view.cards[0].outcome, /岗位交接缺少可靠记录/);
    assert.doesNotMatch(allText(view), /河港暂缺维护者|产出减半|苏岚同意接下已有岗位|第16年.*停运/);
    assert.equal(JSON.stringify(state), before);
    assertSources(state, view);
  }
});

test('two actor cards preserve actual different choices, failed review and veto without shared credit', () => {
  let state;
  for (let seed = 0; seed < 100; seed++) {
    const candidate = twoActors(seed);
    lock(candidate, 'protagonist', 'B4', 'independent_review');
    lock(candidate, 'linche', 'F6', 'local_veto'); decade(candidate);
    if (candidate.events.find(e => e.actionId === 'independent_review').status === 'failed') { state = candidate; break; }
  }
  assert.ok(state);
  const view = getDecadeReview(state), [protagonist, linche] = view.cards;
  assert.equal(protagonist.actorId, 'protagonist'); assert.equal(linche.actorId, 'linche');
  assert.match(protagonist.choice, /第20年.*B4/);
  assert.match(protagonist.outcome, /复核未形成可靠结论/);
  assert.match(linche.choice, /第20年.*F6/);
  assert.match(linche.outcome, /停闸与先行撤离权生效/);
  assert.doesNotMatch(linche.outcome, /复核确认/);
  assert.ok(!protagonist.sourceIds.some(id => id.includes(':linche:')));
  assert.ok(!linche.sourceIds.some(id => id.includes(':protagonist:')));
  assertSources(state, view);
});

test('each actor may explicitly pass without fabricating missed records or personal history', () => {
  const state = twoActors(); decade(state);
  const view = getDecadeReview(state);
  assert.equal(view.cards.length, 2);
  for (const card of view.cards) {
    assert.match(card.choice, /明确放弃/);
    assert.ok(card.sourceIds.includes(`pass:20:${card.actorId}`));
  }
  assert.doesNotMatch(allText(view), /父亲|你记得|亲历|曾在免费学校任教/);
  assertSources(state, view);
});

test('year30 support and successful later checks never revise the saved year23 loss', () => {
  const state = twoActors(); decade(state);
  const loss = structuredClone(state.flags.crisis);
  lock(state, 'protagonist', 'D5', 'mutual_aid'); decade(state);
  const before = JSON.stringify(state), view = getDecadeReview(state);
  assert.match(view.cards[0].choice, /第30年.*后续生计/);
  assert.match(view.cards[0].outcome, /第31年.*支持生计/);
  assert.match(view.cards[0].responsibility, /第23年已记录的损失仍在/);
  assert.equal(view.cards[1].actorId, 'linche');
  assert.deepEqual(state.flags.crisis, loss); assert.equal(JSON.stringify(state), before);
  assertSources(state, view);
  const future = twoActors(6);
  lock(future, 'protagonist', 'B4', 'independent_review');
  lock(future, 'linche', 'D4', 'free_warning'); decade(future);
  const failed = future.events.find(e => e.actionId === 'independent_review');
  assert.equal(failed.status, 'failed');
  const past = structuredClone({ crisis: future.flags.crisis, failure: future.history.find(h => h.id === `resolved:${failed.id}`) });
  lock(future, 'protagonist', 'B4', 'complete_review');
  lock(future, 'linche', 'E4', 'train_network'); decade(future);
  const later = getDecadeReview(future);
  assert.match(later.cards[0].outcome, /第32年.*遗留校验在实际人手支持下完成.*只新增面向未来的核查能力/);
  assert.match(later.cards[0].responsibility, /原来的复核失败保留.*第23年已记录的损失仍在/);
  assert.equal(future.flags.review, undefined);
  assert.deepEqual({ crisis: future.flags.crisis, failure: future.history.find(h => h.id === `resolved:${failed.id}`) }, past);
  assertSources(future, later);
});

test('cancelled year32 recovery remains unfulfilled and preserves the previous failure and loss', () => {
  const state = twoActors(6);
  lock(state, 'protagonist', 'B4', 'independent_review');
  lock(state, 'linche', 'D4', 'free_warning'); decade(state);
  const failed = state.events.find(e => e.actionId === 'independent_review');
  assert.equal(failed.status, 'failed');
  const past = structuredClone({ crisis: state.flags.crisis, failure: state.history.find(h => h.id === `resolved:${failed.id}`) });
  assert.ok(past.crisis.damage > 0);
  lock(state, 'protagonist', 'B4', 'complete_review'); decade(state);
  const recovery = state.events.find(e => e.actionId === 'complete_review');
  assert.equal(recovery.status, 'cancelled');
  assert.equal(recovery.resolvedYear, 32);
  const before = JSON.stringify(state), view = getDecadeReview(state), card = view.cards[0];
  assert.match(card.choice, /第30年.*B4/);
  assert.match(card.outcome, /第32年.*行动取消，未兑现原定安排/);
  assert.doesNotMatch(card.outcome, /成功|实际人手支持下完成|新增.*核查能力/);
  assert.match(card.responsibility, /取消记录与已付成本保留.*第23年已记录的损失仍在/);
  assert.ok(card.sourceIds.includes(recovery.sourceActionId));
  assert.ok(card.sourceIds.includes(`resolved:${recovery.id}`));
  assert.ok(card.sourceIds.includes('crisis-impact'));
  assert.equal(state.flags.review, undefined);
  assert.deepEqual({ crisis: state.flags.crisis, failure: state.history.find(h => h.id === `resolved:${failed.id}`) }, past);
  assert.equal(JSON.stringify(state), before);
  assertSources(state, view);
});

test('unresolved genuine commitments remain pending; flags and missing results cannot promote them', () => {
  const state = built(), event = state.events.find(e => e.actionId === 'build_joint');
  state.events = [event];
  state.history = state.history.filter(h => h.id !== `resolved:${event.id}` && !h.id.includes(':training'));
  Object.assign(event, { year: 12, status: 'pending' }); delete event.resolvedYear;
  const view = getDecadeReview(state);
  assert.match(view.cards[0].outcome, /第12年兑现，目前仍待结果/);
  assert.doesNotMatch(view.cards[0].outcome, /水文站启用/);
  assert.equal(view.cards[0].sourceIds.length, 1);
  const missing = built(); missing.history = missing.history.filter(h => h.id !== `resolved:${event.id}`);
  assert.match(getDecadeReview(missing).cards[0].outcome, /结果未知/);
  assertSources(state, view);
});

test('root cancellation requires its own matching cancelled historical record', () => {
  const state = built(), event = state.events.find(e => e.actionId === 'build_joint');
  const outcome = state.history.find(h => h.id === `resolved:${event.id}`);
  event.status = 'cancelled'; outcome.status = 'cancelled'; outcome.kind = 'cancelled';
  const view = getDecadeReview(state);
  assert.match(view.cards[0].outcome, /行动取消，未兑现/);
  assert.doesNotMatch(view.cards[0].outcome, /启用|培训抵达/);
  assertSources(state, view);
});

test('altered source, actor, window, event, cell or outcome is not evidence of fulfillment', () => {
  const original = built();
  const event = state => state.events.find(e => e.actionId === 'build_joint');
  const source = state => state.history.find(h => h.id === event(state).sourceActionId);
  const outcome = state => state.history.find(h => h.id === `resolved:${event(state).id}`);
  const changes = [
    s => source(s).year = 10,
    s => source(s).kind = 'history',
    s => source(s).status = 'failed',
    s => source(s).cellId = 'F6',
    s => source(s).actorId = 'linche',
    s => source(s).sourceActionId = 'other',
    s => source(s).parentId = 'arrival',
    s => source(s).actionId = 'preserve_records',
    s => s.actors[0].availableFrom = 10,
    s => event(s).id = 'other',
    s => event(s).parentId = 'arrival',
    s => event(s).sourceActionId = 'other',
    s => event(s).actorId = 'linche',
    s => event(s).kind = 'history',
    s => event(s).cellId = 'F6',
    s => event(s).resolvedYear = 2,
    s => event(s).status = 'pending',
    s => outcome(s).cellId = 'F6',
    s => outcome(s).actorId = 'linche',
    s => outcome(s).year = 2,
    s => outcome(s).parentId = 'arrival',
    s => outcome(s).sourceActionId = 'other',
    s => outcome(s).actionId = 'preserve_records',
    s => outcome(s).status = 'failed',
    s => outcome(s).kind = 'failure',
    s => s.history.push(structuredClone(source(s))),
    s => s.history.push(structuredClone(outcome(s))),
    s => s.events.push(structuredClone(event(s))),
  ];
  for (const change of changes) {
    const state = structuredClone(original); change(state);
    const view = getDecadeReview(state);
    assert.ok(view.cards.every(card => !/水文站启用|培训抵达/.test(card.outcome)), change.toString());
    assertSources(state, view);
  }
});

test('unrelated, inconsistent or unrecorded descendants do not inherit credit', () => {
  const original = built();
  const changes = [
    s => s.events.find(e => e.actionId === 'training').parentId = 'other',
    s => s.events.find(e => e.actionId === 'training').sourceActionId = 'action:10:protagonist:D4:renew_charter',
    s => s.events.find(e => e.actionId === 'training').cellId = 'F6',
    s => s.events.find(e => e.actionId === 'training').actorId = 'linche',
    s => s.events.find(e => e.actionId === 'training').resolvedYear = 8,
    s => s.history = s.history.filter(h => !h.id.endsWith(':training')),
    s => s.events.find(e => e.actionId === 'training').status = 'cancelled',
  ];
  for (const change of changes) {
    const state = structuredClone(original); change(state);
    const view = getDecadeReview(state);
    assert.match(view.cards[0].outcome, /水文站启用/);
    assert.doesNotMatch(view.cards[0].outcome, /培训抵达|分站/);
    assert.equal(view.cards[0].sourceIds.length, 2);
    assertSources(state, view);
  }
});

test('view is immutable, deterministic, detached, and never reads hidden rolls', () => {
  const state = built(), before = JSON.stringify(state);
  const expected = getDecadeReview(freeze(state));
  assert.deepEqual(getDecadeReview(state), expected);
  assert.equal(JSON.stringify(state), before);
  expected.cards[0].sourceIds.push('not-history');
  assert.ok(!getDecadeReview(state).cards[0].sourceIds.includes('not-history'));
  const guarded = built();
  for (const record of [...guarded.events, ...guarded.history]) {
    Object.defineProperty(record, 'roll', { get() { throw new Error('hidden roll accessed'); } });
  }
  assert.doesNotThrow(() => getDecadeReview(guarded));
  assert.doesNotMatch(JSON.stringify(getDecadeReview(guarded)), /probability|"roll"/);
});
