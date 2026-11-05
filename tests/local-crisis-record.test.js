import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getLocalCrisisRecord} from '../src/local-crisis-record.js';
import {sceneArt} from '../src/scene-art.js';
import {southBankVisual} from '../src/south-bank-visuals.js';
import {advanceYear,validateState} from '../src/simulation.js';
import {restoreSave} from '../src/save.js';
import {localAt20,localAt30,legacyLocalAt30,lock,submit,decade} from './helpers/local-crisis.js';
const copy=structuredClone;
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}

test('local tally never exposes a future settlement or a global status as an outcome',()=>{
 const s=localAt20();s.flags.crisis.status='averted';s.flags.crisis.damageByCell={D5:0};
 for(const year of [20,21,22]){s.year=year;const view=getLocalCrisisRecord(s,'D5');assert.equal(view.status,'pending');assert.equal(view.markerFile,null);assert.equal(view.recordId,null);assert.equal(view.damage,null);}
});
test('real year23 transition adds only a historical annotation, not invented physical damage',()=>{
 const s=localAt20(),physical=copy(southBankVisual(s)),art=sceneArt(s,'D5');submit(s);while(s.year<23)advanceYear(s);
 const view=getLocalCrisisRecord(s,'D5');assert.equal(view.status,'loss');assert.equal(view.recordId,'crisis-impact');assert.equal(view.damage,s.flags.crisis.damageByCell.D5);
 assert.deepEqual(southBankVisual(s),physical);assert.equal(sceneArt(s,'D5').file,art.file);assert.equal(sceneArt(s,'D5').alt,art.alt);assert.deepEqual(sceneArt(s,'D5').history,view);
 assert.match(view.detail.join(' '),/不是人口或伤亡统计.*不证明建筑毁损/);
});
test('same current D5 institutions distinguish a recorded loss from a recorded zero',()=>{
 const loss=localAt30(),zero=localAt30({zero:true});assert.deepEqual(loss.institutions.filter(i=>i.cellId==='D5'),zero.institutions.filter(i=>i.cellId==='D5'));
 assert.equal(getLocalCrisisRecord(loss,'D5').status,'loss');assert.equal(getLocalCrisisRecord(zero,'D5').status,'zero');assert.equal(getLocalCrisisRecord(zero,'D5').damage,0);
 assert.equal(sceneArt(loss,'D5').file,sceneArt(zero,'D5').file);assert.notEqual(sceneArt(loss,'D5').history.markerFile,sceneArt(zero,'D5').history.markerFile);
 assert.match(getLocalCrisisRecord(zero,'D5').summary,/不等于没有洪水/);
});
test('actual legacy impact can be linked but cannot provide invented local loss values',()=>{
 const s=legacyLocalAt30(),before=JSON.stringify(s),view=getLocalCrisisRecord(freeze(s),'D5');
 assert.equal(view.status,'unknown');assert.equal(view.recordId,'crisis-impact');assert.equal(view.damage,null);assert.equal(view.coverage,null);assert.equal(JSON.stringify(s),before);
 assert.match(view.summary,/原始清点仍在.*明细未知/);assert.match(view.detail.join(' '),/不从整体结果/);
});
for(const change of ['missing','duplicate','date','kind','parent','coordinate','status','reality','action-source'])test(`invalid ${change} impact cannot verify a local tally or source link`,()=>{
 const s=localAt30({zero:true}),record=s.history.find(h=>h.id==='crisis-impact');
 if(change==='missing')s.history=s.history.filter(h=>h!==record);if(change==='duplicate')s.history.push(copy(record));if(change==='date')record.year=22;if(change==='kind')record.kind='outcome';if(change==='parent')record.parentId='arrival';if(change==='coordinate')record.cellId='D5';if(change==='status')record.status='pending';if(change==='reality')record.reality='R0';if(change==='action-source')record.sourceActionId='action:20:protagonist:F6:independent_review';
 const view=getLocalCrisisRecord(s,'D5');assert.equal(view.status,'unknown');assert.equal(view.recordId,null);assert.equal(view.damage,null);
});
test('partial or invalid per-place values stay unknown without borrowing aggregate or other places',()=>{
 const original=localAt30();
 for(const value of [undefined,null,NaN,Infinity,-1,1.1,'0']){const s=copy(original);s.flags.crisis.damageByCell.D5=value;s.flags.crisis.damage=0;s.flags.crisis.status='averted';s.flags.crisis.damageByCell.F6=0;const v=getLocalCrisisRecord(s,'D5');assert.equal(v.status,'unknown');assert.equal(v.damage,null);assert.equal(v.recordId,'crisis-impact');}
 const partial=copy(original);delete partial.flags.crisis.coverageByCell.D5;const view=getLocalCrisisRecord(partial,'D5');assert.equal(view.status,'loss');assert.equal(view.coverage,null);assert.match(view.detail[0],/覆盖系数：未知/);
 partial.flags.crisis.affectedCells=partial.flags.crisis.affectedCells.filter(id=>id!=='D5');assert.equal(getLocalCrisisRecord(partial,'D5').status,'unknown');
});
test('all affected regions refer to the real shared impact but unrelated cells have no tally',()=>{
 const s=localAt30();for(const id of ['D4','E4','D5','F6']){const v=getLocalCrisisRecord(s,id);assert.equal(v.cellId,id);assert.equal(v.damage,s.flags.crisis.damageByCell[id]);assert.equal(v.recordId,'crisis-impact');}
 assert.equal(getLocalCrisisRecord(s,'B4'),null);assert.equal(sceneArt(s,'B4').history,undefined);assert.equal(sceneArt(s,'D5',{ending:true}).history,undefined);
});
test('stored precision is retained so a small positive loss is never printed as zero',()=>{
 const s=localAt30();s.flags.crisis.damageByCell.D5=.0001;s.flags.crisis.coverageByCell.D5=.7268;
 assert.equal(validateState(s).valid,true);const view=getLocalCrisisRecord(s,'D5');assert.equal(view.status,'loss');
 assert.match(view.detail[0],/损失系数：0\.0001；当年覆盖系数：0\.7268/);
 assert.equal(view.damage,.0001);assert.equal(view.coverage,.7268);
});
test('current closures, later aid and new flags do not rewrite the frozen local tally',()=>{
 const s=localAt30(),before=getLocalCrisisRecord(s,'D5'),crisis=copy(s.flags.crisis);
 for(const i of s.institutions.filter(i=>i.cellId==='D5'))i.active=false;
 assert.deepEqual(getLocalCrisisRecord(s,'D5'),before);assert.match(sceneArt(s,'D5').alt,/没有正在上课的人.*没有人在分发物资/);
 lock(s,'protagonist','D5','mutual_aid');decade(s);assert.deepEqual(s.flags.crisis,crisis);assert.deepEqual(getLocalCrisisRecord(s,'D5'),before);
 assert.equal(southBankVisual(s).aid.active,true);s.flags.review=true;s.flags.veto=true;assert.deepEqual(getLocalCrisisRecord(s,'D5'),before);
});
test('view, source access and save restoration are pure and do not inspect random values',()=>{
 const s=localAt30(),before=copy(s),view=getLocalCrisisRecord(s,'D5');assert.equal(validateState(s).valid,true);
 assert.deepEqual(getLocalCrisisRecord(restoreSave({state:copy(s)},{imported:true}).state,'D5'),view);
 Object.defineProperty(s,'seed',{get(){throw Error('future seed access');}});for(const e of s.events)for(const key of ['roll','probability'])Object.defineProperty(e,key,{get(){throw Error('random input');}});
 assert.deepEqual(getLocalCrisisRecord(s,'D5'),view);freeze(before);const frozenView=getLocalCrisisRecord(before,'D5');frozenView.detail.push('display-only');assert.deepEqual(getLocalCrisisRecord(before,'D5'),view);
});
test('three original archive markers use distinct non-color geometry and no invented damage diagram',()=>{
 for(const status of ['loss','zero','unknown']){
  const svg=fs.readFileSync(new URL(`../public/assets/crisis-tally-${status}.svg`,import.meta.url),'utf8');assert.match(svg,/viewBox="0 0 64 72"/);assert.match(svg,new RegExp(`data-tally-state="${status}"`));assert.match(svg,/id="archive-page"/);
  for(const other of ['loss','zero','unknown'])assert.equal(svg.includes(`id="${other==='unknown'?'unknown-detail':`recorded-${other}`}"`),status===other);
  assert.doesNotMatch(svg,/id="(?:ruins|injuries|people|flood-level|damaged-buildings)"/);
 }
});
