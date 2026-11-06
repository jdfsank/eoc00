import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as previous from './fixtures/pre-training-authorization-simulation.js';
import {getHandoffOutlook} from '../src/handoff-outlook.js';
import {investigateAndLock} from './helpers/play.js';
const copy=structuredClone;
function lock(s,actor,site,action,api=sim){if(api===sim)return investigateAndLock(s,actor,site,action);const a=api.getActions(s,site,actor).find(a=>a.id===action);for(const e of a.requireEvidence)api.investigate(s,actor,site,e);api.lockTask(s,actor,site,action);}
function next(s,api=sim){for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);api.advanceToNextWindow(s);return s;}
function ready(api=sim){const s=api.createRun(0);lock(s,'protagonist','D4','build_joint',api);next(s,api);lock(s,'protagonist','D4','recruit_successor',api);next(s,api);lock(s,'protagonist','B4','independent_review',api);lock(s,'linche','D4','free_warning',api);return next(s,api);}
function planned(s=ready(),policy='share_power'){lock(s,'protagonist','D4',policy);lock(s,'linche','E4','authorize_training');return s;}
function submitted(s=planned()){sim.commitWindow(s);return s;}
function granted(){const s=submitted();sim.advanceYear(s);return s;}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function refs(v,set=new Set()){if(v&&typeof v==='object'&&!set.has(v)){set.add(v);Object.values(v).forEach(x=>refs(x,set));}return set;}

test('audit natural mandate is a paid local right, not a new institution or hidden service bonus',()=>{
 const s=ready(),target=sim.getTrainingAuthorizationPlan(s).target,source=s.institutions.find(i=>i.id===target.id),south=s.institutions.find(i=>i.kind==='training'&&i.cellId==='D5');
 assert.ok(target);assert.equal(sim.getHandoffReadiness(s).canShare,false);
 const institutionFacts=JSON.stringify(s.institutions),coverage=sim.getWarningCoverage(s),oldCrisis=JSON.stringify(s.flags.crisis),oldSnapshots=JSON.stringify(s.snapshots),trust=s.flags.trust;
 const balance={...s.cells.find(c=>c.id==='E4').channels};planned(s);
 assert.equal(JSON.stringify(s.institutions),institutionFacts);assert.equal(sim.getTrainingAuthorizationStatus(s).status,'available');
 const outlook=getHandoffOutlook(s);assert.equal(outlook.ready,true);assert.equal(outlook.current.canShare,false);assert.equal(outlook.projected.canShare,true);assert.equal(outlook.withoutAuthorization.canShare,false);
 assert.deepEqual(outlook.projected.staffCells,outlook.current.staffCells);assert.deepEqual(outlook.projected.checkCells,outlook.current.checkCells);
 sim.commitWindow(s);const cell=s.cells.find(c=>c.id==='E4');assert.equal(cell.channels.politics,balance.politics-3);assert.equal(cell.channels.economy,balance.economy-2);assert.equal(cell.channels.science,balance.science);
 assert.equal(JSON.stringify(s.institutions),institutionFacts);assert.equal(sim.getTrainingAuthorizationStatus(s).status,'pending');
 const afterPayment=JSON.stringify(s);assert.throws(()=>sim.commitWindow(s));assert.equal(JSON.stringify(s),afterPayment);
 sim.advanceYear(s);assert.equal(sim.validateState(s).valid,true);assert.equal(sim.getTrainingAuthorizationStatus(s).status,'authorized');
 assert.equal(s.institutions.length,JSON.parse(institutionFacts).length);assert.ok(source.localHandoffAuthorization);assert.equal(south.localHandoffAuthorization,undefined);assert.equal(south.handoffAuthorization,undefined);
 const stripped=copy(s.institutions);for(const i of stripped)delete i.localHandoffAuthorization;assert.equal(JSON.stringify(stripped),institutionFacts);assert.deepEqual(sim.getWarningCoverage(s),coverage);assert.equal(s.flags.trust,trust);
 assert.equal(JSON.stringify(s.flags.crisis),oldCrisis);for(const [year,value] of Object.entries(JSON.parse(oldSnapshots)))assert.equal(JSON.stringify(s.snapshots[year]),JSON.stringify(value));assert.equal(sim.getHandoffReadiness(s).canShare,true);sim.advanceToNextWindow(s);assert.equal(sim.getEnding(s).title,'许多人签署的历史');assert.equal(JSON.stringify(s.flags.crisis),oldCrisis);
});

test('audit local resident evidence and atomic budget failures cannot manufacture a grant',()=>{
 const wrongPlace=ready();sim.investigate(wrongPlace,'linche','D5','resident_testimony');const before=JSON.stringify(wrongPlace);assert.throws(()=>sim.lockTask(wrongPlace,'linche','E4','authorize_training',['resident_testimony']),/证据/);assert.equal(JSON.stringify(wrongPlace),before);
 const broke=planned();broke.cells.find(c=>c.id==='E4').channels.politics=0;const frozen=JSON.stringify(broke);assert.equal(sim.getWindowReview(broke).ready,false);assert.throws(()=>sim.commitWindow(broke));assert.equal(JSON.stringify(broke),frozen);assert.equal(sim.getTrainingAuthorizationStatus(broke).status,'available');
});

