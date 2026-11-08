import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as previous from './fixtures/pre-decision-flow-producer/simulation.js';
import * as older from './fixtures/pre-training-workload-producer/simulation.js';
import * as preHandoff from './fixtures/pre-handoff-simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import {getPolicyChoiceFork as read} from '../src/policy-choice-fork.js';
import {restoreSave} from '../src/save.js';
import {lock,next,commit,routes} from './fixtures/round24-investigation-routes.js';
const json = JSON.stringify;
const choice = (s,id) => read(s,'D4').choices.find(c=>c.actionId===id);
function natural(api=sim,mode='missing') {
  const s=api.createRun(mode==='archive'?1:0);
  if(mode==='ready')lock(s,api,'protagonist','D4','build_joint');
  if(mode==='archive')lock(s,api,'protagonist','B4','preserve_records');
  next(s,api);
  if(mode==='ready')lock(s,api,'protagonist','D4','renew_charter');
  else lock(s,api,'protagonist','D4','recruit_volunteer');
  next(s,api);
  if(mode==='ready')lock(s,api,'protagonist','F6','independent_review');
  if(mode==='archive')lock(s,api,'protagonist','E4','train_network');
  next(s,api);return s;
}
function freeze(o){if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
for(const[name,api]of [['current',sim],['previous',previous],['older',older]])for(const mode of ['missing','ready','archive'])test(`${name}/${mode}: natural public contracts preserved`,()=>{
  const s=natural(api,mode),before=json(s);assert.deepEqual(sim.getPublicPlanningStateIssues(s),[]);
  for(const actor of sim.getActors(s)){
    const view=read(s,'D4',actor.id),actions=sim.getActions(s,'D4',actor.id);
    if (!actions.length) {assert.equal(view,null);continue;}
    assert.ok(view);assert.match(view.timing,/第31年.*不等于/);assert.match(view.assessment,/第40年.*真实存续/);
    assert.deepEqual(view.choices.map(c=>c.actionId),actions.map(a=>a.id));
    for(const [i,c]of view.choices.entries()){assert.equal(c.effect,actions[i].reward);assert.equal(c.responsibility,actions[i].risk);assert.ok(c.current.length);assert.doesNotMatch(c.current,/第31年|第40年/);}
    view.choices[0].effect='mutated';assert.notEqual(read(s,'D4',actor.id).choices[0].effect,'mutated');
  }
  if(mode==='missing'){assert.match(choice(s,'share_power').current,/缺少运转.*缺少成功.*尚未作出合作承诺/);assert.match(choice(s,'withdraw').current,/缺少运转/);assert.equal(choice(s,'central_review').current,'尚无完成的指令复核；签署集中方针不会自动完成复核。');}
  if(mode==='ready'){assert.equal(sim.getHandoffReadiness(s).canShare,true);assert.match(choice(s,'share_power').current,/齐备/);assert.match(choice(s,'central_review').current,/成功纠正共同标准/);}
  if(mode==='archive'){assert.equal(sim.getHandoffReadiness(s).canWithdraw,true);assert.match(choice(s,'withdraw').current,/齐备/);assert.equal(choice(s,'central_review').current,'地方保档已提供交班方法，但尚无完成的指令复核。');}
  assert.equal(json(s),before);
});
test('consent is separate from withdrawal, missing and explicit refusal differ',()=>{
  const s=natural(sim,'archive');assert.match(choice(s,'share_power').current,/尚未作出合作承诺/);
  s.flags.trust=false;assert.match(choice(s,'share_power').current,/明确拒绝/);assert.match(choice(s,'withdraw').current,/齐备/);
  s.flags.trust=true;assert.match(choice(s,'share_power').current,/齐备/);
});
test('locked training and a passed actor never fabricate present capacity',()=>{
  const s=natural(),before=read(s,'D4');lock(s,sim,'linche','E4','train_network');assert.deepEqual(read(s,'D4'),before);
  sim.passTask(s,'protagonist');assert.deepEqual(read(s,'D4'),before);assert.equal(read(s,'D4','linche'),null);
});
test('deep frozen public reading and save restore are unchanged',()=>{
  const s=natural(sim,'archive'),before=json(s),restored=restoreSave(JSON.parse(json({state:s}))).state;
  freeze(s);assert.deepEqual(read(s,'D4'),read(restored,'D4'));assert.equal(json(s),before);
});
for(const[name,api]of [['pre-handoff',preHandoff],['original',legacy]])test(`${name}: genuine unsupported producer`,()=>{const s=routes(api)[30],before=json(s);assert.equal(read(s,'D4'),null);assert.equal(json(s),before);});
test('invalid public state, unknown versions, actors and contexts fail closed',()=>{
  const s=natural();for(const value of [null,undefined,{},[]])assert.equal(read(value,'D4'),null);
  for(const cell of ['B4','F6','E4','D5',null])assert.equal(read(s,cell),null);
  assert.equal(read(s,'D4','missing'),null);
  for(const year of [0,10,20])assert.equal(read(routes(sim)[year],'D4'),null);
  for(const key of ['planningRulesVersion','handoffRulesVersion','crisisRulesVersion','staffingRulesVersion','branchAccessRulesVersion','recoveryRulesVersion','futureCheckRulesVersion','archiveUpgradeRulesVersion','portAccessRulesVersion','trainingAuthorizationRulesVersion','trainingWorkloadRulesVersion']){const copy=structuredClone(s);copy[key]='future';assert.equal(read(copy,'D4'),null,key);}
  for(const change of [s=>s.institutions=null,s=>s.events=null,s=>s.actors=[],s=>s.flags.trust='yes',s=>s.actors[0].name=' ',s=>s.flags.review='true',s=>s.drafts={bad:{}}]){const copy=structuredClone(s);change(copy);const before=json(copy);assert.equal(read(copy,'D4'),null);assert.equal(json(copy),before);}
  commit(s,sim);assert.equal(read(s,'D4'),null);
});
test('public reader never inspects seed, hidden roll, prose or future snapshots',()=>{
  const s=natural(sim,'archive'),reads=[];
  const guard=(o,k)=>Object.defineProperty(o,k,{get(){reads.push(k);throw Error(k);},configurable:true});
  guard(s,'seed');guard(s,'futureSnapshots');for(const e of s.events){guard(e,'roll');guard(e,'text');}for(const h of s.history)guard(h,'text');
  assert.ok(read(s,'D4'));assert.deepEqual(reads,[]);
});
for(const[name,api]of [['current',sim],['previous',previous],['older',older]])for(const policy of ['share_power','central_review','withdraw'])test(`${name}/${policy}: identical saved state and every continued year`,()=>{
  const s=natural(api,'archive'),ref=structuredClone(s);assert.ok(read(s,'D4'));
  lock(s,sim,'protagonist','D4',policy);lock(ref,api,'protagonist','D4',policy);
  assert.equal(json(s),json(ref));assert.ok(read(s,'D4'));commit(s,sim);commit(ref,api);assert.equal(json(s),json(ref));
  while(s.phase==='playback'){assert.equal(read(s,'D4'),null);sim.advanceYear(s);api.advanceYear(ref);assert.equal(json(s),json(ref));}
  assert.equal(s.year,40);assert.equal(read(s,'D4'),null);
});

test('natural unrenewed training exposes the authorization gap, not absent people',()=>{
  const s=sim.createRun(0);lock(s,sim,'protagonist','D4','build_joint');next(s,sim);
  lock(s,sim,'protagonist','D4','recruit_successor');next(s,sim);
  lock(s,sim,'protagonist','F6','independent_review');next(s,sim);
  assert.ok(sim.getHandoffReadiness(s).staff.length);assert.match(choice(s,'withdraw').current,/尚缺地方承接授权/);
  assert.doesNotMatch(choice(s,'withdraw').current,/缺少运转中的/);
  assert.match(choice(s,'central_review').current,/成功纠正共同标准/);
});

test('archive claim requires an active carrier and matching successful public source',()=>{
  const original=natural(sim,'archive');
  for(const change of [
    (s,i)=>i.active=false,
    (s,i)=>i.maintenance=0,
    (s,i)=>i.sourceEventId='unmatched-source',
    (s,i)=>i.sourceActionId='unmatched-action',
    (s,i)=>s.events.find(e=>e.id===i.sourceEventId).status='failed',
  ]){
    const s=structuredClone(original),carrier=s.institutions.find(i=>i.kind==='independent');
    assert.ok(carrier);change(s,carrier);const before=json(s);freeze(s);
    assert.equal(choice(s,'central_review').current,'尚无完成的指令复核；签署集中方针不会自动完成复核。');
    assert.equal(json(s),before);
  }
});
