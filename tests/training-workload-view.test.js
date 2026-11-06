import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTrainingChoiceComparison as render} from '../src/training-choice-comparison-view.js';

const original={politics:.1,economy:.25,science:.7,religion:.1};
const reassigned={politics:.5,economy:.45,science:.1,religion:.1};
const zero={politics:0,economy:0,science:0,religion:0};
const school={politics:.1,economy:.25,science:.65,religion:.2};
function fixture({legacy=false,maintenance=1}={}){
 const scale=source=>Object.fromEntries(Object.entries(source).map(([key,value])=>[key,Math.round(value*maintenance*1e4)/1e4]));
 const delta=legacy?zero:{politics:.4,economy:.2,science:-.6,religion:0};
 return {readOnly:true,title:'承接原学徒，还是新增培训？',cellId:'E4',actorId:'linche',conditional:{shareMissing:[],assumption:'仅假设合同兑现，不是未来结果。'},options:[
  {actionId:'authorize_training',title:'协商学徒承接权',cost:{politics:3,economy:2},investigationRounds:1,affordable:true,newInstitutions:0,dueYear:31,annualSourceAdded:zero,annualSourceChange:scale(delta),coverage:{current:.55*maintenance,ifFulfilled:.55*maintenance},requiredEvidence:[{title:'听取原学徒的承接条件',local:true,rounds:1}],conditions:['原点须仍运转且未授权。'],workload:{mode:legacy?'authorize-only':'reassign',version:legacy?null:'training-workload-v1',maintenance,before:original,after:legacy?original:reassigned,delta,scaledBefore:scale(original),scaledAfter:scale(legacy?original:reassigned),scaledDelta:scale(delta)}},
  {actionId:'train_network',title:'培育轮值维护者',cost:{economy:4,science:2},investigationRounds:0,affordable:true,newInstitutions:1,dueYear:31,annualSourceAdded:school,annualSourceChange:school,coverage:{current:.55*maintenance,ifFulfilled:.55},requiredEvidence:[],conditions:['新学校承接，不补签原学徒。']}
 ]};
}

test('native compact summary leads with the real tradeoff, not duplicate costs or forecasts',()=>{
 const html=render(fixture()),summary=html.match(/^<details[^>]*><summary[^>]*>(.*?)<\/summary>/s)[1];
 assert.match(summary,/增协调、减带教/);assert.doesNotMatch(summary,/政治3|经济4|第40年|最优/);
 assert.doesNotMatch(html,/<details[^>]*\sopen(?:\s|>)/);assert.equal((html.match(/data-training-choice="/g)||[]).length,2);
 assert.match(html,/data-training-choice-comparison/);assert.match(html,/data-training-choice-detail/);
 assert.doesNotMatch(html,/<button|<input|data-action=|tabindex=/);
});

test('science reduction, non-refund and last action slot all precede the detailed disclosure',()=>{
 const main=render(fixture()).split('<details class="training-choice-detail"')[0];
 assert.match(main,/data-training-source="authorize_training:science">−0.6<\/td>/);
 assert.match(main,/科学来源减少0.6/);assert.match(main,/费用不退/);assert.match(main,/最后一次介入/);assert.match(main,/各占本角色1个名额/);
 assert.match(main,/年度来源不是未来通道净增/);assert.match(main,/不是第40年预测/);
 assert.match(main,/若第31年兑现/);assert.match(main,/相对现在/);assert.match(main,/当前维护/);
 assert.doesNotMatch(main,/\+-|\+−|工时|总收益守恒/);
});

test('paired source rows keep signed values for both options adjacent and semantically labelled',()=>{
 const html=render(fixture()),rows=[...html.matchAll(/<tr><th scope="row">([^<]+)<\/th>(.*?)<\/tr>/g)];
 assert.equal(rows.length,4);assert.deepEqual(rows.map(row=>row[1]),['政治','经济','科学','宗教']);
 for(const row of rows){assert.match(row[2],/authorize_training:/);assert.match(row[2],/train_network:/);}
 assert.match(rows[2][2],/−0.6/);assert.match(rows[2][2],/\+0.65/);assert.match(rows[3][2],/不变/);
});

test('old authorization explicitly preserves the existing source rather than adding a new tradeoff',()=>{
 const html=render(fixture({legacy:true}));
 assert.match(html,/data-training-workload-mode="authorize-only"/);assert.match(html,/沿用原授权规则/);assert.match(html,/原点来源不变/);
 assert.match(html,/旧规则授权只补承接权，不重排原点年度来源/);
 assert.doesNotMatch(html,/科学来源减少|增协调、减带教|−0.6/);
 for(const key of Object.keys(original))assert.match(html,new RegExp(`data-training-source="authorize_training:${key}">不变</td>`));
});

test('current maintenance scales the source change, not the new school or historic channel values',()=>{
 const html=render(fixture({maintenance:.5}));
 assert.match(html,/data-training-source="authorize_training:science">−0.3<\/td>/);
 assert.match(html,/data-training-source="train_network:science">\+0.65<\/td>/);
 assert.match(html,/原培训点：当前 → 若授权兑现/);assert.match(html,/<dt>科学<\/dt><dd>0.35 → 0.05<\/dd>/);
 assert.match(html,/当前维护系数：0.5/);assert.match(html,/不是当地通道值/);
});

test('rendering remains deterministic, read-only and safely escapes supplied prose',()=>{
 const view=fixture(),before=JSON.stringify(view),first=render(view);assert.equal(render(view),first);assert.equal(JSON.stringify(view),before);
 view.title='<img src=x onerror=boom>';view.options[0].conditions=['<script>bad</script>'];view.conditional.shareMissing=['<b>missing</b>'];
 const html=render(view);assert.doesNotMatch(html,/<img|<script|<b>/);assert.match(html,/&lt;script&gt;/);
 assert.equal(render(null),'');assert.equal(render({readOnly:true,options:[]}),'');
});


test('protagonist sees the mutually exclusive policy cost in the main layer',()=>{
 const view=fixture();view.actorId='protagonist';const html=render(view),main=html.split('<details class="training-choice-detail"')[0];
 assert.match(main,/主角选其一，就不能同时签署本轮交班方针/);assert.doesNotMatch(main,/方针仍须另行安排/);
 assert.doesNotMatch(render(fixture()),/data-training-policy-conflict/);
});

test('source scaling scope distinguishes current original maintenance and full new-school maintenance',()=>{
 const html=render(fixture({maintenance:.5}));
 assert.match(html,/原学徒按当前维护；新校按足额维护1/);
 assert.match(html,/新培训不改变原点；新校按足额维护1列来源/);
});
