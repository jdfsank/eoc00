import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from './fixtures/pre-future-check-simulation.js';
import {sceneFor,evidenceFor} from '../src/story.js';
function at30(api=sim,{staff=true,review=false,preserve=false}={}){
 const s=api.createRun(0);
 function next(tasks=[]){for(const [actor,cell,id,extra=[]] of tasks){const a=api.getActions(s,cell,actor).find(a=>a.id===id);assert.ok(a);for(const e of [...a.requireEvidence,...extra])if(!api.getInvestigation(s,actor,cell).evidence.includes(e))api.investigate(s,actor,cell,e);api.lockTask(s,actor,cell,id);}for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);api.advanceToNextWindow(s);}
 next(preserve?[['protagonist','B4','preserve_records']]:[]);next([['protagonist','D4','recruit_volunteer']]);next([['protagonist','B4',review?'independent_review':'local_veto',review?[]:['evacuation_routes']],...(staff?[['linche','E4','train_network']]:[])]);return s;
}
test('new from-zero B4 scene and evidence distinguish future construction from a failed review',()=>{
 const s=at30(),bytes=JSON.stringify(s),body=sceneFor(s,'B4','linche').body.join(' ');
 assert.match(body,/第34年/);assert.match(body,/第23年/);assert.match(body,/没有可直接沿用/);assert.match(body,/成本不会退回/);assert.match(body,/另付经费/);assert.doesNotMatch(body,/没有及时完成的校验仍留在/);
 assert.match(evidenceFor(s,'anomaly_records','B4','linche').text,/不证明此前曾完成或失败/);assert.match(evidenceFor(s,'resident_testimony','B4','linche').text,/不代替跨地交班授权/);assert.equal(s.flags.crisis.damage,.1904);assert.equal(JSON.stringify(s),bytes);
});
test('no workforce is stated as conditional training rather than promised success',()=>{
 const s=at30(sim,{staff:false}),body=sceneFor(s,'B4').body.join(' ');assert.match(body,/目前没有可用人手/);assert.match(body,/第31年/);assert.match(body,/没有另外签署方针/);assert.match(body,/无人就取消/);
});
test('true old run and available failure record retain their original scenes and contracts',()=>{
 const oldState=at30(old),before=JSON.stringify(oldState);assert.doesNotMatch(sceneFor(oldState,'B4').body.join(' '),/第34年/);assert.doesNotMatch(evidenceFor(oldState,'anomaly_records','B4').text,/新刻水尺/);assert.equal(JSON.stringify(oldState),before);
 const failed=at30(sim,{review:true});assert.ok(sim.getRecoverySource(failed,'B4'));assert.equal(sceneFor(failed,'B4').title,'没赶上的那份校验');assert.match(evidenceFor(failed,'anomaly_records','B4').text,/第32年/);
 const preserved=at30(sim,{preserve:true});assert.equal(sim.getFutureCheckPlan(preserved).available,false);assert.doesNotMatch(sceneFor(preserved,'B4').body.join(' '),/第34年/);
});
