import test from 'node:test';
import assert from 'node:assert/strict';
import { getDecisionStageCopy, getLockedOutcomeLabel, getActionResponsibility } from '../src/decision-stage-copy.js';
import * as current from '../src/simulation.js';
import * as original from './fixtures/pre-tradeoffs-simulation.js';
import * as preWorkload from './fixtures/pre-training-workload-producer/simulation.js';
import { checkpoints, copy } from './fixtures/pre-training-workload-scenarios.js';
import { restoreSave } from '../src/save.js';

test('decision stages distinguish reading, saving a draft, committing and advancing years', () => {
  const preview = getDecisionStageCopy('preview');
  assert.match(preview.status, /免费预览.*不改动原有安排/);
  assert.doesNotMatch(preview.status, /尚未锁定/); // The reader may already have a draft.
  assert.match(preview.caution, /不取证.*不花调查轮次.*不支付/);
  const confirm = getDecisionStageCopy('confirm');
  assert.match(confirm.status, /只保存草稿/);
  assert.match(confirm.caution, /不支付.*不建立制度.*不揭示随机结果/);
  assert.match(confirm.caution, /已花的调查轮次不会退回/);
  assert.match(confirm.backLabel, /返回方案.*暂不锁定/);
  const window = getDecisionStageCopy('window', { phase: 'planning' });
  assert.match(window.status, /尚未提交.*尚未支付/);
  assert.match(window.primaryLabel, /统一提交.*进入逐年演变/);
  assert.doesNotMatch(window.primaryLabel, /推进十年/);
  assert.match(window.caution, /年份不会立即跳转/);
  const playback = getDecisionStageCopy('playback');
  assert.match(playback.summary, /约定年份核对.*不等于工作已经完成/);
  assert.match(playback.caution, /逐年推进才结算下一年/);
  assert.match(getLockedOutcomeLabel(), /若.*兑现.*目标/);
  assert.doesNotMatch(getLockedOutcomeLabel(), /已锁定结果|已生效|已完成/);
});

test('stale saved window routes never claim already-paid costs are unpaid', () => {
  for (const phase of ['playback', 'ended', 'unknown']) {
    const text = Object.values(getDecisionStageCopy('window', { phase })).join(' ');
    assert.doesNotMatch(text, /成本尚未支付|草稿尚未提交|提交会一次性支付/);
    assert.match(text, /不能再次支付、提交或改写/);
  }
});

test('stage copy is detached and cannot inspect a random result or saved history', () => {
  const state = new Proxy({ phase: 'planning' }, { get(target, key) {
    assert.equal(key, 'phase');
    return target[key];
  } });
  const first = getDecisionStageCopy('window', state);
  first.status = 'changed by consumer';
  assert.match(getDecisionStageCopy('window', state).status, /尚未提交/);
  for (const stage of ['preview', 'confirm', 'playback']) getDecisionStageCopy(stage, state);
  assert.equal(getDecisionStageCopy('not-a-stage', state), null);
});

test('responsibility copy does not invent quotations, consent, workload changes or future results', () => {
  const actions = ['build_merchant', 'build_state', 'build_joint', 'preserve_records', 'renew_charter',
    'recruit_volunteer', 'recruit_successor', 'recruit_risk', 'restore_archive', 'fund_school', 'mutual_aid',
    'free_warning', 'present_archive', 'relocate_teacher', 'independent_review', 'local_veto', 'train_network',
    'authorize_training', 'complete_review', 'establish_future_check', 'upgrade_archive_check',
    'open_port_warning', 'share_power', 'central_review', 'withdraw'];
  for (const id of actions) {
    const text = getActionResponsibility(id);
    assert.ok(text.length > 10 && text.length <= 65, `${id}: brief human responsibility`);
    assert.doesNotMatch(text, /[“”「」]|[0-9]|政治.*提高|科学.*减少|必定|已经成功|已经签署/);
    if (text.includes('已经同意')) assert.match(text, /不等于已经同意/);
  }
  assert.match(getActionResponsibility('authorize_training'), /不等于.*同意接班/);
  assert.match(getActionResponsibility('relocate_teacher'), /不等于获得苏岚的同意/);
  assert.match(getActionResponsibility('recruit_risk'), /已有工作/);
  assert.equal(typeof getActionResponsibility('unknown'), 'string');
  assert.equal(typeof getActionResponsibility('__proto__'), 'string');
});

test('genuine original producer histories and original contracts remain byte exact after UI reading', () => {
  const state = original.createRun(12);
  original.lockTask(state, 'protagonist', 'D4', 'build_joint', ['independent_flood_records', 'unfunded_maintenance']);
  original.commitWindow(state);
  original.advanceToNextWindow(state);
  const before = JSON.stringify(state), savedText = state.history.map(row => [row.id, row.title, row.text]);
  assert.ok(!Object.hasOwn(state, 'planningRulesVersion'));
  const restored = restoreSave({ state: copy(state) }).state;
  for (const stage of ['preview', 'confirm', 'window', 'playback']) getDecisionStageCopy(stage, restored);
  for (const action of original.getActions(state, 'D4', 'protagonist')) getActionResponsibility(action.id);
  assert.equal(JSON.stringify(restored), before);
  assert.deepEqual(restored.history.map(row => [row.id, row.title, row.text]), savedText);
});

test('genuine pre-workload and new histories keep distinct rules through every phase', () => {
  for (const [name, api] of [['old', preWorkload], ['new', current]]) {
    const route = checkpoints(api);
    for (const [phase, source] of Object.entries(route)) {
      const restored = restoreSave({ state: copy(source) }).state;
      const before = JSON.stringify(restored);
      for (const stage of ['preview', 'confirm', 'window', 'playback']) getDecisionStageCopy(stage, restored);
      getActionResponsibility('authorize_training');
      assert.equal(JSON.stringify(restored), before, `${name}/${phase}: no stored data changed`);
      assert.equal(JSON.stringify(restored), JSON.stringify(source), `${name}/${phase}: no migration`);
      assert.equal(Object.hasOwn(restored, 'trainingWorkloadRulesVersion'), name === 'new');
    }
  }
});
