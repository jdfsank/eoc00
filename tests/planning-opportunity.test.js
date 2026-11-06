import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from './fixtures/pre-training-workload-producer/simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import {ready, lock, next, commit} from './fixtures/pre-training-workload-scenarios.js';
import {getPlanningOpportunity} from '../src/planning-opportunity.js';
import {renderPlanningOpportunity} from '../src/planning-opportunity-view.js';

const bytes = JSON.stringify;
const copy = structuredClone;
const view = (s, actorId = 'protagonist', cellId = 'E4', actionId) => getPlanningOpportunity(s, {actorId, cellId, ...(actionId ? {actionId} : {})});
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

// No policy locks, evidence or synthetic assumptions are manufactured to render.
test('four actual protagonist states stay distinct in scene, action and window views', () => {
  const s = ready(sim);
  assert.equal(view(s).policyActor.status, 'unassigned');
  assert.match(view(s).statusText, /尚未安排/);
  lock(s, 'protagonist', 'D4', 'share_power', sim);
  for (const options of [{}, {actorId:'protagonist',cellId:'E4'}, {actorId:'protagonist',cellId:'E4',actionId:'train_network'}]) {
    const result = getPlanningOpportunity(s, options);
    assert.equal(result.policyActor.status, 'policy-locked');
    assert.equal(result.policyActor.actionId, 'share_power');
    if (options.actorId) assert.match(result.contextText, /替换已拟方针/);
  }
  const before = bytes(s);
  assert.equal(view(s, 'linche').policyActor.status, 'policy-locked');
  assert.match(view(s, 'linche').contextText, /不占主角名额/);
  assert.equal(bytes(s), before);
  lock(s, 'protagonist', 'E4', 'train_network', sim);
  assert.equal(view(s).policyActor.status, 'other-locked');
  assert.match(getPlanningOpportunity(s).contextText, /照此提交不签方针/);
  sim.passTask(s, 'protagonist');
  assert.equal(view(s).policyActor.status, 'passed');
  assert.match(view(s).statusText, /明确放弃/);
  sim.unlockTask(s, 'protagonist');
  assert.equal(view(s).policyActor.status, 'unassigned');
});

test('year30 actionable sites explain real role constraints without compulsory choices', () => {
  const s = ready(sim);
  for (const actor of sim.getActors(s)) for (const cell of s.cells) {
    const actions = sim.getActions(s, cell.id, actor.id);
    const result = view(s, actor.id, cell.id);
    assert.equal(!!result, actions.length > 0, `${actor.id}/${cell.id}`);
    if (result) {
      assert.match(result.roleText, /方针仅主角可在D4签署，林澈不能代签/);
      assert.equal(result.readOnly, true);
    }
    for (const action of actions) assert.equal(view(s, actor.id, cell.id, action.id).actionId, action.id);
  }
  assert.equal(view(s, 'linche', 'D4'), null);
  assert.equal(view(s, 'missing', 'E4'), null);
  assert.equal(view(s, 'protagonist', 'E4', 'withdraw'), null);
  assert.match(view(s, 'protagonist', 'D4', 'share_power').contextText, /不保证第40年/);
  for (const policy of ['central_review','withdraw']) assert.match(view(s, 'protagonist', 'D4', policy).contextText, /不保证第40年/);
  sim.passTask(s, 'protagonist');
  assert.match(getPlanningOpportunity(s).contextText, /可保留/);
});

test('rendering does not mutate evidence, drafts, history, payment, saves or rules', () => {
  const s = ready(sim);
  sim.investigate(s, 'protagonist', 'E4', 'resident_testimony');
  lock(s, 'linche', 'E4', 'train_network', sim);
  const before = bytes(s); freeze(s);
  for (let i = 0; i < 4; i++) for (const options of [{}, {actorId:'protagonist',cellId:'E4',actionId:'authorize_training'}, {actorId:'linche',cellId:'E4'}]) {
    const result = getPlanningOpportunity(s, options);
    assert.match(renderPlanningOpportunity(result), /data-planning-opportunity/);
    assert.equal(result.policyActor.status, 'unassigned');
  }
  assert.equal(bytes(s), before);
});

test('private seeds, random results, snapshots and material prose are not consulted', () => {
  const s = ready(sim);
  const expected = view(s);
  const refuse = (object,key) => Object.defineProperty(object,key,{configurable:true,get(){throw Error(`Private read: ${key}`);}});
  for (const key of ['seed','snapshots','baseline']) refuse(s,key);
  for (const event of s.events) for (const key of ['roll','text']) refuse(event,key);
  for (const record of s.history) refuse(record,'text');
  assert.deepEqual(view(s), expected);
});

