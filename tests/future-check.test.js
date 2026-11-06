import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as sim from '../src/simulation.js';
import * as prior from './fixtures/pre-future-check-simulation.js';
import {restoreSave} from '../src/save.js';
import {getHandoffOutlook} from '../src/handoff-outlook.js';

const copy=structuredClone, ID='establish_future_check';
const event=s=>s.events.find(e=>e.actionId===ID);
const choice=s=>sim.getActions(s,'B4').find(a=>a.id===ID);
const reload=s=>restoreSave(JSON.parse(JSON.stringify({state:s}))).state;
function choose(api,s,actor,site,id,extra=[]) {
  const action=api.getActions(s,site,actor).find(a=>a.id===id);
  assert.ok(action,`${s.year}/${actor}/${site}/${id}`);
  for(const evidence of [...action.requireEvidence,...extra])if(!api.getInvestigation(s,actor,site).evidence.includes(evidence))api.investigate(s,actor,site,evidence);
  api.lockTask(s,actor,site,id);
}
function submit(api,s,tasks=[]) {
  for(const args of tasks)choose(api,s,...args);
  for(const actor of api.getActors(s))if(!s.drafts[actor.id])api.passTask(s,actor.id);
  api.commitWindow(s);
}
function decade(api,s,tasks=[]) {submit(api,s,tasks);api.advanceToNextWindow(s);return s;}
// Natural reachability witnesses, no resource/actor/flag mutations.
function at30({staff=true,first=null,twenty=null,seed=0}={},api=sim) {
  const s=api.createRun(seed);
  decade(api,s,first?[['protagonist','B4',first]]:[]);
  decade(api,s,[['protagonist','D4','recruit_volunteer']]);
  decade(api,s,twenty||[['protagonist','B4','local_veto',['evacuation_routes']],...(staff?[['linche','E4','train_network']]:[])]);
  return s;
}
function pending(options={},others=[['protagonist','D4','withdraw']]) {
  const s=at30(options);submit(sim,s,[['linche','B4',ID],...others]);return s;
}
function until(s,year=40) {while(s.year<year)sim.advanceYear(s);return s;}
function past(s) {return {history:copy(s.history.filter(h=>h.year<=30)),events:copy(s.events.filter(e=>e.year<=30)),crisis:copy(s.flags.crisis),snapshots:copy(Object.fromEntries(Object.entries(s.snapshots).filter(([year])=>Number(year)<=30)))};}
function rejected(s) {
  const before=copy(s);
  assert.equal(sim.validateState(s).valid,false);
  assert.throws(()=>reload(s));
  if(s.phase==='playback')assert.throws(()=>sim.advanceYear(s));
  else {assert.equal(sim.getWindowReview(s).ready,false);assert.throws(()=>sim.commitWindow(s));}
  assert.deepEqual(s,before,'invalid save or year settlement is atomic');
}
function freeze(o) {if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;}

