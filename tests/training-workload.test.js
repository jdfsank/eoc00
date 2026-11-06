import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from './fixtures/pre-training-workload-producer/simulation.js';
import {restoreSave} from '../src/save.js';
import {getTrainingChoiceComparison} from '../src/training-choice-comparison.js';
const cp=structuredClone;
const BEFORE={politics:.1,economy:.25,science:.7,religion:.1};
const AFTER={politics:.5,economy:.45,science:.1,religion:.1};
function lock(s,actor,cell,id,api=sim){const a=api.getActions(s,cell,actor).find(a=>a.id===id);assert.ok(a,id);for(const e of a.requireEvidence)if(!api.getInvestigation(s,actor,cell).evidence.includes(e))api.investigate(s,actor,cell,e);api.lockTask(s,actor,cell,id);}
function commit(s,api=sim){for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);}
function next(s,api=sim){commit(s,api);api.advanceToNextWindow(s);return s;}
function ready(api=sim){const s=api.createRun(0);lock(s,'protagonist','D4','build_joint',api);next(s,api);lock(s,'protagonist','D4','recruit_successor',api);next(s,api);lock(s,'protagonist','B4','independent_review',api);lock(s,'linche','D4','free_warning',api);return next(s,api);}
const target=s=>s.institutions.find(i=>i.kind==='training'&&i.cellId==='E4');
const event=s=>s.events.find(e=>e.actionId==='authorize_training');
function pending(api=sim){const s=ready(api);lock(s,'linche','E4','authorize_training',api);lock(s,'protagonist','D4','share_power',api);commit(s,api);return s;}
function finished(){const s=pending();sim.advanceYear(s);return s;}
const effective=s=>sim.getInstitutionEffectiveAnnualSource(s,target(s));
function freeze(o){if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}

test('new runs opt in; old authorized runs keep their original zero-change contract',()=>{
 const s=ready(), legacy=ready(old);assert.equal(s.trainingWorkloadRulesVersion,'training-workload-v1');assert.equal(legacy.trainingWorkloadRulesVersion,undefined);
 assert.deepEqual(sim.getTrainingAuthorizationPlan(s).workload,{version:'training-workload-v1',targetId:target(s).id,before:BEFORE,after:AFTER});
 assert.equal(sim.getTrainingAuthorizationPlan(legacy).workload,undefined);
 const v=getTrainingChoiceComparison(legacy,'E4','linche').options[0];assert.equal(v.workload.mode,'authorize-only');assert.deepEqual(v.annualSourceChange,{politics:0,economy:0,science:0,religion:0});
 const prior=pending(old);old.advanceYear(prior);assert.deepEqual(effective(prior),BEFORE);assert.equal(sim.getTrainingAuthorizationContracts(prior)[0].workload,undefined);assert.equal(sim.validateState(prior).valid,true);
});

test('workload begins only at real year31 success; historical base, people and coverage remain unchanged',()=>{
 const s=ready(), original=cp(target(s)), coverage=sim.getWarningCoverage(s), population=s.institutions.length;
 assert.deepEqual(effective(s),BEFORE);lock(s,'linche','E4','authorize_training');assert.deepEqual(effective(s),BEFORE);commit(s);assert.deepEqual(effective(s),BEFORE);
 assert.notEqual(event(s).trainingWorkload,s.history.find(h=>h.id===event(s).sourceActionId).trainingWorkload);
 sim.advanceYear(s);assert.deepEqual(effective(s),AFTER);assert.deepEqual(target(s).annualSource,BEFORE);
 const institution=cp(target(s));delete institution.localHandoffAuthorization;assert.deepEqual(institution,original);
 assert.equal(s.institutions.length,population);assert.deepEqual(sim.getWarningCoverage(s),coverage);
 const e=event(s), action=s.history.find(h=>h.id===e.sourceActionId), outcome=s.history.find(h=>h.id===`resolved:${e.id}`);
 assert.deepEqual(e.trainingWorkload,action.trainingWorkload);assert.deepEqual(e.trainingWorkload,outcome.trainingWorkload);assert.equal(target(s).localHandoffAuthorization.trainingWorkloadVersion,'training-workload-v1');
 assert.equal(sim.validateState(s).valid,true);assert.deepEqual(sim.getTrainingAuthorizationContracts(s)[0].workload,e.trainingWorkload);
});

