import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as current from '../src/simulation.js';
import {restoreSave} from '../src/save.js';
import * as previous from './fixtures/pre-decision-flow-producer/simulation.js';
import {restoreSave as previousRestore} from './fixtures/pre-decision-flow-producer/save.js';
import * as older from './fixtures/pre-training-workload-producer/simulation.js';
import {restoreSave as olderRestore} from './fixtures/pre-training-workload-producer/save.js';
import {getPlanningOpportunity} from '../src/planning-opportunity.js';
import {renderPlanningOpportunity} from '../src/planning-opportunity-view.js';

const bytes=JSON.stringify,copy=structuredClone;
function exact(actual,expected,label){assert.equal(bytes(actual),bytes(expected),label);}
function savedExact(actual,expected,label){exact(actual,expected,label);exact(restoreSave({state:copy(actual)}).state,expected,`${label}: exact restore`);}
function lock(s,api,actor,cell,id){
 const a=api.getActions(s,cell,actor).find(a=>a.id===id);assert.ok(a,`${actor}/${cell}/${id} at ${s.year}`);
 for(const e of a.requireEvidence)if(!api.getInvestigation(s,actor,cell).evidence.includes(e))api.investigate(s,actor,cell,e);
 api.lockTask(s,actor,cell,id,a.requireEvidence);
}
function commit(s,api){for(const actor of api.getActors(s))if(!s.drafts[actor.id])api.passTask(s,actor.id);api.commitWindow(s);}
function next(s,api){commit(s,api);api.advanceToNextWindow(s);return s;}
function year20(api,{seed=0,build='build_joint'}={}){
 const s=api.createRun(seed);if(build)lock(s,api,'protagonist','D4',build);next(s,api);
 lock(s,api,'protagonist','D4',api.getActions(s,'D4').some(a=>a.id==='recruit_successor')?'recruit_successor':'recruit_volunteer');return next(s,api);
}

