import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from './fixtures/pre-tradeoffs-simulation.js';
import {getDraftChoiceComparison as compare} from '../src/draft-choice-comparison.js';
const request=(cellId='D4',actionId='build_state',extra={})=>({actorId:'protagonist',cellId,actionId,...extra});
function next(s,api=sim){for(const actor of api.getActors(s))if(!s.drafts[actor.id])api.passTask(s,actor.id);api.commitWindow(s);api.advanceToNextWindow(s);return s;}
function year20(api=sim){return next(next(api.createRun(12),api),api);}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}
function trap(object,key){Object.defineProperty(object,key,{configurable:true,get(){throw Error(`unexpected read: ${key}`);}});}

test('new world compares the actual locked build against a public, incomplete candidate without mutation',()=>{
 const s=sim.createRun(12);sim.lockTask(s,'protagonist','D4','build_merchant');
 const before=JSON.stringify(s),result=compare(s,request('D4','build_joint'));
 assert.equal(result.original.action.id,'build_merchant');assert.deepEqual(result.original.evidence,[]);
 assert.deepEqual(result.candidate.missing,['independent_flood_records','unfunded_maintenance']);
 assert.equal(result.sameAction,false);assert.equal(result.evidenceChanged,false);assert.equal(JSON.stringify(s),before);
});
test('passed arrangement remains an explicit pass, not an invented contract',()=>{
 const s=sim.createRun(12);sim.passTask(s,'protagonist');const before=JSON.stringify(s),result=compare(s,request());
 assert.deepEqual(result.original,{status:'passed',title:'本窗口明确放弃',cellId:null,action:null,evidence:[]});
 assert.equal(result.sameAction,false);assert.equal(result.evidenceChanged,false);assert.equal(JSON.stringify(s),before);
});
test('natural year 20 preserves basic 0.30 draft after actual evacuation research unlocks current 0.20',()=>{
 const s=year20();sim.lockTask(s,'protagonist','B4','local_veto');
 assert.equal(compare(s,request('B4','local_veto')).evidenceChanged,false);
 sim.investigate(s,'protagonist','B4','evacuation_routes');const before=JSON.stringify(s);
 const result=compare(s,request('B4','local_veto'));
 assert.match(result.original.action.reward,/0\.30/);assert.match(result.candidate.action.reward,/0\.20/);
 assert.deepEqual(result.original.evidence,[]);assert.equal(result.sameAction,true);assert.equal(result.evidenceChanged,true);
 assert.equal(JSON.stringify(s),before);
 const elsewhere=compare(s,request('F6','local_veto'));assert.equal(elsewhere.sameAction,false);assert.equal(elsewhere.evidenceChanged,false);
});
test('new rules ignore supplied scene evidence and use only the selected actor investigation',()=>{
 const s=year20();sim.passTask(s,'protagonist');
 assert.deepEqual(compare(s,request('B4','independent_review',{legacyEvidence:['anomaly_records']})).candidate.missing,['anomaly_records']);
 sim.investigate(s,'protagonist','B4','anomaly_records');
 assert.deepEqual(compare(s,request('F6','independent_review')).candidate.missing,[]);
});
test('true old producer uses scene evidence for candidate but never overwrites original snapshot',()=>{
 const s=year20(old);old.lockTask(s,'protagonist','B4','local_veto',[]);const before=JSON.stringify(s);
 const result=compare(s,request('B4','independent_review',{legacyEvidence:['anomaly_records']}));
 assert.deepEqual(result.original.action,sim.getActions(s,'B4','protagonist',[]).find(a=>a.id==='local_veto'));
 assert.deepEqual(result.candidate.missing,[]);assert.equal(result.candidate.action.probability,old.getActions(s,'B4').find(a=>a.id==='independent_review').probability);
 assert.equal(JSON.stringify(s),before);
});
test('evidenceChanged compares sets, not ordering or duplicate count',()=>{
 const s=old.createRun(12);old.lockTask(s,'protagonist','D4','build_joint',['independent_flood_records','unfunded_maintenance']);
 assert.equal(compare(s,request('D4','build_joint',{legacyEvidence:['unfunded_maintenance','independent_flood_records','independent_flood_records']})).evidenceChanged,false);
 assert.equal(compare(s,request('D4','build_joint',{legacyEvidence:['independent_flood_records']})).evidenceChanged,true);
});
test('all planning windows support valid arrangements while non-planning years and phases fail closed',()=>{
 const s=sim.createRun(12);
 for(const year of [0,10,20,30]){assert.equal(s.year,year);sim.passTask(s,'protagonist');const cellId=year===0?'D4':'D5',actionId=year===0?'build_state':'mutual_aid';assert.ok(compare(s,request(cellId,actionId)));if(year<30)next(s);}
 for(const phase of ['committed','ended','playback',null]){const bad=structuredClone(s);bad.phase=phase;assert.equal(compare(bad,request('D5','mutual_aid')),null);}
 for(const year of [-1,1,40,'20']){const bad=structuredClone(s);bad.year=year;assert.equal(compare(bad,request()),null);}
});
test('invalid identities, missing candidates and corrupt drafts fail closed',()=>{
 const s=sim.createRun(12);sim.lockTask(s,'protagonist','D4','build_merchant');
 for(const input of [undefined,null,{},request('A1'),request('D4','invented'),request('D4','build_state',{actorId:'linche'}),request('D4','build_state',{actorId:'missing'})])assert.equal(compare(s,input),null);
 for(const patch of [{actorId:'linche'},{window:10},{status:'unknown'},{cellId:'A1'},{actionId:'invented'},{evidence:null},{evidence:['invented']},{evidence:[{}]},{actionId:'build_joint',evidence:[]},{evidence:['resident_testimony']}]){const bad=structuredClone(s);Object.assign(bad.drafts.protagonist,patch);assert.equal(compare(bad,request()),null);}
 const none=structuredClone(s);delete none.drafts.protagonist;assert.equal(compare(none,request()),null);
 const passed=structuredClone(s);passed.drafts.protagonist.status='passed';assert.equal(compare(passed,request()),null);
 assert.equal(compare(null,request()),null);
});
test('deep frozen state and complete JSON remain unchanged; every returned object is detached',()=>{
 const s=year20();sim.investigate(s,'protagonist','B4','evacuation_routes');sim.lockTask(s,'protagonist','B4','local_veto');freeze(s);const before=JSON.stringify(s);
 const result=compare(s,request('B4','local_veto'));assert.ok(result);
 result.original.action.cost.economy=999;result.original.evidence.push('invented');result.candidate.action.requireEvidence.push('invented');result.candidate.missing.push('invented');
 assert.equal(JSON.stringify(s),before);const again=compare(s,request('B4','local_veto'));assert.notEqual(again.original.action.cost.economy,999);assert.deepEqual(again.original.evidence,['evacuation_routes']);assert.deepEqual(again.candidate.missing,[]);
});
test('public contract reading does not inspect seeds, rolls, history prose or future payloads',()=>{
 const s=year20();sim.lockTask(s,'protagonist','B4','local_veto');sim.investigate(s,'protagonist','B4','evacuation_routes');
 trap(s,'seed');trap(s,'future');trap(s,'evidenceText');
 for(const event of s.events){trap(event,'roll');trap(event,'payload');trap(event,'text');}
 for(const entry of s.history)trap(entry,'text');
 assert.ok(compare(s,request('B4','local_veto')));
 // Unreadable fields needed for validity fail closed rather than escaping.
 trap(s.drafts.protagonist,'evidence');assert.equal(compare(s,request('B4','local_veto')),null);
});
test('another available actor cannot supply evidence or impersonate the original owner',()=>{
 const s=sim.createRun(12);next(s);sim.lockTask(s,'protagonist','D4','recruit_volunteer');next(s);
 sim.investigate(s,'protagonist','B4','anomaly_records');sim.passTask(s,'protagonist');sim.passTask(s,'linche');
 const before=JSON.stringify(s);
 assert.deepEqual(compare(s,request('F6','independent_review')).candidate.missing,[]);
 assert.deepEqual(compare(s,request('F6','independent_review',{actorId:'linche'})).candidate.missing,['anomaly_records']);
 assert.equal(JSON.stringify(s),before);
 const corrupt=structuredClone(s);corrupt.drafts.linche=corrupt.drafts.protagonist;
 assert.equal(compare(corrupt,request('F6','independent_review',{actorId:'linche'})),null);
});
test('legacy frozen original evidence remains valid without any current investigation or scene evidence',()=>{
 const s=old.createRun(12);old.lockTask(s,'protagonist','D4','build_joint',['independent_flood_records','unfunded_maintenance']);
 trap(s,'investigations');const result=compare(s,request('D4','build_joint'));
 assert.ok(result);assert.deepEqual(result.original.evidence,['independent_flood_records','unfunded_maintenance']);
 assert.deepEqual(result.candidate.missing,['independent_flood_records','unfunded_maintenance']);assert.equal(result.evidenceChanged,true);
});
