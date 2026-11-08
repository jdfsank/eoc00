import test from 'node:test';import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';import * as previous from './fixtures/pre-decision-flow-producer/simulation.js';import * as legacy from './fixtures/legacy-simulation.js';
import {routes,lock} from './fixtures/round24-investigation-routes.js';
import {getLocalCostLedger as ledger,localCostNumber} from '../src/local-cost-ledger.js';import {renderLocalCostLedger as render} from '../src/local-cost-ledger-view.js';
const json=JSON.stringify;const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
for(const[name,api]of [['current',sim],['previous',previous],['original',legacy]])for(const[year,state]of Object.entries(routes(api))){
 test(`${name} ${year}: every public contract uses only exact local current values`,()=>{
  const before=json(state);freeze(state);
  for(const actor of sim.getActors(state))for(const cell of state.cells)for(const action of sim.getActions(state,cell.id,actor.id)){
   const v=ledger(state,cell.id,action);assert.equal(v.cellId,cell.id);assert.equal(v.scope,'single-contract');assert.equal(v.readOnly,true);
   assert.deepEqual(v.rows.map(r=>[r.key,r.cost]),Object.entries(action.cost).filter(([,v])=>v));
   for(const r of v.rows){assert.equal(r.before,cell.channels[r.key]);assert.equal(r.after,r.before-r.cost);assert.equal(r.insufficient,r.before<r.cost);}
   for(const text of ['尚未支付','未合并同地其他草稿','其他地点的通道不能代付','未计算年度演化'])assert.ok(render(v).includes(text));
   if(v.rows[0])v.rows[0].before=999;assert.ok(ledger(state,cell.id,action).rows.every(r=>r.before<=100));
  }
  assert.equal(json(state),before);
 });
}
test('other same-place draft and own replacement are not silently deducted',()=>{
 const s=routes(sim)[20],a=sim.getActions(s,'D4').find(a=>a.id==='relocate_teacher'),v=ledger(s,'D4',a);
 lock(s,sim,'protagonist','D4','free_warning');lock(s,sim,'linche','D4','present_archive');const before=json(s);
 assert.deepEqual(ledger(s,'D4',a),v);assert.equal(json(s),before);assert.match(render(v),/最终在本轮安排核对/);
});
test('synthetic zero/tiny shortfalls use unrounded arithmetic and never grant readiness',()=>{
 const s=sim.createRun(0),a=sim.getActions(s,'D4').find(a=>a.id==='build_joint');
 for(const amount of [0,5.99999999,6,6.00000001,100]){const p=structuredClone(s);p.cells.find(c=>c.id==='D4').channels.economy=amount;const v=ledger(p,'D4',a);assert.equal(v.rows[0].insufficient,amount<6);assert.ok(!('canLock'in v)&&!('ready'in v));assert.match(render(v),amount<6?/单项仍缺约/:/单项后约/);if(amount===5.99999999)assert.match(render(v),/少于 0.01/);}
});
test('invalid cost, duplicate place and missing/nonfinite channel never fabricate a balance',()=>{
 const s=sim.createRun(0),a=sim.getActions(s,'D4')[0];
 for(const cost of [null,[],{economy:NaN},{economy:Infinity},{economy:-1},{unknown:1}])assert.equal(ledger(s,'D4',{...a,cost}),null);
 for(const n of [undefined,null,'52',NaN,Infinity,-1,101]){const p=structuredClone(s);p.cells.find(c=>c.id==='D4').channels.economy=n;assert.equal(ledger(p,'D4',{cost:{economy:6}}),null);}
 const p=structuredClone(s);p.cells.push(structuredClone(p.cells.find(c=>c.id==='D4')));assert.equal(ledger(p,'D4',a),null);
 for(const invalid of [null,{},[],{...s,phase:'ended'},{...s,year:21}])assert.equal(ledger(invalid,'D4',a),null);
 assert.equal(ledger(s,'missing',a),null);assert.equal(render(null),'');
});
test('zero cost still occupies the intervention slot',()=>{const v=ledger(sim.createRun(0),'D4',{cost:{economy:0}});assert.deepEqual(v.rows,[]);assert.match(render(v),/仍占用本窗口一次介入/);});
test('two-decimal reading preserves tiny nonzero amounts and signs',()=>{for(const[n,out]of [[0,'0'],[12,'12'],[12.345,'12.35'],[.001,'少于 0.01'],[-.001,'负且少于 0.01'],[-2.345,'-2.35'],[NaN,'未知']])assert.equal(localCostNumber(n),out);});
test('no hidden roll, history, draft or other local channel is read',()=>{const s=sim.createRun(0),a=sim.getActions(s,'D4')[0];for(const key of ['seed','events','history','drafts','futureSnapshots'])Object.defineProperty(s,key,{get(){throw Error(key);}});for(const c of s.cells)if(c.id!=='D4')Object.defineProperty(c,'channels',{get(){throw Error(c.id);}});assert.ok(ledger(s,'D4',a));});
test('view escapes labels and offers no extra action',()=>{const html=render({cellId:'<img src=x>',rows:[{key:'economy',label:'<script>',before:52,cost:6,after:46,insufficient:false}]});assert.ok(!html.includes('<img')&&!html.includes('<script>')&&!html.includes('<button'));assert.match(html,/&lt;img/);});
