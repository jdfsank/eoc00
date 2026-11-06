import {getReviewHistory} from '../src/review-history.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {monasteryVisual,MONASTERY_ASSETS,MONASTERY_ARCHIVES,MONASTERY_REVIEWS} from '../src/monastery-visuals.js';import {sceneArt} from '../src/scene-art.js';import {institutionVisual} from '../src/board-visuals.js';import {getSceneVisit} from '../src/scene-visit.js';import {createRun,advanceYear,advanceToNextWindow,validateState} from '../src/simulation.js';import {normalizeUi,restoreSave} from '../src/save.js';import {monasteryAt20,monasteryAt30,monasteryRecovery,lock,submit,next} from './helpers/monastery.js';
function freeze(o){if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(freeze);}return o;}
const preserved=s=>s.institutions.filter(i=>i.cellId==='B4'&&i.sourceActionId.endsWith(':preserve_records'));
const review=s=>s.institutions.filter(i=>i.cellId==='B4'&&i.sourceActionId.endsWith(':independent_review'));

test('original B4 library is retained before any new institution and in both screen types',()=>{
 const s=createRun(0),v=monasteryVisual(s);assert.equal(s.cells.find(c=>c.id==='B4').prop,'temple');assert.equal(v.archiveState,'none');assert.equal(v.stage,'none');assert.equal(v.prop,'monastery_none_none');assert.equal(institutionVisual(s,'B4').prop,v.prop);assert.equal(sceneArt(s,'B4').file,'monastery-none-none.svg');assert.match(v.label,/原址保留/);assert.deepEqual(v.sourceIds,[]);
});
test('draft or pending preservation never appears as a completed cabinet; actual year1 does',()=>{
 const s=createRun(0),before=monasteryVisual(s);lock(s,'protagonist','B4','preserve_records');assert.deepEqual(monasteryVisual(s),before);submit(s);assert.equal(monasteryVisual(s).archiveState,'none');assert.match(monasteryVisual(s).label,/待第1年兑现/);assert.equal(monasteryVisual(s).sourceIds.length,1);
 advanceYear(s);const v=monasteryVisual(s);assert.equal(v.archiveState,'kept');assert.equal(v.stage,'none');assert.match(v.label,/保档不等于本次复核成功/);assert.equal(s.flags.review,undefined);
});
test('two actual preservation projects remain source-distinct without erasing the landmark',()=>{
 const s=monasteryAt20(0,{secondPreserve:true}),v=monasteryVisual(s);assert.deepEqual(v.archive.years,[1,11]);assert.equal(v.sourceIds.length,4);assert.equal(v.prop,'monastery_kept_none');assert.match(v.label,/第1、11年/);assert.equal(validateState(s).valid,true);
});
test('preserved records and an actual failed review coexist instead of a false successful check',()=>{
 const s=monasteryAt30(2),v=monasteryVisual(s);assert.equal(v.archiveState,'kept');assert.equal(v.stage,'failed');assert.equal(v.archive.active,true);assert.equal(v.failed.active,true);assert.equal(v.review.exists,false);assert.match(v.label,/保档不等于本次复核成功.*第22年复核失败/);assert.equal(v.sourceIds.length,4);
});
test('initial review stays pending until its real outcome, independently of preserved records',()=>{
 const s=monasteryAt20(2),before=monasteryVisual(s);lock(s,'protagonist','B4','independent_review');assert.deepEqual(monasteryVisual(s),before);submit(s);assert.equal(monasteryVisual(s).stage,'pending');advanceYear(s);assert.equal(monasteryVisual(s).stage,'pending');advanceYear(s);assert.equal(monasteryVisual(s).stage,'failed');
});
test('actual first successful review is distinct from preservation and from later recovery',()=>{
 const s=monasteryAt30(0),v=monasteryVisual(s);assert.equal(v.archiveState,'kept');assert.equal(v.stage,'verified');assert.equal(v.failed.exists,false);assert.equal(v.review.year,22);assert.equal(v.review.late,false);assert.equal(v.review.active,true);
});
test('actual recovery at32 retains failure and the unchanged crisis through40',()=>{
 const s=monasteryAt30(2),past=structuredClone({failure:s.events.find(e=>e.actionId==='independent_review'),crisis:s.flags.crisis});const before=monasteryVisual(s);lock(s,'protagonist','B4','complete_review');assert.deepEqual(monasteryVisual(s),before);submit(s);assert.equal(monasteryVisual(s).stage,'renewing');advanceYear(s);assert.equal(monasteryVisual(s).stage,'renewing');advanceYear(s);let v=monasteryVisual(s);assert.equal(v.stage,'recovered');assert.equal(v.failed.exists,true);assert.equal(v.archiveState,'kept');assert.equal(v.review.year,32);assert.match(v.label,/第22年复核失败.*第32年兑现，只面向今后/);advanceToNextWindow(s);assert.equal(monasteryVisual(s).stage,'recovered');assert.deepEqual({failure:s.events.find(e=>e.actionId==='independent_review'),crisis:s.flags.crisis},past);
});
test('cancelled recovery without real workforce adds no table or success',()=>{
 const s=monasteryRecovery(monasteryAt30(2,{train:false}));advanceToNextWindow(s);assert.equal(s.events.find(e=>e.actionId==='complete_review').status,'cancelled');assert.equal(monasteryVisual(s).stage,'failed');assert.equal(monasteryVisual(s).review.exists,false);
});
test('archive cabinet, failed records and successful check each close independently',()=>{
 const s=monasteryRecovery();advanceToNextWindow(s);preserved(s).forEach(i=>i.active=false);let v=monasteryVisual(s);assert.equal(v.archiveState,'closed');assert.equal(v.stage,'recovered');assert.equal(v.review.active,true);assert.equal(institutionVisual(s,'B4').halted,false);
 s.institutions.filter(i=>i.sourceActionId.endsWith(':complete_review')).forEach(i=>i.maintenance=0);v=monasteryVisual(s);assert.equal(v.stage,'closed_recovered');assert.equal(v.failed.exists,true);assert.equal(v.failed.active,true);assert.match(v.alt,/整座藏书院/);
 const f=monasteryAt30(2);review(f).forEach(i=>i.active=false);assert.equal(monasteryVisual(f).stage,'failed_closed');assert.equal(monasteryVisual(f).archiveState,'kept');
});
test('missing, forged, future or cross-region sources do not supply successful B4 institutions',()=>{
 const original=monasteryAt30(0),own=original.institutions.find(i=>i.sourceActionId.endsWith(':independent_review'));
 const corruptions=[s=>s.history.splice(s.history.findIndex(h=>h.id===`resolved:${own.sourceEventId}`),1),s=>s.history.find(h=>h.id===`resolved:${own.sourceEventId}`).cellId='F6',s=>s.events.find(e=>e.id===own.sourceEventId).year=39,s=>s.institutions.find(i=>i.id===own.id).id='fake',s=>s.events.push({...s.events.find(e=>e.id===own.sourceEventId)}),s=>s.events.push({id:own.sourceActionId,cellId:'F6',year:39})];
 for(const mutate of corruptions){const s=structuredClone(original);mutate(s);s.flags.review=true;const v=monasteryVisual(s);assert.equal(v.review.exists,false);assert.equal(v.stage,'none');assert.equal(v.archiveState,'kept');assert.ok(!v.sourceIds.includes(`resolved:${own.sourceEventId}`));}
});
test('cross-table duplicate source IDs are withheld, not rewritten or followed to another place',()=>{
 const s=monasteryAt30(2),id=s.history.find(h=>h.kind==='failure'&&h.cellId==='B4').id,history=JSON.stringify(s.history);s.events.push({id,year:39,cellId:'F6',actionId:'training',kind:'event',title:'OTHER FUTURE',text:'DO NOT FOLLOW',parentId:null,sourceActionId:null,probability:1,status:'pending'});assert.equal(validateState(s).valid,true);assert.ok(!getSceneVisit(s,'B4').sourceIds.includes(id));assert.equal(JSON.stringify(s.history),history);
});
test('view is pure, accepts old actual sources, and never reads seed or pending random results',async()=>{
 const s=monasteryRecovery(),before=monasteryVisual(s),saved=JSON.stringify(s);monasteryVisual(freeze(structuredClone(s)));assert.equal(JSON.stringify(s),saved);Object.defineProperty(s,'seed',{get(){throw Error('seed');}});for(const e of s.events)for(const key of ['roll','probability'])Object.defineProperty(e,key,{get(){throw Error(key);}});assert.deepEqual(monasteryVisual(s),before);
 const old=await import('./fixtures/legacy-simulation.js'),legacy=old.createRun(0);old.lockTask(legacy,'protagonist','B4','preserve_records',[]);old.commitWindow(legacy);old.advanceToNextWindow(legacy);assert.equal(monasteryVisual(legacy).archiveState,'kept');
});
test('B4 readonly visit is real and safely refreshable at1/22/32/40, without broadening other regions',()=>{
 const s=createRun(0);lock(s,'protagonist','B4','preserve_records');submit(s);advanceYear(s);const y22=monasteryAt20(2);lock(y22,'protagonist','B4','independent_review');submit(y22);advanceYear(y22);advanceYear(y22);const y32=monasteryRecovery();advanceYear(y32);advanceYear(y32);const y40=structuredClone(y32);advanceToNextWindow(y40);
 for(const state of [s,y22,y32,y40]){const before=JSON.stringify(state),v=getSceneVisit(state,'B4');assert.equal(v.available,true);assert.deepEqual(v.art,sceneArt(state,'B4'));assert.equal(normalizeUi(state,{screen:'visit',selected:'B4'}).screen,'visit');assert.equal(restoreSave({state,ui:{screen:'visit',selected:'B4'}},{imported:true}).ui.screen,'world');assert.equal(JSON.stringify(state),before);}assert.equal(getSceneVisit(s,'A1'),null);
});
test('all27 original scene/prop pairs preserve landmark and independent non-color state geometry',()=>{
 const expected=[];for(const archive of ['none','kept','closed'])for(const review of ['none','pending','failed','failed_closed','renewing','verified','recovered','closed','closed_recovered']){
  const name=`monastery_${archive}_${review}`;expected.push(name);const failed=['failed','failed_closed','renewing','recovered','closed_recovered'].includes(review),table=['verified','recovered','closed','closed_recovered'].includes(review);
  for(const prop of [false,true]){const path=prop?`props/${name}.svg`:`${name.replaceAll('_','-')}.svg`,svg=fs.readFileSync(new URL(`../public/assets/${path}`,import.meta.url),'utf8');assert.match(svg,prop?/viewBox="0 0 64 80"/:/viewBox="0 0 1000 500"/);assert.equal(svg.match(/data-archive="([^"]+)"/)?.[1],archive);assert.equal(svg.match(/data-review="([^"]+)"/)?.[1],review);const shape=(id,yes)=>assert.equal(svg.includes(`id="${id}"`),yes,`${name}/${prop}: ${id}`);shape('library-landmark',true);shape('preserved-cabinet',archive!=='none');shape('preserved-closed',archive==='closed');shape('pending-order',['pending','renewing'].includes(review));shape('failed-folio',failed);shape('failed-storage-closed',review==='failed_closed');shape('review-table',table);shape('paired-ledgers',['verified','recovered'].includes(review));shape('review-closure',['closed','closed_recovered'].includes(review));}
  const png=fs.readFileSync(new URL(`../public/assets/props/${name}.png`,import.meta.url));assert.equal(png.readUInt32BE(16),128);assert.equal(png.readUInt32BE(20),160);assert.equal(png[25],6);
 }assert.equal(MONASTERY_ASSETS.length,27);assert.deepEqual(MONASTERY_ASSETS,expected);assert.deepEqual(MONASTERY_ARCHIVES,['none','kept','closed']);assert.equal(MONASTERY_REVIEWS.length,9);
});

