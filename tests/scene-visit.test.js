import test from 'node:test';
import assert from 'node:assert/strict';
import {getSceneVisit} from '../src/scene-visit.js';
import {sceneArt} from '../src/scene-art.js';
import {createRun,advanceYear,advanceToNextWindow,getActions,validateState,traceEvent} from '../src/simulation.js';
import {normalizeUi,restoreSave} from '../src/save.js';
import {portAt20,portAt30,portRecovery,lock} from './helpers/far-port.js';

function dates(){
 const failed=portAt30(),pending=portRecovery(structuredClone(failed)),y31=structuredClone(pending);
 advanceYear(y31);const y32=structuredClone(y31);advanceYear(y32);
 const y40=structuredClone(y32);advanceToNextWindow(y40);
 return {failed,pending,y31,y32,y40};
}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;}

test('supported F6 shore remains real while unrelated sites stay unavailable',()=>{
 const s=createRun(0),v=getSceneVisit(s,'F6');assert.equal(v.available,true);assert.equal(v.art.file,'open-shore.svg');assert.equal(v.sourceIds.length,0);assert.match(v.summary.join(''),/尚无可核实/);
 for(const cell of ['D4','E4'])assert.equal(getSceneVisit(s,cell).available,true);
 for(const cell of ['A1','Z9',null])assert.equal(getSceneVisit(s,cell),null);
 for(const year of [-1,41,1.5,null])assert.equal(getSceneVisit({...s,year},'F6'),null);
 assert.equal(getSceneVisit({...s,cells:[]},'F6'),null);assert.equal(getSceneVisit(null,'F6'),null);
});
test('locked review and locked recovery never install a future institution or source',()=>{
 const s=portAt20(),before=getSceneVisit(s,'F6');lock(s,'protagonist','F6','independent_review');assert.deepEqual(getSceneVisit(s,'F6'),before);
 const failed=portAt30(),previous=getSceneVisit(failed,'F6');lock(failed,'protagonist','F6','complete_review');assert.deepEqual(getSceneVisit(failed,'F6'),previous);
});
test('natural31 pending and32 actual completion use distinct truthful scenes without AVG actions',()=>{
 const {y31,y32}=dates();for(const s of [y31,y32]){assert.equal(validateState(s).valid,true);assert.deepEqual(getActions(s,'F6','protagonist'),[]);assert.deepEqual(getSceneVisit(s,'F6').art,sceneArt(s,'F6'));}
 const waiting=getSceneVisit(y31,'F6'),done=getSceneVisit(y32,'F6');assert.equal(waiting.art.file,'far-port-branch-pending.svg');assert.match(waiting.summary.join(''),/尚未形成新校验组/);assert.doesNotMatch(waiting.summary.join(''),/第32年兑现/);
 assert.equal(done.art.file,'far-port-branch-recovered.svg');assert.match(done.summary.join(''),/第22年复核失败记录保留.*第32年兑现/);assert.match(done.summary.join(''),/没有被改写/);
 const outcome=y32.history.find(h=>h.kind==='outcome'&&h.sourceActionId?.endsWith(':complete_review'));assert.ok(outcome);assert.ok(done.sourceIds.includes(outcome.id));assert.ok(!waiting.sourceIds.includes(outcome.id));
});
test('year40 remains viewable after planning ends and preserves both old failure and present services',()=>{
 const {y40}=dates(),v=getSceneVisit(y40,'F6');assert.equal(y40.phase,'ended');assert.equal(v.year,40);assert.equal(v.available,true);assert.equal(v.art.file,'far-port-branch-recovered.svg');assert.match(v.summary.join(''),/分站运行中.*第22年复核失败记录保留.*后续校验组运行中/);
 assert.ok(v.sourceIds.some(id=>id.includes('resolved:')&&id.endsWith(':independent_review')));assert.ok(v.sourceIds.some(id=>id.includes('resolved:')&&id.endsWith(':complete_review')));
});
test('cancelled recovery and separate service closures do not borrow a success or hide a surviving carrier',()=>{
 const cancelled=portRecovery(portAt30(1,false));advanceToNextWindow(cancelled);const c=getSceneVisit(cancelled,'F6');assert.equal(c.art.file,'far-port-shore-failed.svg');assert.doesNotMatch(c.summary.join(''),/校验组运行中|分站运行中/);
 const {y40}=dates();y40.institutions.filter(i=>i.sourceActionId.endsWith(':complete_review')).forEach(i=>i.maintenance=0);const closed=getSceneVisit(y40,'F6');assert.equal(closed.art.file,'far-port-branch-closed.svg');assert.match(closed.summary.join(''),/分站运行中.*校验组已停运/);
 y40.institutions.filter(i=>i.kind==='branch').forEach(i=>i.active=false);assert.equal(getSceneVisit(y40,'F6').art.file,'far-port-branch-closed-closed.svg');
});
test('sources are unique existing local records, not future, cross-region or ambiguous references',()=>{
 const {y31,y32}=dates(),future=y32.history.find(h=>h.kind==='outcome'&&h.sourceActionId?.endsWith(':complete_review'));
 y31.history.push(future,{id:'cross',kind:'outcome',year:22,cellId:'B4'},{id:'duplicate',kind:'failure',year:22,cellId:'F6'},{id:'duplicate',kind:'failure',year:22,cellId:'F6'});
 const v=getSceneVisit(y31,'F6');assert.ok(!v.sourceIds.includes(future.id));assert.ok(!v.sourceIds.includes('cross'));assert.ok(!v.sourceIds.includes('duplicate'));
 for(const id of v.sourceIds){const h=y31.history.find(h=>h.id===id);assert.equal(h.cellId,'F6');assert.ok(h.year<=31);}
});
test('view is immutable and does not inspect RNG, queued roll or probability',()=>{
 for(const state of Object.values(dates())){const s=freeze(structuredClone(state)),before=JSON.stringify(s);getSceneVisit(s,'F6');assert.equal(JSON.stringify(s),before);}
 const s=dates().y31,expected=getSceneVisit(s,'F6');Object.defineProperty(s,'seed',{get(){throw Error('random seed');}});
 for(const e of s.events)for(const key of ['roll','probability'])Object.defineProperty(e,key,{get(){throw Error(key);}});
 assert.deepEqual(getSceneVisit(s,'F6'),expected);
});
test('read-only visit survives safe refresh at31/32/40 while import returns to world',()=>{
 const {y31,y32,y40}=dates();for(const state of [y31,y32,y40]){
  const saved={state,ui:{screen:'visit',selected:'F6'}},before=JSON.stringify(state);assert.equal(normalizeUi(state,saved.ui).screen,'visit');assert.equal(restoreSave(saved).ui.screen,'visit');assert.equal(restoreSave(saved,{imported:true}).ui.screen,'world');assert.equal(JSON.stringify(state),before);
 }
 assert.equal(normalizeUi(createRun(0),{screen:'visit',selected:'D4'}).screen,'visit');
 assert.equal(normalizeUi(createRun(0),{screen:'visit',selected:'A1'}).screen,'world');
});