for(const mode of ['stopped','missing','substitute'])test(`audit ${mode} frozen target cancels without authorizing another school`,()=>{
 const s=submitted(),contract=sim.getTrainingAuthorizationContracts(s)[0],target=s.institutions.find(i=>i.id===contract.target.id);
 if(mode==='stopped')target.active=false;
 else {s.institutions=s.institutions.filter(i=>i!==target);if(mode==='substitute')s.institutions.push({...target,id:'replacement-training'});}
 const paid=s.history.find(h=>h.id===contract.sourceActionId).cost,crisis=JSON.stringify(s.flags.crisis);assert.equal(sim.validateState(s).valid,true);sim.advanceYear(s);
 assert.equal(sim.validateState(s).valid,true);assert.equal(sim.getTrainingAuthorizationStatus(s).status,'cancelled');assert.ok(s.institutions.every(i=>!i.localHandoffAuthorization));assert.deepEqual(paid,{politics:3,economy:2});assert.equal(JSON.stringify(s.flags.crisis),crisis);assert.equal(sim.getHandoffReadiness(s).canShare,false);
});

test('audit a true published old engine save retains its original contracts and exact continuation',()=>{
 const s=ready(previous);assert.equal(Object.hasOwn(s,'trainingAuthorizationRulesVersion'),false);assert.ok(!sim.getActions(s,'E4','linche').some(a=>a.id==='authorize_training'));
 const a=copy(s),b=copy(s);lock(a,'protagonist','D4','share_power',previous);lock(b,'protagonist','D4','share_power');lock(a,'linche','E4','train_network',previous);lock(b,'linche','E4','train_network');
 previous.commitWindow(a);sim.commitWindow(b);assert.deepEqual(b,a);
 while(a.year<40){previous.advanceYear(a);sim.advanceYear(b);assert.deepEqual(b,a);}
});

test('audit public contract readers are frozen, detached, and do not read hidden simulation or investigation fields',()=>{
 for(const s of [ready(),submitted(),granted()]){
  const expected=sim.getTrainingAuthorizationStatus(s),before=JSON.stringify(s);assert.deepEqual(sim.getTrainingAuthorizationStatus(freeze(copy(s))),expected);assert.equal(JSON.stringify(s),before);
  const sourceRefs=refs(s);for(const r of refs(expected))assert.equal(sourceRefs.has(r),false);
  const trapped=copy(s);for(const key of ['seed','snapshots','baseline','investigations','promises'])Object.defineProperty(trapped,key,{get(){throw Error(`Private ${key}`);}});
  for(const e of [...trapped.events,...trapped.history])for(const key of ['roll','probability','text','description'])Object.defineProperty(e,key,{get(){throw Error(`Private ${key}`);}});
  assert.deepEqual(sim.getTrainingAuthorizationStatus(trapped),expected);
 }
});

test('audit copied, mismatched and source-less grants fail validation and remain unavailable as real authorization',()=>{
 const good=granted(),target=sim.getTrainingAuthorizationContracts(good)[0].target;
 for(const mode of ['copy-d5','wrong-target','missing-outcome','fake-cost']){
  const s=copy(good),i=s.institutions.find(i=>i.id===target.id),event=s.events.find(e=>e.actionId==='authorize_training');
  if(mode==='copy-d5')s.institutions.find(i=>i.cellId==='D5'&&i.kind==='training').localHandoffAuthorization=copy(i.localHandoffAuthorization);
  if(mode==='wrong-target')i.localHandoffAuthorization.targetId='replacement';
  if(mode==='missing-outcome')s.history=s.history.filter(h=>h.id!==`resolved:${event.id}`);
  if(mode==='fake-cost')s.history.find(h=>h.id===event.sourceActionId).cost.economy=0;
  assert.equal(sim.validateState(s).valid,false,mode);assert.equal(sim.getTrainingAuthorizationStatus(s).status,'unknown',mode);assert.equal(sim.getHandoffReadiness(s).canShare,false,mode);
 }
});

test('audit local mandate cannot invent an independent method or repair refused riverport trust',()=>{
 for(const situation of ['no-check','refused-trust']){
  const s=sim.createRun(0);lock(s,'protagonist','D4','build_joint');next(s);lock(s,'protagonist','D4','recruit_successor');next(s);
  if(situation==='no-check'){lock(s,'protagonist','B4','local_veto');lock(s,'linche','D4','free_warning');}
  else{lock(s,'protagonist','D4','relocate_teacher');lock(s,'linche','B4','independent_review');}
  next(s);assert.equal(sim.getTrainingAuthorizationPlan(s).available,true);planned(s);const projected=getHandoffOutlook(s).projected;
  assert.equal(projected.canShare,false);assert.equal(projected.canWithdraw,situation==='refused-trust');
  sim.commitWindow(s);sim.advanceYear(s);const actual=sim.getHandoffReadiness(s);assert.equal(actual.canShare,false);assert.equal(actual.canWithdraw,situation==='refused-trust');
  if(situation==='no-check')assert.deepEqual(actual.checkCells,[]);else assert.equal(actual.trust,false);
  sim.advanceToNextWindow(s);assert.equal(sim.getEnding(s).title,'纸上的共同作者');
 }
});
