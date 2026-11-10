import test from 'node:test';
import assert from 'node:assert/strict';
import {getRoleResearchBudget,renderRoleResearchBudget} from '../src/role-research-budget.js';
import {getRoleReadingChoice} from '../src/role-reading-choice.js';
import * as sim from '../src/simulation.js';
import * as old from './fixtures/pre-training-workload-producer/simulation.js';
import {ready} from './fixtures/pre-training-workload-scenarios.js';
for(let budget=0;budget<=3;budget++)for(let requiredRounds=0;requiredRounds<=5;requiredRounds++)test(`public budget ${budget}, required ${requiredRounds}: finite three-slot comparison, never an execution permission`,()=>{
 const input=Object.freeze({budget,requiredRounds}),v=getRoleResearchBudget(input),html=renderRoleResearchBudget(input);
 assert.equal(v.used,3-budget);assert.equal(v.shortfall,Math.max(0,requiredRounds-budget));
 assert.equal(v.slots.length,3);assert.equal(v.slots.filter(s=>s==='used').length,3-budget);
 assert.equal(v.slots.filter(s=>s==='needed').length,Math.min(requiredRounds,budget));
 assert.equal(v.slots.filter(s=>s==='free').length,Math.max(0,budget-requiredRounds));
 assert.equal(v.status,requiredRounds===0?'gathered':requiredRounds>budget?'shortfall':'available');
 assert.ok(html.includes('aria-hidden="true"'));assert.ok(html.includes('换地点不重置'));assert.ok(html.includes(`本窗口已用 ${3-budget} 轮`));
 assert.ok(!html.includes('<button'));assert.ok(!html.includes('progressbar'));assert.ok(!html.includes('可执行'));
});
test('unknown or malformed budgets never become a full allowance',()=>{
 for(const role of [null,{}, {budget:4,requiredRounds:0},{budget:-1,requiredRounds:0},{budget:NaN,requiredRounds:0},{budget:2.5,requiredRounds:0},{budget:3,requiredRounds:-1},{budget:3,requiredRounds:Infinity},{budget:3,requiredRounds:0.5}]){assert.equal(getRoleResearchBudget(role),null);assert.equal(renderRoleResearchBudget(role),'');}
});
for(const [name,api] of [['current',sim],['prior',old]])test(`${name}: natural cross-location expenditure stays with its actor; free role reading neither refills nor transfers`,()=>{
 const s=ready(api);api.investigate(s,'linche','D5','anomaly_records');api.investigate(s,'linche','D5','resident_testimony');
 const bytes=JSON.stringify(s),v=getRoleReadingChoice(s,{actorId:'protagonist',cellId:'E4',actionId:'authorize_training'});
 assert.deepEqual(v.roles.map(r=>getRoleResearchBudget(r).status),['available','shortfall']);
 assert.equal(getRoleResearchBudget(v.roles[1]).shortfall,1);assert.equal(getRoleResearchBudget(v.roles[1]).used,3);
 api.investigate(s,'protagonist','E4','resident_testimony');const after=JSON.stringify(s);
 const gathered=getRoleReadingChoice(s,{actorId:'protagonist',cellId:'E4',actionId:'authorize_training'});
 assert.equal(getRoleResearchBudget(gathered.roles[0]).status,'gathered');assert.equal(getRoleResearchBudget(gathered.roles[1]).status,'shortfall');
 gathered.roles.forEach(renderRoleResearchBudget);assert.equal(JSON.stringify(s),after);assert.notEqual(after,bytes);
});
for(const [name,api] of [['current',sim],['prior',old]])test(`${name}: training without required testimony does not become blocked by unrelated spent rounds`,()=>{const s=ready(api);api.investigate(s,'linche','D5','anomaly_records');api.investigate(s,'linche','D5','resident_testimony');const before=JSON.stringify(s),v=getRoleReadingChoice(s,{actorId:'protagonist',cellId:'E4',actionId:'train_network'});assert.equal(v.roles[1].budget,0);assert.equal(v.roles[1].requiredRounds,0);assert.equal(getRoleResearchBudget(v.roles[1]).status,'gathered');assert.equal(JSON.stringify(s),before);});
