import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import * as prior from './fixtures/pre-training-workload-producer/simulation.js';
import {ready, lock, next, commit} from './fixtures/pre-training-workload-scenarios.js';
import {getRoleReadingChoice} from '../src/role-reading-choice.js';
import {renderRoleReadingChoice} from '../src/role-reading-choice-view.js';
const bytes=JSON.stringify;
const context=(actionId='authorize_training')=>({actorId:'protagonist',cellId:'E4',actionId});
const offer=(s,id)=>getRoleReadingChoice(s,context(id));
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

for(const id of ['authorize_training','train_network'])test(`${id}: two navigation destinations read available contracts, not an automatic assignment`,()=>{
 const s=ready(sim),before=bytes(s),view=offer(s,id);
 assert.equal(view.roles.length,2);
 assert.deepEqual(view.links.map(({id,actorId,cellId,actionId})=>({id,actorId,cellId,actionId})),[
  {id:'companion',actorId:'linche',cellId:'E4',actionId:id},
  {id:'policies',actorId:'protagonist',cellId:'D4',actionId:null},
 ]);
 assert.ok(sim.getActions(s,'E4','linche').some(a=>a.id===id));
 assert.equal(sim.getActions(s,'D4','linche').length,0);
 assert.deepEqual(view.roles.map(role=>role.status),['unassigned','unassigned']);
 assert.equal(bytes(s),before);
});

test('research remains actor-specific even after protagonist has already paid for testimony',()=>{
 const s=ready(sim);sim.investigate(s,'protagonist','E4','resident_testimony');
 const before=bytes(s),view=offer(s);
 assert.deepEqual(view.roles.map(({budget,requiredRounds})=>({budget,requiredRounds})),[
  {budget:2,requiredRounds:0},{budget:3,requiredRounds:1},
 ]);
 assert.match(view.boundary,/材料不转给另一角色/);
 assert.equal(bytes(s),before);
});

test('exhausted companion can still read, but is never described as ready to execute',()=>{
 const s=ready(sim);
 sim.investigate(s,'linche','D5','anomaly_records');
 sim.investigate(s,'linche','D5','resident_testimony');
 const before=bytes(s),view=offer(s),html=renderRoleReadingChoice(getRoleReadingChoice(s,context()));
 assert.equal(view.roles[1].budget,0);assert.equal(view.roles[1].requiredRounds,1);
 assert.ok(view.links.some(link=>link.id==='companion'));
 assert.match(html,/现有调查余额不足，查看不会补充/);
 assert.equal(bytes(s),before);
});

test('existing locked work, signed draft and deliberate pass are reported without replacement',()=>{
 const s=ready(sim);
 lock(s,'protagonist','D4','share_power',sim);lock(s,'linche','D5','mutual_aid',sim);
 const before=bytes(s),view=offer(s);
 assert.deepEqual(view.roles.map(role=>role.status),['locked','locked']);
 assert.match(view.roles[0].arrangement,/共享档案与纠错权/);
 assert.match(view.roles[1].arrangement,/D5/);
 assert.equal(bytes(s),before);
 sim.passTask(s,'linche');assert.equal(offer(s).roles[1].status,'passed');
});

test('invalid companion draft is unknown rather than proof of a usable assignment',()=>{
 const s=ready(sim);
 s.drafts.linche={actorId:'linche',window:30,status:'locked',cellId:'E4',actionId:'authorize_training',evidence:[]};
 assert.equal(offer(s).roles[1].status,'unknown');
 assert.match(offer(s).roles[1].arrangement,/待核对/);
});

test('entry points stay narrow and do not invent a missing companion',()=>{
 const s=ready(sim);
 for(const options of [{},{actorId:'protagonist',cellId:'E4'},{actorId:'linche',cellId:'E4',actionId:'train_network'},
  {actorId:'protagonist',cellId:'D4',actionId:'share_power'}]) assert.equal(getRoleReadingChoice(s,options),null);
 const solo=sim.createRun(0);next(solo,sim);next(solo,sim);next(solo,sim);
 assert.equal(offer(solo,'train_network'),null);
 commit(s,sim);assert.equal(offer(s),null);
});

test('unaffordable contracts remain explicitly reading only and do not promise a valid whole window',()=>{
 const s=ready(sim);s.cells.find(c=>c.id==='E4').channels.economy=0;
 const view=offer(s),before=bytes(s);
 assert.ok(view);assert.match(view.boundary,/费用、同格冲突与整轮条件仍须核对/);
 renderRoleReadingChoice(getRoleReadingChoice(s,context()));assert.equal(bytes(s),before);
});

test('previous workload producer retains its genuine saved world and original scene-budget producer gains no invented budget',()=>{
 const old=ready(prior),before=bytes(old);assert.ok(offer(old));assert.equal(bytes(old),before);
 const s=legacy.createRun(0);
 const oldLock=(cell,id)=>{const a=legacy.getActions(s,cell,'protagonist').find(a=>a.id===id);legacy.lockTask(s,'protagonist',cell,id,a.requireEvidence);};
 oldLock('D4','build_joint');next(s,legacy);oldLock('D4','recruit_successor');next(s,legacy);next(s,legacy);
 const original=bytes(s);assert.equal(offer(s,'train_network'),null);assert.equal(bytes(s),original);
});

test('read-only role offers preserve deep-frozen natural worlds across five seeds',()=>{
 for(const seed of [0,1,2,3,12]){
  const s=ready(sim,{seed});const before=bytes(s);freeze(s);
  for(const id of ['authorize_training','train_network'])assert.ok(renderRoleReadingChoice(getRoleReadingChoice(s,context(id))).includes('data-role-choice'));
  assert.equal(bytes(s),before);
 }
});

test('role motif and navigation escape actor names and keep free-reading boundaries visible',()=>{
 const s=ready(sim);s.actors.find(a=>a.id==='linche').name='<img src=x onerror=alert(1)>';
 const html=renderRoleReadingChoice(getRoleReadingChoice(s,context()));
 assert.match(html,/&lt;img/);assert.ok(!html.includes('<img'));
 for(const actor of ['protagonist','linche'])assert.ok(html.includes(`data-role-slot="${actor}"`));
 for(const id of ['companion','policies'])assert.ok(html.includes(`data-action="opportunity-route" data-id="${id}"`));
 assert.match(html,/免费查看 · 不锁定/);assert.match(html,/重新锁定才替换/);
});
