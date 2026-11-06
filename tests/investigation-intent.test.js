import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as prior from './fixtures/pre-training-authorization-simulation.js';
import * as original from './fixtures/pre-tradeoffs-simulation.js';
import { evidenceFor, evidenceText } from '../src/story.js';
import { evidenceTitleFor, investigationIntentFor } from '../src/investigation-intent.js';
import { investigateAndLock as lock } from './helpers/play.js';

const clone = value => structuredClone(value);
function next(state, api = sim) {
  for (const actor of api.getActors(state)) if (!state.drafts[actor.id]) api.passTask(state, actor.id);
  api.commitWindow(state); api.advanceToNextWindow(state); return state;
}
function choose(state, actorId, cellId, actionId, api = sim) {
  if (api === sim) return lock(state, actorId, cellId, actionId);
  const action = api.getActions(state, cellId, actorId).find(item => item.id === actionId);
  if (api.usesTradeoffs?.(state)) for (const id of action.requireEvidence) api.investigate(state, actorId, cellId, id);
  api.lockTask(state, actorId, cellId, actionId, action.requireEvidence);
}
function joint20(api = sim) {
  const state = api.createRun(0);
  choose(state, 'protagonist', 'D4', 'build_joint', api); next(state, api);
  choose(state, 'protagonist', 'D4', 'recruit_successor', api); next(state, api);
  return state;
}
function authorization30(api = sim) {
  const state = joint20(api);
  choose(state, 'protagonist', 'B4', 'independent_review', api);
  choose(state, 'linche', 'D4', 'free_warning', api); next(state, api);
  return state;
}
function absent20() {
  const state = sim.createRun(0); next(state);
  lock(state, 'protagonist', 'D4', 'recruit_volunteer'); next(state); return state;
}
function upgrade30() {
  const state = sim.createRun(0); lock(state, 'protagonist', 'B4', 'preserve_records'); next(state);
  lock(state, 'protagonist', 'D4', 'recruit_volunteer'); next(state);
  lock(state, 'protagonist', 'B4', 'local_veto'); lock(state, 'linche', 'E4', 'train_network'); next(state);
  return state;
}
function recovery30() {
  const state = absent20(); lock(state, 'protagonist', 'B4', 'independent_review');
  lock(state, 'linche', 'E4', 'train_network'); next(state);
  assert.equal(state.events.find(event => event.actionId === 'independent_review').status, 'failed');
  return state;
}
function port30() {
  const state = sim.createRun(6); lock(state, 'protagonist', 'D4', 'build_merchant'); next(state);
  lock(state, 'protagonist', 'D4', 'recruit_successor'); next(state);
  lock(state, 'protagonist', 'F6', 'independent_review'); lock(state, 'linche', 'D4', 'free_warning'); next(state);
  assert.equal(state.events.find(event => event.actionId === 'independent_review').status, 'failed');
  return state;
}
const material = (state, cellId, id, actorId = 'protagonist') => investigationIntentFor(state, cellId, actorId).evidence.find(item => item.id === id);
const freeze = value => {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
};

test('all natural available locations at 0/10/20/30 have a short current choice and matching public material names', () => {
  const state = sim.createRun(0), states = [clone(state)];
  lock(state, 'protagonist', 'D4', 'build_joint'); next(state); states.push(clone(state));
  lock(state, 'protagonist', 'D4', 'recruit_successor'); next(state); states.push(clone(state));
  lock(state, 'protagonist', 'B4', 'independent_review'); lock(state, 'linche', 'D4', 'free_warning'); next(state); states.push(clone(state));
  for (const current of [...states, upgrade30(), recovery30(), port30(), next(absent20())]) {
    for (const actor of sim.getActors(current)) for (const cell of current.cells) {
      const actions = sim.getActions(current, cell.id, actor.id), intent = investigationIntentFor(current, cell.id, actor.id);
      if (!actions.length) { assert.equal(intent, null); continue; }
      assert.ok(intent.question.includes('？')); assert.ok(intent.question.length <= 80);
      assert.deepEqual(intent.evidence.map(item => item.id), sim.getEvidenceIds(current, cell.id, actor.id));
      for (const entry of intent.evidence) {
        assert.equal(entry.title, evidenceTitleFor(current, entry.id, cell.id, actor.id));
        assert.equal(entry.title, evidenceFor(current, entry.id, cell.id, actor.id).title);
        assert.ok(entry.prompt.endsWith('？'));
        for (const action of entry.localActions) assert.ok(actions.some(candidate => candidate.id === action.id));
      }
    }
  }
});

