import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import {getDecadeReview} from '../src/decade-review.js';
import {futureCheckRecollection, sceneFor, evidenceFor} from '../src/story.js';
import {investigateAndLock as lock} from './helpers/play.js';
const freeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
function submit(s,tasks=[]) {for(const t of tasks)lock(s,...t);for(const a of sim.getActors(s))if(!s.drafts[a.id])sim.passTask(s,a.id);sim.commitWindow(s);}
function decade(s,tasks=[]) {submit(s,tasks);sim.advanceToNextWindow(s);}
function ready(upgrade,staff=true) {const s=sim.createRun(0);decade(s,upgrade?[['protagonist','B4','preserve_records']]:[]);decade(s,[['protagonist','D4','recruit_volunteer']]);decade(s,[['protagonist','B4','local_veto'],...(staff?[['linche','E4','train_network']]:[])]);return s;}
function pending(upgrade,staff=true) {const s=ready(upgrade,staff);submit(s,[['linche','B4',upgrade?'upgrade_archive_check':'establish_future_check']]);return s;}
function finish(s){sim.advanceToNextWindow(s);return s;}
for(const upgrade of [false,true]) {
 const label=upgrade?'archive upgrade':'future check';
 test(`${label}: waiting, success and cancellation are sourced and read-only`,()=>{
  for(const staff of [false,true]) {
   const s=pending(upgrade,staff),old=structuredClone(s.history.filter(h=>h.year<30)),crisis=structuredClone(s.flags.crisis);
   assert.equal(futureCheckRecollection(freeze(structuredClone(s))).status,'pending');
   assert.match(futureCheckRecollection(s).paragraphs.join(''),/仍待兑现/);
   finish(s);const before=structuredClone(s);freeze(s);
   const recall=futureCheckRecollection(s),card=getDecadeReview(s).cards.find(c=>c.actorId==='linche');
   assert.equal(recall.status,staff?'success':'cancelled');
   assert.match(card.outcome,staff?/第3[34]年.*校验/:/取消/);
   assert.match(recall.paragraphs.join(''),/第23年.*不附送/);
   for(const id of [...recall.sources,...card.sourceIds])assert.equal(s.history.filter(h=>h.id===id).length,1);
   assert.deepEqual(s,before);assert.deepEqual(s.flags.crisis,crisis);assert.deepEqual(s.history.filter(h=>h.year<30),old);
  }
 });
 test(`${label}: missing or tampered source remains unknown without repair`,()=>{
  const original=finish(pending(upgrade));
  const action=upgrade?'upgrade_archive_check':'establish_future_check';
  for(const mutate of [
   s=>{s.history=s.history.filter(h=>h.id!==`resolved:${s.events.find(e=>e.actionId===action).id}`);},
   s=>{s.history.find(h=>h.id===s.events.find(e=>e.actionId===action).sourceActionId).cost.science=0;},
   s=>{s.investigations['30:linche']=[];},
   s=>{const e=s.events.find(e=>e.actionId===action);e[upgrade?'archiveUpgradeWorkforceIds':'futureCheckWorkforceIds']=['imagined'];},
   ...(upgrade?[s=>{s.history=s.history.filter(h=>h.id!==s.events.find(e=>e.actionId===action).archiveSourceRecordId);}]:[]),
  ]) {
   const s=structuredClone(original);mutate(s);const before=structuredClone(s);freeze(s);
   assert.equal(futureCheckRecollection(s).status,'unknown');
   assert.match(getDecadeReview(s).cards.find(c=>c.actorId==='linche').outcome,/结果未知/);
   assert.match(sceneFor(s,'B4').body.join(''),/结果未知/);assert.deepEqual(s,before);
  }
 });
}
test('upgrade proposal distinguishes old archive from new check and states opportunity costs',()=>{
 const s=ready(true),before=structuredClone(s);freeze(s);
 const scene=sceneFor(s,'B4');assert.match(scene.body.join(''),/经济5、科学3.*2轮.*1轮/);
 assert.match(scene.body.join(''),/第33年.*取消.*不退/);assert.match(scene.body.join(''),/不增加交班地域/);
 assert.match(evidenceFor(s,'resident_testimony','B4').text,/不是交班授权/);
 assert.deepEqual(s,before);
});
test('archive closure and joint unavailability have distinct cancellation recollections',()=>{
 for(const staff of [true,false]) {
  const s=pending(true,staff),e=s.events.find(e=>e.actionId==='upgrade_archive_check');
  const original=s.institutions.find(i=>i.id===e.archiveSourceInstitutionId);
  original.active=false;original.maintenance=0;
  finish(s);const before=structuredClone(s);freeze(s);
  const recall=futureCheckRecollection(s),card=getDecadeReview(s).cards.find(c=>c.actorId==='linche');
  assert.equal(recall.status,'cancelled');assert.match(recall.paragraphs[0],/原保档未能继续运转/);
  assert.match(card.outcome,/原保档未能继续运转/);
  if(!staff)assert.match(card.outcome,/也没有实际测量或教学人手/);
  assert.deepEqual(s,before);
 }
});