for(const maintenance of [.1,.5,1])test(`maintenance ${maintenance}: public source change equals year31 arithmetic, not a channel forecast`,()=>{
 const s=ready(),legacy=ready(old);target(s).maintenance=target(legacy).maintenance=maintenance;
 const row=getTrainingChoiceComparison(s,'E4','linche').options[0];
 assert.deepEqual(row.workload.before,BEFORE);assert.deepEqual(row.workload.after,AFTER);assert.deepEqual(row.workload.delta,{politics:.4,economy:.2,science:-.6,religion:0});
 assert.deepEqual(row.workload.scaledDelta,{politics:Math.round(.4*maintenance*1e8)/1e8,economy:Math.round(.2*maintenance*1e8)/1e8,science:Math.round(-.6*maintenance*1e8)/1e8,religion:0});
 for(const [state,api]of [[s,sim],[legacy,old]]){lock(state,'linche','E4','authorize_training',api);commit(state,api);api.advanceYear(state);}
 const current=s.cells.find(c=>c.id==='E4').channels, prior=legacy.cells.find(c=>c.id==='E4').channels;
 for(const key of sim.CHANNELS)assert.ok(Math.abs((current[key]-prior[key])-row.workload.scaledDelta[key])<.00011,key);
 assert.deepEqual(target(s).annualSource,BEFORE);assert.equal(sim.validateState(s).valid,true);
});

test('cancelled or stopped targets receive no effective workload and no replacement source',()=>{
 for(const change of [s=>target(s).active=false,s=>target(s).maintenance=0,s=>s.institutions=s.institutions.filter(i=>i!==target(s))]){
  const s=pending();change(s);assert.equal(sim.validateState(s).valid,true);sim.advanceYear(s);assert.equal(event(s).status,'cancelled');assert.equal(sim.getTrainingAuthorizationContracts(s)[0].status,'cancelled');
  if(target(s)){assert.deepEqual(effective(s),BEFORE);assert.equal(target(s).localHandoffAuthorization,undefined);}assert.equal(sim.validateState(s).valid,true);
 }
 const s=finished();sim.advanceYear(s);target(s).active=false;assert.equal(sim.getTrainingAuthorizationContracts(s)[0].status,'success');assert.deepEqual(effective(s),BEFORE);assert.equal(sim.validateState(s).valid,true);assert.equal(sim.getHandoffReadiness(s).authorizedCells.length,0);
});

test('custom sources remain legal but cannot be silently converted to the fixed standard assignment',()=>{
 for(const science of [0,.1,.4,1,900]){const s=ready();target(s).annualSource.science=science;assert.equal(sim.validateState(s).valid,true);assert.equal(sim.getTrainingAuthorizationPlan(s).available,false);assert.match(sim.getTrainingAuthorizationPlan(s).reason,/自定义/);assert.equal(sim.getActions(s,'E4','linche').some(a=>a.id==='authorize_training'),false);assert.ok(sim.getActions(s,'E4','linche').some(a=>a.id==='train_network'));assert.equal(effective(s).science,science);assert.equal(getTrainingChoiceComparison(s,'E4','linche'),null);}
 const legacy=ready(old);target(legacy).annualSource.science=0;assert.equal(sim.getTrainingAuthorizationPlan(legacy).available,true);
});