test('D4 year20 describes local testimony and old-life conversation separately from portable emergency work', () => {
  const state = joint20(), before = JSON.stringify(state);
  const resident = material(state, 'D4', 'resident_testimony'), old = material(state, 'D4', 'old_reality_record');
  assert.deepEqual(resident.localActions.map(action => action.id), ['free_warning']); assert.deepEqual(resident.destinations, []);
  assert.deepEqual(old.localActions.map(action => action.id), ['present_archive']);
  for (const [id, actionId] of [['anomaly_records', 'independent_review'], ['evacuation_routes', 'local_veto']]) {
    const entry = material(state, 'D4', id);
    assert.equal(entry.usage, 'portable'); assert.deepEqual(entry.localActions, []);
    assert.deepEqual(entry.destinations.map(place => place.cellId), ['B4', 'F6']);
    assert.ok(entry.destinations.every(place => place.actions[0].id === actionId));
  }
  assert.equal(JSON.stringify(state), before);
  sim.investigate(state, 'protagonist', 'D4', 'anomaly_records'); sim.investigate(state, 'protagonist', 'D4', 'old_reality_record');
  assert.equal(sim.getInvestigation(state, 'protagonist', 'D4').budget, 0);
  assert.throws(() => sim.investigate(state, 'protagonist', 'D4', 'resident_testimony'), /调查轮次不足/);
  assert.equal(material(state, 'D4', 'resident_testimony').usage, 'local'); // A use is not a promise of remaining budget.
});

test('E4 authorization title is public and consistent, while year30 old-life material has no invented year20 use', () => {
  const state = authorization30(), before = JSON.stringify(state), actor = 'linche';
  assert.match(investigationIntentFor(state, 'E4', actor).question, /原学徒.*承接权.*轮值教学/);
  const resident = material(state, 'E4', 'resident_testimony', actor), old = material(state, 'E4', 'old_reality_record', actor);
  assert.equal(resident.title, '听取原学徒的承接条件'); assert.deepEqual(resident.localActions.map(action => action.id), ['authorize_training']);
  assert.equal(old.usage, 'background'); assert.deepEqual(old.localActions, []); assert.deepEqual(old.destinations, []);
  assert.doesNotMatch(old.prompt, /呈示|回应|签名|同意|解锁/);
  assert.equal(JSON.stringify(state), before);
  sim.investigate(state, actor, 'E4', 'anomaly_records'); sim.investigate(state, actor, 'E4', 'old_reality_record');
  assert.throws(() => sim.investigate(state, actor, 'E4', 'resident_testimony'), /调查轮次不足/);
  assert.equal(sim.getTrainingAuthorizationPlan(state).available, true); // Offer survives; ability to research does not.
});

test('B4 future, archive-upgrade and recovery material titles follow their real distinct contracts', () => {
  const future = next(absent20()), upgrade = upgrade30(), recovery = recovery30();
  for (const [state, actionId, anomalyTitle, residentTitle] of [
    [future, 'establish_future_check', '核对未来校验所需的新记录', '听取修院居民对新校验席的条件'],
    [upgrade, 'upgrade_archive_check', '重读保档中的异源刻度', '听取修院居民对保档升级的条件'],
    [recovery, 'complete_review', '重读未完成的异源校验', '听取岸边居民的证词'],
  ]) {
    assert.equal(material(state, 'B4', 'anomaly_records').title, anomalyTitle);
    assert.equal(evidenceTitleFor(state, 'resident_testimony', 'B4'), residentTitle);
    assert.deepEqual(material(state, 'B4', 'anomaly_records').localActions.map(action => action.id), [actionId]);
    assert.equal(material(state, 'B4', 'resident_testimony').usage, actionId === 'complete_review' ? 'background' : 'local');
    const carried = material(state, 'E4', 'anomaly_records', 'linche');
    assert.ok(carried.destinations.some(place => place.cellId === 'B4' && place.actions.some(action => action.id === actionId)));
    assert.deepEqual(material(state, 'E4', 'resident_testimony', 'linche').destinations, []);
  }
});

test('F6 has a real choice between finishing review and opening access, not a generic archive invitation', () => {
  const state = port30(), before = JSON.stringify(state), intent = investigationIntentFor(state, 'F6');
  assert.match(intent.question, /旧底稿.*开放预警/);
  assert.deepEqual(material(state, 'F6', 'anomaly_records').localActions.map(action => action.id), ['complete_review']);
  assert.deepEqual(material(state, 'F6', 'resident_testimony').localActions.map(action => action.id), ['open_port_warning']);
  assert.match(material(state, 'F6', 'resident_testimony').prompt, /收费窗外/);
  assert.deepEqual(material(state, 'F6', 'resident_testimony').destinations, []);
  assert.equal(material(state, 'F6', 'old_reality_record').usage, 'background');
  assert.equal(JSON.stringify(state), before);
});

