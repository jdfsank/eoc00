import test from 'node:test';
import assert from 'node:assert/strict';
import {monasteryVisual} from '../src/monastery-visuals.js';
import {getSceneVisit} from '../src/scene-visit.js';
import {institutionVisual} from '../src/board-visuals.js';
import {getFutureCheckContracts,validateState} from '../src/simulation.js';
import {futureVisualDates} from './helpers/future-check-visuals.js';

test('future B4 lock remains unchanged and pending work order contains no imaginary old failure or future table',()=>{
 const d=futureVisualDates();assert.deepEqual(monasteryVisual(d.locked),monasteryVisual(d.before));
 for(const s of [d.pending,d.y33]){const v=monasteryVisual(s);assert.equal(validateState(s).valid,true);assert.equal(v.stage,'pending');assert.equal(v.failed.exists,false);assert.equal(v.review.exists,false);assert.match(v.label,/从零新建.*第34年/);assert.match(v.alt,/尚无新对照台或成功标记/);assert.ok(!v.sourceIds.some(id=>id.startsWith('resolved:')&&id.endsWith(':establish_future_check')));}
});
test('actual future34 and40 have the current table and exact new-contract source, never recovered failure geometry',()=>{
 const d=futureVisualDates();for(const s of [d.y34,d.y40]){const v=monasteryVisual(s),contract=getFutureCheckContracts(s)[0],before=JSON.stringify(s);assert.equal(validateState(s).valid,true);assert.equal(v.stage,'verified');assert.equal(v.review.future,true);assert.equal(v.review.late,false);assert.equal(v.failed.exists,false);assert.match(v.label,/未来校验席运行中（第34年兑现/);assert.match(v.alt,/没有凭空添加旧失败底稿/);assert.equal(v.prop,'monastery_none_verified');assert.ok(v.sourceIds.includes(contract.sourceActionId));assert.ok(v.sourceIds.includes(contract.recordId));assert.equal(institutionVisual(s,'B4').recordsOnly,false);assert.equal(getSceneVisit(s,'B4').art.file,'monastery-none-verified.svg');assert.equal(JSON.stringify(s),before);assert.deepEqual(s.flags.crisis,d.before.flags.crisis);}
});
test('cancelled prospective check has no completed table, and a later real shutdown preserves its history',()=>{
 const cancelled=futureVisualDates({staff:false}).y34,v=monasteryVisual(cancelled);assert.equal(v.stage,'none');assert.equal(v.review.exists,false);assert.match(v.label,/第34年未来校验合同取消/);assert.ok(v.sourceIds.includes(getFutureCheckContracts(cancelled)[0].recordId));
 const s=futureVisualDates().y40,c=getFutureCheckContracts(s)[0];s.institutions.find(i=>i.id===c.institutionId).active=false;const closed=monasteryVisual(s);assert.equal(closed.stage,'closed');assert.equal(closed.review.future,true);assert.match(closed.label,/未来校验席已停运/);assert.match(closed.alt,/已经封起/);assert.ok(closed.sourceIds.includes(c.recordId));
});
test('new future source uses strict mechanism proof and also rejects cross-table ambiguous destinations',()=>{
 const s=futureVisualDates().y40,c=getFutureCheckContracts(s)[0];s.events.push({id:c.recordId,year:40,cellId:'D5',kind:'event',actionId:'training',status:'pending',probability:1,parentId:null,sourceActionId:null});
 const v=monasteryVisual(s);assert.equal(v.review.exists,false);assert.equal(v.stage,'none');assert.ok(!v.sourceIds.includes(c.recordId));assert.match(v.label,/来源不完整/);
});

test('actual old failed folio survives a separate from-zero future check without being invented as its source',async()=>{
 const {monasteryAt30,lock,submit}=await import('./helpers/monastery.js');const {advanceYear}=await import('../src/simulation.js');
 const s=monasteryAt30(2,{preserve:false});const old=s.institutions.find(i=>i.cellId==='B4'&&i.sourceActionId.endsWith(':independent_review'));assert.ok(old);old.active=false;
 lock(s,'protagonist','B4','establish_future_check');submit(s);let v=monasteryVisual(s);assert.equal(v.stage,'renewing');assert.equal(v.failed.exists,true);assert.match(v.alt,/既有失败底稿单独保留，不是这份新建合同的来源/);
 while(s.year<34)advanceYear(s);v=monasteryVisual(s);assert.equal(validateState(s).valid,true);assert.equal(v.stage,'recovered');assert.equal(v.review.future,true);assert.equal(v.review.late,false);assert.match(v.alt,/旧失败底稿另行保留/);assert.match(v.label,/第22年复核失败底稿保留.*未来校验席运行中（第34年兑现/);
});
