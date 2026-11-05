import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sceneArt} from '../src/scene-art.js';
import {institutionVisual,mapActivity} from '../src/board-visuals.js';
import {advanceYear,advanceToNextWindow,validateState} from '../src/simulation.js';
import {restoreSave} from '../src/save.js';
import {warningAt20,warningPending,warningAt30,lock} from './helpers/river-warning.js';
const copy=structuredClone;

test('real resident warning appears at fulfilment, never from a flag, lock or pending plan',()=>{
 const s=warningAt20(),before=sceneArt(s,'D4');assert.equal(before.file,'archive-desk.svg');
 s.flags.freeWarning=true;assert.deepEqual(sceneArt(s,'D4'),before);delete s.flags.freeWarning;
 lock(s,'protagonist','D4','free_warning');assert.deepEqual(sceneArt(s,'D4'),before);assert.equal(mapActivity(s,'D4')[0].kind,'draft');
 warningPending(s);assert.deepEqual(sceneArt(s,'D4'),before);assert.equal(mapActivity(s,'D4')[0].kind,'pending');
 advanceYear(s);assert.equal(s.year,21);assert.equal(sceneArt(s,'D4').file,'river-warning-active.svg');assert.ok(s.institutions.some(i=>i.kind==='warning'));
 assert.equal(s.institutions.some(i=>i.kind==='station'),false);assert.equal(validateState(s).valid,true);
});
test('resident bell preserves a stopped archive without reopening or replacing its old job',()=>{
 const s=warningAt20('archive'),archive=s.institutions.find(i=>i.kind==='archive'),original=copy(archive),shutdown=copy(s.history.find(h=>h.id==='archive-unattended'));
 assert.equal(archive.active,false);warningPending(s);advanceToNextWindow(s);
 assert.equal(sceneArt(s,'D4').file,'river-warning-active.svg');assert.deepEqual(archive,original);assert.deepEqual(s.history.find(h=>h.id==='archive-unattended'),shutdown);
 assert.match(sceneArt(s,'D4').alt,/不表示原档案岗位恢复/);assert.match(institutionVisual(s,'D4').label,/居民钟报运行中/);
});
test('warning visual follows actual local service rather than global freeWarning',()=>{
 const s=warningAt30();s.flags.freeWarning=false;assert.equal(sceneArt(s,'D4').file,'river-warning-active.svg');
 s.institutions.find(i=>i.kind==='warning').cellId='B4';assert.equal(sceneArt(s,'D4').file,'archive-desk.svg');
 s.institutions.find(i=>i.kind==='warning').cellId='D4';s.institutions.find(i=>i.kind==='warning').startYear=31;assert.equal(sceneArt(s,'D4').file,'archive-desk.svg');
});
test('warning upkeep and closure retain the archive and bell, then restoration removes obsolete closure',()=>{
 const s=warningAt30(),team=s.institutions.find(i=>i.kind==='warning');
 team.maintenance=.5;assert.equal(validateState(s).valid,true);assert.equal(sceneArt(s,'D4').file,'river-warning-maintenance.svg');assert.match(sceneArt(s,'D4').alt,/仍在敲钟.*维护不足/);
 for(const zero of [false,true]){team.active=!zero;team.maintenance=zero?1:0;assert.equal(sceneArt(s,'D4').file,'river-warning-stopped.svg');assert.match(sceneArt(s,'D4').alt,/没有正在传讯的人/);}
 team.active=true;team.maintenance=1;assert.equal(sceneArt(s,'D4').file,'river-warning-active.svg');
});
test('new active team is not hidden by old closed team, regardless of institution ordering',()=>{
 const s=warningAt30(),old=copy(s.institutions.find(i=>i.kind==='warning'));old.active=false;old.startYear=20;
 s.institutions.push(old);assert.equal(sceneArt(s,'D4').file,'river-warning-active.svg');s.institutions.reverse();assert.equal(sceneArt(s,'D4').file,'river-warning-active.svg');
});
test('real station history takes priority over resident bell art in every station state',()=>{
 const s=warningAt30('station'),station=s.institutions.find(i=>i.kind==='station');assert.equal(s.institutions.some(i=>i.kind==='warning'),false);assert.equal(sceneArt(s,'D4').file,'river-station-public-active.svg');
 s.institutions.push(copy(warningAt30().institutions.find(i=>i.kind==='warning')));
 station.maintenance=.7;assert.equal(sceneArt(s,'D4').file,'river-station-public-maintenance.svg');station.active=false;assert.equal(sceneArt(s,'D4').file,'river-station-public-stopped.svg');
 assert.equal(sceneArt(s,'D4',{ending:true}).file,'archive-desk.svg');
});
test('save import, repeated viewing and unrelated scene selection do not alter warning history',()=>{
 for(const kind of ['unbuilt','archive','station']){
  const s=warningAt30(kind),before=copy(s),restored=restoreSave({state:copy(s)},{imported:true});
  assert.deepEqual(sceneArt(restored.state,'D4'),sceneArt(s,'D4'));sceneArt(s,'B4');sceneArt(s,'F6');sceneArt(s,'D4');assert.deepEqual(s,before);assert.deepEqual(restored.state,before);
 }
});
test('warning artwork retains objects and distinguishes operation without relying on color',()=>{
 for(const condition of ['active','maintenance','stopped']){
  const svg=fs.readFileSync(new URL(`../public/assets/river-warning-${condition}.svg`,import.meta.url),'utf8');
  assert.match(svg,/viewBox="0 0 1000 500"/);assert.match(svg,new RegExp(`data-warning-state="${condition}"`));
  for(const id of ['retained-archive','retained-records','river-doorway','resident-bell-frame','bell','resident-duty-board'])assert.ok(svg.includes(`id="${id}"`),`${condition} ${id}`);
  for(const [id,present] of [['resident-relay',condition!=='stopped'],['working-bell-rope',condition!=='stopped'],['current-duty-sheets',condition!=='stopped'],['tied-bell-rope',condition==='stopped'],['closed-duty-board',condition==='stopped'],['upkeep-brace',condition==='maintenance']])assert.equal(svg.includes(`id="${id}"`),present,`${condition} ${id}`);
  assert.doesNotMatch(svg,/id="(?:station|water-gauge|check-table|paired-ledgers)"/);
 }
});