const corruptions={
 unknownRule:s=>s.trainingWorkloadRulesVersion='unknown',
 strippedRule:s=>delete s.trainingWorkloadRulesVersion,
 missingEventPlan:s=>delete event(s).trainingWorkload,
 missingActionPlan:s=>delete s.history.find(h=>h.id===event(s).sourceActionId).trainingWorkload,
 missingOutcomePlan:s=>delete s.history.find(h=>h.id===`resolved:${event(s).id}`).trainingWorkload,
 changedBefore:s=>event(s).trainingWorkload.before.science=.6,
 changedAfter:s=>event(s).trainingWorkload.after.science=3,
 changedTarget:s=>event(s).trainingWorkload.targetId='other',
 extraMetadata:s=>event(s).trainingWorkload.unearned=true,
 changedBase:s=>target(s).annualSource.science=.1,
 changedGrant:s=>target(s).localHandoffAuthorization.trainingWorkloadVersion='unknown',
 strippedGrantVersion:s=>delete target(s).localHandoffAuthorization.trainingWorkloadVersion,
 orphanMetadata:s=>{s.events=s.events.filter(e=>e!==event(s));},
 counterfeitInstitution:s=>{s.institutions.find(i=>i.cellId==='D5').trainingWorkload=cp(event(s).trainingWorkload);},
 wrongEventMetadata:s=>{s.events.find(e=>e.actionId==='independent_review').trainingWorkload=cp(event(s).trainingWorkload);},
};
for(const[name,mutate]of Object.entries(corruptions))test(`rejects ${name} instead of inventing effective sources`,()=>{const s=finished();mutate(s);assert.equal(sim.validateState(s).valid,false);assert.throws(()=>restoreSave({state:s}),/损坏/);const before=JSON.stringify(s);assert.throws(()=>sim.advanceYear(s),/损坏/);assert.equal(JSON.stringify(s),before);});

test('workload cannot be prewritten in a draft, old contract, or successful-looking pending grant',()=>{
 const s=ready();lock(s,'linche','E4','authorize_training');s.drafts.linche.trainingWorkload=sim.getTrainingAuthorizationPlan(s).workload;assert.equal(sim.validateState(s).valid,false);
 const prior=pending(old);event(prior).trainingWorkload={version:'training-workload-v1',targetId:target(prior).id,before:BEFORE,after:AFTER};assert.equal(sim.validateState(prior).valid,false);
 const early=pending();target(early).localHandoffAuthorization={version:'training-authorization-v1',eventId:event(early).id,year:31,sourceActionId:event(early).sourceActionId,targetId:target(early).id,trainingWorkloadVersion:'training-workload-v1'};assert.equal(sim.validateState(early).valid,false);assert.equal(effective(early),null);
});

test('effective sources and validated workload reads are detached, frozen-safe and do not read private state',()=>{
 const s=finished(),expected=effective(s),contract=sim.getTrainingAuthorizationContracts(s);const immutable=freeze(cp(s));assert.deepEqual(effective(immutable),expected);
 const returned=effective(s);returned.science=999;assert.deepEqual(effective(s),expected);const read=sim.getTrainingAuthorizationContracts(s);read[0].workload.after.science=999;assert.deepEqual(sim.getTrainingAuthorizationContracts(s),contract);
 for(const key of ['seed','investigations','baseline','snapshots','drafts'])Object.defineProperty(s,key,{get(){throw Error(`private ${key}`);}});
 for(const row of [...s.events,...s.history])for(const key of ['roll','probability','text','title','description'])Object.defineProperty(row,key,{get(){throw Error(`private ${key}`);}});
 assert.deepEqual(effective(s),expected);assert.deepEqual(sim.getTrainingAuthorizationContracts(s),contract);
});


test('locked window warning discloses new workload and retains the exact old producer warning',()=>{
 const s=ready(),legacy=ready(old);
 for(const[state,api]of [[s,sim],[legacy,old]]){lock(state,'linche','E4','authorize_training',api);lock(state,'protagonist','D4','share_power',api);}
 const before=JSON.stringify(s),warnings=sim.getWindowReview(s).warnings;
 const warning=warnings.find(text=>text.startsWith('东岸承接协商'));
 assert.match(warning,/第31年只向指定原培训点/);
 assert.match(warning,/大部分深入带教转入议事与生计轮值/);
 assert.match(warning,/政治、经济年度来源提高，科学来源减少/);
 assert.match(warning,/按该原点实际维护缩放/);
 assert.match(warning,/目标失效或已有授权则取消且政治3、经济2不退/);
 assert.doesNotMatch(warning,/不新建学校、增加产出/);
 assert.equal(JSON.stringify(s),before);
 const oldWarnings=old.getWindowReview(legacy).warnings;
 assert.deepEqual(sim.getWindowReview(legacy).warnings,oldWarnings);
 assert.ok(oldWarnings.includes('东岸承接协商第31年只向原培训点赋予本地授权；目标失效或已有授权则取消且政治3、经济2不退。不新建学校、增加产出、校验或河港信任，D5同源学徒不获连带授权。'));
});
