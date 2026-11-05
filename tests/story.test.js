import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, getActions, getActors, passTask, commitWindow, advanceToNextWindow } from '../src/simulation.js';
import { sceneFor, evidenceFor } from '../src/story.js';
import { investigateAndLock as lockTask } from './helpers/play.js';
function decade(state, action, cellId = 'D4') {
  if (action) lockTask(state, 'protagonist', cellId, action);
  for (const actor of getActors(state)) if (!state.drafts[actor.id]) passTask(state, actor.id);
  commitWindow(state); advanceToNextWindow(state);
}
const body = state => sceneFor(state, 'D4').body.join('\n');
test('no-build playthrough never invents trainees, management, a rescued father or a station', () => {
  const state = createRun();
  decade(state);
  assert.match(body(state), /没有河港测站投入运转/);
  assert.doesNotMatch(body(state), /第一批学徒已经/);
  decade(state);
  assert.equal(sceneFor(state, 'D4').speaker, '苏岚 · 河港居民');
  assert.match(body(state), /没有属于她的测站管理岗位/);
  assert.doesNotMatch(body(state), /父亲/);
  assert.match(state.history.find(event => event.id === 'old-reality-conflict').text, /没有建成水文站/);
  decade(state);
  assert.match(body(state), /测站一直没有建成/);
  assert.match(body(state), /没有现存的培训点或学校/);
});
test('failed build is acknowledged rather than replaying the successful training story', () => {
  const state = createRun(6); decade(state, 'build_joint');
  assert.match(body(state), /建站协议没能兑现/);
  assert.match(body(state), /小型档案站/);
  decade(state);
  assert.match(body(state), /没有正在运转的水文站/);
  assert.doesNotMatch(body(state), /父亲|河港的管理者/);
});
test('successful renewal preserves the public station and Linche’s teaching without appointing Sulan', () => {
  const state = createRun(12); decade(state, 'build_joint');
  assert.match(body(state), /第一批学徒已经/);
  decade(state, 'renew_charter');
  assert.equal(sceneFor(state, 'D4').speaker, '苏岚 · 河港居民');
  assert.match(body(state), /林澈留下带教.*没有记录苏岚接任/);
  assert.match(state.history.find(event => event.id === 'resolved:event:action:10:protagonist:D4:renew_charter').text, /林澈留下带教/);
  assert.match(body(state), /仍向居民开放/);
  assert.doesNotMatch(body(state), /父亲/);
  assert.match(state.history.find(event => event.id === 'old-reality-conflict').text, /测站仍在运转/);
});
test('unattended station is presented as shut down while prior training remains', () => {
  const state = createRun(12); decade(state, 'build_joint'); decade(state, 'recruit_risk');
  assert.match(body(state), /测站的门关着/);
  assert.equal(sceneFor(state, 'D4').speaker, '苏岚 · 河港居民');
  assert.match(state.history.find(event => event.id === 'old-reality-conflict').text, /测站已经停运/);
  decade(state);
  assert.match(body(state), /如今已经停运/);
  assert.match(body(state), /仍有人教授读尺/);
});
test('rebuilding creates a real station without claiming the missed training chain', () => {
  const state = createRun(6); decade(state, 'build_joint'); decade(state, 'restore_archive');
  assert.match(body(state), /测站仍在运转/);
  assert.equal(state.institutions.some(i => i.kind === 'training'), false);
  assert.match(sceneFor(state, 'E4').body.join(''), /还没有持续运作的课堂/);
  assert.match(sceneFor(state, 'F6').body.join(''), /没有在这里建成分站/);
});
test('intermediate years retain their decade chapter instead of jumping to the finale', () => {
  const state = createRun();
  state.year = 4;
  assert.match(sceneFor(state, 'D4').subtitle, /第一卷/);
  state.year = 24;
  assert.match(sceneFor(state, 'D4').subtitle, /第三卷/);
});

