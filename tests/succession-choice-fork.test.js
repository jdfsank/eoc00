import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as prior from './fixtures/pre-decision-flow-producer/simulation.js';
import * as preStaffing from './fixtures/pre-staffing-simulation.js';
import * as original from './fixtures/legacy-simulation.js';
import * as preRecruitment from './fixtures/pre-recruitment-simulation.js';
import {lock, next, commit} from './fixtures/round24-investigation-routes.js';
import {getSuccessionChoiceFork as fork} from '../src/succession-choice-fork.js';

function at10(api=sim, seed=0, action=null) {
  const s=api.createRun(seed);
  if(action)lock(s,api,'protagonist','D4',action);
  next(s,api);return s;
}
const routes=[['station',0,'build_joint'],['archive',12,'build_merchant'],['none',0,null]];
for(const [name,api] of [['current',sim],['prior',prior],['pre-staffing',preStaffing]])
for(const [kind,seed,build] of routes)test(`${name}/${kind}: only genuine available contracts, exact public terms`,()=>{
  const s=at10(api,seed,build), before=JSON.stringify(s), result=fork(s);
  assert.ok(result);assert.equal(result.roleLabel,{station:'测站岗位',archive:'档案岗位',none:'无现成岗位'}[kind]);
  const actions=sim.getActions(s,'D4');
  assert.deepEqual(result.choices.map(c=>c.actionId),actions.map(a=>a.id));
  for(const row of result.choices){
    const a=actions.find(a=>a.id===row.actionId);
    for(const key of ['cost','probability','requireEvidence','description','risk','reward'])assert.deepEqual(row[key],a[key]);
    assert.equal(row.dueYear,10+a.dueIn);
    assert.equal(row.staffingNote,a.staffingNote||'');
    assert.equal(row.modelNote,a.modelNote||'');
    assert.ok(row.people.length<30);assert.ok(row.responsibility.length<35);
    assert.ok(Object.isFrozen(row));assert.ok(Object.isFrozen(row.cost));
    if(sim.RECRUITMENT_ACTIONS.includes(row.actionId))for(const staffing of row.staffing){
      const role=s.institutions.find(i=>i.id===staffing.institutionId);
      assert.deepEqual(staffing,{institutionId:role.id,kind:role.kind,...sim.getInstitutionStaffing(s,role,{assumedRecruitmentActionId:row.actionId})});
    }
  }
  if(kind==='none')assert.deepEqual(result.choices.map(c=>c.actionId),['recruit_volunteer','restore_archive']);
  if(kind==='archive')assert.ok(!result.choices.some(c=>c.actionId==='renew_charter'));
  assert.match(result.summary,/第20年才可部署/);
  assert.equal(JSON.stringify(s),before);
  assert.throws(()=>{result.choices[0].cost.economy=999;},TypeError);
  assert.equal(JSON.stringify(s),before);
});

test('uncollected evidence and insufficient budget do not claim eligibility or grant evidence',()=>{
  const s=at10(sim,0,'build_joint');
  const successor=()=>fork(s).choices.find(c=>c.actionId==='recruit_successor');
  assert.deepEqual(successor().missingEvidence,['successor_consent']);
  const before=JSON.stringify(s);fork(s);assert.equal(JSON.stringify(s),before);
  assert.throws(()=>sim.lockTask(s,'protagonist','D4','recruit_successor'),/证据/);
  sim.investigate(s,'protagonist','D4','successor_consent');
  assert.deepEqual(successor().missingEvidence,[]);
  // A current public budget shortage is a display fixture, not a producer route.
  s.cells.find(c=>c.id==='D4').channels.economy=0;
  assert.deepEqual(successor().cost,{economy:5,science:2});
  assert.equal(Object.hasOwn(successor(),'available'),false);
  const low=JSON.stringify(s);fork(s);assert.equal(JSON.stringify(s),low);
});

