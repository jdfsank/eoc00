import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import {restoreSave} from '../src/save.js';
import {getCrossLocationInvestigation as cross} from '../src/investigation-cross-location.js';
import {getInvestigationPlan} from '../src/investigation-plan.js';
import {getActionCardTradeoff} from '../src/action-card-copy.js';
import * as previous from './fixtures/pre-decision-flow-producer/simulation.js';
import * as older from './fixtures/pre-training-workload-producer/simulation.js';
import * as legacy from './fixtures/pre-tradeoffs-simulation.js';
import {routes,relocationRoutes,lock,commit,copy} from './fixtures/round24-investigation-routes.js';
const bytes=JSON.stringify;
const sort=rows=>rows.map(r=>`${r.cellId}/${r.actionId}${r.enhancementId?'/'+r.enhancementId:''}`).sort();
const material=(s,cell,id,actor='protagonist')=>cross(s,cell,actor).materials.find(m=>m.id===id);
// Independent differential oracle actually acquires one legal material on a
// test-only clone, then reads each destination's public plan before/after.
function oracle(s,origin,actor,evidence){
 const after=copy(s);sim.investigate(after,actor,origin,evidence);const blocks=[],enhancements=[];
 for(const cell of s.cells){if(cell.id===origin)continue;const before=getInvestigationPlan(s,cell.id,actor),next=getInvestigationPlan(after,cell.id,actor);if(!before)continue;
  for(const action of before.actions){const later=next.actions.find(a=>a.actionId===action.actionId);if(action.reachable&&!later.reachable)blocks.push({cellId:cell.id,actionId:action.actionId});
   for(const extra of action.optionalEnhancements){const then=later.optionalEnhancements.find(e=>e.id===extra.id);if(extra.reachable&&!extra.acquired&&!then.reachable)enhancements.push({cellId:cell.id,actionId:action.actionId,enhancementId:extra.id});}
  }
 }
 return {blocks:sort(blocks),enhancements:sort(enhancements)};
}
for(const [version,api]of [['round21',previous],['round20',older]])for(const seed of [0,6,12,42])test(`round24 ${version}/${seed}: cross-location claims equal actual legal one-material outcomes`,()=>{
 for(const s of Object.values(routes(api,seed)))for(const actor of sim.getActors(s))for(const cell of s.cells){
  const plan=getInvestigationPlan(s,cell.id,actor.id);if(!plan)continue;const before=bytes(s),view=cross(s,cell.id,actor.id);assert.ok(view);assert.equal(bytes(s),before);
  for(const m of view.materials){if(!m.canInvestigate){assert.deepEqual(m.blocksAfter,[]);assert.deepEqual(m.enhancementsLostAfter,[]);continue;}
   const expected=oracle(s,cell.id,actor.id,m.id);assert.deepEqual(sort(m.blocksAfter),expected.blocks,`${s.year}/${cell.id}/${actor.id}/${m.id}`);assert.deepEqual(sort(m.enhancementsLostAfter),expected.enhancements);
  }
 }
});
test('round24 y20 resident then archive newly closes only other-place full review/enhancement, not basic veto',()=>{
 const s=routes(previous)[20];sim.investigate(s,'protagonist','D4','resident_testimony');const before=bytes(s),m=material(s,'D4','old_reality_record');
 assert.equal(m.budgetAfter,1);assert.deepEqual(sort(m.blocksAfter),['B4/independent_review','F6/independent_review']);assert.deepEqual(sort(m.enhancementsLostAfter),['B4/local_veto/surveyed_veto','F6/local_veto/surveyed_veto']);assert.ok(m.enhancementsLostAfter.every(e=>e.basicRequiresNoEvidence));assert.equal(bytes(s),before);
 sim.investigate(s,'protagonist','D4','old_reality_record');assert.deepEqual(material(s,'D4','old_reality_record').blocksAfter,[]);for(const m of cross(s,'D4').materials)assert.deepEqual(m.blocksAfter,[],'already-unreachable routes are not newly lost');
 assert.ok(getInvestigationPlan(s,'B4').actions.find(a=>a.actionId==='local_veto').reachable);
});
test('round24 y30 same-name local testimony cannot pay another location; portable anomaly can',()=>{
 for(const origin of ['D4','E4']){const s=routes(previous)[30],before=bytes(s),m=material(s,origin,'resident_testimony');assert.ok(m.blocksAfter.some(r=>r.cellId==='B4'&&r.actionId==='establish_future_check'));assert.equal(bytes(s),before);sim.investigate(s,'protagonist',origin,'resident_testimony');assert.equal(sim.getInvestigation(s,'protagonist','B4').evidence.includes('resident_testimony'),false);assert.equal(sim.getInvestigation(s,'linche','B4').budget,3);}
 const s=routes(previous)[30],m=material(s,'D4','anomaly_records');assert.equal(m.portable,true);assert.ok(!m.blocksAfter.some(r=>r.cellId==='B4'&&r.actionId==='establish_future_check'));sim.investigate(s,'protagonist','D4','anomaly_records');const p=getInvestigationPlan(s,'B4').actions.find(a=>a.actionId==='establish_future_check');assert.equal(p.requiredRounds,1);assert.equal(p.reachable,true);assert.equal(sim.getInvestigation(s,'linche','B4').evidence.includes('anomaly_records'),false);
});
test('round24 acquired/unaffordable materials and a retained locked contract produce no invented loss or draft rewrite',()=>{
 const s=routes(previous)[20];sim.lockTask(s,'protagonist','B4','local_veto');const draft=bytes(s.drafts);sim.investigate(s,'protagonist','D4','resident_testimony');const before=bytes(s);const view=cross(s,'D4');assert.equal(bytes(s),before);assert.equal(bytes(s.drafts),draft);assert.ok(!view.materials.flatMap(m=>m.blocksAfter).some(a=>a.actionId==='local_veto'));
 sim.investigate(s,'protagonist','D4','old_reality_record');for(const m of cross(s,'D4').materials.filter(m=>m.acquired||!m.canInvestigate)){assert.deepEqual(m.blocksAfter,[]);assert.deepEqual(m.enhancementsLostAfter,[]);}
});
test('round24 true legacy producer never acquires modern shared-budget projection',()=>{for(const s of Object.values(routes(legacy))){assert.equal(sim.usesTradeoffs(s),false);assert.equal(cross(s,'D4'),null);assert.equal(bytes(restoreSave({state:copy(s)}).state),bytes(s));}});
test('round24 public-reader: deeply frozen worlds, private-field traps, and detached outputs',()=>{
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
 for(const year of [20,30]){const s=routes(previous)[year],before=bytes(s),expected=cross(s,'D4');assert.deepEqual(cross(freeze(copy(s)),'D4'),expected);
  const trapped=copy(s),deny=(target,key)=>Object.defineProperty(target,key,{get(){throw Error(`Private read ${key}`);},configurable:true});for(const key of ['seed','baseline','snapshots'])deny(trapped,key);for(const row of [...trapped.events,...trapped.history])for(const key of ['roll','text','description'])deny(row,key);assert.deepEqual(cross(trapped,'D4'),expected);
  const changed=cross(s,'D4');changed.materials[0].name='forged';changed.origin.name='forged';assert.deepEqual(cross(s,'D4'),expected);assert.equal(bytes(s),before);
 }
});
test('round24 invalid/non-planning inputs do not manufacture confident closure',()=>{assert.equal(cross(null,'D4'),null);const s=routes(previous)[20];assert.equal(cross(s,'Z99'),null);assert.equal(cross(s,'D4','unknown'),null);commit(s,previous);assert.equal(cross(s,'D4'),null);});
for(const [version,api]of [['round21',previous],['round20',older]])test(`round24 ${version}: both full annual histories remain exact with display readers interleaved`,()=>{
 for(const seed of [0,6,12,42]){const expected=api.createRun(seed),actual=copy(expected);
  for(const year of [0,10,20,30]){const task=year===0?[['protagonist','D4','build_joint']]:year===10?[['protagonist','D4',api.getActions(expected,'D4').some(a=>a.id==='recruit_successor')?'recruit_successor':'recruit_volunteer']]:year===20?[['protagonist','D4','free_warning'],['linche','E4','train_network']]:[['protagonist','D4','share_power'],['linche','B4','establish_future_check']];
   for(const actor of sim.getActors(actual))for(const cell of actual.cells){cross(actual,cell.id,actor.id);for(const action of sim.getActions(actual,cell.id,actor.id))getActionCardTradeoff(action);}
   for(const [actor,cell,id]of task){lock(expected,api,actor,cell,id);lock(actual,sim,actor,cell,id);assert.equal(bytes(actual),bytes(expected));}
   commit(expected,api);commit(actual,sim);assert.equal(bytes(actual),bytes(expected));while(expected.phase==='playback'){api.advanceYear(expected);sim.advanceYear(actual);assert.equal(bytes(actual),bytes(expected),`annual ${actual.year}`);assert.equal(bytes(restoreSave({state:copy(actual)}).state),bytes(expected));}
  }
 }
});
test('round24 relocation-only card preserves every dynamic reward/risk byte, including real older contracts',()=>{
 for(const api of [sim,previous,older,legacy]){const s=routes(api)[20];for(const actor of api.getActors(s))for(const action of api.getActions(s,'D4',actor.id)){const view=getActionCardTradeoff(action);if(action.id!=='relocate_teacher'){assert.equal(view,null);continue;}assert.deepEqual(view,[{field:'reward',label:'若合同兑现',text:action.reward,known:true},{field:'risk',label:'仍需承担',text:action.risk,known:true}]);}assert.equal(sim.getActions(s,'D4','linche').some(a=>a.id==='relocate_teacher'),api===legacy);}
});
for(const directory of ['pre-decision-flow-producer','pre-training-workload-producer'])test(`round24 ${directory} files remain SHA-identical to original manifest`,()=>{const root=new URL(`./fixtures/${directory}/`,import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));for(const [file,sha]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),sha,file);});

