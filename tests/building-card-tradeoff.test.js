import test from 'node:test';
import assert from 'node:assert/strict';
import * as current from '../src/simulation.js';
import * as original from './fixtures/legacy-simulation.js';
import * as coverage from './fixtures/pre-tradeoffs-simulation.js';
import * as previous from './fixtures/pre-decision-flow-producer/simulation.js';
import { restoreSave } from '../src/save.js';
import { BUILDING_ACTION_IDS, getBuildingContract } from '../src/building-contract.js';
import { getBuildingCardTradeoff } from '../src/building-card-tradeoff.js';

const producers = [['current', current], ['original', original], ['coverage', coverage], ['previous', previous]];
const copy = structuredClone;
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function expected(contract) {
  return [
    { field: 'reward', label: '若合同兑现', text: contract.displayReward, known: true },
    { field: 'risk', label: '仍需承担', text: contract.displayRisk, known: true },
  ];
}
function submit(api, state, id) {
  if (id) {
    const action = api.getActions(state, 'D4').find(a => a.id === id);
    if (api.usesTradeoffs?.(state)) for (const evidence of action.requireEvidence) api.investigate(state, 'protagonist', 'D4', evidence);
    api.lockTask(state, 'protagonist', 'D4', id, action.requireEvidence);
  }
  for (const actor of api.getActors(state)) if (!state.drafts[actor.id]) api.passTask(state, actor.id);
  api.commitWindow(state);
}
for (const [name, api] of producers) test(`${name} build cards copy full available public terms without mutation`, () => {
  const state = api.createRun(0), before = copy(state);
  for (const id of BUILDING_ACTION_IDS) {
    const contract = getBuildingContract(state, id);
    const view = getBuildingCardTradeoff(freeze(state), id);
    assert.deepEqual(view, expected(contract));
    if (name !== 'original') {
      const action = current.getActions(state, 'D4').find(a => a.id === id);
      assert.equal(view[0].text, action.reward);
      assert.equal(view[1].text, action.risk);
    } else {
      assert.match(view[0].text, /若成功.*足额维护、人手齐备.*年度源项/);
      assert.match(view[0].text, /若各步来源仍运转.*第7年.*第12年/);
      assert.match(view[1].text, /失败成本不退.*原教学链不启动.*旧版整体公式/);
      assert.doesNotMatch(JSON.stringify(view), /较小.*保护|有限保护|减少.*损失|0\.45|10%|15%/);
    }
    view[0].text = 'forged'; view[1].label = 'guaranteed'; view.push({});
    assert.deepEqual(getBuildingCardTradeoff(state, id), expected(contract));
  }
  assert.deepEqual(state, before);
});

for (const [name, api] of producers) test(`${name} build cards do not read seed, rolls or evidence contents`, () => {
  const first = api.createRun(0), second = api.createRun(91);
  for (const id of BUILDING_ACTION_IDS) assert.deepEqual(getBuildingCardTradeoff(first, id), getBuildingCardTradeoff(second, id));
  const deny = label => ({ enumerable: true, get() { throw Error(`Read ${label}`); } });
  Object.defineProperty(first, 'seed', deny('seed'));
  Object.defineProperty(first, 'randomResults', deny('randomResults'));
  Object.defineProperty(first, 'evidenceContents', deny('evidenceContents'));
  const event = { actionId: 'build_joint', status: 'pending' };
  Object.defineProperty(event, 'roll', deny('roll')); first.events.push(event);
  for (const id of BUILDING_ACTION_IDS) assert.deepEqual(getBuildingCardTradeoff(first, id), getBuildingCardTradeoff(second, id));
});

test('unavailable scopes do not fabricate building cards', () => {
  assert.equal(getBuildingCardTradeoff(null, 'build_joint'), null);
  for (const [, api] of producers) {
    const state = api.createRun(0);
    for (const id of [undefined, '', 'build_invented', 'build_joint_extra', 'relocate_teacher', '__proto__']) assert.equal(getBuildingCardTradeoff(state, id), null);
    for (const options of [{cellId:'B4'}, {cellId:'F6'}, {actorId:'linche'}, {actorId:'invented'}]) assert.equal(getBuildingCardTradeoff(state, 'build_joint', options), null);
    submit(api, state);
    assert.equal(getBuildingCardTradeoff(state, 'build_joint'), null);
    api.advanceToNextWindow(state);
    assert.equal(state.year, 10);
    assert.equal(getBuildingCardTradeoff(state, 'build_joint'), null);
  }
});

test('independent branch policy and legacy evidence are passed through unchanged', () => {
  for (const api of [current, original]) for (const version of ['public-branch-v1', 'source-branch-v1']) {
    const state = api.createRun(0); state.branchAccessRulesVersion = version;
    const options = {cellId:'D4', actorId:'protagonist', legacyEvidence:['independent_flood_records', 'unfunded_maintenance']};
    const before = copy({state, options});
    for (const id of BUILDING_ACTION_IDS) assert.deepEqual(getBuildingCardTradeoff(freeze(state), id, freeze(options)), expected(getBuildingContract(state, id, options)));
    assert.deepEqual({state, options}, before);
    if (api === current) assert.match(getBuildingCardTradeoff(state, 'build_merchant')[1].text, version === 'public-branch-v1' ? /F6分站公开/ : /后续分站的预警覆盖/);
  }
});

for (const [name, api] of producers) test(`${name} reading cards preserves natural continuation and import through year16`, () => {
  for (const seed of [0, 6]) for (const id of BUILDING_ACTION_IDS) {
    const baseline = api.createRun(seed), viewed = copy(baseline);
    for (const build of BUILDING_ACTION_IDS) getBuildingCardTradeoff(viewed, build);
    assert.deepEqual(viewed, baseline);
    submit(api, baseline, id); submit(api, viewed, id);
    while (baseline.year < 16) {
      if (baseline.phase === 'planning') { submit(api, baseline); submit(api, viewed); }
      api.advanceYear(baseline); api.advanceYear(viewed);
      assert.deepEqual(viewed, baseline);
    }
    const restored = restoreSave({state:copy(viewed)}).state;
    assert.deepEqual(restored, baseline);
    assert.equal(getBuildingCardTradeoff(restored, id), null, 'historical institutions never become prospective cards');
  }
});
