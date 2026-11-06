import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as previous from './fixtures/pre-decision-flow-producer/simulation.js';
import * as older from './fixtures/pre-training-workload-producer/simulation.js';
import * as legacy from './fixtures/pre-tradeoffs-simulation.js';
import * as original from './fixtures/legacy-simulation.js';
import {sceneFor, evidenceFor} from '../src/story.js';
import {getCrisisSceneContext} from '../src/crisis-scene-context.js';
import {lock, next, routes, commit} from './fixtures/round24-investigation-routes.js';
const bytes = JSON.stringify;
function at20(api, prepared = true) {
  const state = api.createRun(0);
  if (prepared) lock(state,api,'protagonist','D4','build_joint');
  next(state,api);
  const id = prepared ? 'recruit_successor' : 'recruit_volunteer';
  lock(state,api,'protagonist','D4',id);next(state,api);
  return state;
}
for (const [name, api] of [['current',sim],['round21',previous],['round20',older]])
for (const prepared of [true,false]) test(`${name}: real ${prepared?'100%':'55%'} preparation, both places and actors`,()=>{
  const state=at20(api,prepared), before=bytes(state);
  for(const cell of ['B4','F6'])for(const actor of ['protagonist','linche']){
    const original=bytes(sceneFor(state,cell,actor));
    const review=api.getActions(state,cell,actor).find(a=>a.id==='independent_review');
    assert.equal(review.probability,prepared?1:.55);
    const result=getCrisisSceneContext(state,cell,actor);
    assert.equal(result.body.length,1);assert.ok(result.body[0].length>=65&&result.body[0].length<=90);
    assert.match(result.body[0],/若成功/);assert.match(result.body[0],/减少损失，却不改正标准/);
    assert.equal(result.question,`这一次，${api.getActors(state).find(a=>a.id===actor).name}要把名额留给哪一种工作？`);
    assert.doesNotMatch(result.body.join(''),/同意|愿意|已经纠正|没有签下|55%|100%/);
    for(const id of sim.getEvidenceIds(state,cell,actor))assert.ok(!result.body.join('').includes(evidenceFor(state,id,cell,actor).text));
    result.body[0]='changed';assert.notEqual(getCrisisSceneContext(state,cell,actor).body[0],'changed');
    assert.equal(bytes(sceneFor(state,cell,actor)),original);
  }
  assert.equal(bytes(state),before);
});
test('locked tasks and paid evidence do not become signed outcomes or alter drafts',()=>{
  const state=at20(sim,false);lock(state,sim,'protagonist','B4','independent_review');
  sim.investigate(state,'linche','F6','evacuation_routes');lock(state,sim,'linche','F6','local_veto');
  const before=bytes(state);
  for(const [cell,actor]of [['B4','protagonist'],['F6','linche']]){
    const context=getCrisisSceneContext(state,cell,actor);assert.ok(context);
    assert.doesNotMatch(context.body.join(''),/未签|没有签|已生效|已经完成了/);
  }
  assert.equal(bytes(state),before);
});
for(const [name,api]of [['per-scene',legacy],['overall-crisis',original]])test(`actual old ${name} producer retains original scene`,()=>{
  const state=routes(api)[20],before=bytes(state);
  assert.equal(sim.usesTradeoffs(state),false);
  assert.equal(sim.usesLegacyCrisisRules(state),name==='overall-crisis');
  for(const cell of ['B4','F6'])assert.equal(getCrisisSceneContext(state,cell),null);
  assert.equal(bytes(state),before);
});
test('unrelated natural years, places, unavailable actors and playback fall back',()=>{
  const states=routes(sim);
  for(const year of [0,10,30])for(const cell of ['B4','F6'])assert.equal(getCrisisSceneContext(states[year],cell),null);
  const state=states[20];for(const cell of ['D4','E4','D5','A1',null])assert.equal(getCrisisSceneContext(state,cell),null);
  assert.equal(getCrisisSceneContext(state,'B4','missing'),null);
  next(state,sim);next(state,sim);assert.equal(state.year,40);assert.equal(getCrisisSceneContext(state,'B4'),null);
  const playback=at20(sim);for(const actor of sim.getActors(playback))sim.passTask(playback,actor.id);sim.commitWindow(playback);
  assert.equal(getCrisisSceneContext(playback,'B4'),null);
});
test('malformed and unknown rules return null; never patch their world',()=>{
  for(const mutate of [s=>s.planningRulesVersion='future',s=>s.crisisRulesVersion='future',s=>s.actors=[],s=>s.actors[0].name='',s=>s.institutions=null,s=>s.cells=[],s=>s.events[0].probability=NaN,s=>s.staffingRulesVersion='unknown']){
    const state=at20(sim);mutate(state);const before=bytes(state);assert.equal(getCrisisSceneContext(state,'B4'),null);assert.equal(bytes(state),before);
  }
  for(const value of [null,undefined,{},[],{year:20,phase:'planning'}])assert.equal(getCrisisSceneContext(value,'B4'),null);
});
test('seed, RNG results and evidence prose are not read',()=>{
  const state=at20(sim),reads=[];
  const forbidden=(object,key)=>Object.defineProperty(object,key,{get(){reads.push(key);throw Error(`private ${key}`);},configurable:true});
  forbidden(state,'seed');forbidden(state,'futureSnapshots');
  for(const event of state.events){forbidden(event,'roll');forbidden(event,'text');}
  for(const item of state.history)forbidden(item,'text');
  for(const cell of ['B4','F6'])assert.ok(getCrisisSceneContext(state,cell));
  assert.deepEqual(reads,[]);
});
for(const directory of ['pre-decision-flow-producer','pre-training-workload-producer'])test(`${directory} producer bytes remain original`,()=>{
  const root=new URL(`./fixtures/${directory}/`,import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
  for(const[file,hash]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),hash,file);
});
test('all protected production source remains unchanged',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/round23-protected-source-manifest.json',import.meta.url)));
  for(const[file,hash]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(`../src/${file}`,import.meta.url))).digest('hex'),hash,file);
});

for(const[name,api]of [['round21',previous],['round20',older]])for(const prepared of [true,false])test(`${name} ${prepared?'prepared':'unprepared'}: context keeps every later annual outcome producer-exact`,()=>{
  const state=at20(api,prepared),reference=structuredClone(state);
  for(const year of [20,30]){
    const tasks=year===20?[['protagonist','B4','independent_review'],['linche','F6','local_veto']]:[['protagonist','D4','share_power'],['linche','E4','train_network']];
    for(const[actor,cell,id]of tasks){
      getCrisisSceneContext(state,cell,actor);lock(state,sim,actor,cell,id);lock(reference,api,actor,cell,id);
      getCrisisSceneContext(state,cell,actor);assert.equal(bytes(state),bytes(reference));
    }
    commit(state,sim);commit(reference,api);assert.equal(bytes(state),bytes(reference));
    while(state.phase==='playback'){
      getCrisisSceneContext(state,'B4');sim.advanceYear(state);api.advanceYear(reference);assert.equal(bytes(state),bytes(reference));
    }
  }
  assert.equal(state.year,40);
});
