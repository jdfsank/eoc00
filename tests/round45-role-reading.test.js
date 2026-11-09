import test from 'node:test';
import assert from 'node:assert/strict';
import {renderRoleReadingChoice} from '../src/role-reading-choice-view.js';
import {getRoleReadingChoice} from '../src/role-reading-choice.js';
import * as sim from '../src/simulation.js';
import {ready} from './fixtures/pre-training-workload-scenarios.js';
for(const actionId of ['authorize_training','train_network'])test(`${actionId}: a reading directory precedes full role facts without omitting information`,()=>{
 const state=ready(sim),before=JSON.stringify(state);
 const choice=getRoleReadingChoice(state,{actorId:'protagonist',cellId:'E4',actionId});
 const html=renderRoleReadingChoice(choice);
 assert.ok(html.indexOf('opportunity-role-links')<html.indexOf('opportunity-role-pair'));
 assert.match(html,/aria-label="免费阅读目录"/);
 assert.match(html,/当前安排与调查/);
 assert.ok(!html.includes('<details'));
 assert.ok(html.includes(choice.explanation));assert.ok(html.includes(choice.boundary));
 for(const role of choice.roles){for(const value of [role.name,role.duty,role.arrangement,`剩余 ${role.budget} / 3 调查轮`,`E4本项仍需 ${role.requiredRounds} 轮`])assert.ok(html.includes(value));}
 assert.equal((html.match(/data-action="opportunity-route"/g)||[]).length,2);
 assert.equal(JSON.stringify(state),before);
});
test('role headings pair readable names with decorative ordinal seals',()=>{
 const html=renderRoleReadingChoice({explanation:'<safe>',boundary:'A & B',links:[],roles:[{actorId:'x',name:'<name>',duty:'duty',arrangement:'original',budget:0,requiredRounds:1}]});
 assert.match(html,/opportunity-role-heading/);assert.match(html,/aria-hidden="true"/);
 assert.match(html,/&lt;name&gt;/);assert.match(html,/&lt;safe&gt;/);assert.match(html,/A &amp; B/);
 assert.match(html,/现有调查余额不足，查看不会补充/);
 assert.equal(renderRoleReadingChoice(null),'');
});
