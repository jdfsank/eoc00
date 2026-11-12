import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const between=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const render=between('function contractFields(', 'function draftChoiceComparison');
const context=vm.createContext({esc:String,costText:()=> '原成本',chanceText:()=> '原发生时间',actionClaim:(a,f)=>a[f],state:{},getLocalCostLedger:()=>({}),renderLocalCostLedger:()=>'<section data-local-cost-ledger>原当地账页</section>'});
vm.runInContext(render,context);
test('core has exactly four original fields, complete and unfolded, without support dossiers',()=>{
 const html=context.contractFields({reward:'原收益',risk:'原风险',modelNote:'原模型'},{cellId:'E4'});
 assert.deepEqual([...html.matchAll(/<dt>(.*?)<\/dt>/g)].map(m=>m[1]),['提交成本与名额','结果与发生时间','值得争取的结果','风险、代价与维护']);
 for(const text of ['原成本；本窗口 1 次介入','原发生时间','原收益','原风险'])assert.equal(html.split(text).length,2);
 assert.ok(html.includes('data-contract-material-risk'));assert.ok(!/details|原模型|原当地账页/.test(html));
});
test('support retains exact original model caveat without making empty definition lists',()=>{
 assert.equal(context.contractSources({},{}),'<section data-local-cost-ledger>原当地账页</section>');
 const a={modelNote:'原模型'};assert.ok(context.contractSources(a,{}).includes('原模型 参数可调，尚未经过真人平衡验证。'));
 assert.equal(context.contractSources(a,{},{includeModel:false}),'<section data-local-cost-ledger>原当地账页</section>');
});
test('preview and confirmation put core before comparison, duties, evidence and accounts in source/DOM order',()=>{
 const choice=between('function choice(', 'function investigationComparisonPanel');
 const core=choice.indexOf('${contractFields(a,options)}');assert.ok(core>0);
 for(const support of ['${draftChoiceComparison()}', '${renderPlanningOpportunity(', '${renderRoleReadingChoice(', '${confirm&&preview.canLock&&research?', '${contractSources('])assert.ok(choice.indexOf(support)>core,support);
 assert.equal(choice.split('${contractFields(').length,2);
 assert.ok(choice.includes('includeModel:!confirm||!technicalModel'));
 assert.ok(choice.includes('data-confirm-contract-details'));assert.ok(choice.includes("${confirm&&building?buildingResponsibility(a,options):''}"));
});
test('browser chain preserves eighty original suites and appends only priority suite',()=>{
 const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url)));
 const entries=pkg.scripts['test:browser'].split(' && ');assert.equal(entries.length,81);
 assert.equal(entries.at(-2),'node scripts/round47-window-readiness-test.mjs');assert.equal(entries.at(-1),'node scripts/round48-contract-priority-test.mjs');
});