for(const [name,api] of [['original',original],['pre-recruitment',preRecruitment]])
test(`${name}: genuine unsupported old contracts are not given inferred modern staffing`,()=>{
  for(const [,seed,build] of routes){const s=at10(api,seed,build),before=JSON.stringify(s);assert.equal(fork(s),null);assert.equal(JSON.stringify(s),before);}
});

test('only current D4 protagonist planning and proven sources are described',()=>{
  assert.equal(fork(sim.createRun()),null);
  const s=at10();
  for(const cell of ['B4','E4',null])assert.equal(fork(s,cell),null);
  for(const actor of ['linche','unknown',null])assert.equal(fork(s,'D4',actor),null);
  commit(s,sim);assert.equal(fork(s),null);sim.advanceToNextWindow(s);assert.equal(fork(s),null);
  const damaged=at10(sim,12,'build_merchant');damaged.institutions[0].sourceEventId='missing';assert.equal(fork(damaged),null);
  for(const input of [null,undefined,{},[]])assert.equal(fork(input),null);
});

test('private random values, saved prose and future snapshots are not read',()=>{
  const s=at10(sim,12,'build_merchant'),reads=[];
  const forbid=(object,key)=>Object.defineProperty(object,key,{get(){reads.push(key);throw Error(key);}});
  for(const key of ['seed','baseline','snapshots','futureSnapshots'])forbid(s,key);
  for(const event of s.events)for(const key of ['roll','text'])forbid(event,key);
  for(const h of s.history)for(const key of ['title','text'])forbid(h,key);
  assert.ok(fork(s));assert.deepEqual(reads,[]);
});

for(const [kind,seed,build] of routes)test(`${kind}: viewing does not change any later contract settlement`,()=>{
  for(const action of sim.getActions(at10(sim,seed,build),'D4')){
    const s=at10(sim,seed,build),reference=structuredClone(s);
    fork(s);lock(s,sim,'protagonist','D4',action.id);lock(reference,sim,'protagonist','D4',action.id);
    fork(s);assert.deepEqual(s,reference);
    while(s.year<40){
      commit(s,sim);commit(reference,sim);
      while(s.phase==='playback'){
        sim.advanceYear(s);sim.advanceYear(reference);assert.deepEqual(s,reference);assert.equal(fork(s),null);
      }
    }
  }
});


test('risk preview exposes exact conditional staffing consequences and deployment timing',()=>{
  for(const [kind,seed,build] of routes){
    const result=fork(at10(sim,seed,build));
    for(const row of result.choices.filter(c=>sim.RECRUITMENT_ACTIONS.includes(c.actionId)))assert.equal(row.travelling,'第20年可部署林澈');
    const successor=result.choices.find(c=>c.actionId==='recruit_successor');
    if(successor)assert.equal(successor.local,'苏岚接班（需先商量）');
    const risk=result.choices.find(c=>c.actionId==='recruit_risk');
    if(risk)assert.equal(risk.responsibility,`若兑现，${kind==='station'?'测站':'档案站'}年度来源减半；若仍缺继任，第16年停运。`);
  }
});

test('explicit station-only public policy never invents archive production loss or shutdown',()=>{
  // Public policy compatibility fixture, not an assertion of a native old route.
  for(const [kind,seed,build] of routes.filter(([kind])=>kind!=='none')){
    const state=at10(sim,seed,build);state.staffingRulesVersion=sim.STAFFING_RULES.stationOnly;
    const before=JSON.stringify(state),risk=fork(state).choices.find(c=>c.actionId==='recruit_risk');
    if(kind==='archive'){
      assert.equal(risk.responsibility,'本局档案站不因缺岗减产或停运。');
      assert.equal(risk.staffing[0].sourceMultiplier,1);assert.equal(risk.staffing[0].shutdownIfUnchangedYear,null);
    }else assert.equal(risk.responsibility,'若兑现，测站年度来源减半；若仍缺继任，第16年停运。');
    assert.equal(JSON.stringify(state),before);
  }
});
