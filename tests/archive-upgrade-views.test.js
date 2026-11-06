import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import {investigateAndLock as lock} from './helpers/play.js';
import {monasteryVisual,MONASTERY_ASSETS} from '../src/monastery-visuals.js';
import {getReviewHistory} from '../src/review-history.js';
import {getSceneVisit} from '../src/scene-visit.js';
function submit(s,tasks=[]){for(const t of tasks)lock(s,...t);for(const a of sim.getActors(s))if(!s.drafts[a.id])sim.passTask(s,a.id);sim.commitWindow(s);}
function decade(s,tasks=[]){submit(s,tasks);sim.advanceToNextWindow(s);}
function pending(staff=true){const s=sim.createRun(0);decade(s,[['protagonist','B4','preserve_records']]);decade(s,[['protagonist','D4','recruit_volunteer']]);decade(s,staff?[['linche','E4','train_network']]:[]);submit(s,[['linche','B4','upgrade_archive_check']]);return s;}
function freeze(o){if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(freeze);}return o;}
function inspect(s,status,stage){const before=structuredClone(s);freeze(s);const v=monasteryVisual(s),e=s.events.find(e=>e.actionId==='upgrade_archive_check');assert.equal(v.stage,stage);assert.ok(MONASTERY_ASSETS.includes(v.prop));assert.equal(v.failed.exists,false);assert.match(v.label,/保档/);const h=getReviewHistory(s,`resolved:${e.id}`);assert.equal(h.responses.find(r=>r.actionId==='upgrade_archive_check').status,status);assert.match(h.responses.find(r=>r.actionId==='upgrade_archive_check').note,/第23年原始清点不改写/);const visit=getSceneVisit(s,'B4');assert.match(visit.summary.join(''),/保档/);for(const id of [...v.sourceIds,...h.sourceIds,...visit.sourceIds])assert.equal(s.history.filter(r=>r.id===id).length,1);assert.deepEqual(s,before);}
test('archive upgrade uses existing pending and verified assets, not failed-review recovery',()=>{
 const s=pending();const v=monasteryVisual(s);assert.equal(v.stage,'pending');assert.match(v.alt,/保档升级待第33年/);assert.doesNotMatch(v.alt,/原失败底稿/);assert.equal(getReviewHistory(s).responses.at(-1).status,'pending');
 sim.advanceToNextWindow(s);inspect(s,'success','verified');assert.match(monasteryVisual(s).alt,/第33年真实完成的保档升级/);assert.equal(monasteryVisual(s).archiveState,'kept');
});
test('cancelled conversion remains visible with original archive, no new check asset',()=>{
 const s=pending(false);sim.advanceToNextWindow(s);inspect(s,'cancelled','none');assert.match(monasteryVisual(s).label,/第33年保档升级取消/);assert.equal(monasteryVisual(s).archiveState,'kept');
});
test('closed conversion keeps historical success without an active-work claim',()=>{
 const s=pending();sim.advanceToNextWindow(s);s.institutions.find(i=>i.sourceActionId.endsWith(':upgrade_archive_check')).active=false;
 inspect(s,'success','closed');assert.match(monasteryVisual(s).alt,/已经封起/);
});
test('tampered original cannot supply visual/history upgrade credit or mutate records',()=>{
 const s=pending();sim.advanceToNextWindow(s);const e=s.events.find(e=>e.actionId==='upgrade_archive_check');s.history=s.history.filter(h=>h.id!==e.archiveSourceRecordId);const before=structuredClone(s);freeze(s);
 assert.equal(monasteryVisual(s).review.upgrade,false);assert.match(monasteryVisual(s).label,/结果未知/);assert.equal(getReviewHistory(s).responses.some(r=>r.actionId==='upgrade_archive_check'),false);assert.match(getReviewHistory(s).detail.join(''),/经过未知/);assert.match(getSceneVisit(s,'B4').summary.join(''),/结果未知/);assert.deepEqual(s,before);
});