test('round24 cross-location view: grouped genuine losses, optional/basic distinction and no invented material body',async()=>{
 const {renderCrossLocationInvestigation:render}=await import('../src/investigation-cross-location-view.js');const s=routes(previous)[20];sim.investigate(s,'protagonist','D4','resident_testimony');const plan=cross(s,'D4'),html=render(plan,'old_reality_record');
 assert.equal((html.match(/data-cross-location-cell=/g)||[]).length,2);assert.equal((html.match(/data-cross-location-kind="required"/g)||[]).length,2);assert.equal((html.match(/data-cross-location-kind="enhancement"/g)||[]).length,2);assert.equal((html.match(/基本停闸仍无需取证/g)||[]).length,2);assert.match(html,/林澈的调查轮数不受本次影响/);assert.match(html,/费用、名额与同格安排/);assert.doesNotMatch(html,/data-action=|<script|seed|roll|基线|快照/);
 const {evidenceFor}=await import('../src/story.js');for(const id of sim.getEvidenceIds(s,'D4'))assert.ok(!html.includes(evidenceFor(s,id,'D4').text),'no acquired or unread prose needed for this notice');
 assert.equal(render(null,'x'),'');assert.equal(render(plan,'unknown'),'');assert.equal(render(plan,'resident_testimony'),'');assert.equal(render(cross(routes(previous)[0],'D4'),'independent_flood_records'),'');
 sim.investigate(s,'protagonist','D4','old_reality_record');assert.equal(render(cross(s,'D4'),'anomaly_records'),'');
});
test('round24 cross-location view: unknown is visibly unknown, never empty-safe; all public text/attributes escaped',async()=>{
 const {renderCrossLocationInvestigation:render}=await import('../src/investigation-cross-location-view.js');const s=routes(previous)[20],bad=copy(s);bad.investigations[`${s.year}:protagonist`]='invalid';const unknown=cross(bad,'D4');assert.ok(unknown.issues.length);const warning=render(unknown,'old_reality_record');assert.match(warning,/data-cross-location-unknown/);assert.match(warning,/这不表示别处没有代价/);
 sim.investigate(s,'protagonist','D4','resident_testimony');const plan=cross(s,'D4'),payload='\"><img src=x onerror=alert(1)>\'&';plan.actorName=payload;plan.otherActors[0].actorName=payload;const m=plan.materials.find(m=>m.id==='old_reality_record');m.id=payload;for(const row of [...m.blocksAfter,...m.enhancementsLostAfter]){row.cellId=payload;row.cellName=payload;row.actionId=payload;row.title=payload;row.enhancementTitle=payload;}const html=render(plan,payload);assert.ok(!html.includes(payload));assert.doesNotMatch(html,/<img|<script/);assert.match(html,/&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;&#39;&amp;/);
});

test('round24 relocation scope uses real active, absent and already-stopped jobs; uncertain model never invents a shutdown',async()=>{
 const {getRelocationContract}=await import('../src/relocation-history.js');
 for(const api of [previous,older])for(const [branch,s]of Object.entries(relocationRoutes(api))){const before=bytes(s),contract=getRelocationContract(s);assert.equal(contract.status,'recorded');assert.match(contract.detail[0],/东岸.*同时停用河港当时已有的制度/);assert.match(contract.detail[0],/不以苏岚是否担任维护者为条件/);if(branch==='none'){assert.equal(contract.targets.length,0);assert.match(contract.detail[1],/不存在的停运/);}else{assert.equal(contract.targets.length,1);assert.match(contract.detail[1],/已停运的制度不会被算作一次新的停运/);if(branch==='stopped')assert.equal(s.institutions.find(i=>i.id===contract.targets[0].id).active,false);}assert.equal(bytes(s),before);}
 const broken=copy(routes(previous)[20]);broken.history=broken.history.filter(h=>!h.id.startsWith('resolved:event:action:0:'));const before=bytes(broken),unknown=getRelocationContract(broken);assert.equal(unknown.status,'unknown');assert.match(unknown.detail[1],/来源不完整.*不能.*补写停运/);assert.equal(bytes(broken),before);
});