test('B4 actual current-world source namespace and confirmed action status match historical review facts',()=>{
 const original=monasteryAt30(0),id=original.events.find(e=>e.actionId==='independent_review').id;
 for(const row of ['action','event','outcome'])for(const reality of ['R0','P1']){
  const s=structuredClone(original),r=row==='event'?s.events.find(e=>e.id===id):s.history.find(h=>h.id===(row==='action'?id.slice(6):`resolved:${id}`));r.reality=reality;assert.equal(validateState(s).valid,true);const saved=JSON.stringify(s),v=monasteryVisual(s);assert.equal(v.review.exists,false);assert.equal(v.stage,'none');assert.equal(v.archiveState,'kept');assert.ok(!v.sourceIds.includes(`resolved:${id}`));assert.equal(JSON.stringify(s),saved);
 }
 const unconfirmed=structuredClone(original);unconfirmed.history.find(h=>h.id===id.slice(6)).status='failed';assert.equal(monasteryVisual(unconfirmed).review.exists,false);
 for(const action of ['preserve_records','independent_review']){const s=action==='preserve_records'?createRun(2):monasteryAt20(2);lock(s,'protagonist','B4',action);submit(s);const e=s.events.find(e=>e.status==='pending'&&e.actionId===action);e.reality='R0';const v=monasteryVisual(s);assert.equal(v.pending,null);assert.ok(!v.sourceIds.includes(e.sourceActionId));assert.equal(v.stage,'none');}
});

