import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as previous from '../tests/fixtures/pre-decision-flow-producer/simulation.js';
import * as older from '../tests/fixtures/pre-training-workload-producer/simulation.js';
import * as legacy from '../tests/fixtures/pre-tradeoffs-simulation.js';
import {routes,lock,commit,copy} from '../tests/fixtures/round24-investigation-routes.js';
import {getWorldPlanning as planning} from '../src/world-planning.js';
import {getCrisisSceneContext as context} from '../src/crisis-scene-context.js';
import {evidenceFor} from '../src/story.js';
const bytes=JSON.stringify;
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
for(const [name,api]of [['current',sim],['prior',previous],['older',older],['legacy',legacy]])test(`round25 ${name}: all real cells and roles report exact local contracts without mutation`,()=>{
 for(const s of Object.values(routes(api)))for(const cell of s.cells)for(const actor of sim.getActors(s)){const before=bytes(s),v=planning(s,cell.id,actor.id);assert.ok(v);assert.equal(v.readOnly,true);assert.equal(v.cellId,cell.id);assert.equal(v.year,s.year);assert.equal(v.selectedActor.id,actor.id);assert.deepEqual(v.actors.map(a=>a.id),sim.getActors(s).map(a=>a.id));for(const a of v.actors){assert.equal(a.localContractCount,sim.getActions(s,cell.id,a.id).length);assert.equal(a.draftStatus,'unassigned');if(sim.usesTradeoffs(s))assert.equal(a.budget,sim.getInvestigation(s,a.id,cell.id).budget);else assert.notEqual(a.budgetStatus,'shared');}const count=sim.getActions(s,cell.id,actor.id).length,others=sim.getActors(s).filter(a=>a.id!==actor.id&&sim.getActions(s,cell.id,a.id).length);assert.equal(v.primary.kind,count?'scene':others.length?'switch-scene':'history');assert.equal(bytes(s),before);}
});
test('round25 malformed/inactive targets do not produce actionable recommendations',()=>{
 const s=routes(previous)[30];for(const state of [null,undefined,{}, {...s,phase:'playback'},{...s,phase:'ended'}])assert.equal(planning(state,'D4','protagonist'),null);
 for(const cell of [null,undefined,'','Z99','__proto__',{},['D4']])assert.equal(planning(s,cell,'protagonist'),null);
 for(const actor of [null,undefined,'','ghost','__proto__',{},['protagonist']])assert.equal(planning(s,'D4',actor),null);
});
test('round25 year30 alternative is real protagonist policy and never rewrites drafts or budgets',()=>{
 const s=routes(previous)[30];assert.equal(sim.getActions(s,'D4','linche').length,0);const v=planning(s,'D4','linche');assert.equal(v.primary.kind,'switch-scene');assert.equal(v.primary.actorId,'protagonist');assert.match(v.primary.label,/主角.*D4.*方案/);
 lock(s,previous,'protagonist','D4','share_power');const before=bytes(s),draft=bytes(s.drafts);for(const a of sim.getActors(s)){const x=planning(s,'D4',a.id);assert.equal(x.actors.find(a=>a.id==='protagonist').draftStatus,'locked');assert.equal(bytes(s),before);assert.equal(bytes(s.drafts),draft);}
 previous.passTask(s,'protagonist');assert.equal(planning(s,'D4','linche').actors.find(a=>a.id==='protagonist').draftStatus,'passed');
});
test('round25 budgets are exact after irreversible evidence use and remain actor-specific',()=>{
 const s=routes(previous)[30];previous.investigate(s,'protagonist','D4','resident_testimony');lock(s,previous,'linche','B4','establish_future_check');for(const cell of ['D4','B4','E4']){const v=planning(s,cell,'linche');assert.equal(v.actors.find(a=>a.id==='protagonist').budget,2);assert.equal(v.actors.find(a=>a.id==='linche').budget,0);}
});
test('round25 public read models accept frozen worlds, avoid hidden outcomes, and return detached data',()=>{
 for(const y of [20,30]){const s=routes(previous)[y],before=bytes(s),v=planning(s,'D4','protagonist');assert.deepEqual(planning(freeze(copy(s)),'D4','protagonist'),v);const trapped=copy(s),deny=(target,key)=>Object.defineProperty(target,key,{get(){throw Error(`Hidden read ${key}`);},configurable:true});for(const key of ['seed','baseline','snapshots'])deny(trapped,key);for(const row of [...trapped.events,...trapped.history])for(const key of ['roll','text','description'])deny(row,key);assert.deepEqual(planning(trapped,'D4','protagonist'),v);const c=context(s,'B4','protagonist');assert.deepEqual(context(freeze(copy(s)),'B4','protagonist'),c);assert.deepEqual(context(trapped,'B4','protagonist'),c);v.actors[0].name='forged';assert.notEqual(planning(s,'D4','protagonist').actors[0].name,'forged');assert.equal(bytes(s),before);}
});
test('round25 current year20 bounded context retains unread evidence and excludes unrelated/old scenes',()=>{
 const states=routes(sim);for(const [year,s]of Object.entries(states))for(const cell of s.cells)for(const actor of sim.getActors(s)){const before=bytes(s),v=context(s,cell.id,actor.id);if(Number(year)===20&&['B4','F6'].includes(cell.id)){assert.ok(v);assert.ok(v.body.length&&v.question);for(const id of sim.getEvidenceIds(s,cell.id,actor.id))assert.ok(!bytes(v).includes(evidenceFor(s,id,cell.id,actor.id).text));}else assert.equal(v,null);assert.equal(bytes(s),before);}
 for(const s of Object.values(routes(legacy)))for(const cell of ['B4','F6'])assert.equal(context(s,cell,'protagonist'),null);
 const compatible=routes(older)[20];for(const cell of ['B4','F6'])assert.deepEqual(context(compatible,cell,'protagonist'),context(states[20],cell,'protagonist'),'Compatible public crisis contracts, not unrelated training marker, determine scene applicability');
 const s=states[20];for(const actor of ['ghost',null,{},['protagonist']])assert.equal(context(s,'B4',actor),null);for(const cell of ['Z99',null,{},['B4']])assert.equal(context(s,cell,'protagonist'),null);for(const phase of ['playback','ended'])assert.equal(context({...s,phase},'B4','protagonist'),null);
});
for(const [name,api]of [['prior',previous],['older',older]])test(`round25 ${name}: complete 0→40 histories identical with all read models interleaved`,()=>{
 for(const seed of [0,6,12,42]){const expected=api.createRun(seed),actual=copy(expected);for(const year of [0,10,20,30]){for(const actor of sim.getActors(actual))for(const cell of actual.cells){planning(actual,cell.id,actor.id);context(actual,cell.id,actor.id);}const tasks=year===0?[['protagonist','D4','build_joint']]:year===10?[['protagonist','D4',api.getActions(expected,'D4').some(a=>a.id==='recruit_successor')?'recruit_successor':'recruit_volunteer']]:year===20?[['protagonist','D4','free_warning'],['linche','E4','train_network']]:[['protagonist','D4','share_power'],['linche','B4','establish_future_check']];for(const args of tasks){lock(expected,api,...args);lock(actual,sim,...args);assert.equal(bytes(actual),bytes(expected));}commit(expected,api);commit(actual,sim);assert.equal(bytes(actual),bytes(expected));while(expected.phase==='playback'){api.advanceYear(expected);sim.advanceYear(actual);assert.equal(bytes(actual),bytes(expected),`${seed} year${actual.year}`);}}assert.equal(actual.year,40);assert.equal(actual.phase,'ended');}
});
test('round25 protected simulation/save/story and core assets unchanged from independently captured baseline',()=>{
 // Exact bytes from independently captured main 6f84bb067f325cd7375ef209be7efb624d9bcde3.
 const hashes={'simulation.js':'08fab00c7ba363112e455733cc4820953479617b1322e53f407f49c22f237fee','save.js':'3d223c8e34e0b09c7e02f769bff23d110730de463313f1d2312893d54726b768','story.js':'205318494aa78849a9d439278ac3bdf29212691ce197a2b7140e6ceb57791578'};
 for(const [file,hash]of Object.entries(hashes))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(`../src/${file}`,import.meta.url))).digest('hex'),hash,file);
});
test('round25 damaged public records remain explicitly unknown rather than invented allowance/draft',()=>{
 for(const corrupt of [s=>delete s.investigations,s=>s.investigations['30:protagonist']={},s=>s.investigations['30:protagonist']=[{cellId:'Z99',evidenceId:'resident_testimony'}]]){const s=routes(previous)[30];corrupt(s);const before=bytes(s),v=planning(s,'D4','protagonist');assert.equal(v.selectedActor.budget,null);assert.equal(v.selectedActor.budgetStatus,'unknown');assert.equal(v.selectedActor.localContractCount,null);assert.equal(v.primary.kind,'unknown');assert.equal(bytes(s),before);}
 for(const draft of [null,{}, {actorId:'linche',window:30,status:'passed'},{actorId:'protagonist',window:20,status:'passed'},{actorId:'protagonist',window:30,status:'locked',cellId:'Z99',actionId:'bogus'}]){const s=routes(previous)[30];s.drafts.protagonist=draft;assert.equal(planning(s,'D4','protagonist').selectedActor.draftStatus,'unknown');}
 const s=routes(previous)[0];assert.equal(planning(s,'D4','linche'),null,'Not-yet-available role cannot become selected');
});
