import test from 'node:test';
import assert from 'node:assert/strict';
import {getSceneVisit} from '../src/scene-visit.js';
import {sceneArt} from '../src/scene-art.js';
import {createRun,getActions,validateState,traceEvent} from '../src/simulation.js';
import {normalizeUi,restoreSave} from '../src/save.js';
import {southVisitDates,collisionEvent} from './helpers/south-visit.js';
const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;};
const aidId='action:30:protagonist:D5:mutual_aid',aidEvent=`event:${aidId}`,aidResult=`resolved:${aidEvent}`;

test('D5 readonly visit is available without inventing a carrier, and unrelated regions remain unsupported',()=>{
 const s=createRun(0),v=getSceneVisit(s,'D5');assert.equal(v.available,true);assert.equal(v.cellId,'D5');assert.equal(v.art.file,'open-shore.svg');assert.deepEqual(v.sourceIds,[]);assert.match(v.summary.join(''),/尚无已存/);
 for(const cell of ['D4','E4'])assert.equal(getSceneVisit(s,cell).available,true);
 for(const cell of ['A1',null])assert.equal(getSceneVisit(s,cell),null);
});
test('locked and pending aid preserve the real shore/teaching artwork until actual31 fulfilment',()=>{
 for(const teaching of [false,true]){
  const d=southVisitDates({teaching});assert.deepEqual(getSceneVisit(d.locked,'D5'),getSceneVisit(d.before,'D5'));
  const before=getSceneVisit(d.before,'D5'),pending=getSceneVisit(d.pending,'D5'),done=getSceneVisit(d.y31,'D5');
  assert.deepEqual(pending.art,before.art);assert.match(pending.summary.join(''),/待第31年兑现/);assert.ok(pending.sourceIds.includes(aidId));assert.ok(!pending.sourceIds.includes(aidResult));
  assert.equal(done.art.file,teaching?'south-bank-learning-aid.svg':'south-bank-aid.svg');assert.match(done.summary.join(''),/第31年兑现.*不改写第23年清点/);assert.ok(done.sourceIds.includes(aidResult));
  assert.deepEqual(getActions(d.y31,'D5','protagonist'),[]);assert.equal(d.y40.phase,'ended');assert.deepEqual(getActions(d.y40,'D5','protagonist'),[]);
  assert.deepEqual(getSceneVisit(d.y40,'D5').art,done.art);assert.deepEqual(d.y31.flags.crisis,d.before.flags.crisis);
 }
});
test('teaching links retain their actual D4 build and E4 training provenance, separate from D5 aid',()=>{
 const s=southVisitDates().y31,v=getSceneVisit(s,'D5');assert.equal(v.sourceIds.length,5);assert.match(v.summary.join(''),/D4建站后、E4第7年培训/);
 for(const id of v.sourceIds){const chain=traceEvent(s,id);assert.ok(chain.length);assert.ok(chain.every(r=>r.year<=31));assert.ok(chain.every(r=>r.reality===undefined||r.reality==='R1'));}
 const training=v.sourceIds.find(id=>id.endsWith(':training'));assert.equal(s.history.find(h=>h.id===training).cellId,'E4');assert.equal(s.history.find(h=>h.id===aidResult).cellId,'D5');
});
test('D5 teaching and aid closures coexist independently, with old history unchanged and no new outcome',()=>{
 const s=southVisitDates().y40,history=JSON.stringify(s.history),crisis=JSON.stringify(s.flags.crisis),original=getSceneVisit(s,'D5');
 s.institutions.filter(i=>i.cellId==='D5'&&i.kind==='mutual').forEach(i=>i.active=false);let v=getSceneVisit(s,'D5');assert.equal(v.art.file,'south-bank-learning-aid-closed.svg');assert.match(v.summary.join(''),/读尺班运行中.*互助仓停运/);
 s.institutions.filter(i=>i.cellId==='D5'&&i.kind==='training').forEach(i=>i.maintenance=0);v=getSceneVisit(s,'D5');assert.equal(v.art.file,'south-bank-learning-closed-aid-closed.svg');assert.match(v.summary.join(''),/读尺班停运.*互助仓停运/);
 s.institutions.filter(i=>i.cellId==='D5'&&i.kind==='mutual').forEach(i=>{i.active=true;i.maintenance=.5;});v=getSceneVisit(s,'D5');assert.equal(v.art.file,'south-bank-learning-closed-aid.svg');assert.match(v.summary.join(''),/互助仓运行中，维护不足/);
 assert.deepEqual(v.sourceIds,original.sourceIds);assert.equal(JSON.stringify(s.history),history);assert.equal(JSON.stringify(s.flags.crisis),crisis);
});
test('valid imported bad aid chains retain current art but no longer advertise an unsafe source',()=>{
 const natural=southVisitDates().y31,art=sceneArt(natural,'D5');
 const mutations=[
  ...[aidId,aidEvent,aidResult].map(id=>s=>{const r=[...s.events,...s.history].find(r=>r.id===id);r.reality='R0';}),
  ...[aidId,aidResult].map(id=>s=>s.events.push(collisionEvent(id))),
  s=>s.history.push({...s.history.find(r=>r.id===aidId),id:aidEvent}),
  s=>{s.events.push(collisionEvent('future-parent'));s.history.find(r=>r.id===aidResult).parentId='future-parent';},
  ...[aidId,aidEvent,aidResult].map(id=>s=>{s.history=s.history.filter(r=>r.id!==id);s.events=s.events.filter(r=>r.id!==id);})
 ];
 for(const mutate of mutations){const s=structuredClone(natural);mutate(s);assert.equal(validateState(s).valid,true);const before=JSON.stringify(s),restored=restoreSave({state:s,ui:{screen:'visit',selected:'D5'}},{imported:true});assert.equal(restored.ui.screen,'world');assert.equal(JSON.stringify(restored.state),before);
  const v=getSceneVisit(s,'D5');assert.deepEqual(v.art,art);assert.ok(!v.sourceIds.includes(aidId));assert.ok(!v.sourceIds.includes(aidResult));assert.match(v.summary.join(''),/原始来源缺失或不一致/);assert.equal(v.sourceIds.length,3);assert.equal(JSON.stringify(s),before);
 }
});
test('training rejects unsafe ancestors without erasing current teaching or borrowing D5 aid provenance',()=>{
 for(const target of ['action:0:protagonist:D4:build_joint','event:action:0:protagonist:D4:build_joint','resolved:event:action:0:protagonist:D4:build_joint:training']){
  const s=southVisitDates().y31,[r]=[...s.history,...s.events].filter(r=>r.id===target);r.reality='R0';const v=getSceneVisit(s,'D5');assert.equal(v.art.file,'south-bank-learning-aid.svg');assert.deepEqual(v.sourceIds,[aidId,aidResult]);assert.match(v.summary.join(''),/来源经过未知/);assert.equal(v.art.history.recordId,null);
 }
});
test('new D5 visit suppresses unsafe shared-crisis links while preserving exact saved tally and original global helper',()=>{
 const natural=southVisitDates({aid:true}).y31,normal=getSceneVisit(natural,'D5'),early='action:10:protagonist:D5:mutual_aid';assert.equal(normal.art.history.recordId,'crisis-impact');
 const cases=[
  ...['crisis-impact','crisis-warning',early,`event:${early}`,`resolved:event:${early}`].map(id=>s=>{if(s.history.some(r=>r.id===id))s.events.push(collisionEvent(id));else s.history.push({...s.history.find(r=>r.id===early),id});}),
  ...['crisis-warning',early,`event:${early}`,`resolved:event:${early}`].map(id=>s=>[...s.history,...s.events].find(r=>r.id===id).reality='R0'),
  s=>s.history=s.history.filter(r=>r.id!=='crisis-warning'),
  s=>s.history.find(r=>r.id===early).status='pending',
  ...[early,`event:${early}`,`resolved:event:${early}`].map(id=>s=>[...s.history,...s.events].find(r=>r.id===id).actorId='wrong-actor'),
  s=>s.history.find(r=>r.id==='crisis-warning').status='pending',
  s=>s.history.find(r=>r.id==='crisis-warning').cellId='B4'
 ];
 for(const mutate of cases){const s=structuredClone(natural);mutate(s);assert.equal(validateState(s).valid,true);const before=JSON.stringify(s),oldArt=sceneArt(s,'D5'),v=getSceneVisit(s,'D5');assert.equal(v.art.file,oldArt.file);assert.equal(v.art.alt,oldArt.alt);assert.equal(v.art.caption,oldArt.caption);assert.equal(v.art.history.recordId,null);assert.equal(v.art.history.damage,normal.art.history.damage);assert.equal(v.art.history.coverage,normal.art.history.coverage);assert.match(v.art.history.detail.join(''),/暂不提供跳转/);assert.equal(JSON.stringify(s),before);assert.equal(sceneArt(s,'D5').history.recordId,'crisis-impact');}
});
test('unlinked imported carrier and missing source remain unknown, not falsely removed or repaired',()=>{
 const s=southVisitDates().y31;s.institutions.find(i=>i.cellId==='D5'&&i.kind==='mutual').sourceActionId='unknown';const v=getSceneVisit(s,'D5');assert.equal(v.art.file,'south-bank-learning-aid.svg');assert.match(v.summary.join(''),/互助仓运行中.*来源经过未知/);assert.ok(!v.sourceIds.includes(aidResult));
});
test('D5 visit remains deterministic, deeply immutable and never inspects RNG or pending probabilities',()=>{
 for(const state of Object.values(southVisitDates())){const s=freeze(structuredClone(state)),before=JSON.stringify(s);getSceneVisit(s,'D5');assert.equal(JSON.stringify(s),before);}
 const s=southVisitDates().pending,expected=getSceneVisit(s,'D5');Object.defineProperty(s,'seed',{get(){throw Error('seed');}});for(const e of s.events)for(const key of ['roll','probability'])Object.defineProperty(e,key,{get(){throw Error(key);}});assert.deepEqual(getSceneVisit(s,'D5'),expected);
});
test('31/40 safe refresh preserves D5 readonly visit; imports still return to world without changing state',()=>{
 const d=southVisitDates();for(const s of [d.y31,d.y40]){const ui={screen:'visit',selected:'D5'},before=JSON.stringify(s);assert.equal(normalizeUi(s,ui).screen,'visit');assert.equal(restoreSave({state:s,ui}).ui.screen,'visit');assert.equal(restoreSave({state:s,ui},{imported:true}).ui.screen,'world');assert.equal(JSON.stringify(s),before);}
});
