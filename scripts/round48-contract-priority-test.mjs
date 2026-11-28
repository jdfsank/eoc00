import {chromium} from 'playwright';
import binary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as old from '../tests/fixtures/pre-training-workload-producer/simulation.js';
import {ready,lock} from '../tests/fixtures/pre-training-workload-scenarios.js';
import {getBuildingContract} from '../src/building-contract.js';
const out=process.env.AW_OUTPUT||'playtest-output/round48-contract-priority';
await fs.mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),json=JSON.stringify;
const report={scope:'Semantic core contract priority and unchanged source dossiers, confirmation and reversible reading. Public-API current and genuine old producer saves. No universal balance, human or physical-device certification.',checks:[],screenshots:[],metrics:[],errors:[]};
async function hashInputs(){const rows=[];async function walk(p){for(const e of(await fs.readdir(p,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const f=`${p}/${e.name}`;if(e.isDirectory())await walk(f);else rows.push([f,sha(await fs.readFile(f))]);}}for(const p of ['src','tests','scripts'])await walk(p);return sha(json(rows));}
report.inputsBefore=await hashInputs();report.scriptBefore=sha(await fs.readFile(new URL(import.meta.url)));
const check=(name,ok,detail)=>{report.checks.push({name,passed:!!ok,...(detail===undefined?{}:{detail})});assert.ok(ok,name);};
let server,browser,page;
try{
 server=await createServer({server:{host:'127.0.0.1',port:4848,strictPort:true}});await server.listen();
 browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});page=await browser.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.errors.push(r.url()));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('http://127.0.0.1:4848');await page.locator('.selection-card').waitFor();
 const click=a=>page.locator(`[data-action="${a}"]`).first().click();
 async function exact(s,label){const actual=await page.evaluate(()=>({world:JSON.stringify(window.afterwave.state),save:JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state)}));check(label+' exact world and autosave',actual.world===json(s)&&actual.save===json(s));}
 async function load(s,big,label){await click('settings');await page.locator('#import-save').setInputFiles({name:label+'.json',mimeType:'application/json',buffer:Buffer.from(json({state:s,ui:{bigText:big}}))});await page.locator('.selection-card').waitFor();if(await page.locator('.toast').count())await page.locator('.toast').waitFor({state:'hidden',timeout:6000});await exact(s,label+' import');}
 async function select(cell,actor='protagonist'){await click('home');await page.locator(`[data-action="actor"][data-actor="${actor}"]`).click();await click('list');await page.locator(`[data-action="select"][data-cell="${cell}"]`).click();await page.locator('[data-primary-action]').click();}
 async function preview(id){await select(id.startsWith('build_')?'D4':id==='preserve_records'?'B4':'E4');await page.locator(`[data-action="choose"][data-id="${id}"]`).click();await page.locator('[data-contract-core]').waitFor();}
 async function inspect(loc,big,label){const m=await loc.evaluate(e=>({font:getComputedStyle(document.documentElement).fontSize,width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[e,...e.querySelectorAll('*')].filter(n=>{const r=n.getBoundingClientRect();return r.width&&(r.left<-.6||r.right>innerWidth+.6);}).map(n=>n.className),clipped:[e,...e.querySelectorAll('p,h2,h3,h4')].filter(n=>{const c=getComputedStyle(n);return ['hidden','clip'].includes(c.overflowY)&&n.scrollHeight>n.clientHeight+1;}).map(n=>n.className)}));check(label+' native font, no horizontal overflow or clipped prose',m.font===(big?'32px':'16px')&&m.scroll<=m.width&&!m.overflow.length&&!m.clipped.length,m);}
 async function shot(loc,label){await loc.scrollIntoViewIfNeeded();const path=`${out}/${label}.png`;await loc.screenshot({path});report.screenshots.push({path,sha256:sha(await fs.readFile(path)),kind:'original Chromium element screenshot'});}
 async function destination(actor,cell,screen,label){const u=await page.evaluate(()=>window.afterwave.ui);check(label+' exact destination',u.actor===actor&&u.selected===cell&&u.screen===screen,u);}
 function originalFields(s,a,cell){
  const h=getBuildingContract(s,a.id,{cellId:cell,actorId:'protagonist'}),names={politics:'政治',economy:'经济',science:'科学',religion:'宗教'};
  const cost=Object.entries(a.cost||{}).filter(([,v])=>v).map(([k,v])=>`${names[k]||k} −${Math.abs(v)}`).join(' · ')||'无通道即时成本';
  const time=a.conditional?`第 ${s.year+(a.dueIn||0)} 年核对条件，原培训点失效、被替换或已获授权则取消`:a.probability!=null&&a.probability<1?`${Math.round(a.probability*100)}% · 第 ${s.year+(a.dueIn||0)} 年一次性判定`:`第 ${s.year+(a.dueIn||0)} 年生效`;
  return [['提交成本与名额',`${cost}；本窗口 1 次介入`],['结果与发生时间',time],['值得争取的结果',h?.displayReward||a.reward||a.description],['风险、代价与维护',h?.displayRisk||a.risk||'将占用当前棋子的十年机会，其他地点需要等待。']];
 }
 async function priority(s,a,cell,big,label){
  const core=page.locator('[data-contract-core]');
  check(label+' exactly one complete original core',await core.count()===1&&json(await core.locator(':scope > div').evaluateAll(es=>es.map(e=>[e.querySelector('dt').textContent,e.querySelector('dd').textContent])))===json(originalFields(s,a,cell)));
  const m=await core.evaluate(e=>{const box=n=>{const r=n.getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY};};const supports=[...document.querySelectorAll('[data-draft-choice-comparison],[data-planning-opportunity],[data-role-choice],[data-contract-research],[data-local-cost-ledger]')];return {core:box(e),rows:[...e.children].map(n=>({label:n.querySelector('dt').textContent,...box(n),visible:!!n.getClientRects().length&&!n.closest('details:not([open])')})),supports:supports.map(n=>({kind:n.className,...box(n),follows:!!(e.compareDocumentPosition(n)&Node.DOCUMENT_POSITION_FOLLOWING)}))};});
  report.metrics.push({label,...m});check(label+' all original terms visible before every supporting dossier in DOM and pixels',m.rows.length===4&&m.rows.every(r=>r.visible)&&m.supports.length>0&&m.supports.every(r=>r.follows&&r.top>=m.core.bottom),m);
  await inspect(page.locator('.decision-page'),big,label);await exact(s,label);
  check(label+' one separate local cost ledger retained',await page.locator('[data-local-cost-ledger]').count()===1);
  if(!a.modelNote)check(label+' no absent model fabricated',await page.locator('.contract-model').count()===0);
  const confirm=await page.locator('[data-decision-stage="confirm"]').count();
  if(a.modelNote){const details=page.locator('[data-confirm-contract-details]');if(confirm&&['build_joint','authorize_training'].includes(a.id)){check(label+' technical detail remains originally collapsed',await details.count()===1&&!await details.evaluate(e=>e.open));await details.locator(':scope > summary').click();check(label+' original technical explanation accessible',(await details.innerText()).includes(a.modelNote));await details.locator(':scope > summary').click();}else check(label+' original model note and caveat visible once',(await page.locator('.contract-model').innerText()).includes(a.modelNote+' 参数可调，尚未经过真人平衡验证。'));}
  if(confirm&&a.id==='build_joint')check(label+' building material failure stays outside details',await page.locator('.building-responsibility').evaluate(e=>!e.closest('details')&&e.innerText.includes('成本不退')&&e.innerText.includes('第16年')));
 }
 async function refresh(stage,s,label){const selector=`[data-decision-stage="${stage}"]`;
 await page.locator(selector).waitFor();
 const route=await page.evaluate(()=>{const u=afterwave.ui;return [u.screen,u.selected,u.actor,u.choice,u.bigText]});
 await page.waitForFunction(route=>{const raw=localStorage.getItem('afterwave.save.v1'),u=raw&&JSON.parse(raw).ui;return !afterwave.storage.pending&&!afterwave.storage.lastError&&!afterwave.storage.conflicted&&u&&JSON.stringify([u.screen,u.selected,u.actor,u.choice,u.bigText])===JSON.stringify(route)},route);
 await page.reload();await page.locator(`[data-decision-stage="${stage}"]`).waitFor();await exact(s,label+' refresh');}
 for(const [producer,api] of [['current',sim],['old',old]])for(const width of [320,390,1280])for(const big of [false,true])for(const id of ['authorize_training','train_network','build_joint','preserve_records']){
  const label=`${producer}-${width}-${big?200:100}-${id}`,cell=id==='build_joint'?'D4':id==='preserve_records'?'B4':'E4';await page.setViewportSize({width,height:width===320?568:900});
  const s=['build_joint','preserve_records'].includes(id)?api.createRun(0):ready(api),a=sim.getActions(s,cell,'protagonist').find(a=>a.id===id);
  for(const e of a.requireEvidence)if(!api.getInvestigation(s,'protagonist',cell).evidence.includes(e))api.investigate(s,'protagonist',cell,e);
  await load(s,big,label);await preview(id);await priority(s,a,cell,big,label+' preview');
  if(id==='authorize_training'||id==='build_joint'&&width===390)await shot(page.locator('[data-contract-core]'),label+'-core');
  await refresh('preview',s,label);await priority(s,a,cell,big,label+' refreshed preview');
  const go=page.locator('[data-action="confirm"]');await go.scrollIntoViewIfNeeded();await page.keyboard.press('Tab');await go.focus();check(label+' continue has visible keyboard focus',await go.evaluate(e=>e===document.activeElement&&getComputedStyle(e).outlineStyle!=='none'));await page.keyboard.press('Enter');await page.locator('[data-decision-stage="confirm"]').waitFor();
  await priority(s,a,cell,big,label+' confirm');await refresh('confirm',s,label);await priority(s,a,cell,big,label+' refreshed confirm');
  await page.locator('[data-action="choose"]').first().dblclick();check(label+' double back remains preview with original heading focus',await page.evaluate(()=>window.afterwave.ui.screen==='choice'&&document.activeElement===document.querySelector('main h1')));await page.locator('[data-decision-stage="preview"]').waitFor();await priority(s,a,cell,big,label+' back');
  await page.locator('[data-resume-contract]').click();check(label+' source returns to exact contract with visible keyboard focus',await page.locator(`.choice-card[data-id="${id}"]`).evaluate(e=>{const r=e.querySelector('.choice-title').getBoundingClientRect();return e===document.activeElement&&r.top>=-.5&&r.top<innerHeight;}));await exact(s,label+' source return');
  await page.keyboard.press('Enter');await priority(s,a,cell,big,label+' source re-entry');
  if(id==='authorize_training'){await page.locator('[data-action="opportunity-route"][data-id="companion"]').dblclick();await exact(s,label+' repeated source read');await page.locator('[data-action="opportunity-return"]').dblclick();await priority(s,a,cell,big,label+' repeated source return');}
 }
 // Real existing draft editing: even the long before/after comparison follows the new core.
 const edit=ready(sim);lock(edit,'protagonist','E4','train_network',sim);sim.investigate(edit,'protagonist','E4','resident_testimony');await page.setViewportSize({width:320,height:568});await load(edit,true,'draft-comparison');await click('window');await page.locator('[data-action="edit-draft"][data-actor="protagonist"]').click();await page.locator('[data-action="choose"][data-id="authorize_training"]').click();const action=sim.getActions(edit,'E4','protagonist').find(a=>a.id==='authorize_training');await priority(edit,action,'E4',true,'draft-comparison');check('draft comparison still present',await page.locator('[data-draft-choice-comparison]').count()===1);await click('draft-edit-return');await exact(edit,'cancel comparison');
 check('no page or network errors',report.errors.length===0,report.errors);
}catch(e){report.failure=String(e.stack||e);throw e;}finally{
 if(browser)await browser.close();if(server)await server.close();report.inputsAfter=await hashInputs();report.scriptAfter=sha(await fs.readFile(new URL(import.meta.url)));report.checks.push({name:'all source, tests and scripts unchanged during run',passed:report.inputsBefore===report.inputsAfter&&report.scriptBefore===report.scriptAfter});if(report.inputsBefore!==report.inputsAfter)report.failure='Inputs changed during run';report.finishedAt=new Date().toISOString();await fs.writeFile(`${out}/report.json`,json(report,null,2));console.log(json({checks:report.checks.length,passed:report.checks.filter(c=>c.passed).length,failure:report.failure||null}));assert.equal(report.failure,undefined);
}