test('unavailable windows and stale or unknown drafts never become a policy claim', () => {
  const at0 = sim.createRun(0); assert.equal(getPlanningOpportunity(at0), null);
  next(at0, sim); assert.equal(getPlanningOpportunity(at0), null);
  next(at0, sim); assert.equal(getPlanningOpportunity(at0), null);
  next(at0, sim); assert.ok(getPlanningOpportunity(at0));
  const s = ready(sim);
  for (const draft of [{actorId:'protagonist',window:20,status:'passed'}, {actorId:'protagonist',window:30,status:'other'}, {actorId:'protagonist',window:30,status:'locked',cellId:'D4',actionId:'made_up',evidence:[]}]) {
    s.drafts.protagonist = draft;
    assert.equal(getPlanningOpportunity(s).policyActor.status, 'unknown');
    assert.match(getPlanningOpportunity(s).statusText, /未知不等于/);
  }
  delete s.drafts.protagonist; commit(s, sim);
  assert.equal(getPlanningOpportunity(s), null);
  sim.advanceToNextWindow(s); assert.equal(getPlanningOpportunity(s), null);
});

test('locked status requires the authoritative public task and acquired evidence', () => {
  const base = ready(sim);
  for (const mode of ['missing-required', 'unacquired', 'bad-cell', 'bad-evidence', 'wrong-actor', 'expired']) {
    const s = copy(base);
    lock(s, 'protagonist', 'E4', 'authorize_training', sim);
    const d = s.drafts.protagonist;
    if (mode === 'missing-required') d.evidence = [];
    if (mode === 'unacquired') s.investigations['30:protagonist'] = [];
    if (mode === 'bad-cell') d.cellId = 'X9';
    if (mode === 'bad-evidence') d.evidence = null;
    if (mode === 'wrong-actor') d.actorId = 'linche';
    if (mode === 'expired') d.window = 20;
    assert.equal(getPlanningOpportunity(s).policyActor.status, 'unknown', mode);
  }
  const s = copy(base);
  lock(s, 'protagonist', 'D4', 'share_power', sim);
  s.drafts.protagonist.evidence = ['resident_testimony'];
  assert.equal(getPlanningOpportunity(s).policyActor.status, 'unknown', 'unacquired evidence does not certify a locked policy');
});

test('legal no-policy preparation remains committable and naturally resolves', () => {
  const s = sim.createRun(0); next(s,sim);
  lock(s,'protagonist','D4','recruit_volunteer',sim);next(s,sim);next(s,sim);
  lock(s,'protagonist','B4','establish_future_check',sim);
  lock(s,'linche','E4','train_network',sim);
  const before = bytes(s), result = getPlanningOpportunity(s);
  assert.equal(result.policyActor.status, 'other-locked');
  assert.equal(bytes(s), before);
  assert.equal(sim.getWindowReview(s).ready, true);
  commit(s,sim);sim.advanceToNextWindow(s);
  assert.equal(s.events.find(event=>event.actionId==='establish_future_check').status,'success');
  assert.equal(sim.getEnding(s).policy,null);
  assert.equal(sim.validateState(s).valid,true);
});

test('genuine previous and original producers retain exact states and future rules', () => {
  for (const api of [old, legacy]) {
    const s = api.createRun(0);
    const oldLock = (actor,cell,id) => { const action=api.getActions(s,cell,actor).find(a=>a.id===id); if(api.getInvestigation) for(const evidence of action.requireEvidence) api.investigate(s,actor,cell,evidence); api.lockTask(s,actor,cell,id,action.requireEvidence); };
    const oldNext = () => { for(const actor of api.getActors(s)) if(!s.drafts[actor.id]) api.passTask(s,actor.id);api.commitWindow(s);api.advanceToNextWindow(s); };
    oldLock('protagonist','D4','build_joint');oldNext();
    oldLock('protagonist','D4','recruit_successor');oldNext();
    oldLock('protagonist','B4','independent_review');oldLock('linche','D4','free_warning');oldNext();
    const before=bytes(s), control=copy(s);
    for(const options of [{},{actorId:'protagonist',cellId:'E4',actionId:'train_network'},{actorId:'linche',cellId:'E4'}]) assert.ok(renderPlanningOpportunity(getPlanningOpportunity(s,options)));
    assert.equal(bytes(s),before);
    for(const state of [s,control]) {api.passTask(state,'protagonist');api.passTask(state,'linche');api.commitWindow(state);api.advanceToNextWindow(state);}
    assert.equal(bytes(s),bytes(control));
  }
});

test('renderer escapes public names and keeps status, role and consequence visible', () => {
  const s = ready(sim);s.actors[0].name='<img src=x onerror=alert(1)>';
  const result=getPlanningOpportunity(s), html=renderPlanningOpportunity(result);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.match(html,/data-policy-status="unassigned"/);
  assert.ok(html.indexOf(result.contextText.replaceAll('>', '&gt;')) < html.indexOf('<details'));
  assert.equal(renderPlanningOpportunity(null),'');
});