test('7fd0ee703d9339f7c2ef68c63f38819c221b8d27 baseline is the exact published simulation blob apart from two import paths',()=>{
  const bytes=Buffer.from(readFileSync(new URL('./fixtures/pre-future-check-simulation.js',import.meta.url),'utf8').replace("'../../src/data/board.json'","'./data/board.json'").replace("'./pre-future-check-branch-access.js'","'./branch-access.js'"));
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),'be6ec5826d6aedb3edbec770f9a8bc8ccdb414eb');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'92458fa080b3ba3bfc4003c943831cd0f3da1e66464a18181864dccc8ce0d679');
  const helper=readFileSync(new URL('./fixtures/pre-future-check-branch-access.js',import.meta.url));
  assert.equal(createHash('sha1').update(`blob ${helper.length}\0`).update(helper).digest('hex'),'b3e40a27d89e7a65bdcc2a9fe17f0ecd9f1b2341');
});
test('new factory adds explicit prospective rule identities; no save migration',()=>{
  const s=sim.createRun(0),old=prior.createRun(0);old.futureCheckRulesVersion='future-check-v1';old.archiveUpgradeRulesVersion='archive-upgrade-v1';old.trainingAuthorizationRulesVersion='training-authorization-v1';old.trainingWorkloadRulesVersion='training-workload-v1';
  assert.deepEqual(s,old);assert.deepEqual(reload(s),s);
  const oldSave=prior.createRun(0);assert.deepEqual(reload(oldSave),oldSave);assert.equal(reload(oldSave).futureCheckRulesVersion,undefined);
});
test('natural stopped-veto route can choose a costly year34 prospective check without inventing a failed review',()=>{
  const s=at30(),before=copy(s),a=choice(s);
  assert.equal(s.flags.crisis.damage,.1904);assert.equal(sim.getRecoverySource(s,'B4'),null);assert.equal(s.events.some(e=>e.actionId==='independent_review'),false);
  assert.deepEqual(a.cost,{economy:6,science:4});assert.equal(a.dueIn,4);assert.equal(a.probability,1);assert.equal(a.conditional,true);assert.deepEqual(a.requireEvidence,['anomaly_records','resident_testimony']);
  assert.match(a.description,/水尺.*抄本/);assert.match(a.risk,/34.*人手.*取消.*不退/);assert.deepEqual(s,before);
  const oldChoices=prior.getActions(at30({},prior),'B4');assert.equal(oldChoices.some(a=>a.id===ID),false);
  assert.equal(sim.getActions(at30({},prior),'B4').some(a=>a.id===ID),false);
});
test('natural success starts at34, keeps all past facts and does not grant review, trust, authorization or a policy',()=>{
  const s=pending({},[]),historical=past(s),flags=copy(s.flags),oldInstitutions=copy(s.institutions),resources=s.cells.find(c=>c.id==='B4').channels;
  assert.equal(sim.getFutureCheckContracts(s)[0].status,'pending');assert.equal(sim.hasCompletedFutureCheck(s),false);
  assert.match(s.history.find(h=>h.id===event(s).sourceActionId).text,/34.*取消.*不退/);
  assert.equal(event(s).futureCheckWorkforceIds,undefined);
  until(s,33);assert.equal(event(s).status,'pending');assert.equal(sim.getHandoffReadiness(s).checks.length,0);
  until(s,34);assert.equal(event(s).status,'success');assert.equal(event(s).resolvedYear,34);assert.equal(sim.hasCompletedFutureCheck(s),true);
  assert.deepEqual(sim.getFutureCheckContracts(s)[0].workforceIds,sim.getRecoveryWorkforce(s).map(i=>i.id));
  assert.deepEqual(sim.getHandoffReadiness(s).checkCells,['B4']);assert.equal(sim.getHandoffReadiness(s).canWithdraw,true);assert.equal(sim.getHandoffReadiness(s).canShare,false);
  assert.deepEqual(s.flags,flags);assert.deepEqual(s.institutions.slice(0,oldInstitutions.length),oldInstitutions);assert.deepEqual(past(s),historical);assert.deepEqual(reload(s),s);
  until(s);assert.equal(sim.getEnding(s).title,'未签署的下一页');assert.equal(s.flags.review,undefined);assert.equal(s.flags.trust,undefined);assert.equal(s.flags.policy,undefined);
  assert.equal(resources===s.cells.find(c=>c.id==='B4').channels,false);assert.deepEqual(past(s),historical);
});
for(const policy of ['withdraw','share_power','central_review'])test(`natural future check plus ${policy} keeps policy and trust requirements`,()=>{
  const s=pending({},[['protagonist','D4',policy]]);until(s);
  assert.equal(sim.hasCompletedFutureCheck(s),true);assert.equal(s.flags.crisis.damage,.1904);
  assert.equal(sim.getEnding(s).title,{withdraw:'没有唯一守夜人',share_power:'纸上的共同作者',central_review:'仍亮着灯的续史局'}[policy]);
  if(policy==='central_review')assert.match(sim.getEnding(s).text,/未来指令.*没有赶上第23年/);
});
test('no genuine workforce cancels at34 and leaves spent resources, evidence and slot costs',()=>{
  const s=at30({staff:false}),b4=()=>s.cells.find(c=>c.id==='B4'),before=copy(b4().channels);
  submit(sim,s,[['linche','B4',ID],['protagonist','D4','withdraw']]);
  assert.equal(b4().channels.economy,before.economy-6);assert.equal(b4().channels.science,before.science-4);
  assert.equal(sim.getInvestigation(s,'linche','B4').budget,0);
  const control=copy(s);until(s);assert.equal(event(s).status,'cancelled');assert.equal(sim.hasCompletedFutureCheck(s),false);
  assert.equal(s.institutions.some(i=>i.sourceEventId===event(s).id),false);assert.equal(sim.getEnding(s).title,'交班后的空椅子');
  assert.match(event(s).text,/34.*取消.*不退/);assert.deepEqual(reload(s),s);
  until(control);assert.deepEqual(control,s,'no extra refund path after cancellation');
});
test('31-year training supplies34-year work, but uses the other slot and leaves the policy unsigned',()=>{
  const s=pending({staff:false},[['protagonist','E4','train_network']]);until(s,31);
  assert.equal(sim.getRecoveryWorkforce(s).length,1);assert.equal(event(s).status,'pending');assert.equal(sim.getHandoffReadiness(s).checks.length,0);
  const reload31=reload(s);until(s);until(reload31);assert.deepEqual(s,reload31);
  assert.equal(event(s).status,'success');assert.equal(sim.getEnding(s).title,'未签署的下一页');assert.equal(sim.getHandoffReadiness(s).canWithdraw,true);
});
test('all three evidence rounds must belong to the executor, with resident testimony from B4',()=>{
  const s=at30();sim.investigate(s,'linche','B4','old_reality_record');sim.investigate(s,'linche','B4','anomaly_records');
  const before=copy(s);assert.throws(()=>sim.investigate(s,'linche','B4','resident_testimony'),/轮次不足/);assert.deepEqual(s,before);
  const t=at30();sim.investigate(t,'protagonist','B4','anomaly_records');sim.investigate(t,'protagonist','B4','resident_testimony');assert.throws(()=>sim.lockTask(t,'linche','B4',ID),/证据/);
  sim.investigate(t,'linche','D5','resident_testimony');sim.investigate(t,'linche','B4','anomaly_records');assert.throws(()=>sim.lockTask(t,'linche','B4',ID),/证据/);
});
test('artificial low resource boundary rejects whole submission without partial charge',()=>{
  const s=at30();choose(sim,s,'linche','B4',ID);sim.passTask(s,'protagonist');s.cells.find(c=>c.id==='B4').channels.science=3.99;
  const before=copy(s);assert.equal(sim.getWindowReview(s).ready,false);assert.throws(()=>sim.commitWindow(s),/不足/);assert.deepEqual(s,before);
});
test('a used actor slot is not a third action and a second B4 contract is a same-cell conflict',()=>{
  const s=at30();choose(sim,s,'protagonist','B4',ID);choose(sim,s,'linche','B4',ID);
  const before=copy(s);assert.equal(sim.getWindowReview(s).ready,false);assert.throws(()=>sim.commitWindow(s),/同格/);assert.deepEqual(s,before);
  choose(sim,s,'protagonist','D4','withdraw');assert.equal(Object.keys(s.drafts).length,2);assert.equal(sim.getWindowReview(s).tasks.filter(t=>t.a.id===ID).length,1);
});
test('existing successful B4 source suppresses redundant new construction',()=>{
  const s=at30({first:'preserve_records'});assert.equal(choice(s),undefined);assert.match(sim.getFutureCheckPlan(s).reason,/已有.*无需/);
  assert.equal(sim.getActions(s,'F6').some(a=>a.id===ID),false);
  // Artificial closure boundary: retain old physical carrier and history.
  const old=s.institutions.find(i=>i.cellId==='B4');old.active=false;old.maintenance=0;const historical=copy(old);
  assert.ok(choice(s));decade(sim,s,[['linche','B4',ID],['protagonist','D4','withdraw']]);assert.equal(sim.hasCompletedFutureCheck(s),true);assert.deepEqual(s.institutions.find(i=>i.id===old.id),historical);
  assert.deepEqual(sim.getHandoffReadiness(s).checkCells,['B4']);
});
test('natural failed review keeps the original cheaper32-year recovery contract and no new duplicate choice',()=>{
  const s=at30({twenty:[['protagonist','B4','independent_review'],['linche','E4','train_network']]});
  assert.equal(s.events.find(e=>e.actionId==='independent_review').status,'failed');assert.equal(choice(s),undefined);assert.match(sim.getFutureCheckPlan(s).reason,/失败底稿.*更低.*更早/);
  const a=sim.getActions(s,'B4').find(a=>a.id==='complete_review');assert.deepEqual(a.cost,{economy:4,science:3});assert.equal(a.dueIn,2);assert.deepEqual(a.requireEvidence,['anomaly_records']);
  decade(sim,s,[['linche','B4','complete_review'],['protagonist','D4','withdraw']]);assert.equal(sim.hasCompletedRecovery(s),true);assert.equal(sim.hasCompletedFutureCheck(s),false);
});
test('artificial closed failure can start anew without reviving or erasing the original failed review',()=>{
  const s=at30({twenty:[['protagonist','B4','independent_review'],['linche','E4','train_network']]});
  const failed=s.events.find(e=>e.actionId==='independent_review'),i=s.institutions.find(i=>i.sourceEventId===failed.id);i.active=false;
  const original=copy({failed,i});assert.ok(choice(s));decade(sim,s,[['linche','B4',ID]]);
  assert.deepEqual({failed,i},original);assert.equal(sim.hasCompletedRecovery(s),false);assert.equal(sim.hasCompletedFutureCheck(s),true);
});
test('artificial later workforce retirement preserves completed history but not an unsupported handoff',()=>{
  const s=pending();until(s,35);const completed=copy(event(s));for(const i of s.institutions)if(i.kind==='school')i.active=false;
  assert.equal(sim.validateState(s).valid,true);assert.equal(sim.hasCompletedFutureCheck(s),true);until(s);assert.deepEqual(event(s),completed);assert.equal(sim.getEnding(s).title,'交班后的空椅子');assert.deepEqual(reload(s),s);
});
test('artificial later new-check closure stops readiness while preserving a sourced historical institution',()=>{
  const s=pending();until(s,35);s.institutions.find(i=>i.sourceEventId===event(s).id).active=false;
  assert.equal(sim.hasCompletedFutureCheck(s),false);assert.equal(sim.getFutureCheckSources(s,{requireActive:false}).length,1);assert.equal(sim.validateState(s).valid,true);until(s);assert.equal(sim.getEnding(s).title,'交班后的空椅子');
});
for(const value of ['future-check-v9',null,{},false])test(`unknown future version ${JSON.stringify(value)} rejects before any write`,()=>{
  const s=at30();s.futureCheckRulesVersion=value;rejected(s);
  const t=pending();t.futureCheckRulesVersion=value;rejected(t);
});
const pendingTamper=[
  ['missing rule',s=>{delete s.futureCheckRulesVersion;}],
  ['wrong contract rule',(s,e)=>{e.futureCheckRulesVersion='future-check-v2';}],
  ['wrong action rule',(s,e,h)=>{delete h.futureCheckRulesVersion;}],
  ['wrong cost',(s,e,h)=>{h.cost.science=3;}],
  ['wrong due year',(s,e)=>{e.year=32;}],
  ['wrong probability',(s,e)=>{e.probability=.8;}],
  ['wrong parent',(s,e)=>{e.parentId=null;}],
  ['wrong identity',(s,e)=>{e.id='event:fake';}],
  ['another action type',(s,e)=>{e.actionId='independent_review';}],
  ['missing action',(s,e)=>{s.history=s.history.filter(h=>h.id!==e.sourceActionId);}],
  ['missing investigation',(s,e)=>{delete s.investigations[`30:${e.sourceActionId.split(':')[2]}`];}],
  ['foreign resident testimony',(s,e)=>{s.investigations[`30:${e.sourceActionId.split(':')[2]}`].find(i=>i.evidenceId==='resident_testimony').cellId='D4';}],
  ['missing evidence',(s,e,h)=>{e.evidence=h.evidence=['anomaly_records'];}],
  ['premature workforce',(s,e)=>{e.futureCheckWorkforceIds=sim.getRecoveryWorkforce(s).map(i=>i.id);}],
  ['premature completion',(s,e)=>{e.resolvedYear=34;}],
  ['different reality',(s,e,h)=>{h.reality='R0';}],
];
for(const [name,mutate]of pendingTamper)test(`artificial malformed pending source: ${name}`,()=>{
  const s=pending(),e=event(s),h=s.history.find(h=>h.id===e.sourceActionId);mutate(s,e,h);rejected(s);assert.equal(sim.getFutureCheckContracts(s).length,0);
});
const successTamper=[
  ['missing workforce',(s,e)=>{e.futureCheckWorkforceIds=[];}],
  ['invented workforce',(s,e)=>{e.futureCheckWorkforceIds=['fake'];s.history.find(h=>h.id===`resolved:${e.id}`).futureCheckWorkforceIds=['fake'];}],
  ['duplicate workforce',(s,e)=>{e.futureCheckWorkforceIds.push(e.futureCheckWorkforceIds[0]);}],
  ['missing outcome',(s,e)=>{s.history=s.history.filter(h=>h.id!==`resolved:${e.id}`);}],
  ['altered outcome',(s,e)=>{s.history.find(h=>h.id===`resolved:${e.id}`).futureCheckWorkforceIds=[];}],
  ['missing carrier',(s,e)=>{s.institutions=s.institutions.filter(i=>i.sourceEventId!==e.id);}],
  ['cloned carrier',(s,e)=>{const i=s.institutions.find(i=>i.sourceEventId===e.id);s.institutions.push({...copy(i),id:'fake',cellId:'F6'});}],
  ['relocated carrier',(s,e)=>{s.institutions.find(i=>i.sourceEventId===e.id).cellId='E4';}],
  ['premature carrier',(s,e)=>{s.institutions.find(i=>i.sourceEventId===e.id).startYear=32;}],
  ['changed outcome reality',(s,e)=>{s.history.find(h=>h.id===`resolved:${e.id}`).reality='R0';}],
];
for(const [name,mutate]of successTamper)test(`artificial malformed successful source: ${name}`,()=>{
  const s=pending();until(s,35);mutate(s,event(s));rejected(s);assert.equal(sim.hasCompletedFutureCheck(s),false);assert.equal(sim.getHandoffReadiness(s).checks.length,0);
});
for(const mutate of ['inactive','zero','fake'])test(`artificial ${mutate} workforce cannot fulfill an otherwise real pending contract`,()=>{
  const s=pending(),school=s.institutions.find(i=>i.kind==='school');if(mutate==='inactive')school.active=false;else if(mutate==='zero')school.maintenance=0;else school.id='fake-school';
  assert.equal(sim.getRecoveryWorkforce(s).length,0);until(s);assert.equal(event(s).status,'cancelled');assert.equal(sim.hasCompletedFutureCheck(s),false);
});
for(const staff of [false,true])test(`whole-window read-only prediction with current workforce=${staff} keeps explicit noncompletion branch`,()=>{
  const s=at30({staff});choose(sim,s,'linche','B4',ID);choose(sim,s,'protagonist','D4','withdraw');
  const before=copy(s),view=getHandoffOutlook(freeze(copy(s)));assert.deepEqual(s,before);assert.equal(view.ready,true);assert.equal(view.conditional[0].dueYear,34);assert.equal(view.conditional[0].actionId,ID);assert.equal(view.conditional[0].supported,staff);
  assert.equal(view.projected.canWithdraw,staff);assert.equal(view.withoutConditionalChecks.canWithdraw,false);assert.equal(view.projected.canShare,false);
  const actual=copy(s);sim.commitWindow(actual);until(actual);assert.equal(sim.getHandoffReadiness(actual).canWithdraw,view.projected.canWithdraw);
  const otherSeed=copy(s);otherSeed.seed='does-not-reroll';assert.deepEqual(getHandoffOutlook(otherSeed),view);
});
test('whole-window projection recognizes31-to34 training, but no policy or trust is manufactured',()=>{
  const s=at30({staff:false});choose(sim,s,'linche','B4',ID);choose(sim,s,'protagonist','E4','train_network');const view=getHandoffOutlook(freeze(copy(s)));
  assert.equal(view.conditional[0].supported,true);assert.equal(view.projected.canWithdraw,true);assert.equal(view.projected.policyStatus,'no-policy');assert.equal(view.projected.trust,false);
  sim.commitWindow(s);until(s);assert.equal(sim.getEnding(s).title,'未签署的下一页');
});
test('projection source code does not read hidden random or advance the actual world',()=>{
  const source=readFileSync(new URL('../src/handoff-outlook.js',import.meta.url),'utf8');assert.doesNotMatch(source,/randomFor\s*\(|Math\.random\s*\(|advanceYear\s*\(|advanceToNextWindow\s*\(/);
});
test('natural forced teaching can staff future calibration but gains neither consent nor handoff authority',()=>{
  const s=at30({twenty:[['protagonist','D4','relocate_teacher'],['linche','B4','local_veto']]});
  assert.equal(sim.getRecoveryWorkforce(s).length,1);assert.equal(sim.getHandoffReadiness(s).authorizedStaff.length,0);assert.equal(s.flags.trust,false);
  const original=copy(s.flags);decade(sim,s,[['linche','B4',ID],['protagonist','D4','withdraw']]);
  assert.equal(sim.hasCompletedFutureCheck(s),true);assert.equal(sim.getHandoffReadiness(s).authorizedStaff.length,0);assert.equal(sim.getHandoffReadiness(s).canWithdraw,false);assert.equal(sim.getEnding(s).title,'交班后的空椅子');
  assert.equal(s.flags.trust,false);assert.equal(s.flags.forced,original.forced);assert.equal(s.institutions.find(i=>i.kind==='school').handoffAuthorization,undefined);
});
test('artificial same-region resumption does not turn two B4 methods into two check regions',()=>{
  const s=at30({first:'preserve_records'}),preserved=s.institutions.find(i=>i.cellId==='B4');preserved.active=false;
  submit(sim,s,[['linche','B4',ID],['protagonist','D4','withdraw']]);until(s,35);preserved.active=true;
  assert.equal(sim.validateState(s).valid,true);const ready=sim.getHandoffReadiness(s);
  assert.equal(ready.checks.length,2);assert.deepEqual(ready.checkCells,['B4']);assert.equal(sim.getEnding(s).metrics.autonomy,2);assert.deepEqual(ready.authorizedCells,['E4']);
});
test('year34 cancellation does not issue a refund: channels match a spent-cost no-event control exactly',()=>{
  const s=pending({staff:false}),control=copy(s),e=event(control);
  // Artificial accounting control: remove only the future contract, keep its
  // already-paid channels. No carriers or gameplay progress are manufactured.
  control.events=control.events.filter(row=>row.id!==e.id);control.history=control.history.filter(row=>row.id!==e.sourceActionId);
  until(s,34);until(control,34);assert.equal(event(s).status,'cancelled');assert.deepEqual(s.cells,control.cells);assert.deepEqual(s.snapshots[34],control.snapshots[34]);
});
test('new contract is unavailable before30, and an altered31 deadline cannot give early returns',()=>{
  const s=sim.createRun(0);assert.equal(choice(s),undefined);decade(sim,s);assert.equal(choice(s),undefined);decade(sim,s,[['protagonist','D4','recruit_volunteer']]);assert.equal(choice(s),undefined);
  const p=pending();event(p).year=31;rejected(p);assert.equal(sim.hasCompletedFutureCheck(p),false);
});
test('year31 reload, reversed grid traversal and repeated read-only views cannot change future completion',()=>{
  const s=pending();until(s,31);const b=reload(s);
  while(s.year<40){sim.getFutureCheckSources(freeze(copy(s)));sim.getFutureCheckContracts(freeze(copy(s)));sim.advanceYear(s);sim.advanceYear(b,{reverse:true});assert.deepEqual(s,b);}
});
// Genuine 7fd engine histories are created and advanced by that exact old code,
// then compared in full every year. No deleting current-version fields to fake saves.
for(const seed of [0,1,6])for(const route of ['veto','recovery','records','empty'])for(const loadYear of [0,11,22,30,31,34])test(`true7fd annual full-state replay ${seed}/${route}/import${loadYear}`,()=>{
  const old=prior.createRun(seed);let loaded=null;
  function tasks(s){
    if(s.year===0)return route==='records'?[['protagonist','B4','preserve_records']]:[];
    if(s.year===10)return [['protagonist','D4','recruit_volunteer']];
    if(s.year===20)return route==='empty'?[]:[['protagonist','B4',route==='recovery'?'independent_review':'local_veto',route==='recovery'?[]:['evacuation_routes']],['linche','E4','train_network']];
    if(s.year===30)return [['protagonist','D4','withdraw'],...(prior.getActions(s,'B4','linche').some(a=>a.id==='complete_review')?[['linche','B4','complete_review']]:[])];
  }
  while(old.year<40){
    if(old.year===loadYear){loaded=reload(old);assert.deepEqual(loaded,old);assert.equal(loaded.futureCheckRulesVersion,undefined);}
    if(old.phase==='planning'){const plan=tasks(old);submit(prior,old,plan);if(loaded)submit(sim,loaded,plan);}
    prior.advanceYear(old);if(loaded){sim.advanceYear(loaded);assert.deepEqual(loaded,old,`all state at${old.year}`);assert.deepEqual(sim.getEnding(loaded),prior.getEnding(old));}
  }
  assert.ok(loaded);assert.deepEqual(sim.getEnding(loaded),prior.getEnding(old));
});