test('monastery review art agrees with shared verified responses on malformed sources and missing crisis',()=>{
 const original=monasteryAt30(0),id=original.events.find(e=>e.actionId==='independent_review').id;
 const mutations=[s=>s.history.find(h=>h.id===id.slice(6)).evidence=[],s=>s.events.find(e=>e.id===id).evidence=[],s=>s.events.find(e=>e.id===id).actorId='unknown',s=>s.history.find(h=>h.id===`resolved:${id}`).actionId='training',s=>s.history.push({...s.history.find(h=>h.id===id.slice(6)),id:'action:20:protagonist:F6:independent_review',cellId:'F6'}),s=>s.history.push({id:'pass:20:protagonist',kind:'action'})];
 for(const mutate of mutations){const s=structuredClone(original);mutate(s);const v=monasteryVisual(s),history=getReviewHistory(s,null,'B4');assert.equal(history.responses.some(r=>r.eventId===id),false);assert.equal(v.review.exists,false);assert.equal(v.archiveState,'kept');assert.ok(!v.sourceIds.includes(`resolved:${id}`));}
 const missing=structuredClone(original);missing.history=missing.history.filter(h=>h.id!=='crisis-impact');delete missing.flags.crisis;assert.equal(getReviewHistory(missing,null,'B4').status,'unknown');assert.equal(monasteryVisual(missing).stage,'verified');
});
