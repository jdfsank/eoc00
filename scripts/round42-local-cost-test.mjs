// NEW validation authored after executor recovery. This is not historical evidence.
// Public controls and genuine producer saves; no injected world or DOM state.
import {chromium} from 'playwright';
import binary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as previous from '../tests/fixtures/pre-decision-flow-producer/simulation.js';
import * as legacy from '../tests/fixtures/legacy-simulation.js';
import {routes,lock} from '../tests/fixtures/round24-investigation-routes.js';
import {getBuildingContract} from '../src/building-contract.js';
import {createUi} from '../src/save.js';
import {getLocalCostLedger} from '../src/local-cost-ledger.js';
const out=process.env.AW_OUTPUT||'playtest-output/round42-local-cost';
await fs.mkdir(out,{recursive:true});
const report={startedAt:new Date().toISOString(),scope:'New post-recovery validation. Public local contract balances, retained drafts, exact world/autosave, genuine previous and original producers. 320/390/1280 with native 100/200% fonts. No historical pass counts reused.',checks:[],screenshots:[],metrics:[],errors:[]};
const json=JSON.stringify,sha=b=>createHash('sha256').update(b).digest('hex');
function check(name,passed,detail){report.checks.push({name,passed:!!passed,...(detail===undefined?{}:{detail})});assert.ok(passed,name);}
async function treeHash(root){const h=createHash('sha256');async function walk(p){for(const e of(await fs.readdir(p,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const f=`${p}/${e.name}`;if(e.isDirectory())await walk(f);else{h.update(f);h.update(await fs.readFile(f));}}}await walk(root);return h.digest('hex');}
report.sourceBefore=await treeHash('src');report.scriptBefore=sha(await fs.readFile(new URL(import.meta.url)));report.testsBefore=await treeHash('tests');
const names={politics:'政治',economy:'经济',science:'科学',religion:'宗教'};
const number=n=>Math.abs(n)<.01&&n!==0?'少于 0.01':Number(Math.abs(n).toFixed(2)).toString();
const first=sim.createRun(0),ready=sim.createRun(0);lock(ready,sim,'protagonist','D4','build_joint');
const retained=routes(sim)[20];lock(retained,sim,'protagonist','D4','relocate_teacher');lock(retained,sim,'linche','D4','free_warning');
const cases=[
 {name:'current-missing',s:first,id:'build_joint',canConfirm:false},
 {name:'current-ready',s:ready,id:'build_joint',canConfirm:true},
 {name:'current-multichannel',s:sim.createRun(0),id:'build_state',canConfirm:true},
 {name:'retained-original',s:retained,id:'relocate_teacher',canConfirm:true},
 {name:'retained-alternative-same-channel',s:retained,id:'free_warning',canConfirm:false},
 {name:'previous-producer',s:routes(previous)[20],id:'relocate_teacher',canConfirm:true},
 {name:'original-legacy',s:routes(legacy)[20],id:'relocate_teacher',canConfirm:true},
];
let server,browser,page;
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
const allowedUi=new Set([...Object.keys(createUi()),'choice','traceId','mapTrace','cellHistory']);
async function exact(s,label){const r=await page.evaluate(()=>({world:JSON.stringify(window.afterwave.state),save:JSON.parse(localStorage.getItem('afterwave.save.v1'))}));check(label+' world exact',r.world===json(s));check(label+' autosaved world exact',json(r.save.state)===json(s));check(label+' no added save fields',json(Object.keys(r.save).sort())===json(['state','ui'])&&Object.keys(r.save.ui).every(k=>allowedUi.has(k)));}
async function imported(s,big,label){await click('settings');await page.locator('#import-save').setInputFiles({name:`${label}.json`,mimeType:'application/json',buffer:Buffer.from(json({state:s,ui:{bigText:big}}))});await page.locator('.selection-card').waitFor();if(await page.locator('.toast').count())await page.locator('.toast').waitFor({state:'hidden',timeout:6000});await exact(s,label+' import');}
async function enter(id){await click('home');await click('list');await page.locator('[data-action="select"][data-cell="D4"]').click();await click('avg');await page.locator(`.choice-card[data-id="${id}"]`).click();await page.locator('[data-decision-stage="preview"]').waitFor();}
async function reload(stage){await page.waitForLoadState('networkidle',{timeout:12000});await page.reload();await page.locator(`[data-decision-stage="${stage}"]`).waitFor();}
function originalFields(s,a){const h=getBuildingContract(s,a.id,{cellId:'D4',actorId:'protagonist',legacyEvidence:s.drafts.protagonist?.evidence||[]});const costs=Object.entries(a.cost).filter(([,v])=>v).map(([k,v])=>`${names[k]} −${Math.abs(v)}`).join(' · ')||'无通道即时成本';assert.ok(!a.conditional,'Test cases deliberately use nonconditional contract times');return [
 ['提交成本与名额',`${costs}；本窗口 1 次介入`],
 ['结果与发生时间',a.probability!=null&&a.probability<1?`${Math.round(a.probability*100)}% · 第 ${s.year+(a.dueIn||0)} 年一次性判定`:`第 ${s.year+(a.dueIn||0)} 年生效`],
 ['值得争取的结果',h?.displayReward||a.reward||a.description],
 ['风险、代价与维护',h?.displayRisk||a.risk||'将占用当前棋子的十年机会，其他地点需要等待。'],
 ];}
async function inspect(s,a,label,big){const fields=await page.locator('.contract > div').evaluateAll(es=>es.slice(0,4).map(e=>[e.querySelector('dt')?.textContent.trim(),e.querySelector('dd')?.textContent.trim()]));check(label+' original four field order/content exact',json(fields)===json(originalFields(s,a)));const scope=page.locator('[data-local-cost-ledger]');check(label+' ledger outside original dl',await scope.evaluate(e=>e.tagName==='SECTION'&&!e.closest('dl')&&document.querySelectorAll('dl.contract').length===1&&document.querySelectorAll('[data-local-cost-ledger]').length===1&&document.querySelector('dl.contract').children.length===4&&!!(document.querySelector('dl.contract').compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING)));const entries=Object.entries(a.cost).filter(([,v])=>v!==0);check(label+' exact charged channel set',json((await page.locator('[data-local-cost-channel]').evaluateAll(es=>es.map(e=>e.dataset.localCostChannel))).sort())===json(entries.map(([k])=>k).sort()));for(const [key,cost]of entries){const local=s.cells.find(c=>c.id==='D4').channels[key],row=page.locator(`[data-local-cost-channel="${key}"]`);check(label+' '+key+' public local arithmetic',json(await row.locator('b').allTextContents())===json([number(local),number(cost),number(local-cost)]));check(label+' '+key+' real shortfall flag',await row.getAttribute('data-local-cost-shortfall')===String(local<cost));}const text=await scope.innerText();check(label+' unpaid/local/single-contract scope explicit',['D4','由当地承担','其他地点的通道不能代付','尚未支付','未合并同地其他草稿','未计算年度演化'].every(t=>text.includes(t)));const m=await page.evaluate(()=>({font:getComputedStyle(document.documentElement).fontSize,width:innerWidth,scroll:document.documentElement.scrollWidth}));report.metrics.push({label,...m});check(label+' native font and no horizontal overflow',m.font===(big?'32px':'16px')&&m.scroll<=m.width);await exact(s,label);return text;}
async function shot(label){await page.locator('[data-local-cost-ledger]').scrollIntoViewIfNeeded();const path=`${out}/${label}.png`;await page.screenshot({path});const b=await fs.readFile(path);report.screenshots.push({path,sha256:sha(b),width:b.readUInt32BE(16),height:b.readUInt32BE(20),kind:'original Chromium viewport'});}
try{
 server=await createServer({server:{host:'127.0.0.1',port:4842,strictPort:true}});await server.listen();browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});page=await browser.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.errors.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)report.errors.push({url:r.url(),status:r.status()});});page.on('console',m=>{if(/\[vite\].*(hot updated|page reload)/.test(m.text()))report.errors.push(m.text());});
 await page.goto('http://127.0.0.1:4842');await page.locator('.selection-card').waitFor();
 for(const [width,height]of [[320,568],[390,844],[1280,900]])for(const big of [false,true])for(const c of cases){const label=`${c.name}-${width}-${big?200:100}`;await page.setViewportSize({width,height});await imported(c.s,big,label);await enter(c.id);const evidence=sim.usesTradeoffs(c.s)?sim.getInvestigation(c.s,'protagonist','D4').evidence:[];const a=sim.getActions(c.s,'D4','protagonist',evidence).find(a=>a.id===c.id);check(label+' public contract available',!!a);const text=await inspect(c.s,a,label+' preview',big);check(label+' original evidence gate',await page.locator('[data-action="confirm"]').isEnabled()===c.canConfirm);await reload('preview');check(label+' reload ledger stable',await inspect(c.s,a,label+' reload',big)===text);if(c.canConfirm){await click('confirm');await page.locator('[data-decision-stage="confirm"]').waitFor();check(label+' confirm ledger stable',await inspect(c.s,a,label+' confirm',big)===text);await reload('confirm');await inspect(c.s,a,label+' confirm reload',big);}else check(label+' missing evidence remains blocked after reload',await page.locator('[data-action="confirm"]').isDisabled());if(['current-ready','original-legacy'].includes(c.name))await shot(label);check(label+' no page/network/hot-update errors',report.errors.length===0,report.errors);}
 // Additional breadth is from real public producers, not made-up game worlds.
 let natural=0,multi=0;
 for(const api of [sim,previous,legacy])for(const seed of [0,3,6])for(const s of Object.values(routes(api,seed)))for(const actor of sim.getActors(s))for(const cell of s.cells)for(const action of sim.getActions(s,cell.id,actor.id)){const before=json([s,action]),v=getLocalCostLedger(s,cell.id,action),keys=Object.entries(action.cost).filter(([,v])=>v);check(`natural ${natural} independent local values`,!!v&&v.rows.length===keys.length&&keys.every(([k,cost])=>v.rows.some(r=>r.key===k&&r.before===cell.channels[k]&&r.cost===cost&&r.after===cell.channels[k]-cost)));check(`natural ${natural} no mutation`,json([s,action])===before);natural++;if(keys.length>1)multi++;}report.naturalContracts=natural;report.multiChannelContracts=multi;
 check('no page/network/hot-update errors',report.errors.length===0,report.errors);
}catch(e){report.failure=String(e.stack||e);throw e;}finally{
 if(browser)await browser.close();if(server)await server.close();report.sourceAfter=await treeHash('src');report.scriptAfter=sha(await fs.readFile(new URL(import.meta.url)));report.testsAfter=await treeHash('tests');report.finishedAt=new Date().toISOString();for(const[k,a,b]of [['source',report.sourceBefore,report.sourceAfter],['script',report.scriptBefore,report.scriptAfter],['original tests',report.testsBefore,report.testsAfter]]){report.checks.push({name:k+' hash stable',passed:a===b});if(a!==b)report.failure=(report.failure||'')+`\n${k} changed during validation`;}await fs.writeFile(`${out}/report.json`,json(report,null,2));console.log(json({checks:report.checks.length,passed:report.checks.filter(c=>c.passed).length,naturalContracts:report.naturalContracts,errors:report.errors,failure:report.failure||null}));assert.equal(report.failure,undefined,'Validation failed or inputs changed');
}
