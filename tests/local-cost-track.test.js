import test from 'node:test';
import assert from 'node:assert/strict';
import {renderLocalCostTrack as track,renderLocalCostLedger as render} from '../src/local-cost-ledger-view.js';
import {getLocalCostLedger} from '../src/local-cost-ledger.js';
import * as sim from '../src/simulation.js';
import {routes} from './fixtures/round24-investigation-routes.js';

test('fixed local ruler faithfully encodes all public contracts in four natural route snapshots, without mutation',()=>{
 let n=0;
 for(const s of Object.values(routes(sim)))for(const actor of sim.getActors(s))for(const c of s.cells)for(const a of sim.getActions(s,c.id,actor.id)){
  const v=getLocalCostLedger(s,c.id,a),before=JSON.stringify([s,a,v]);
  for(const row of v.rows){const html=track(row);assert.ok(html.includes(`width:${Math.min(row.before,row.cost)}%`));assert.ok(html.includes(`width:${Math.max(0,row.after)}%`));assert.match(html,/aria-hidden="true"/);n++;}
  assert.equal(JSON.stringify([s,a,v]),before);
  if(v.rows.length)assert.match(render(v),/满格为 100/);
  assert.match(render(v),/收益仍须等待合同兑现/);
 }
 assert.ok(n>20);
});
test('zero, exhausted, shortfall and tiny balances never exceed fixed scale',()=>{
 for(const [before,cost]of [[0,6],[6,6],[5.99999999,6],[6.00000001,6],[100,0],[100,100],[100,150]]){
  const row={before,cost,after:before-cost},html=track(row),widths=[...html.matchAll(/width:([^%]+)%/g)].map(m=>Number(m[1]));
  assert.equal(widths.length,2);assert.ok(widths.every(n=>n>=0&&n<=100));assert.equal(widths[0]+widths[1],before);
  if(cost>before)assert.equal(widths[1],0);
 }
});
test('invalid or inconsistent arithmetic cannot enter CSS',()=>{
 for(const row of [{before:NaN,cost:6,after:0},{before:'52',cost:6,after:46},{before:101,cost:6,after:95},{before:52,cost:-1,after:53},{before:52,cost:6,after:47},{before:52,cost:Infinity,after:-Infinity}])assert.equal(track(row),'');
});
