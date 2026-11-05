import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as prior from './fixtures/pre-aftermath-simulation.js';
import {restoreSave} from '../src/save.js';
const copy=structuredClone;
function lock(api,s,actor,cell,id){for(const e of api.getActions(s,cell,actor).find(a=>a.id===id).requireEvidence)api.investigate(s,actor,cell,e);api.lockTask(s,actor,cell,id);}
function next(api,s){for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);api.advanceToNextWindow(s);}
function recruited(api=sim){const s=api.createRun(0);next(api,s);lock(api,s,'protagonist','D4','recruit_successor');next(api,s);return s;}
function submitted(){const s=recruited();lock(sim,s,'linche','D4','present_archive');sim.passTask(s,'protagonist');sim.commitWindow(s);return s;}
const canonical='action:20:protagonist:D4:relocate_teacher';
for(const [name,mutate] of [
 ['null source',e=>{e.sourceActionId=null;}],
 ['missing source',e=>{delete e.sourceActionId;}],
 ['protagonist source with Linche event ID',e=>{e.sourceActionId=canonical;}],
 ['canonical IDs without actual source history',e=>{e.sourceActionId=canonical;e.parentId=canonical;e.id=`event:${canonical}`;}],
])test(`new pending relocation rejects ${name} before any year or cost mutation`,()=>{
 const s=submitted(),e=s.events.find(e=>e.actionId==='present_archive');e.actionId='relocate_teacher';mutate(e);const before=copy(s);
 assert.equal(sim.validateState(s).valid,false);assert.throws(()=>restoreSave({state:s}),/存档|迁任/);assert.throws(()=>sim.advanceYear(s),/迁任|存档/);assert.deepEqual(s,before);
 // A forged future event cannot be carried into a new atomic submission either.
 const planning=recruited();planning.events.push(copy(e));planning.events.at(-1).year=21;const at20=copy(planning);
 assert.equal(sim.getWindowReview(planning).ready,false);assert.throws(()=>sim.commitWindow(planning));assert.deepEqual(planning,at20);
});
for(const [name,mutate] of [['missing',e=>delete e.resolvedYear],['different',e=>e.resolvedYear=12],['string',e=>e.resolvedYear='11']])test(`new recruitment with ${name} resolution date is invalid and never prints undefined`,()=>{
 const s=recruited(),e=s.events.find(e=>e.actionId==='recruit_successor');mutate(e);assert.equal(sim.validateState(s).valid,false);const refusal=sim.getActorRefusals(s,'linche','D4')[0];assert.match(refusal.reason,/缺少可核实/);assert.doesNotMatch(refusal.reason,/undefined|第12年|第11年/);assert.equal(refusal.sourceEventId,null);assert.throws(()=>restoreSave({state:s}),/存档|兑现年代/);
});
test('new correctly sourced protagonist relocation remains valid throughout actual resolution',()=>{const s=recruited();lock(sim,s,'protagonist','D4','relocate_teacher');sim.passTask(s,'linche');sim.commitWindow(s);assert.equal(sim.validateState(s).valid,true);const e=s.events.find(e=>e.actionId==='relocate_teacher');assert.equal(e.sourceActionId,canonical);sim.advanceYear(s);assert.equal(s.flags.forced,true);assert.equal(sim.validateState(s).valid,true);});
test('true prior Linche relocation keeps old provenance and complete continuation',()=>{const old=recruited(prior);lock(prior,old,'linche','D4','relocate_teacher');prior.passTask(old,'protagonist');prior.commitWindow(old);const loaded=restoreSave({state:copy(old)}).state;assert.equal(sim.validateState(loaded).valid,true);for(let year=21;year<=30;year++){prior.advanceYear(old);sim.advanceYear(loaded);assert.deepEqual(loaded,old);}});
