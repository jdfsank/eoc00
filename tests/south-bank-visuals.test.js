import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {southBankVisual,SOUTH_BANK_ASSETS} from '../src/south-bank-visuals.js';
import {sceneArt} from '../src/scene-art.js';
import {institutionVisual} from '../src/board-visuals.js';
import {createRun,passTask,commitWindow,advanceYear,advanceToNextWindow} from '../src/simulation.js';
import {investigateAndLock} from './helpers/play.js';
const next=s=>{if(!s.drafts.protagonist)passTask(s,'protagonist');commitWindow(s);advanceToNextWindow(s);return s;};
function started(teaching=false){const s=createRun(0);if(teaching)investigateAndLock(s,'protagonist','D4','build_joint');next(s);investigateAndLock(s,'protagonist','D5','mutual_aid');return s;}
const provider=(kind,active=true,maintenance=1)=>({id:kind,kind,cellId:'D5',active,maintenance,startYear:7});
const state=institutions=>({institutions,flags:{},events:[]});

test('a real locked and submitted aid plan cannot draw a warehouse before year11',()=>{
 const s=started();assert.equal(sceneArt(s,'D5').file,'open-shore.svg');assert.equal(institutionVisual(s,'D5'),null);commitWindow(s);
 assert.equal(sceneArt(s,'D5').file,'open-shore.svg');advanceYear(s);assert.equal(sceneArt(s,'D5').file,'south-bank-aid.svg');assert.equal(institutionVisual(s,'D5').prop,'south_bank_aid');
 advanceToNextWindow(s);assert.equal(s.year,20);assert.equal(sceneArt(s,'D5').file,'south-bank-aid.svg');
});
test('teaching and aid coexist only after the separate real outcomes',()=>{
 const s=started(true);assert.equal(sceneArt(s,'D5').file,'bank-reading.svg');next(s);
 const before=structuredClone(s),visual=institutionVisual(s,'D5');assert.equal(visual.prop,'south_bank_learning_aid');assert.match(visual.label,/读尺班运行中.*互助仓运行中/);assert.equal(sceneArt(s,'D5').file,'south-bank-learning-aid.svg');assert.deepEqual(s,before);
});
test('all six aid/teaching opening combinations choose distinct faithful assets',()=>{
 const seen=new Set();for(const teaching of [null,true,false])for(const aid of [true,false]){
  const s=state([provider('mutual',aid),...(teaching===null?[]:[provider('training',teaching)])]);const visual=southBankVisual(s),art=sceneArt(s,'D5');
  seen.add(visual.prop);assert.equal(art.captionBelow,true);assert.ok(SOUTH_BANK_ASSETS.includes(visual.prop));assert.equal(art.file,visual.file);assert.equal(institutionVisual(s,'D5').prop,visual.prop);
  if(teaching===false)assert.match(art.alt,/没有正在上课的人/);if(!aid)assert.match(art.alt,/曾经建成.*木条封起.*没有人在分发物资/);
  if(teaching===true)assert.match(art.alt,/没有屋顶与围墙/);
 }assert.equal(seen.size,6);
});
test('zero maintenance stops only that service; restarting keeps the other site history',()=>{
 const s=state([provider('training'),provider('mutual',true,0)]);
 assert.equal(southBankVisual(s).prop,'south_bank_learning_aid_closed');assert.equal(institutionVisual(s,'D5').halted,false);
 s.institutions[0].active=false;assert.equal(southBankVisual(s).prop,'south_bank_learning_closed_aid_closed');assert.equal(institutionVisual(s,'D5').halted,true);
 s.institutions.push({...provider('mutual'),id:'restart',startYear:31});assert.equal(southBankVisual(s).prop,'south_bank_learning_closed_aid');assert.match(institutionVisual(s,'D5').label,/读尺班停运.*互助仓运行中/);
});
test('partial upkeep and multiple shifts remain separate from closure and protection counts',()=>{
 const s=state([provider('training'),provider('mutual',true,.7)]);let visual=institutionVisual(s,'D5');assert.equal(visual.compound.teaching.maintenanceGap,false);assert.equal(visual.compound.aid.maintenanceGap,true);assert.match(visual.label,/互助仓运行中，维护不足/);
 const file=sceneArt(s,'D5').file;s.institutions.push({...provider('mutual'),id:'extra-shift',startYear:31});assert.equal(sceneArt(s,'D5').file,file);assert.equal(institutionVisual(s,'D5').prop,visual.prop);
});
test('new assets preserve projection, transparency and independent activity silhouettes',()=>{
 for(const name of SOUTH_BANK_ASSETS){
  const scene=fs.readFileSync(new URL(`../public/assets/${name.replaceAll('_','-')}.svg`,import.meta.url),'utf8');
  const svg=fs.readFileSync(new URL(`../public/assets/props/${name}.svg`,import.meta.url),'utf8');
  const png=fs.readFileSync(new URL(`../public/assets/props/${name}.png`,import.meta.url));
  assert.match(scene,/viewBox="0 0 1000 500"/);assert.match(scene,/id="mutual-shed"/);assert.doesNotMatch(scene,/id="open-shade"/);
  assert.match(svg,/viewBox="0 0 64 80"/);assert.match(svg,/Ground anchor 32,64/);assert.equal(png.readUInt32BE(16),128);assert.equal(png.readUInt32BE(20),160);assert.equal(png[25],6);
  assert.equal(scene.includes('id="aid-workers"'),!name.endsWith('aid_closed'));assert.equal(scene.includes('id="aid-shutter"'),name.endsWith('aid_closed'));
  assert.equal(scene.includes('id="reading-circle"'),name.includes('learning'));assert.equal(scene.includes('id="learners"'),name.includes('learning')&&!name.includes('learning_closed'));
 }
});
