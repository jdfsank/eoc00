import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRun,getActors,passTask,commitWindow,advanceToNextWindow,advanceYear,validateState} from '../src/simulation.js';
import {sceneArt} from '../src/scene-art.js';
import {eastBankVisitArt,eastBankAuthorizationArt} from '../src/east-bank-visit-art.js';
import {investigateAndLock} from './helpers/play.js';
const carrier=(kind,status='active')=>({id:kind,kind,cellId:'E4',startYear:kind==='training'?7:11,active:status!=='stopped',maintenance:status==='unknown'?null:1});
const state=(...institutions)=>({year:30,institutions});
const submit=s=>{for(const a of getActors(s))if(!s.drafts[a.id])passTask(s,a.id);commitWindow(s);return s;};
function at30(){const s=createRun(0);investigateAndLock(s,'protagonist','D4','build_joint');submit(s);advanceToNextWindow(s);submit(s);advanceToNextWindow(s);submit(s);advanceToNextWindow(s);return s;}
function pending(){const s=at30();investigateAndLock(s,'protagonist','E4','authorize_training');return submit(s);}
const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;};

test('east-bank return image distinguishes both carrier types and all nine known/unknown combinations',()=>{
 for(const a of ['active','stopped','unknown'])for(const b of ['active','stopped','unknown']){
  const s=state(carrier('training',a),carrier('school',b)),before=JSON.stringify(s),art=eastBankVisitArt(s);
  assert.equal(art.file,`east-bank-teaching-${a}-${b}.svg`);assert.equal(art.composite,true);assert.match(art.alt,/不是精确地理布局/);assert.match(art.caption,/同一时点/);assert.ok(fs.existsSync(`public/assets/${art.file}`));assert.equal(JSON.stringify(s),before);
 }
});
test('unbuilt and future carriers never produce pupils; unknown is not closure',()=>{
 assert.equal(eastBankVisitArt(state()).file,'open-shore.svg');assert.equal(eastBankVisitArt({year:6,institutions:[carrier('training')]}).file,'open-shore.svg');
 for(const patch of [{startYear:null},{active:null},{maintenance:undefined},{maintenance:2},{maintenance:-1}]){
  const art=eastBankVisitArt(state({...carrier('training'),...patch}));assert.equal(art.file,'east-bank-teaching-unknown.svg');assert.match(art.alt,/不将未知画成停办/);assert.match(art.caption,/未核实/);
 }
 const mixed=eastBankVisitArt(state(carrier('training','stopped'),{...carrier('school'),startYear:31}));assert.equal(mixed.file,'closed-classroom.svg');assert.doesNotMatch(mixed.caption,/学校/);
});
test('actual same-kind survivors keep the group active without asserting a carrier count',()=>{
 const s=state(carrier('training','stopped'),{...carrier('training'),id:'training-two'},carrier('school','stopped'));
 assert.equal(eastBankVisitArt(s).file,'east-bank-teaching-active-stopped.svg');assert.match(eastBankVisitArt(s).alt,/不表示机构或人数统计/);
});
test('legacy AVG artwork remains compatible while visits use a truthful two-carrier scene',()=>{
 const s=state(carrier('training'),carrier('school','stopped'));
 assert.equal(sceneArt(s,'E4').file,'local-classroom.svg');assert.equal(sceneArt(s,'E4',{visit:true}).file,'east-bank-teaching-active-stopped.svg');assert.equal(sceneArt(s,'E4',{ending:true,visit:true}).file,'archive-desk.svg');
});
test('no contract or locked draft creates a document; submission and verified fulfilment have different objects',()=>{
 const s=at30();assert.equal(validateState(s).valid,true);assert.equal(eastBankAuthorizationArt(s),null);const before=sceneArt(s,'E4',{visit:true});investigateAndLock(s,'protagonist','E4','authorize_training');assert.deepEqual(sceneArt(s,'E4',{visit:true}),before);
 submit(s);assert.equal(eastBankAuthorizationArt(s).status,'pending');assert.match(eastBankAuthorizationArt(s).alt,/尚未签署.*没有授权印记/);assert.equal(sceneArt(s,'E4').detail.status,'pending');advanceYear(s);assert.equal(validateState(s).valid,true);assert.equal(eastBankAuthorizationArt(s).status,'authorized');assert.match(eastBankAuthorizationArt(s).alt,/已归档/);
 const granted=JSON.stringify(s.institutions);sceneArt(s,'E4',{visit:true});assert.equal(JSON.stringify(s.institutions),granted);
});
test('cancelled and unknown provenance cannot borrow the fulfilled document',()=>{
 const cancelled=pending();cancelled.institutions.find(i=>i.kind==='training'&&i.cellId==='E4').active=false;advanceYear(cancelled);assert.equal(eastBankAuthorizationArt(cancelled).status,'cancelled');assert.match(eastBankAuthorizationArt(cancelled).alt,/没有新增|保留取消/);assert.equal(sceneArt(cancelled,'E4',{visit:true}).file,'closed-classroom.svg');
 const s=pending();advanceYear(s);s.history=s.history.filter(h=>!h.id.endsWith(':authorize_training'));assert.equal(eastBankAuthorizationArt(s).status,'unknown');assert.match(eastBankAuthorizationArt(s).alt,/桌为空.*没有签署文书/);
 const flags=at30();flags.flags.localHandoffAuthorization=true;assert.equal(eastBankAuthorizationArt(flags),null);
});
test('a retained authorization record is not a claim that the original training still operates at40',()=>{
 const s=pending();advanceToNextWindow(s);s.institutions.find(i=>i.kind==='training'&&i.cellId==='E4').active=false;
 const art=sceneArt(s,'E4',{visit:true});assert.equal(art.file,'closed-classroom.svg');assert.equal(art.detail.status,'authorized');assert.match(art.detail.caption,/记录保留/);assert.match(art.detail.alt,/当前是否运转由现场另行说明/);
});
test('art reads are immutable and never inspect RNG, rolls, pending prose or probabilities',()=>{
 for(const s of [at30(),pending()]){
  const expected=sceneArt(s,'E4',{visit:true}),frozen=freeze(structuredClone(s)),before=JSON.stringify(frozen);assert.deepEqual(sceneArt(frozen,'E4',{visit:true}),expected);assert.equal(JSON.stringify(frozen),before);
  Object.defineProperty(s,'seed',{get(){throw Error('seed read');}});for(const e of s.events)for(const key of ['roll','probability'])Object.defineProperty(e,key,{get(){throw Error(`${key} read`);}});assert.deepEqual(sceneArt(s,'E4',{visit:true}),expected);
 }
});
test('all mandate images are local vector drawings with distinct non-color marks',()=>{
 for(const status of ['pending','authorized','cancelled','unknown']){const svg=fs.readFileSync(`public/assets/east-bank-mandate-${status}.svg`,'utf8');assert.match(svg,/viewBox="0 0 1000 390"/);assert.doesNotMatch(svg,/<image|<script|<foreignObject|https?:\/\/(?!www.w3.org)/);}
 const unknown=fs.readFileSync('public/assets/east-bank-teaching-unknown.svg','utf8');assert.doesNotMatch(unknown,/id="learners"|649 330l160/);
});
