import test from 'node:test';
import assert from 'node:assert/strict';
import {renderInvestigationComparison} from '../src/investigation-comparison-view.js';

function view(overrides={}) {
  const risk={ready:true,guaranteedReview:false,attempts:[{actorId:'protagonist',cellId:'B4',probability:.8,dueYear:22}],vetoBase:1,success:{available:true,damage:0},fallback:{possible:true,damage:.9431,damageByCell:{D4:.7724,B4:1,D5:1,F6:1}},regions:['D4','B4','D5','F6'].map(cellId=>({cellId,currentCoverage:cellId==='D4'?.2:0,coverage:cellId==='D4'?.35:0,protection:0,aid:false}))};
  const option={id:'review',title:'假设：交叉复核',actionId:'independent_review',cost:{science:3,economy:4},dueYear:22,probability:.8,evidence:[{id:'anomaly_records',name:'异常水位记录',acquired:false,cost:2}],investigationCost:2,budgetAfter:1,reachable:true,available:true,ready:true,issues:[],outlook:risk};
  return {hypothetical:true,actorId:'protagonist',actorName:'主角',cellId:'B4',budget:3,title:'调查前条件比较 · 只读假设',retained:[{actorId:'linche',actorName:'林澈',status:'locked',cellId:'D4',title:'居民传讯',actionId:'free_warning'}],issues:[],options:[option],notes:['公开合同，不读取隐藏结果。'],...overrides};
}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}

test('comparison view is explanatory only: hypothetical labels, real retained arrangement, costs and no action handlers',()=>{
  const html=renderInvestigationComparison(view());
  for(const content of ['调查前条件比较 · 只读假设','条件推算，不代替取证','已锁定 D4 · 居民传讯','还需 2 轮 → 调查后余 1 轮','科学 −3 · 经济 −4','复核 80% · 第22年判定一次','0.9431','平均值沿用逐地取整后再平均'])assert.ok(html.includes(content),content);
  assert.doesNotMatch(html, /data-action=|<button|已锁定结果|data-evidence-id=/);
  assert.match(html, /data-branch="success"/);assert.match(html, /data-branch="fallback"/);
});
test('rendering deeply frozen public data does not mutate or demand state/evidence text',()=>{
  const v=freeze(view()),before=JSON.stringify(v);renderInvestigationComparison(v);assert.equal(JSON.stringify(v),before);
  assert.equal(renderInvestigationComparison(null),'');assert.equal(renderInvestigationComparison({hypothetical:false}),'');
});
test('guaranteed review has no impossible failure branch or failure consequences',()=>{
  const v=view();v.options[0].probability=1;v.options[0].outlook.guaranteedReview=true;v.options[0].outlook.fallback.possible=false;
  const html=renderInvestigationComparison(v);assert.match(html,/复核 100%/);assert.match(html,/复核确定完成/);assert.doesNotMatch(html,/data-branch="fallback"|若未及时完成|损失 <strong>/);
});
test('insufficient remaining investigation and unavailable contracts never display whole-round numbers',()=>{
  for(const mode of ['budget','unavailable']){
    const v=view();v.budget=1;const o=v.options[0];o.ready=false;o.outlook=null;o.issues=['仍缺真实条件'];
    if(mode==='budget'){o.reachable=false;o.budgetAfter=-1;}else{o.available=false;o.id='basic_veto';o.actionId='local_veto';o.investigationCost=0;o.evidence=[];}
    const html=renderInvestigationComparison(v);assert.match(html,/整轮数值暂不展示/);assert.match(html,/仍缺真实条件/);assert.doesNotMatch(html,/data-branch=|调查后余 -1/);
    assert.ok(html.includes(mode==='budget'?'现余 1 轮，不足':'本项当前不可采用'));
  }
});
test('missing and passed actors retain their actual status without invented default actions',()=>{
  const v=view({retained:[{actorId:'linche',actorName:'林澈',status:'missing'}]});let html=renderInvestigationComparison(v);assert.match(html,/尚未安排，不视为放弃/);assert.doesNotMatch(html,/已明确放弃本窗口/);
  v.retained[0].status='passed';html=renderInvestigationComparison(v);assert.match(html,/已明确放弃本窗口/);
});
test('each real review attempt stays separate without combined probability',()=>{
  const v=view();v.options[0].outlook.attempts.push({actorId:'linche',cellId:'F6',probability:.55,dueYear:22});
  const html=renderInvestigationComparison(v);assert.match(html,/主角 · B4：各自 80%/);assert.match(html,/林澈 · F6：各自 55%/);assert.match(html,/不合并成一个整轮成功率/);assert.doesNotMatch(html,/91%/);
});
test('renderer escapes all externally supplied presentation labels',()=>{
  const v=view({actorName:'<img src=x onerror=bad>',title:'<script>bad</script>',issues:['<iframe>']});v.options[0].evidence[0].name='<svg onload=bad>';v.retained[0].title='"<button>bad';
  const html=renderInvestigationComparison(v);assert.doesNotMatch(html,/<script|<iframe|<svg|<img|<button/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;svg onload=bad&gt;/);
});
test('shared missing arrangements appear once rather than repeated under every option',()=>{
  const issue='林澈尚未安排';const v=view({issues:[issue]});v.options[0].ready=false;v.options[0].outlook=null;v.options[0].issues=[issue];
  v.options.push({...v.options[0],id:'surveyed_veto'},{...v.options[0],id:'basic_veto'});
  const html=renderInvestigationComparison(v);assert.equal(html.split(issue).length-1,1);assert.equal((html.match(/整轮条件待齐，见上方/g)||[]).length,3);
});
test('unknown public state never prints null budget or invents a free zero-probability contract',()=>{
  const partial=view({budget:null,options:[],issues:['公开资料无法核对']});const html=renderInvestigationComparison(partial);assert.match(html,/暂不列调查余额或整轮数值/);assert.doesNotMatch(html,/null|没有其他可执行角色/);
  const v=view();Object.assign(v.options[0],{available:false,ready:false,probability:null,dueYear:null,cost:{},outlook:null,issues:['行动不可用']});
  const blocked=renderInvestigationComparison(v);assert.match(blocked,/费用未列/);assert.match(blocked,/发生时间与概率未列/);assert.doesNotMatch(blocked,/第null年|复核 0%|无通道即时成本/);
});
test('a veto comparison still discloses a single retained other-actor review probability and deadline',()=>{
  const v=view();const o=v.options[0];Object.assign(o,{id:'basic_veto',actionId:'local_veto',probability:1,dueYear:21,evidence:[],investigationCost:0});
  o.outlook.attempts=[{actorId:'linche',cellId:'F6',probability:.55,dueYear:22}];
  const html=renderInvestigationComparison(v);assert.match(html,/确定 · 第21年生效/);assert.match(html,/林澈 · F6：各自 55%，第22年判定/);assert.match(html,/另一角色已锁定的复核，保留其实际概率与期限/);assert.doesNotMatch(html,/各次复核分别判定/);
});