test('imported cross-table ID collisions cannot turn local visit sources into future or other-region events',()=>{
 const natural=dates().y31,baseline=getSceneVisit(natural,'F6');assert.equal(baseline.sourceIds.length,4);
 const collidedIds=baseline.sourceIds.filter(id=>id.startsWith('resolved:')&&id.endsWith(':independent_review'));assert.equal(collidedIds.length,1);
 for(const id of collidedIds){
  const state=structuredClone(natural),originalHistory=JSON.stringify(state.history);
  state.events.push({id,year:39,cellId:'B4',actionId:'training',kind:'event',title:'OTHER REGION FUTURE EVENT',text:'DO NOT EXPOSE',parentId:null,sourceActionId:null,probability:1,status:'pending'});
  assert.equal(validateState(state).valid,true);const before=JSON.stringify(state),restored=restoreSave({state,ui:{screen:'visit',selected:'F6'}},{imported:true});
  assert.equal(restored.ui.screen,'world');assert.equal(JSON.stringify(restored.state),before);
  // This compatibility boundary is intentionally still accepted by the old
  // trace engine; the read-only visit must not advertise the ambiguous ID.
  assert.equal(traceEvent(state,id).at(-1).title,'OTHER REGION FUTURE EVENT');
  const view=getSceneVisit(state,'F6');assert.deepEqual(view.sourceIds,baseline.sourceIds.filter(sourceId=>sourceId!==id));
  assert.deepEqual(view.art,baseline.art);assert.deepEqual(view.summary,baseline.summary);
  assert.equal(JSON.stringify(state.history),originalHistory);assert.equal(JSON.stringify(state),before);
 }
});
