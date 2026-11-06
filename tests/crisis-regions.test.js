import test from 'node:test';
import assert from 'node:assert/strict';
import {getCrisisRegions,CRISIS_MARKER_OFFSET} from '../src/crisis-regions.js';
import {createRun,FLOOD_REGIONS} from '../src/simulation.js';
import {localAt20,localAt30,legacyLocalAt30} from './helpers/local-crisis.js';
test('map records have verified stages, all four places, and do not mutate facts',()=>{
 for(const [state,status] of [[localAt20(),'warning'],[localAt30(),'loss'],[localAt30({zero:true}),'zero'],[legacyLocalAt30(),'unknown']]){
  const before=JSON.stringify(state),view=getCrisisRegions(state);assert.deepEqual(view.regions.map(r=>r.cellId),FLOOD_REGIONS);assert.ok(view.regions.every(r=>r.status===status));assert.equal(JSON.stringify(state),before);
 }
 assert.equal(getCrisisRegions(createRun(0)).regions.length,0);
});
test('missing and invalid local values never become zero, including a global zero',()=>{
 for(const value of [undefined,null,NaN,Infinity,-1,1.1,'0']){const s=localAt30({zero:true});s.flags.crisis.damageByCell.D5=value;const r=getCrisisRegions(s).regions.find(r=>r.cellId==='D5');assert.equal(r.status,'unknown');assert.equal(r.damage,null);}
});
test('missing provenance does not invent warning or settlement and unsafe source links are withheld',()=>{
 const s=localAt30();s.history=s.history.filter(r=>r.id!=='crisis-impact');assert.ok(getCrisisRegions(s).regions.every(r=>r.status==='unknown'&&r.recordId===null));
 const w=localAt20();w.history.find(r=>r.id==='crisis-warning').parentId='missing';assert.ok(getCrisisRegions(w).regions.every(r=>r.status==='warning'&&r.recordId===null));
 delete s.flags.crisis.affectedCells;assert.equal(getCrisisRegions(s).regions.length,0);
});
test('duplicate milestone, forged reality and future values cannot supply current facts',()=>{
 for(const alter of [s=>s.history.push({...s.history.find(r=>r.id==='crisis-impact')}),s=>s.history.find(r=>r.id==='crisis-impact').reality='R0']){const s=localAt30({zero:true});alter(s);assert.ok(getCrisisRegions(s).regions.every(r=>r.status==='unknown'));}
 const s=localAt20();s.flags.crisis.damageByCell={D4:0,E4:0,D5:0,F6:0};assert.ok(getCrisisRegions(s).regions.every(r=>r.status==='warning'&&r.damage===null));
});

test('E4 record page does not touch the neighboring F6 pending activity chip',()=>{
 // Projection: E4 y=172; F6 y=220. Page extends 10px; chip is 40px above F6 with 10px radius.
 assert.ok(172+CRISIS_MARKER_OFFSET.y+10<=220-40-10-3);
});
