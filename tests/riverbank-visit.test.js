import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as original from './fixtures/legacy-simulation.js';
import * as preTradeoffs from './fixtures/pre-tradeoffs-simulation.js';
import * as preHandoff from './fixtures/pre-handoff-simulation.js';
import * as preRecruitment from './fixtures/pre-recruitment-simulation.js';
import * as preStaffing from './fixtures/pre-staffing-simulation.js';
import * as preRecovery from './fixtures/pre-recovery-simulation.js';
import * as prePort from './fixtures/pre-port-access-simulation.js';
import {getSceneVisit} from '../src/scene-visit.js';
import {sceneArt} from '../src/scene-art.js';
import {restoreSave} from '../src/save.js';

function lock(s,cell,id,actor='protagonist',api=sim){
 const a=api.getActions(s,cell,actor).find(a=>a.id===id);assert.ok(a,`${id} at ${s.year}`);
 if(api.investigate)for(const e of a.requireEvidence)if(!api.getInvestigation(s,actor,cell).evidence.includes(e))api.investigate(s,actor,cell,e);
 api.lockTask(s,actor,cell,id,a.requireEvidence);
}
function submit(s,api=sim){for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);return s;}
function next(s,api=sim){submit(s,api);api.advanceToNextWindow(s);return s;}
function at20({api=sim,build='build_joint',recruit='recruit_successor',seed=0}={}){
 const s=api.createRun(seed);if(build)lock(s,'D4',build,'protagonist',api);next(s,api);
 if(recruit)lock(s,'D4',recruit,'protagonist',api);next(s,api);return s;
}
function relocated(api=sim){const s=at20({api});lock(s,'D4','relocate_teacher','protagonist',api);lock(s,'E4','train_network','linche',api);submit(s,api);api.advanceYear(s);return s;}
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const text=v=>[...v.summary,...v.cards.flatMap(c=>c.paragraphs)].join('\n');
const body=(s,c)=>text(getSceneVisit(s,c));
function safeSources(s,v){
 assert.equal(v.sourceIds.length,new Set(v.sourceIds).size);
 for(const id of v.sourceIds){
  assert.equal(s.history.filter(r=>r.id===id).length,1,id);assert.equal(s.events.filter(r=>r.id===id).length,0,id);
  const chain=sim.traceEvent(s,id);assert.ok(chain.length,id);
  for(const r of chain){assert.ok(r.year<=s.year,`${id} -> ${r.id}`);assert.notEqual(r.reality,'R0');assert.notEqual(r.status,'pending');}
 }
}
test('D4 and E4 have separate free return views even before any construction',()=>{
 const s=sim.createRun(0),before=structuredClone(s);
 for(const cell of ['D4','E4']){
  const v=getSceneVisit(s,cell);assert.equal(v.available,true);assert.equal(v.year,0);assert.match(v.notice,/不取证.*不锁定.*不推进/);
  assert.equal(v.cards.length,0);assert.equal(v.sourceIds.length,0);assert.doesNotMatch(text(v),/苏岚.*同意|第21年|第23年.*损失/);
  assert.equal(v.art.file,sceneArt(s,cell,{visit:true}).file);assert.equal(v.art.history?.status,'pending');
 }
 assert.deepEqual(s,before);
});
test('locked build and paid pending build remain different from a completed station',()=>{
 const s=sim.createRun(0),before=getSceneVisit(s,'D4');lock(s,'D4','build_joint');assert.deepEqual(getSceneVisit(s,'D4'),before);
 submit(s);const paid=getSceneVisit(s,'D4');assert.match(text(paid),/第0年已提交并记录了成本.*第3年兑现/);
 assert.ok(paid.cards.some(c=>c.status==='pending'));assert.doesNotMatch(text(paid),/河港测站启用/);
 assert.equal(paid.art.file,'archive-desk.svg');assert.deepEqual(paid.sourceIds,['action:0:protagonist:D4:build_joint']);
 sim.advanceYear(s);sim.advanceYear(s);sim.advanceYear(s);const done=getSceneVisit(s,'D4');
 assert.match(text(done),/第3年.*测站启用/);assert.ok(!done.cards.some(c=>c.status==='pending'));safeSources(s,done);
});
test('the actual two-sided relocation is readable at21,31,40 without reopening an intervention',()=>{
 const s=relocated();
 for(const target of [21,31,40]){
  if(target===31){sim.advanceToNextWindow(s);lock(s,'D4','central_review');lock(s,'E4','train_network','linche');submit(s);sim.advanceYear(s);}
  if(target===40)sim.advanceToNextWindow(s);
  assert.equal(s.year,target);assert.equal(sim.validateState(s).valid,true);
  const before=structuredClone(s),d4=getSceneVisit(s,'D4'),e4=getSceneVisit(s,'E4');
  assert.deepEqual(sim.getActions(s,'D4','protagonist'),[]);assert.deepEqual(sim.getActions(s,'E4','protagonist'),[]);
  assert.match(text(d4),/当前均已停运/);assert.match(text(d4),/第21年迁任兑现/);assert.match(text(d4),/不是苏岚个人能力/);
  assert.match(text(e4),/原始建站仍归D4，培训结果仍归E4/);assert.match(text(e4),/第21年D4迁任/);
  assert.match(text(e4),/其他教学载体.*各自的来处/);assert.match(text(e4),/不能替她补上同意、留守或原谅/);
  for(const v of [d4,e4]){safeSources(s,v);assert.doesNotMatch(text(v),/现在仍能独立复核|你的介入名额有限|给学校一次机会/);}
  assert.deepEqual(s,before);
  if(target===31)assert.match(text(d4),/第31年.*集中协调.*已签署/);
 }
});
test('a paid pending relocation does not move Sulan or open an E4 school ahead of21',()=>{
 const s=at20(),before=getSceneVisit(s,'E4');lock(s,'D4','relocate_teacher');assert.deepEqual(getSceneVisit(s,'E4'),before);
 submit(s);const v=getSceneVisit(s,'E4');assert.match(text(v),/迁任行动记在D4.*第21年兑现/);
 assert.match(text(v),/现在没有由它产生的新学校/);assert.equal(v.cards.some(c=>c.id==='relocation'),false);
 assert.ok(v.sourceIds.includes('action:20:protagonist:D4:relocate_teacher'));
 assert.ok(!v.sourceIds.some(id=>id==='resolved:event:action:20:protagonist:D4:relocate_teacher'));
});
test('actual free warning recovery keeps the16 closure and never turns an archive into a station',()=>{
 const s=at20({recruit:'recruit_risk'});assert.match(body(s,'D4'),/第16年已记录河港测站.*停运/);
 lock(s,'D4','free_warning');submit(s);sim.advanceYear(s);
 assert.match(body(s,'D4'),/河港测站：1处运行中/);assert.match(body(s,'D4'),/基本预警现在公开准入/);
 assert.match(body(s,'D4'),/第16年已记录.*停运/);assert.match(body(s,'D4'),/第21年的基本预警合同已有兑现/);
 let failed;
 for(let seed=0;seed<30&&!failed;seed++){const r=sim.createRun(seed);lock(r,'D4','build_joint');next(r);if(r.events[0].status==='failed')failed=r;}
 assert.ok(failed);lock(failed,'D4','recruit_risk');next(failed);lock(failed,'D4','free_warning');submit(failed);sim.advanceYear(failed);
 const v=getSceneVisit(failed,'D4');assert.match(text(v),/档案站：当前均已停运/);assert.match(text(v),/居民传讯队：1处运行中/);
 assert.match(text(v),/建站未成，留下小型档案站/);assert.match(text(v),/不恢复原档案岗位/);assert.doesNotMatch(text(v),/河港测站启用/);
 safeSources(failed,v);
});
test('night school and late maintenance teaching remain anonymous and have their own dates',()=>{
 const s=sim.createRun(0);next(s);lock(s,'E4','fund_school');next(s);lock(s,'E4','train_network');next(s);lock(s,'E4','train_network');submit(s);sim.advanceYear(s);
 const v=getSceneVisit(s,'E4');assert.match(text(v),/第11年.*夜校/);assert.match(text(v),/第21年.*轮值/);assert.match(text(v),/第31年.*轮值/);
 assert.doesNotMatch(text(v),/苏岚|林澈|迁任|第7年/);assert.equal(v.cards.filter(c=>c.id.startsWith('carrier:')).length,3);safeSources(s,v);
});
test('a closed migrated school does not erase a separate live training group or invent personal presence',()=>{
 const s=relocated();s.institutions.find(i=>i.sourceActionId.endsWith(':relocate_teacher')).active=false;
 const v=getSceneVisit(s,'E4');assert.match(text(v),/学徒培训点：1处运行中/);assert.match(text(v),/这所学校目前已经停运/);
 assert.match(text(v),/东岸还有其他教学载体在运转/);assert.doesNotMatch(text(v),/苏岚仍在授课|苏岚已经原谅/);
});
const changes={
 'missing-action':(s,a,e,r)=>s.history=s.history.filter(h=>h!==a),
 'missing-result':(s,a,e,r)=>s.history=s.history.filter(h=>h!==r),
 'duplicate-action':(s,a)=>s.history.push(structuredClone(a)),
 'duplicate-event':(s,a,e)=>s.events.push(structuredClone(e)),
 'duplicate-result':(s,a,e,r)=>s.history.push(structuredClone(r)),
 'wrong-result-year':(s,a,e,r)=>r.year=22,
 'wrong-result-region':(s,a,e,r)=>r.cellId='E4',
 'wrong-result-parent':(s,a,e,r)=>r.parentId='crisis-warning',
 'R0-result':(s,a,e,r)=>r.reality='R0',
 'wrong-cost':(s,a)=>a.cost.politics=0,
 'wrong-actor':(s,a)=>a.actorId='linche',
 'action-and-pass':s=>s.history.push({id:'pass:20:protagonist',year:20,cellId:'D4',kind:'pass',status:'confirmed',sourceActionId:null,parentId:null,reality:'R1'}),
 'cross-table-collision':(s,a,e,r)=>s.events.push({id:r.id,kind:'event',year:39,cellId:'F6',status:'pending',title:'DO NOT EXPOSE FUTURE',parentId:null,sourceActionId:null}),
};
for(const [name,change] of Object.entries(changes))test(`relocation ${name} stays unknown without false provenance or mutation`,()=>{
 const s=relocated(),e=s.events.find(e=>e.actionId==='relocate_teacher'),a=s.history.find(r=>r.id===e.sourceActionId),r=s.history.find(r=>r.id===`resolved:${e.id}`);change(s,a,e,r);
 const before=structuredClone(s);
 for(const c of ['D4','E4']){
  const v=getSceneVisit(s,c);assert.match(text(v),/缺失|不一致|未知/);assert.doesNotMatch(text(v),/第21年迁任兑现|来自第21年D4迁任|主角执行的河港迁任/);
  assert.ok(!v.sourceIds.includes(r.id));assert.doesNotMatch(text(v),/DO NOT EXPOSE/);safeSources(s,v);
 }
 assert.deepEqual(s,before);
});
for(const field of ['sourceActionId','sourceEventId','startYear','kind','cellId'])test(`changed E4 carrier ${field} cannot borrow the relocation identity`,()=>{
 const s=relocated(),school=s.institutions.find(i=>i.sourceActionId.endsWith(':relocate_teacher'));
 school[field]=field==='startYear'?20:field==='kind'?'training':field==='cellId'?'D5':'wrong';
 const v=getSceneVisit(s,'E4');assert.doesNotMatch(text(v),/主角执行的河港迁任在东岸留下了这所学校/);
 assert.match(text(v),/缺失|不一致|未知/);
});
test('malformed current activity is unknown, and future institutions do not appear today',()=>{
 const s=relocated(),school=s.institutions.find(i=>i.sourceActionId.endsWith(':relocate_teacher'));school.active=undefined;
 assert.match(body(s,'E4'),/当前运转情况未知/);assert.doesNotMatch(body(s,'E4'),/这所学校目前已经停运/);
 school.startYear=35;const v=getSceneVisit(s,'E4');assert.ok(!v.cards.some(c=>c.id===`carrier:${school.id}`));
});
test('missing or contradictory training ancestry preserves current classroom without fictional origin',()=>{
 const s=relocated(),e=s.events.find(e=>e.actionId==='training');e.requiresInstitution='wrong';
 const v=getSceneVisit(s,'E4');assert.match(text(v),/学徒培训点：1处运行中/);assert.doesNotMatch(text(v),/第7年，D4原建站链的培训抵达/);
 const card=v.cards.find(c=>c.id.includes(':training:E4'));assert.equal(card.status,'unknown');assert.deepEqual(card.sourceIds,[]);
});
test('a contradictory original carrier or unpaid original build cannot establish training or fee provenance',()=>{
 for(const breakOrigin of ['R0-carrier','zero-cost']){
  const s=at20(),station=s.institutions.find(i=>i.kind==='station');
  if(breakOrigin==='R0-carrier')station.reality='R0';else s.history.find(r=>r.id===station.sourceActionId).cost.economy=0;
  const e4=getSceneVisit(s,'E4'),card=e4.cards.find(c=>c.id.includes(':training:E4'));
  assert.equal(card.status,'unknown');assert.deepEqual(card.sourceIds,[]);assert.doesNotMatch(text(e4),/第7年，D4原建站链的培训抵达/);
  if(breakOrigin==='zero-cost'){const fee=getSceneVisit(s,'D4').cards.find(c=>c.id==='maintenance-history');assert.equal(fee.status,'unknown');assert.deepEqual(fee.sourceIds,[]);assert.doesNotMatch(body(s,'D4'),/原本公开服务/);}
 }
});
test('historical23 stays separate and never derives losses from current repaired service',()=>{
 const s=at20();lock(s,'D4','free_warning');next(s);const before=structuredClone(s.flags.crisis),v=getSceneVisit(s,'D4');
 assert.equal(v.art.history.damage,before.damageByCell.D4);assert.match(v.art.history.detail.join(''),/不是人口或伤亡统计/);
 s.institutions.forEach(i=>{i.active=false;i.maintenance=0;});const stopped=getSceneVisit(s,'D4');
 assert.deepEqual(stopped.art.history,v.art.history);assert.deepEqual(s.flags.crisis,before);
});
test('unsafe crisis ancestors are not offered by either new return visit',()=>{
 const s=at20();next(s);s.events.push({id:'crisis-warning',year:39,cellId:'F6',kind:'event',status:'pending',parentId:null,sourceActionId:null});
 for(const c of ['D4','E4']){const v=getSceneVisit(s,c);assert.equal(v.art.history.recordId,null);assert.match(v.art.history.detail.join(''),/不提供未经核实/);}
});
for(const [label,api] of Object.entries({original,preTradeoffs,preHandoff,preRecruitment,preStaffing,preRecovery,prePort}))test(`${label}: genuine old relocation, services and personal choices stay readable without migration`,()=>{
 const s=relocated(api);api.advanceToNextWindow(s);next(s,api);assert.equal(s.year,40);
 const before=structuredClone(s),ending=api.getEnding(s);
 for(const c of ['D4','E4']){const v=getSceneVisit(freeze(s),c);assert.match(text(v),/第21年/);assert.ok(v.sourceIds.length);safeSources(s,v);}
 assert.deepEqual(s,before);assert.deepEqual(api.getEnding(s),ending);
});
test('return readers are frozen-safe, detached, and never inspect RNG, queued prose, drafts or investigation inventory',()=>{
 const s=relocated(),before=structuredClone(s),expected=['D4','E4'].map(c=>getSceneVisit(freeze(structuredClone(s)),c));
 for(const field of ['seed','drafts','investigations'])Object.defineProperty(s,field,{get(){throw Error(`forbidden ${field}`);},configurable:true});
 for(const e of s.events)for(const field of ['roll','probability','text','title'])Object.defineProperty(e,field,{get(){throw Error(`forbidden ${field}`);},configurable:true});
 assert.deepEqual(['D4','E4'].map(c=>getSceneVisit(s,c)),expected);
 expected[0].cards[0].paragraphs.push('MUTATED VIEW');expected[0].cards[0].sourceIds.push('NOT A SOURCE');expected[1].summary.push('MUTATED VIEW');
 assert.doesNotMatch(JSON.stringify(before),/MUTATED VIEW|NOT A SOURCE/);
 const clean=relocated();assert.deepEqual(clean,before);
});
test('safe refresh preserves both readonly visits and import intentionally returns to world',()=>{
 const s=relocated();for(const selected of ['D4','E4']){
  const saved={state:s,ui:{screen:'visit',selected}},before=structuredClone(s);
  assert.equal(restoreSave(saved).ui.screen,'visit');assert.equal(restoreSave(saved,{imported:true}).ui.screen,'world');assert.deepEqual(s,before);
 }
});