test('no-build options and evidence describe a proposed service instead of unpaid station work', () => {
  const state = createRun();
  assert.match(evidenceFor(state, 'resident_testimony').text, /还没有持续运转/);
  assert.doesNotMatch(evidenceFor(state, 'resident_testimony').text, /居民感谢/);
  decade(state);
  assert.match(evidenceFor(state, 'successor_consent').title, /是否有岗位/);
  assert.match(evidenceFor(state, 'successor_consent').text, /没有正在运转/);
  assert.doesNotMatch(evidenceFor(state, 'successor_consent').text, /学徒苏岚同意接班/);
  decade(state);
  const warning = getActions(state, 'D4').find(action => action.id === 'free_warning');
  assert.equal(warning.title, '建立居民传讯队');
  assert.doesNotMatch(warning.description + warning.reward, /欠薪|恢复公开服务/);
  assert.match(warning.description, /还没有水文站/);
  assert.doesNotMatch(getActions(state, 'D4').find(action => action.id === 'relocate_teacher').risk, /失去维护/);
  assert.doesNotMatch(evidenceFor(state, 'anomaly_records').text, /几座测站/);
});
test('resident testimony distinguishes active public, paid and shut-down service', () => {
  const publicRun = createRun(12); decade(publicRun, 'build_joint');
  assert.match(evidenceFor(publicRun, 'resident_testimony').text, /现有的公开预警/);
  decade(publicRun);
  assert.match(evidenceFor(publicRun, 'resident_testimony').text, /收费门槛/);
  const stopped = createRun(12); decade(stopped, 'build_joint'); decade(stopped, 'recruit_risk');
  assert.match(evidenceFor(stopped, 'resident_testimony').text, /还没有持续运转/);
  assert.match(getActions(stopped, 'D4').find(action => action.id === 'free_warning').title, /恢复测站/);
});
test('coverage rules are disclosed as model assumptions in relevant action previews', () => {
  const state = createRun();
  for (const action of getActions(state, 'D4')) assert.ok(action.modelNote);
  decade(state); decade(state);
  assert.match(getActions(state, 'D4').find(action => action.id === 'free_warning').modelNote, /0.65/);
});

test('Linche reads the protagonist’s R0 witness instead of inheriting personal memories', () => {
  const state = createRun(12); decade(state, 'build_joint'); decade(state, 'recruit_successor');
  assert.ok(getActors(state).some(actor => actor.id === 'linche'));
  const before = structuredClone(state);
  const protagonist = sceneFor(state, 'D4', 'protagonist');
  const companion = sceneFor(state, 'D4', 'linche');
  assert.deepEqual(sceneFor(state, 'D4'), protagonist);
  assert.match(protagonist.body.join(''), /你记得她讲课时总开着窗/);
  assert.match(protagonist.body.join(''), /那是你记得的我/);
  assert.match(companion.body.join(''), /主角保存的旧现实档案/);
  assert.match(companion.body.join(''), /不是你的亲历记忆/);
  assert.match(companion.body.join(''), /那是档案里的我/);
  assert.doesNotMatch(companion.body.join(''), /你记得她讲课|那是你记得的我/);
  assert.equal(companion.speaker, protagonist.speaker);
  assert.match(companion.body.join(''), /收费牌也还挂着/);
  assert.deepEqual(state, before);
});

test('companion perspective preserves no-build, failed-build and stopped-station branches', () => {
  for (const [build, seed, expected] of [[null, 12, /没有属于她的测站管理岗位/], ['build_joint', 6, /没有正在运转的水文站/], ['build_joint', 12, /测站的门关着/]]) {
    const state = createRun(seed); decade(state, build); decade(state, build ? 'recruit_risk' : 'recruit_volunteer');
    const scene = sceneFor(state, 'D4', 'linche');
    assert.match(scene.body.join(''), expected);
    assert.match(scene.body.join(''), /不是你的亲历记忆/);
    assert.equal(scene.speaker, '苏岚 · 河港居民');
    assert.doesNotMatch(scene.body.join(''), /你记得她讲课|那是你记得的我|父亲/);
  }
});

test('R0 evidence identifies whose witness it is while local testimony stays state-dependent', () => {
  const state = createRun(12); decade(state, 'build_joint'); decade(state, 'recruit_successor');
  const old = evidenceFor(state, 'old_reality_record', 'D4', 'linche');
  assert.match(old.text, /R0｜已归档现实/);
  assert.match(old.text, /由主角从亲历的旧现实中保存/);
  assert.match(old.text, /他人见证/);
  assert.match(old.text, /不是入局锚定后凭空获得的记忆/);
  assert.deepEqual(evidenceFor(state, 'old_reality_record'), evidenceFor(state, 'old_reality_record', 'D4', 'protagonist'));
  for (const id of ['resident_testimony', 'successor_consent', 'unfunded_maintenance', 'anomaly_records']) {
    assert.deepEqual(evidenceFor(state, id, 'D4', 'linche'), evidenceFor(state, id, 'D4', 'protagonist'));
  }
  assert.match(evidenceFor(state, 'resident_testimony', 'D4', 'linche').text, /收费门槛/);
  assert.match(evidenceFor(state, 'successor_consent', 'D4', 'linche').title, /与苏岚商量培训与接班/);
  assert.doesNotMatch(evidenceFor(state, 'successor_consent', 'D4', 'linche').text, /苏岚带着已经完成的读尺记录/);
});

test('far-port provenance does not claim either actor has never intervened there', () => {
  const state = createRun(12); decade(state, 'build_joint'); decade(state, 'recruit_successor');
  lockTask(state, 'linche', 'F6', 'local_veto', []);
  decade(state);
  for (const actorId of ['protagonist', 'linche']) {
    const text = sceneFor(state, 'F6', actorId).body.join('');
    assert.match(text, /河港协议的抄本/);
    assert.match(text, /经过东岸的课堂/);
    assert.doesNotMatch(text, /你在这里从未落过笔|你记得她讲课/);
  }
});
