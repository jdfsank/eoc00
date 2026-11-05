import test from 'node:test';
import assert from 'node:assert/strict';
import {mapActivity,institutionVisual} from '../src/board-visuals.js';
import {createRun,passTask,unlockTask,commitWindow,advanceYear,advanceToNextWindow,validateState} from '../src/simulation.js';
import {investigateAndLock} from './helpers/play.js';

function at20(){
 const s=createRun(0);passTask(s,'protagonist');commitWindow(s);advanceToNextWindow(s);
 investigateAndLock(s,'protagonist','D4','recruit_volunteer');commitWindow(s);advanceToNextWindow(s);return s;
}
function pair(){const s=at20();investigateAndLock(s,'protagonist','B4','independent_review');investigateAndLock(s,'linche','D5','mutual_aid');return s;}

test('a locked draft is an intent, not a new institution, and unlock/pass remove it',()=>{
 const s=createRun(0);investigateAndLock(s,'protagonist','D4','build_joint');const before=structuredClone(s);
 assert.deepEqual(mapActivity(s).map(a=>[a.kind,a.cellId,a.shape]),[['draft','D4','square']]);
 assert.match(mapActivity(s)[0].label,/拟派遣.*未提交/);assert.equal(institutionVisual(s,'D4'),null);assert.deepEqual(s,before);
 unlockTask(s,'protagonist');assert.deepEqual(mapActivity(s),[]);passTask(s,'protagonist');assert.deepEqual(mapActivity(s),[]);
});
test('both actual actors have non-color-distinct intent chips at B4 and D5',()=>{
 const s=pair();assert.equal(validateState(s).valid,true);const before=structuredClone(s);
 assert.deepEqual(mapActivity(s).map(a=>[a.actorId,a.cellId,a.shape]),[['protagonist','B4','square'],['linche','D5','circle']]);
 assert.equal(mapActivity(s,'B4').length,1);assert.equal(mapActivity(s,'D4').length,0);assert.deepEqual(s,before);
});
test('conflicting same-place drafts remain separate intents, without inventing a joint action',()=>{
 const s=at20();investigateAndLock(s,'protagonist','B4','local_veto');investigateAndLock(s,'linche','B4','local_veto');
 assert.equal(mapActivity(s,'B4').length,2);assert.equal(institutionVisual(s,'B4').kind,'landmark');assert.equal(institutionVisual(s,'B4').prop,'monastery_none_none');assert.equal(institutionVisual(s,'B4').monastery.archive.exists,false);assert.equal(institutionVisual(s,'B4').monastery.review.exists,false);
});
test('commit replaces intent chips with waits at all places; real annual outcomes remove them',()=>{
 const s=pair();commitWindow(s);assert.equal(validateState(s).valid,true);
 assert.deepEqual(mapActivity(s).map(a=>[a.kind,a.cellId,a.shape,a.dueYear]),[['pending','B4','hourglass',22],['pending','D5','hourglass',21]]);
 assert.ok(mapActivity(s).every(a=>a.actorId===undefined));assert.equal(institutionVisual(s,'D5'),null);
 advanceYear(s);assert.deepEqual(mapActivity(s).map(a=>a.cellId),['B4']);assert.equal(institutionVisual(s,'D5').kind,'mutual');
 advanceYear(s);assert.deepEqual(mapActivity(s),[]);assert.equal(institutionVisual(s,'B4').kind,'independent');
 assert.equal(s.events.find(e=>e.cellId==='B4').status,'failed');assert.match(institutionVisual(s,'B4').label,/第22年复核失败底稿保留/);assert.equal(institutionVisual(s,'B4').monastery.review.exists,false);assert.equal(institutionVisual(s,'B4').monastery.stage,'failed');assert.ok(!s.flags.review);
});
test('descendant training waits do not pretend the original actor is stationed there',()=>{
 const s=createRun(0);investigateAndLock(s,'protagonist','D4','build_joint');commitWindow(s);
 advanceYear(s);advanceYear(s);advanceYear(s);
 assert.deepEqual(mapActivity(s).map(a=>[a.kind,a.cellId,a.dueYear]),[['pending','E4',7]]);
 assert.equal(mapActivity(s)[0].actorId,undefined);assert.equal(institutionVisual(s,'E4'),null);
});
test('pending activity has no hard-coded location whitelist and no resolved markers',()=>{
 const s=createRun(0);s.events=s.cells.map((cell,n)=>({id:`test:${n}`,cellId:cell.id,title:'待办',year:1,status:'pending'}));
 assert.equal(mapActivity(s).length,64);
 s.events[0].status='success';s.events[1].status='failed';s.events[2].status='cancelled';assert.equal(mapActivity(s).length,61);
});
test('activity never reads random results, seeds, probabilities, or preparation',()=>{
 const s=pair();commitWindow(s);const before=mapActivity(s);
 Object.defineProperty(s,'seed',{get(){throw Error('seed must not be read');}});
 for(const event of s.events)for(const key of ['roll','probability','preparation'])Object.defineProperty(event,key,{get(){throw Error(`${key} must not be read`);}});
 assert.deepEqual(mapActivity(s),before);assert.ok(before.every(a=>!('roll' in a)&&!('probability' in a)));
});
test('stale drafts and unavailable actors are not presented as current deployments',()=>{
 const s=pair();s.drafts.protagonist.window=10;s.actors.find(a=>a.id==='linche').availableFrom=30;assert.deepEqual(mapActivity(s),[]);
});
