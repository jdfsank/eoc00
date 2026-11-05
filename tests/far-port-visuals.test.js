import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {farPortVisual,FAR_PORT_ASSETS,FAR_PORT_STAGES} from '../src/far-port-visuals.js';
import {institutionVisual,mapActivity} from '../src/board-visuals.js';
import {sceneArt} from '../src/scene-art.js';
import {advanceYear,advanceToNextWindow,validateState} from '../src/simulation.js';
import {portAt20,portAt30,portRecovery,lock,submit} from './helpers/far-port.js';

test('the first review does not pre-reveal failure or success while locked or pending',()=>{
 const s=portAt20(),before=sceneArt(s,'F6');lock(s,'protagonist','F6','independent_review');assert.deepEqual(sceneArt(s,'F6'),before);
 submit(s);assert.equal(farPortVisual(s).stage,'none');assert.equal(mapActivity(s,'F6')[0].kind,'pending');advanceYear(s);assert.deepEqual(sceneArt(s,'F6'),before);
 advanceYear(s);assert.equal(farPortVisual(s).stage,'failed');
});
test('actual branch+failed review keeps both the station and the unverified record',()=>{
 const before=portAt20(),after=portAt30();assert.equal(after.events.find(e=>e.actionId==='independent_review').status,'failed');
 assert.equal(farPortVisual(before).stage,'none');const visual=farPortVisual(after);assert.equal(visual.stage,'failed');assert.equal(visual.branch.active,true);assert.equal(visual.check.exists,false);
 assert.equal(sceneArt(after,'F6').file,'far-port-branch-failed.svg');assert.match(institutionVisual(after,'F6').label,/分站运行中.*第22年复核失败/);
});
test('locking never installs a check; submitted work is unfilled pending paperwork only',()=>{
 const s=portAt30(),before=sceneArt(s,'F6');lock(s,'protagonist','F6','complete_review');assert.deepEqual(sceneArt(s,'F6'),before);assert.equal(mapActivity(s,'F6')[0].kind,'draft');
 portRecovery(s);assert.equal(farPortVisual(s).stage,'pending');assert.equal(farPortVisual(s).check.exists,false);assert.match(farPortVisual(s).alt,/没有新增校验组/);advanceYear(s);assert.equal(farPortVisual(s).stage,'pending');
});
test('year32 real completion adds checking without erasing failure or the frozen crisis',()=>{
 const s=portRecovery(),old=structuredClone({crisis:s.flags.crisis,failed:s.events.find(e=>e.actionId==='independent_review')});advanceYear(s);advanceYear(s);
 assert.equal(validateState(s).valid,true);let v=farPortVisual(s);assert.equal(v.stage,'recovered');assert.equal(v.branch.active,true);assert.equal(v.failed.exists,true);assert.equal(v.check.active,true);assert.equal(v.check.year,32);
 assert.match(v.label,/第22年复核失败记录保留.*第32年兑现，只面向今后/);assert.deepEqual({crisis:s.flags.crisis,failed:s.events.find(e=>e.actionId==='independent_review')},old);
 advanceToNextWindow(s);assert.equal(farPortVisual(s).stage,'recovered');assert.deepEqual({crisis:s.flags.crisis,failed:s.events.find(e=>e.actionId==='independent_review')},old);
});
test('cancelled no-workforce recovery retains only failure records and no fictional branch',()=>{
 const s=portRecovery(portAt30(1,false));advanceYear(s);advanceYear(s);
 assert.equal(s.events.find(e=>e.actionId==='complete_review').status,'cancelled');assert.equal(farPortVisual(s).branch.exists,false);assert.equal(farPortVisual(s).check.exists,false);assert.equal(farPortVisual(s).prop,'far_port_shore_failed');
});
test('success before the crisis and a later recovery are distinct histories',()=>{
 let s;for(let seed=0;seed<6;seed++){const candidate=portAt30(seed);if(candidate.events.find(e=>e.actionId==='independent_review').status==='success'){s=candidate;break;}}
 assert.ok(s);const v=farPortVisual(s);assert.equal(v.stage,'verified');assert.equal(v.failed.exists,false);assert.equal(v.check.late,false);assert.equal(v.check.year,22);
});
test('branch and check closure are independent after the real completed route',()=>{
 const s=portRecovery();advanceToNextWindow(s);const v=farPortVisual(s);assert.equal(v.stage,'recovered');
 s.institutions.filter(i=>i.kind==='branch').forEach(i=>i.active=false);assert.equal(validateState(s).valid,true);assert.equal(farPortVisual(s).prop,'far_port_branch_closed_recovered');assert.equal(farPortVisual(s).check.active,true);
 s.institutions.filter(i=>i.sourceActionId.endsWith(':complete_review')).forEach(i=>i.maintenance=0);assert.equal(farPortVisual(s).stage,'closed');assert.match(farPortVisual(s).label,/后续校验组已停运/);
});
test('missing or cross-place outcome evidence never upgrades the display',()=>{
 const s=portRecovery();advanceToNextWindow(s);const before=structuredClone(s);farPortVisual(s);assert.deepEqual(s,before);
 const result=s.history.find(h=>h.id.startsWith('resolved:')&&h.sourceActionId?.endsWith(':complete_review'));result.cellId='B4';assert.equal(farPortVisual(s).stage,'failed');
 s.flags.review=true;assert.equal(farPortVisual(s).stage,'failed');
});
test('view reads no random inputs or unpublished result fields',()=>{
 const s=portRecovery(),before=farPortVisual(s);Object.defineProperty(s,'seed',{get(){throw Error('seed');}});for(const e of s.events)for(const key of ['roll','probability'])Object.defineProperty(e,key,{get(){throw Error(key);}});assert.deepEqual(farPortVisual(s),before);
});
test('all source/raster combinations keep projection and explicit stage geometry',()=>{
 assert.equal(FAR_PORT_ASSETS.length,34);
 for(const name of FAR_PORT_ASSETS){const svg=fs.readFileSync(new URL(`../public/assets/${name.replaceAll('_','-')}.svg`,import.meta.url),'utf8'),prop=fs.readFileSync(new URL(`../public/assets/props/${name}.svg`,import.meta.url),'utf8'),png=fs.readFileSync(new URL(`../public/assets/props/${name}.png`,import.meta.url));
  assert.match(svg,/viewBox="0 0 1000 500"/);assert.match(prop,/Ground anchor 32,64/);assert.equal(png.readUInt32BE(16),128);assert.equal(png.readUInt32BE(20),160);assert.equal(png[25],6);
  if(name.includes('_shore_'))assert.doesNotMatch(svg,/id="branch-house"/);if(name.endsWith('_pending')){assert.match(svg,/id="pending-order"/);assert.doesNotMatch(svg,/id="paired-ledgers"|id="check-worker"/);}if(name.endsWith('_recovered')){assert.match(svg,/id="failed-folio"/);assert.match(svg,/id="paired-ledgers"/);}
 }
});
test('every place and review stage has independent physical geometry, including ambiguous closed names',()=>{
 // Build the expected matrix directly, never using the asset generator parser.
 const expected=[];
 for(const place of ['shore','branch','branch_closed'])for(const access of place==='shore'?[null]:['public','fee'])for(const stage of FAR_PORT_STAGES){
  if(place==='shore'&&stage==='none')continue;
  const name=`far_port_${place}${access==='fee'?'_fee':''}_${stage}`;expected.push(name);
  const checked=['verified','recovered'].includes(stage),table=checked||stage==='closed';
  for(const type of ['scene','prop']){
   const file=type==='scene'?`../public/assets/${name.replaceAll('_','-')}.svg`:`../public/assets/props/${name}.svg`;
   const svg=fs.readFileSync(new URL(file,import.meta.url),'utf8');
   assert.equal(svg.match(/data-branch="([^"]*)"/)?.[1],place,`${name} ${type} branch`);
   assert.equal(svg.match(/data-review="([^"]*)"/)?.[1],stage,`${name} ${type} review`);
   assert.equal(svg.match(/data-access="([^"]*)"/)?.[1],access||'none',`${name} ${type} access`);
   const geometry=(id,present)=>assert.equal(svg.includes(`id="${id}"`),present,`${name} ${type} ${id}`);
   geometry('branch-house',place!=='shore');
   geometry('branch-open',place==='branch');
   geometry('branch-shutter',place==='branch_closed');
   geometry('branch-access',place!=='shore');
   geometry('fee-notice',access==='fee');geometry('public-notice',access==='public');
   geometry('access-barrier',place==='branch'&&access==='fee');
   geometry('access-raised',place==='branch'&&access==='public');
   geometry('access-shut',place==='branch_closed');geometry('access-notice-tied',place==='branch_closed');
   geometry('check-table',table);
   geometry('check-closure',stage==='closed');
   geometry('paired-ledgers',checked);
   geometry('pending-order',stage==='pending');
   geometry('failed-folio',['failed','failed_closed','pending'].includes(stage)||(type==='scene'&&stage==='recovered'));
   if(type==='scene'){geometry('record-platform',stage!=='none');geometry('check-worker',checked);}
   else geometry('retained-failed-folio',stage==='recovered');
  }
 }
 assert.deepEqual([...FAR_PORT_ASSETS].sort(),expected.sort());
});