test('year10 successor question and title never create an absent post, including original archives', () => {
  const absent = sim.createRun(0); next(absent);
  assert.equal(evidenceTitleFor(absent, 'successor_consent'), '确认是否有岗位需要交接');
  assert.doesNotMatch(investigationIntentFor(absent, 'D4').question, /空岗|接班|交接/);
  const active = sim.createRun(0); lock(active, 'protagonist', 'D4', 'build_joint'); next(active);
  assert.equal(evidenceTitleFor(active, 'successor_consent'), '与苏岚商量培训与接班');
  assert.deepEqual(material(active, 'D4', 'successor_consent').localActions.map(action => action.id), ['recruit_successor']);
  const old = original.createRun(0); next(old, original);
  assert.doesNotMatch(investigationIntentFor(old, 'D4').question, /空岗|接班|交接/);
});

test('the companion is not offered refused relocation or the protagonist’s personal memory', () => {
  const state = joint20(), protagonist = investigationIntentFor(state, 'D4'), companion = investigationIntentFor(state, 'D4', 'linche');
  assert.match(protagonist.question, /迁任/); assert.doesNotMatch(companion.question, /迁任/);
  assert.match(companion.evidence.find(item => item.id === 'old_reality_record').prompt, /主角带来的旧履历/);
  assert.doesNotMatch(JSON.stringify(companion), /你记得|你的亲历|relocate_teacher/);
  assert.equal(investigationIntentFor(sim.createRun(0), 'D4', 'linche'), null);
});

test('genuine previous producer retains old E4 offers and original evidence rules do not claim portability', () => {
  const state = authorization30(prior), before = JSON.stringify(state);
  assert.equal(state.trainingAuthorizationRulesVersion, undefined);
  const intent = investigationIntentFor(state, 'E4', 'linche');
  assert.doesNotMatch(intent.question, /原学徒|承接权/);
  assert.equal(material(state, 'E4', 'resident_testimony', 'linche').title, '听取岸边居民的证词');
  assert.equal(material(state, 'E4', 'resident_testimony', 'linche').usage, 'background');
  assert.equal(JSON.stringify(state), before);
  const old = joint20(original), oldBefore = JSON.stringify(old), originalIntent = investigationIntentFor(old, 'D4');
  assert.ok(originalIntent.evidence.every(item => item.destinations.length === 0));
  assert.equal(originalIntent.evidence.find(item => item.id === 'anomaly_records').usage, 'background');
  assert.equal(JSON.stringify(old), oldBefore);
});

test('all public questions and names are independent of unread prose, seed, rolls and future text', () => {
  const states = [sim.createRun(0), joint20(), authorization30(), next(absent20()), upgrade30(), recovery30(), port30()];
  const expected = states.map(state => ['D4', 'B4', 'E4', 'D5', 'F6'].map(cellId => investigationIntentFor(state, cellId)));
  const saved = Object.fromEntries(Object.entries(evidenceText).map(([id, value]) => [id, Object.getOwnPropertyDescriptor(value, 'text')]));
  try {
    for (const entry of Object.values(evidenceText)) Object.defineProperty(entry, 'text', { configurable: true, get() { throw Error('Unread material must stay closed'); } });
    for (const [index, source] of states.entries()) {
      const state = clone(source);
      Object.defineProperty(state, 'seed', { get() { throw Error('Seed is private'); } });
      for (const record of [...state.history, ...state.events]) for (const key of ['text', 'title', 'description', 'roll']) {
        Object.defineProperty(record, key, { configurable: true, get() { throw Error(`Private narrative: ${key}`); } });
      }
      assert.deepEqual(['D4', 'B4', 'E4', 'D5', 'F6'].map(cellId => investigationIntentFor(state, cellId)), expected[index]);
    }
  } finally {
    for (const [id, descriptor] of Object.entries(saved)) Object.defineProperty(evidenceText[id], 'text', descriptor);
  }
});

test('read-only intent preserves frozen histories, investigations and drafts and returns detached values', () => {
  const state = authorization30(); lock(state, 'protagonist', 'D4', 'share_power');
  const before = JSON.stringify(state), intent = investigationIntentFor(freeze(clone(state)), 'E4', 'linche');
  intent.evidence[0].title = 'not a real title'; intent.evidence[0].localActions[0].title = 'not a real action';
  assert.equal(material(state, 'E4', 'resident_testimony', 'linche').title, '听取原学徒的承接条件');
  assert.equal(JSON.stringify(state), before);
  next(state); assert.equal(investigationIntentFor(state, 'D4'), null);
});