for(const directory of ['pre-decision-flow-producer','pre-training-workload-producer'])test(`round22 ${directory}: genuine producer files are frozen, self-contained and SHA-verified`,()=>{
 const root=new URL(`./fixtures/${directory}/`,import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
 assert.match(manifest.sourceCommit,/^[a-f0-9]{40}$/);
 for(const [file,sha]of Object.entries(manifest.files)){
  const content=fs.readFileSync(new URL(file,root));assert.equal(createHash('sha256').update(content).digest('hex'),sha,file);
  if(file.endsWith('.js'))for(const [,dependency]of content.toString().matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
   assert.ok(dependency.startsWith('./')&&!dependency.includes('..'),`${file}: dependency stays in real producer`);
   assert.ok(Object.hasOwn(manifest.files,dependency.slice(2)),`${file}: dependency is hash-covered`);
  }
 }
});

for(const [version,api,restore]of [['round21',previous,previousRestore],['round20',older,olderRestore]])for(const seed of [0,6,12,42])for(const build of ['build_joint','build_merchant',null])test(`round22 ${version}/${seed}/${build||'pass'}: all four windows and annual histories stay byte-exact`,()=>{
 const expected=api.createRun(seed),actual=copy(expected);
 assert.equal(Object.hasOwn(expected,'trainingWorkloadRulesVersion'),version==='round21');
 savedExact(actual,expected,'genuine new producer state');
 for(const year of [0,10,20,30]){
  assert.equal(expected.year,year);savedExact(actual,expected,`${year} planning`);
  const tasks=year===0?(build?[['protagonist','D4',build]]:[]):year===10?[['protagonist','D4',api.getActions(expected,'D4').some(a=>a.id==='recruit_successor')?'recruit_successor':'recruit_volunteer']]:year===20?[['protagonist','B4','independent_review'],['linche','D4','free_warning']]:[['protagonist','D4','share_power'],['linche','E4',api.getActions(expected,'E4','linche').some(a=>a.id==='authorize_training')?'authorize_training':'train_network']];
  for(const [actor,cell,id]of tasks){
   exact(current.getActions(actual,cell,actor),api.getActions(expected,cell,actor),`${year} public actions`);
   const a=api.getActions(expected,cell,actor).find(a=>a.id===id);
   for(const evidence of a.requireEvidence){api.investigate(expected,actor,cell,evidence);current.investigate(actual,actor,cell,evidence);savedExact(actual,expected,`${year} acquired ${evidence}`);}
   api.lockTask(expected,actor,cell,id,a.requireEvidence);current.lockTask(actual,actor,cell,id,a.requireEvidence);savedExact(actual,expected,`${year} locked ${actor}`);
   const spent=copy(expected.investigations),history=bytes(expected.history),cells=bytes(expected.cells);
   api.unlockTask(expected,actor);current.unlockTask(actual,actor);savedExact(actual,expected,`${year} unlocked ${actor}`);
   exact(actual.investigations,spent,'unlock does not refund evidence');assert.equal(bytes(actual.history),history);assert.equal(bytes(actual.cells),cells,'unlock pays no resources');
   lock(expected,api,actor,cell,id);lock(actual,current,actor,cell,id);
  }
  for(const actor of api.getActors(expected))if(!expected.drafts[actor.id]){api.passTask(expected,actor.id);current.passTask(actual,actor.id);}
  exact(current.getWindowReview(actual),api.getWindowReview(expected),`${year} whole-window review`);
  const preSubmit=copy(actual),review=current.getWindowReview(actual);api.commitWindow(expected);current.commitWindow(actual);
  savedExact(actual,expected,`${year} submission`);assert.equal(actual.year,year,'submit does not advance a year');assert.equal(actual.phase,'playback');
  for(const [cell,cost]of Object.entries(review.costs))for(const [channel,value]of Object.entries(cost))assert.equal(actual.cells.find(c=>c.id===cell).channels[channel],+(preSubmit.cells.find(c=>c.id===cell).channels[channel]-value).toFixed(4),`${cell}/${channel} pays exactly at submit`);
  exact(restore({state:copy(actual)}).state,actual,'original producer can restore continued save');
  while(expected.phase==='playback'){api.advanceYear(expected);current.advanceYear(actual);savedExact(actual,expected,`annual ${expected.year}`);}
 }
 exact(current.getEnding(actual),api.getEnding(expected),'exact ending');
});

test('round22 fresh creation remains identical to genuine previous production, without a new rule marker',()=>{for(const seed of [0,1,6,12,42,999999])savedExact(current.createRun(seed),previous.createRun(seed),`fresh ${seed}`);});

for(const [version,api]of [['round21',previous],['round20',older]])test(`round22 ${version}: later investigation cannot silently strengthen a locked veto`,()=>{
 const expected=year20(api,{build:null}),actual=copy(expected);
 for(const [s,a]of [[expected,api],[actual,current]]){a.lockTask(s,'protagonist','B4','local_veto');a.passTask(s,'linche');a.investigate(s,'protagonist','B4','evacuation_routes');}
 savedExact(actual,expected,'locked basic plus newer evidence');
 const review=current.getWindowReview(actual);assert.match(review.tasks[0].a.reward,/0.30/);assert.match(review.warnings.join(' '),/重新锁定/);
 const basic=copy(actual);commit(basic,current);current.advanceToNextWindow(basic);assert.equal(basic.flags.vetoMitigation,.3);
 for(const [s,a]of [[expected,api],[actual,current]]){a.unlockTask(s,'protagonist');a.lockTask(s,'protagonist','B4','local_veto');}
 savedExact(actual,expected,'explicitly relocked stronger veto');assert.match(current.getWindowReview(actual).tasks[0].a.reward,/0.20/);
 commit(expected,api);commit(actual,current);while(expected.phase==='playback'){api.advanceYear(expected);current.advanceYear(actual);savedExact(actual,expected,'stronger veto yearly result');}assert.equal(actual.flags.vetoMitigation,.2);
});

test('round22 protagonist-only final policy is an opportunity cost, not a new blocking rule',()=>{
 for(const api of [previous,older]){
  const s=year20(api);next(s,api);const before=bytes(s);
  assert.equal(api.getActions(s,'D4','protagonist').filter(a=>['share_power','central_review','withdraw'].includes(a.id)).length,3);
  assert.equal(api.getActions(s,'D4','linche').filter(a=>['share_power','central_review','withdraw'].includes(a.id)).length,0);
  assert.equal(bytes(s),before);const expected=copy(s),actual=copy(s);
  for(const [state,engine]of [[expected,api],[actual,current]]){lock(state,engine,'protagonist','B4','establish_future_check');lock(state,engine,'linche','E4','train_network');assert.equal(engine.getWindowReview(state).ready,true);}
  savedExact(actual,expected,'two nonpolicy tasks remain legal');commit(expected,api);commit(actual,current);
  while(expected.phase==='playback'){api.advanceYear(expected);current.advanceYear(actual);savedExact(actual,expected,'no-policy annual result');}assert.equal(actual.flags.policy,undefined);
 }
});

test('round22 incomplete and colliding tasks still reject atomically before any payment',()=>{
 const s=year20(current);lock(s,current,'protagonist','D4','free_warning');
 for(const mode of ['missing actor','same-cell conflict']){
  if(mode==='same-cell conflict')lock(s,current,'linche','D4','present_archive');
  const before=bytes(s);assert.equal(current.getWindowReview(s).ready,false);assert.throws(()=>current.commitWindow(s));assert.equal(bytes(s),before,mode);
 }
});

test('round22 independent public-reader audit: frozen states and private-field traps produce the same detached notice',()=>{
 const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
 for(const api of [previous,older]){
  const s=year20(api);next(s,api);const before=bytes(s);
  for(const options of [{},{actorId:'protagonist',cellId:'B4'},{actorId:'protagonist',cellId:'E4',actionId:'authorize_training'},{actorId:'linche',cellId:'E4'}]){
   const expected=getPlanningOpportunity(s,options);assert.ok(expected);assert.deepEqual(getPlanningOpportunity(freeze(copy(s)),options),expected);
   const trapped=copy(s),deny=(target,key)=>Object.defineProperty(target,key,{get(){throw Error(`Private field read: ${key}`);},configurable:true});
   for(const key of ['seed','baseline','snapshots'])deny(trapped,key);
   for(const row of [...trapped.events,...trapped.history])for(const key of ['roll','text','description','title'])deny(row,key);
   assert.deepEqual(getPlanningOpportunity(trapped,options),expected,'no RNG or historical prose needed');
   const returned=getPlanningOpportunity(s,options);returned.policyActor.status='forged';assert.deepEqual(getPlanningOpportunity(s,options),expected);
   const rendered=renderPlanningOpportunity(expected);assert.match(rendered,/data-planning-opportunity/);assert.doesNotMatch(rendered,/data-action=|已锁定结果|seed|roll/);
  }
  assert.equal(bytes(s),before,'pure notice cannot alter archive bytes');
 }
});

for(const [version,api,restore]of [['round21',previous,previousRestore],['round20',older,olderRestore]])test(`round22 ${version}: genuine committed and ended archives preserve a stale window UI without changing history`,()=>{
 const s=year20(api);next(s,api);lock(s,api,'protagonist','D4','share_power');commit(s,api);
 for(const phase of ['playback','ended']){
  if(phase==='ended')api.advanceToNextWindow(s);
  const payload={state:copy(s),ui:{screen:'window',selected:'E4',actor:'protagonist'}};
  const oldResult=restore(copy(payload)),newResult=restoreSave(copy(payload));
  assert.equal(oldResult.ui.screen,'window','real historical normalizer retains the stale route');
  assert.equal(newResult.ui.screen,'window','view guard must not rewrite the archived world to fix a UI route');
  exact(newResult.state,s,`${phase}: restored history exact`);exact(oldResult.state,newResult.state,`${phase}: original producer compatibility`);
 }
});
