import test from 'node:test';
import assert from 'node:assert/strict';
import {getWorldPhaseContext} from '../src/world-phase-context.js';
import * as current from '../src/simulation.js';
import * as old from './fixtures/pre-training-workload-producer/simulation.js';
import * as legacy from './fixtures/pre-tradeoffs-simulation.js';

for (const year of [0,10,20,30]) test(`planning ${year} alone shows unfinished drafts`,()=>{
 const context=getWorldPhaseContext({year,phase:'planning'});
 assert.equal(context.kind,'planning');assert.equal(context.showDraftCount,true);
 assert.equal(context.title,'本轮安排');assert.match(context.description,/先锁定或放弃/);
});
for (const year of [0,1,10,11,20,23,30,39]) test(`submitted ${year} does not invent a fresh planning task`,()=>{
 const context=getWorldPhaseContext({year,phase:'playback'});
 assert.equal(context.kind,'playback');assert.equal(context.showDraftCount,false);
 assert.match(context.description,/约定年份核对/);assert.doesNotMatch(context.description,/先锁定|先.*放弃|必定成功/);
});
test('only actual ended40 gets archival copy',()=>{
 const context=getWorldPhaseContext({year:40,phase:'ended'});assert.equal(context.kind,'ended');assert.equal(context.showDraftCount,false);
 assert.match(context.description,/不再安排新的介入/);assert.doesNotMatch(context.description,/先锁定|先.*放弃/);
});
test('malformed public clocks do not fabricate a phase',()=>{
 for(const state of [null,{}, {year:'40',phase:'ended'},{year:40,phase:'planning'},{year:40,phase:'playback'},{year:39,phase:'ended'},{year:5,phase:'planning'},{year:41,phase:'ended'},{year:-1,phase:'planning'},{year:0,phase:'unknown'}])assert.equal(getWorldPhaseContext(state),null);
});
test('phase copy never inspects drafts, future events or private randomness',()=>{
 const state={year:40,phase:'ended'};for(const field of ['drafts','events','history','actors','institutions','flags','seed','roll','snapshots'])Object.defineProperty(state,field,{get(){throw Error(`forbidden ${field}`)}});
 assert.equal(getWorldPhaseContext(state).kind,'ended');
});
for(const [name,api] of [['current',current],['old',old],['legacy',legacy]])test(`${name} genuine complete pass route is unmodified at every clock`,()=>{
 const state=api.createRun(0);
 for(let decade=0;decade<4;decade++){
  let before=JSON.stringify(state);assert.equal(getWorldPhaseContext(state).kind,'planning');assert.equal(JSON.stringify(state),before);
  for(const actor of api.getActors(state))api.passTask(state,actor.id);api.commitWindow(state);
  for(let year=0;year<10;year++){
   before=JSON.stringify(state);assert.equal(getWorldPhaseContext(state).kind,'playback');assert.equal(JSON.stringify(state),before);api.advanceYear(state);
  }
 }
 const before=JSON.stringify(state);assert.equal(getWorldPhaseContext(state).kind,'ended');assert.equal(JSON.stringify(state),before);assert.equal(api.validateState(state).valid,true);
});
