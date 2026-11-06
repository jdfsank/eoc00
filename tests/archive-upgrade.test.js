import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as sim from '../src/simulation.js';
import * as prior from './fixtures/pre-archive-upgrade-simulation.js';
import {restoreSave} from '../src/save.js';
import {getHandoffOutlook} from '../src/handoff-outlook.js';

const copy=structuredClone, ID='upgrade_archive_check';
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
function at30({staff=true,first='preserve_records',twenty=null,seed=0}={},api=sim) {
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

test('frozen published kernel matches baseline bytes apart from import locations',()=>{
 const bytes=readFileSync(new URL('./fixtures/pre-archive-upgrade-simulation.js',import.meta.url),'utf8').replace("'../../src/data/board.json'","'./data/board.json'").replace("'./pre-archive-upgrade-branch-access.js'","'./branch-access.js'");
 assert.equal(createHash('sha1').update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest('hex'),'318cd9c8f0b4c464f8ba547798d0277f2e01bbed');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'213e67a408a3a1ee18513ce9c043b3c87c8721b4bae40d52d1c3b096b8430415');
 assert.equal(createHash('sha256').update(readFileSync(new URL('./fixtures/pre-archive-upgrade-branch-access.js',import.meta.url))).digest('hex'),'2ef0fc66b6ad1300c2e7d6c72e0dea3e0203c9339b4d195bb3610c700634bc80');
});
test('new factory adds explicit prospective versions, never migrates actual old saves',()=>{
 const old=prior.createRun(0),current=sim.createRun(0);assert.deepEqual(current,{...old,archiveUpgradeRulesVersion:'archive-upgrade-v1',trainingAuthorizationRulesVersion:'training-authorization-v1'});assert.deepEqual(reload(old),old);assert.equal(sim.getArchiveUpgradePlan(at30({},prior)).available,false);
});
test('natural paid conversion preserves archive and crisis, adds central review without another geography',()=>{
 const s=at30(),pastBefore=past(s),old=copy(s.institutions),cost=copy(s.cells.find(c=>c.id==='B4').channels);
 assert.equal(sim.getHandoffReadiness(s).canWithdraw,true);assert.equal(sim.getFutureCheckPlan(s).available,false);
 assert.deepEqual(choice(s).cost,{economy:5,science:3});assert.equal(choice(s).dueIn,3);
 submit(sim,s,[['linche','B4',ID],['protagonist','D4','central_review']]);
 assert.equal(s.cells.find(c=>c.id==='B4').channels.economy,cost.economy-5);assert.equal(s.cells.find(c=>c.id==='B4').channels.science,cost.science-3);assert.equal(sim.getInvestigation(s,'linche','B4').budget,0);
 assert.equal(sim.getArchiveUpgradeContracts(s)[0].status,'pending');until(s,32);assert.equal(sim.hasCompletedArchiveUpgrade(s),false);until(s,33);assert.equal(sim.hasCompletedArchiveUpgrade(s),true);assert.deepEqual(s.institutions.slice(0,old.length),old);
 assert.deepEqual(sim.getHandoffReadiness(s).checkCells,['B4']);assert.equal(s.flags.review,undefined);assert.equal(s.flags.trust,undefined);assert.deepEqual(reload(s),s);until(s);
 assert.equal(sim.getEnding(s).title,'仍亮着灯的续史局');assert.deepEqual(s.flags.crisis,pastBefore.crisis);assert.deepEqual(s.history.filter(h=>h.year<30),pastBefore.history.filter(h=>h.year<30));assert.deepEqual(s.events.filter(e=>e.year<=30),pastBefore.events);for(const [y,v] of Object.entries(pastBefore.snapshots))assert.deepEqual(s.snapshots[y],v);
});
for(const reason of ['workforce-unavailable','archive-unavailable','archive-and-workforce-unavailable'])test(`source survival boundary: ${reason} cancels without refund or carrier`,()=>{
 const s=pending({staff:reason==='archive-unavailable'}),control=copy(s);
 if(reason.includes('archive')){const i=s.institutions.find(i=>i.cellId==='B4');i.active=false;i.maintenance=0;}
 until(s,33);assert.equal(event(s).status,'cancelled');assert.equal(event(s).archiveUpgradeCancellationReason,reason);assert.equal(sim.hasCompletedArchiveUpgrade(s),false);assert.deepEqual(reload(s),s);assert.equal(s.institutions.some(i=>i.sourceEventId===event(s).id),false);
 if(reason==='workforce-unavailable'){const e=event(control);control.events=control.events.filter(x=>x.id!==e.id);control.history=control.history.filter(x=>x.id!==e.sourceActionId);until(control,33);assert.deepEqual(s.cells,control.cells);}
});
test('31-year training uses other slot and supports33, no policy is manufactured',()=>{
 const s=at30({staff:false});choose(sim,s,'linche','B4',ID);choose(sim,s,'protagonist','E4','train_network');const before=copy(s),view=getHandoffOutlook(freeze(copy(s)));assert.equal(view.ready,true);assert.equal(view.conditional[0].actionId,ID);assert.equal(view.conditional[0].dueYear,33);assert.equal(view.conditional[0].supported,true);assert.equal(view.projected.policyStatus,'no-policy');assert.deepEqual(s,before);
 sim.commitWindow(s);until(s);assert.equal(sim.hasCompletedArchiveUpgrade(s),true);assert.equal(sim.getEnding(s).title,'未签署的下一页');
});
test('outlook keeps existing B4 method on cancellation branch and exposes paid conditional',()=>{
 const s=at30();choose(sim,s,'linche','B4',ID);choose(sim,s,'protagonist','D4','central_review');const v=getHandoffOutlook(s);assert.equal(v.ready,true);assert.equal(v.withoutConditionalChecks.canWithdraw,true);assert.deepEqual(v.current.checkCells,v.projected.checkCells);assert.match(v.notes.join(''),/不新增地域/);
});
test('executor evidence and local testimony cannot be borrowed; all three rounds are occupied',()=>{
 const s=at30();sim.investigate(s,'protagonist','B4','anomaly_records');sim.investigate(s,'protagonist','B4','resident_testimony');assert.throws(()=>sim.lockTask(s,'linche','B4',ID));sim.investigate(s,'linche','D5','resident_testimony');sim.investigate(s,'linche','B4','anomaly_records');assert.throws(()=>sim.lockTask(s,'linche','B4',ID));assert.throws(()=>sim.investigate(s,'linche','B4','resident_testimony'));
});
test('artificial insufficient resources and two same-cell slots reject atomically',()=>{
 const s=at30();choose(sim,s,'linche','B4',ID);choose(sim,s,'protagonist','B4',ID);let before=copy(s);assert.throws(()=>sim.commitWindow(s));assert.deepEqual(s,before);sim.passTask(s,'protagonist');s.cells.find(c=>c.id==='B4').channels.science=2.99;before=copy(s);assert.throws(()=>sim.commitWindow(s));assert.deepEqual(s,before);
});
test('no source, closed source, wrong site, early year or completed real review offers duplicate conversion',()=>{
 assert.equal(choice(sim.createRun()),undefined);assert.equal(choice(at30({first:null})),undefined);const s=at30();assert.equal(sim.getActions(s,'F6').some(a=>a.id===ID),false);s.institutions.find(i=>i.cellId==='B4').active=false;assert.equal(choice(s),undefined);
 const completed=at30({twenty:[['protagonist','B4','independent_review'],['linche','E4','train_network']]});assert.equal(completed.flags.review,true);assert.equal(choice(completed),undefined);
});
const edits={version:s=>s.archiveUpgradeRulesVersion='unknown',missingVersion:s=>delete s.archiveUpgradeRulesVersion,eventVersion:s=>event(s).archiveUpgradeRulesVersion='unknown',eventAction:s=>event(s).actionId='mutual_aid',early:s=>event(s).year=31,cost:s=>s.history.find(h=>h.id===event(s).sourceActionId).cost.economy=4,source:s=>event(s).archiveSourceInstitutionId='fake',testimony:s=>s.investigations['30:linche'].find(e=>e.evidenceId==='resident_testimony').cellId='D5',missingEvidence:s=>event(s).evidence.pop(),duplicate:s=>s.events.push(copy(event(s))),archiveMoved:s=>s.institutions.find(i=>i.cellId==='B4').cellId='D4',archiveForged:s=>s.events.find(e=>e.actionId==='preserve_records').actionId='independent_review'};
for(const [name,edit] of Object.entries(edits))test(`pending tamper ${name} rejected before import or tick`,()=>{const s=pending();edit(s);rejected(s);});
for(const [name,edit] of Object.entries({workforce:s=>event(s).archiveUpgradeWorkforceIds=['fake'],outcome:s=>s.history.find(h=>h.id===`resolved:${event(s).id}`).archiveSourceRecordId='fake',carrier:s=>s.institutions.find(i=>i.sourceEventId===event(s).id).cellId='D4',duplicate:s=>s.institutions.push({...s.institutions.find(i=>i.sourceEventId===event(s).id),id:'copy'})}))test(`success tamper ${name} cannot prove completion`,()=>{const s=pending();until(s,35);edit(s);rejected(s);assert.equal(sim.hasCompletedArchiveUpgrade(s),false);});
test('unknown marker on actual legacy planning save rejects atomically',()=>{const s=prior.createRun();s.archiveUpgradeRulesVersion='unknown';rejected(s);});
test('stopped new carrier retains historical completion but no live capability',()=>{const s=pending();until(s,35);const i=s.institutions.find(i=>i.sourceEventId===event(s).id);i.active=false;i.maintenance=0;assert.equal(sim.validateState(s).valid,true);assert.equal(sim.hasCompletedArchiveUpgrade(s),false);assert.equal(sim.getArchiveUpgradeSources(s,{requireActive:false}).length,1);});
for(const seed of [0,1,6])for(const route of ['veto','records','future','empty'])for(const loadYear of [0,11,22,30,31,34])test(`true published kernel full-state replay ${seed}/${route}/import${loadYear}`,()=>{
 const old=prior.createRun(seed);let loaded=null;
 function tasks(s){if(s.year===0)return route==='records'?[['protagonist','B4','preserve_records']]:[];if(s.year===10)return [['protagonist','D4','recruit_volunteer']];if(s.year===20)return route==='empty'?[]:[['protagonist','B4','local_veto',['evacuation_routes']],['linche','E4','train_network']];if(s.year===30)return [['protagonist','D4','central_review'],...(route==='future'?[['linche','B4','establish_future_check']]:[])];}
 while(old.year<40){if(old.year===loadYear){loaded=reload(old);assert.deepEqual(loaded,old);assert.equal(loaded.archiveUpgradeRulesVersion,undefined);}if(old.phase==='planning'){const plan=tasks(old);submit(prior,old,plan);if(loaded)submit(sim,loaded,plan);}prior.advanceYear(old);if(loaded){sim.advanceYear(loaded);assert.deepEqual(loaded,old);assert.deepEqual(sim.getEnding(loaded),prior.getEnding(old));}}
 assert.ok(loaded);
});
for(const [name,edit] of Object.entries({actionWorkforce:s=>s.history.find(h=>h.id===event(s).sourceActionId).archiveUpgradeWorkforceIds=['fake'],extraHistory:s=>s.history.push({id:'forged-copy',year:30,cellId:'B4',sourceActionId:event(s).sourceActionId,archiveUpgradeRulesVersion:'archive-upgrade-v1'}),institutionMarker:s=>s.institutions[0].archiveUpgradeRulesVersion='unknown'}))test(`unrecognized metadata placement ${name} rejected atomically`,()=>{const s=pending();edit(s);rejected(s);});
for(const scenario of ['existing-workforce','unsupported','year31-training'])test(`read-only command-check capability distinguishes upgrade outcome: ${scenario}`,()=>{
 const s=at30({staff:scenario==='existing-workforce'});choose(sim,s,'linche','B4',ID);choose(sim,s,'protagonist',scenario==='year31-training'?'E4':'D4',scenario==='year31-training'?'train_network':'central_review');
 const before=copy(s),view=getHandoffOutlook(freeze(copy(s))),supported=scenario!=='unsupported';
 assert.equal(view.ready,true);assert.equal(view.current.commandCheck,false);assert.equal(view.projected.commandCheck,supported);assert.equal(view.withoutConditionalChecks.commandCheck,false);assert.equal(view.withoutRecovery.commandCheck,false);
 assert.deepEqual(view.current.checkCells,view.projected.checkCells);assert.deepEqual(view.current.checkCells,view.withoutConditionalChecks.checkCells);assert.deepEqual(s,before);
 const otherSeed=copy(s);otherSeed.seed='not-a-projection-input';assert.deepEqual(getHandoffOutlook(otherSeed),view);
 sim.commitWindow(s);until(s,33);assert.equal(sim.hasCompletedArchiveUpgrade(s),supported);assert.equal(event(s).status,supported?'success':'cancelled');
});
test('an actual earlier successful review supplies command check without a conditional future contract',()=>{
 const s=at30({twenty:[['protagonist','B4','independent_review'],['linche','E4','train_network']]});assert.equal(s.flags.review,true);choose(sim,s,'protagonist','D4','central_review');sim.passTask(s,'linche');const view=getHandoffOutlook(freeze(copy(s)));
 assert.equal(view.current.commandCheck,true);assert.equal(view.projected.commandCheck,true);assert.equal(view.withoutConditionalChecks.commandCheck,true);assert.equal(view.conditional.length,0);
});
for(const falseReason of ['archive-unavailable','archive-and-workforce-unavailable'])test(`at33 both event and outcome cannot lie about cancellation reason: ${falseReason}`,()=>{
 const s=pending({staff:false});until(s,33);assert.equal(event(s).archiveUpgradeCancellationReason,'workforce-unavailable');event(s).archiveUpgradeCancellationReason=falseReason;s.history.find(h=>h.id===`resolved:${event(s).id}`).archiveUpgradeCancellationReason=falseReason;rejected(s);
});
test('after33 cancellation remains historical when original archive later stops',()=>{
 const s=pending({staff:false});until(s,34);const original=s.institutions.find(i=>i.id===event(s).archiveSourceInstitutionId);original.active=false;original.maintenance=0;
 assert.equal(sim.validateState(s).valid,true);assert.equal(sim.getArchiveUpgradeContracts(s)[0].cancellationReason,'workforce-unavailable');assert.deepEqual(reload(s),s);until(s);assert.equal(event(s).archiveUpgradeCancellationReason,'workforce-unavailable');
});
for(const row of ['action','event','outcome'])for(const [field,value] of [['actorId','linche'],['actionId','independent_review'],['reality','R2']])test(`original archive optional provenance ${row}/${field} must agree with canonical source`,()=>{
 const s=pending();until(s,35);const contract=event(s),original=s.events.find(e=>e.id===contract.archiveSourceEventId);
 const target=row==='event'?original:s.history.find(h=>h.id===(row==='action'?original.sourceActionId:contract.archiveSourceRecordId));target[field]=value;rejected(s);assert.equal(sim.hasCompletedArchiveUpgrade(s),false);
});
for(const row of ['action','event','outcome'])for(const [field,value] of [['actorId','missing-person'],['actionId','mutual_aid'],['reality','R2']])test(`upgrade workforce optional provenance ${row}/${field} cannot prove completion`,()=>{
 const s=pending();until(s,35);const original=s.events.find(e=>e.actionId==='train_network');const target=row==='event'?original:s.history.find(h=>h.id===(row==='action'?original.sourceActionId:`resolved:${original.id}`));target[field]=value;rejected(s);assert.equal(sim.getArchiveUpgradeWorkforce(s).length,0);assert.equal(sim.hasCompletedArchiveUpgrade(s),false);
});
test('upgrade outlook cannot claim support from a conflicting workforce actor',()=>{
 const s=at30();s.events.find(e=>e.actionId==='train_network').actorId='missing-person';assert.equal(sim.getRecoveryWorkforce(s).length,1,'released helper is unchanged');assert.equal(sim.getArchiveUpgradeWorkforce(s).length,0);
 choose(sim,s,'linche','B4',ID);choose(sim,s,'protagonist','D4','central_review');const view=getHandoffOutlook(s);assert.equal(view.ready,true);assert.equal(view.conditional[0].supported,false);assert.equal(view.projected.commandCheck,false);sim.commitWindow(s);until(s,33);assert.equal(event(s).status,'cancelled');assert.equal(event(s).archiveUpgradeCancellationReason,'workforce-unavailable');
});
test('upgrade workforce accepts real station, shared training and branch ancestry',()=>{
 const s=sim.createRun(6);decade(sim,s,[['protagonist','D4','build_state']]);decade(sim,s,[['protagonist','B4','preserve_records']]);decade(sim,s);
 assert.deepEqual(sim.getArchiveUpgradeWorkforce(s),sim.getRecoveryWorkforce(s));assert.deepEqual([...new Set(sim.getArchiveUpgradeWorkforce(s).map(i=>i.kind))].sort(),['branch','station','training']);
});
for(const stage of ['training','branch'])for(const row of ['event','outcome'])test(`derived workforce ${stage}/${row} conflicting actor cannot supply upgrade`,()=>{
 const s=sim.createRun(6);decade(sim,s,[['protagonist','D4','build_state']]);decade(sim,s,[['protagonist','B4','preserve_records']]);decade(sim,s);
 const e=s.events.find(e=>e.actionId===stage),target=row==='event'?e:s.history.find(h=>h.id===`resolved:${e.id}`);target.actorId='missing-person';assert.equal(sim.getArchiveUpgradeWorkforce(s).some(i=>i.kind===stage),false);if(stage==='training')assert.equal(sim.getArchiveUpgradeWorkforce(s).some(i=>i.kind==='branch'),false);
});
