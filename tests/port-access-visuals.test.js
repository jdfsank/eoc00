import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {advanceYear,advanceToNextWindow,getWarningCoverage,validateState} from '../src/simulation.js';
import {farPortVisual,FAR_PORT_STAGES} from '../src/far-port-visuals.js';
import {institutionVisual} from '../src/board-visuals.js';
import {sceneArt} from '../src/scene-art.js';
import {getSceneVisit} from '../src/scene-visit.js';
import {portRecovery} from './helpers/far-port.js';
import {paidPortAt30,portOpening,lock,submit} from './helpers/port-access-visuals.js';
const branch=s=>s.institutions.find(i=>i.kind==='branch'&&i.cellId==='F6');
const freeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};

for(const [stage,seed,review] of [['verified',1,true],['failed',2,true],['none',1,false]])test(`real fee→public access coexists with ${stage} review history`,()=>{
 const s=paidPortAt30(seed,{review}),v=farPortVisual(s),past=structuredClone({crisis:s.flags.crisis,review:s.institutions.filter(i=>i.kind==='independent')});
 assert.equal(v.stage,stage);assert.equal(v.branch.access,'fee');assert.equal(v.file,`far-port-branch-fee-${stage}.svg`);assert.equal(getWarningCoverage(s).F6.coverage,.45);
 lock(s,'protagonist','F6','open_port_warning');assert.deepEqual(farPortVisual(s),v);submit(s);assert.equal(farPortVisual(s).file,v.file);
 advanceYear(s);assert.equal(branch(s).open,true);assert.equal(getWarningCoverage(s).F6.coverage,1);assert.equal(farPortVisual(s).file,`far-port-branch-${stage}.svg`);assert.match(farPortVisual(s).label,/公开预警入口/);assert.match(sceneArt(s,'F6').alt,/横杆竖起/);
 assert.deepEqual({crisis:s.flags.crisis,review:s.institutions.filter(i=>i.kind==='independent')},past);assert.equal(validateState(s).valid,true);
 const event=s.events.find(e=>e.actionId==='open_port_warning');assert.ok(getSceneVisit(s,'F6').sourceIds.includes(`resolved:${event.id}`));
});
test('actual paid and public routes both preserve pending versus realised checking independently',()=>{
 const fee=paidPortAt30(2);lock(fee,'protagonist','F6','complete_review');submit(fee);const publicRun=portRecovery();
 for(const [s,feePart] of [[fee,'fee-'],[publicRun,'']]){
  assert.equal(farPortVisual(s).file,`far-port-branch-${feePart}pending.svg`);advanceYear(s);
  assert.equal(farPortVisual(s).file,`far-port-branch-${feePart}pending.svg`);assert.equal(farPortVisual(s).check.exists,false);assert.match(farPortVisual(s).alt,/没有新增校验组/);
  advanceYear(s);assert.equal(farPortVisual(s).file,`far-port-branch-${feePart}recovered.svg`);assert.equal(farPortVisual(s).failed.exists,true);assert.equal(farPortVisual(s).check.active,true);
  advanceToNextWindow(s);assert.equal(farPortVisual(s).file,`far-port-branch-${feePart}recovered.svg`);
 }
});
test('successful later checking alone never removes the actual fee gate',()=>{
 const s=paidPortAt30(2);lock(s,'protagonist','F6','complete_review');submit(s);advanceYear(s);advanceYear(s);
 assert.equal(farPortVisual(s).file,'far-port-branch-fee-recovered.svg');assert.equal(branch(s).open,false);assert.equal(getWarningCoverage(s).F6.coverage,.45);
});
for(const open of [false,true])test(`branch shutdown keeps ${open?'public':'fee'} history without claiming current access`,()=>{
 const s=paidPortAt30();if(open){portOpening(s);advanceYear(s);}branch(s).active=false;
 const v=farPortVisual(s);assert.equal(v.branch.active,false);assert.equal(v.branch.access,open?'public':'fee');assert.match(v.label,/旧.*规约保留（当前不提供服务）/);assert.match(v.alt,/入口仍封住/);
 assert.equal(v.file,`far-port-branch-closed-${open?'':'fee-'}verified.svg`);assert.equal(v.check.active,true);
 branch(s).active=true;assert.equal(farPortVisual(s).file,`far-port-branch-${open?'':'fee-'}verified.svg`);
});
test('cancelled opening never raises the old gate or revives a stopped branch',()=>{
 const s=portOpening();branch(s).active=false;advanceYear(s);assert.equal(s.events.find(e=>e.actionId==='open_port_warning').status,'cancelled');
 assert.equal(farPortVisual(s).file,'far-port-branch-closed-fee-verified.svg');assert.equal(branch(s).open,false);
});
test('opening retains maintenance and does not reopen a separately closed checking table',()=>{
 const s=paidPortAt30();branch(s).maintenance=.4;s.institutions.filter(i=>i.kind==='independent').forEach(i=>i.maintenance=0);const before=farPortVisual(s);
 assert.equal(before.file,'far-port-branch-fee-closed.svg');portOpening(s);advanceYear(s);const v=farPortVisual(s);
 assert.equal(v.file,'far-port-branch-closed.svg');assert.equal(v.branch.maintenanceGap,true);assert.equal(v.check.active,false);assert.equal(branch(s).maintenance,.4);assert.equal(getWarningCoverage(s).F6.coverage,.4);assert.match(v.label,/维护不足.*公开预警入口.*校验组已停运/);
});
test('access is drawn from the actual local institution, never a promise, global flag, seed or roll',()=>{
 const s=portOpening(),before=farPortVisual(s);s.flags.freeWarning=true;s.flags.review=true;
 assert.deepEqual(farPortVisual(s),before);const frozen=freeze(structuredClone(s));assert.deepEqual(farPortVisual(frozen),before);
 Object.defineProperty(s,'seed',{get(){throw Error('seed');}});for(const e of s.events)for(const key of ['roll','probability'])Object.defineProperty(e,key,{get(){throw Error(key);}});assert.deepEqual(farPortVisual(s),before);
 assert.equal(institutionVisual(s,'F6').prop,before.prop);
});
test('each fee/public pair changes only the independent access layer, never checking geometry',()=>{
 for(const place of ['branch','branch_closed'])for(const stage of FAR_PORT_STAGES)for(const prop of [false,true]){
  const prefix=prop?'props/':'',ext=prop?'svg':'svg',names=[`far_port_${place}_fee_${stage}`,`far_port_${place}_${stage}`];
  const pair=names.map(name=>fs.readFileSync(new URL(`../public/assets/${prefix}${prop?name:name.replaceAll('_','-')}.${ext}`,import.meta.url),'utf8'));
  const ids=svg=>[...svg.matchAll(/id="([^"]+)"/g)].map(m=>m[1]).filter(id=>!['fee-notice','public-notice','access-barrier','access-raised'].includes(id));
  assert.deepEqual(ids(pair[0]),ids(pair[1]),`${place} ${stage}: same physical review records`);assert.notEqual(pair[0],pair[1]);
  const png=names.map(name=>fs.readFileSync(new URL(`../public/assets/props/${name}.png`,import.meta.url)));assert.notDeepEqual(png[0],png[1]);
 }
});
