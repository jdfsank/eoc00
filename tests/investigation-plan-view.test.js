import test from 'node:test';
import assert from 'node:assert/strict';
import {renderInvestigationBudget,renderActionResearch,renderMaterialSummary,renderMaterialDecision,renderContractResearch} from '../src/investigation-plan-view.js';
const material=(overrides={})=>({id:'anomaly_records',name:'新记录',cost:2,acquired:false,portable:true,canInvestigate:true,budgetAfter:1,requiredBy:['future'],enhances:[],blocksAfter:[],enhancementsLostAfter:[],...overrides});
const action=(overrides={})=>({actionId:'future',title:'未来校验',requiredEvidence:[material(),material({id:'resident_testimony',name:'本地条件',cost:1,portable:false})],missingEvidenceIds:['anomaly_records','resident_testimony'],requiredRounds:3,budgetAfter:0,reachable:true,optionalEnhancements:[],...overrides});
const plan=(overrides={})=>({readOnly:true,actorId:'protagonist',cellId:'B4',budget:3,maxBudget:3,spent:0,actions:[action()],materials:[material()],...overrides});
test('three attention tokens distinguish spent and remaining without claiming testimony or authority',()=>{
 const html=renderInvestigationBudget(plan({spent:1,budget:2}));assert.equal((html.match(/research-token spent/g)||[]).length,1);assert.equal((html.match(/research-token remaining/g)||[]).length,2);assert.match(html,/剩余 2 \/ 3 轮/);assert.doesNotMatch(html,/签署|授权/);
});
test('action reads minimum missing investigation and never labels it submit-ready',()=>{
 const html=renderActionResearch(action({reachable:false,requiredRounds:3,budgetAfter:-1}),2);assert.match(html,/本窗口取证不足/);assert.match(html,/还需 3 轮，现余 2 轮/);assert.match(html,/新记录 · 2轮/);assert.doesNotMatch(html,/可提交|调查后余 -1/);
 assert.match(renderActionResearch(action({requiredEvidence:[],requiredRounds:0,budgetAfter:2}),2),/无需取证/);
});
test('closed packet and acquired sheet are distinct and never reveal an unread body',()=>{
 const unread=renderMaterialSummary(material(),plan()),read=renderMaterialSummary(material({acquired:true}),plan());assert.match(unread,/material-object unread/);assert.match(read,/material-object acquired/);assert.match(read,/已取得/);assert.doesNotMatch(unread,/已取得|已同意/);
});
test('one-reading opportunity loss is explicit only when the planner reports a newly blocked local route',()=>{
 const html=renderMaterialDecision(material({id:'old',cost:1,budgetAfter:2,requiredBy:[],blocksAfter:['future']}),plan(),{prompt:'要先读旧档吗？',destinations:[]});assert.match(html,/本次用 1 轮 → 调查后剩余 2 轮/);assert.match(html,/本窗口无法补齐：未来校验/);
 assert.doesNotMatch(renderMaterialDecision(material({canInvestigate:false,budgetAfter:null,blocksAfter:[]}),plan({budget:1})),/调查后剩余 null|本窗口无法补齐/);
});
test('optional route loss never claims basic veto is lost or an existing draft gets upgraded',()=>{
 const veto=action({actionId:'veto',title:'地方停闸',requiredEvidence:[],requiredRounds:0,optionalEnhancements:[{id:'surveyed_veto',title:'强化停闸',requiredRounds:2,reachable:true,acquired:false}]});
 const p=plan({actions:[veto]}),m=material({requiredBy:[],enhancementsLostAfter:[{actionId:'veto',enhancementId:'surveyed_veto'}]});
 assert.match(renderMaterialDecision(m,p),/基本停闸仍不要求材料/);assert.match(renderActionResearch(veto,3),/不是基本停闸的前置/);veto.optionalEnhancements[0].acquired=true;assert.match(renderActionResearch(veto,1),/重新锁定才采用，原草案不自动增强/);
});
test('material purpose separates background, portability and actual local contract use',()=>{
 assert.match(renderMaterialSummary(material({requiredBy:[],portable:false}),plan()),/了解背景/);
 assert.match(renderMaterialSummary(material({requiredBy:[]}),plan()),/可随本人携带/);
 assert.match(renderMaterialSummary(material(),plan()),/用于：未来校验/);
 assert.match(renderMaterialDecision(material({portable:false}),plan()),/只用于此地，不在别处自动生效/);
});
test('contract exposes every missing-material navigation separately, never investigation or lock controls',()=>{
 const html=renderContractResearch(action({reachable:false}),plan({budget:2}));assert.match(html,/本窗口已无法补齐取证/);assert.match(html,/missing-evidence/);assert.equal((html.match(/data-action="preview-evidence"/g)||[]).length,2);assert.doesNotMatch(html,/data-action="(?:evidence|lock|confirm)"/);
});
test('renderer escapes public labels and prompts and leaves frozen planner data unchanged',()=>{
 const p=plan(),m=material({name:'<img src=x>',blocksAfter:['future']});p.actions[0].title='<script>x</script>';const before=JSON.stringify(p);Object.freeze(p.actions[0]);Object.freeze(p.actions);Object.freeze(p);
 const html=renderMaterialSummary(m,p)+renderMaterialDecision(m,p,{prompt:'<iframe>',destinations:[]});assert.doesNotMatch(html,/<img|<script|<iframe/);assert.match(html,/&lt;img/);assert.match(html,/&lt;iframe/);assert.equal(JSON.stringify(p),before);
});
