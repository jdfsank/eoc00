import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from './fixtures/pre-training-workload-producer/simulation.js';
import * as legacy from './fixtures/pre-tradeoffs-simulation.js';
import {routes, lock} from './fixtures/round24-investigation-routes.js';
import {getWorldPlanning} from '../src/world-planning.js';
const view = (s,actor='protagonist',cell='D4') => getWorldPlanning(s,cell,actor);
const freeze = value => {if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

test('natural windows count actual contracts and only currently eligible actors',()=>{
  for(const [year,s] of Object.entries(routes(sim))){
    const result=view(s);assert.equal(result.year,Number(year));
    assert.deepEqual(result.actors.map(a=>a.id),sim.getActors(s).map(a=>a.id));
    for(const actor of result.actors)assert.equal(actor.localContractCount,sim.getActions(s,'D4',actor.id).length);
    assert.equal(result.actors.length,Number(year)<20?1:2);
  }
});
test('year30 Linche D4 explicitly offers protagonist reading, never a draft',()=>{
  const s=routes(sim)[30],before=JSON.stringify(s),result=view(s,'linche');
  assert.equal(result.selectedActor.localContractCount,0);
  assert.deepEqual(result.primary,{kind:'switch-scene',actorId:'protagonist',label:'以主角查看 D4 方案'});
  assert.equal(view(s).primary.kind,'scene');assert.equal(view(s,'linche','A1').primary.kind,'history');
  assert.equal(JSON.stringify(s),before);
});
test('genuine locks and passes stay distinct from absent and damaged drafts',()=>{
  const s=routes(sim)[30];assert.equal(view(s).selectedActor.draftStatus,'unassigned');
  lock(s,sim,'protagonist','D4','share_power');assert.equal(view(s).selectedActor.draftStatus,'locked');
  assert.equal(view(s).selectedActor.draft.actionId,'share_power');
  sim.passTask(s,'protagonist');assert.equal(view(s).selectedActor.draftStatus,'passed');
  for(const bad of [null,false,{}, {actorId:'protagonist',window:20,status:'passed'}, {actorId:'linche',window:30,status:'passed'}, {actorId:'protagonist',window:30,status:'locked',actionId:'missing',cellId:'D4',evidence:[]}]){
    s.drafts.protagonist=bad;assert.equal(view(s).selectedActor.draftStatus,'unknown');
  }
  delete s.drafts;assert.equal(view(s).selectedActor.draftStatus,'unknown');
});
test('shared budget is the real actor budget, exhausted is zero, switching does not refund',()=>{
  const s=routes(sim)[20];sim.investigate(s,'protagonist','B4','anomaly_records');sim.investigate(s,'protagonist','D4','resident_testimony');
  const before=JSON.stringify(s);freeze(s);
  for(let n=0;n<3;n++){
    assert.equal(view(s).selectedActor.budget,0);assert.equal(view(s,'linche').selectedActor.budget,3);
    assert.equal(view(s,'protagonist','F6').selectedActor.budget,0);
  }
  assert.equal(JSON.stringify(s),before);
});
test('real old producers retain shared or per-scene identity without new markers',()=>{
  for(const api of [old,legacy])for(const s of Object.values(routes(api))){
    const before=JSON.stringify(s),result=view(s);
    assert.equal(result.selectedActor.budgetStatus,api===legacy?'per-scene':'shared');
    if(api===legacy){assert.equal(result.selectedActor.budget,null);assert.match(result.budgetNotice,/每现场/);}
    assert.equal(JSON.stringify(s),before);
  }
});
test('invalid identity, inactive phases and malformed budget fail conservatively',()=>{
  const s=routes(sim)[30];assert.equal(view(s,'missing'),null);assert.equal(view(s,'protagonist','Z99'),null);
  for(const bad of [null,{}, {[`${s.year}:protagonist`]:null}, {[`${s.year}:protagonist`]:[{cellId:'D4'}]}]){
    const copy=structuredClone(s);copy.investigations=bad;
    if(bad && !Object.keys(bad).length)assert.equal(view(copy).selectedActor.budget,3);
    else {assert.equal(view(copy).selectedActor.budget,null);assert.equal(view(copy).selectedActor.localContractCount,null);assert.equal(view(copy).primary.kind,'unknown');}
  }
  const copy=structuredClone(s);sim.passTask(copy,'protagonist');sim.passTask(copy,'linche');sim.commitWindow(copy);assert.equal(view(copy),null);sim.advanceToNextWindow(copy);assert.equal(view(copy),null);
});
test('private future, seed, result and prose getters are never touched; return is detached',()=>{
  const s=routes(sim)[30];lock(s,sim,'protagonist','D4','share_power');const expected=view(s,'linche');
  const refuse=(obj,key)=>Object.defineProperty(obj,key,{get(){throw Error(`Private ${key}`);}});
  for(const key of ['seed','baseline','snapshots'])refuse(s,key);
  for(const event of s.events)for(const key of ['roll','text'])refuse(event,key);
  for(const event of s.history)refuse(event,'text');
  assert.deepEqual(view(s,'linche'),expected);
  const result=view(s);result.selectedActor.name='changed';result.selectedActor.draft.title='changed';result.actors.length=0;
  assert.notEqual(s.actors[0].name,'changed');assert.notEqual(view(s).selectedActor.draft.title,'changed');
});

test('unknown evidence and duplicated portable payments do not invent budget',()=>{
  for(const entries of [[{cellId:'D4',evidenceId:'not-real'}],[{cellId:'B4',evidenceId:'old_reality_record'},{cellId:'D4',evidenceId:'old_reality_record'}]]){
    const s=routes(sim)[20];s.investigations['20:protagonist']=entries;
    assert.equal(view(s).selectedActor.budgetStatus,'unknown');assert.equal(view(s).primary.kind,'unknown');
  }
});
