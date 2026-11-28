import {importAndWaitForSave} from './helpers/import-receipt.mjs';
import {chromium} from 'playwright';
import binary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as old from '../tests/fixtures/pre-training-workload-producer/simulation.js';
import {lock,next} from '../tests/fixtures/pre-training-workload-scenarios.js';
import {getWindowReadinessContext} from '../src/window-readiness-context.js';
const out=process.env.AW_OUTPUT||'playtest-output/round47-window-readiness';
await fs.mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),json=JSON.stringify;
const report={scope:'Read-only submission-blocker routing. Public-API current and genuine old producer routes; low-local-balance boundary is explicitly synthetic, not a naturally played or historical save.',checks:[],screenshots:[],metrics:[],errors:[],fixtures:[]};
async function hashInputs(){const rows=[];async function walk(p){for(const e of(await fs.readdir(p,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const f=`${p}/${e.name}`;if(e.isDirectory())await walk(f);else rows.push([f,sha(await fs.readFile(f))]);}}for(const p of ['src','tests','scripts'])await walk(p);return sha(json(rows));}
report.inputsBefore=await hashInputs();report.scriptBefore=sha(await fs.readFile(new URL(import.meta.url)));
const check=(name,ok,detail)=>{report.checks.push({name,passed:!!ok,...(detail===undefined?{}:{detail})});assert.ok(ok,name);};
function two(api){const s=api.createRun(12);lock(s,'protagonist','D4','build_joint',api);next(s,api);lock(s,'protagonist','D4','recruit_successor',api);next(s,api);return s;}
function fixture(api,kind){const s=kind==='opening'?api.createRun(12):two(api);if(['missing','conflict'].includes(kind))lock(s,'protagonist','D4','free_warning',api);if(kind==='conflict')lock(s,'linche','D4','present_archive',api);return s;}
let server,browser,page;
try{
 server=await createServer({server:{host:'127.0.0.1',port:4847,strictPort:true}});await server.listen();
 browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});page=await browser.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.errors.push(r.url()));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('http://127.0.0.1:4847');await page.locator('.selection-card').waitFor();
 const click=a=>page.locator(`[data-action="${a}"]`).first().click();
 async function exact(s,label){const actual=await page.evaluate(()=>({world:JSON.stringify(window.afterwave.state),save:JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state)}));check(label+' exact world and autosave',actual.world===json(s)&&actual.save===json(s));}
 async function load(s,big,label){await click('settings');await importAndWaitForSave(page,{name:label+'.json',mimeType:'application/json',buffer:Buffer.from(json({state:s,ui:{bigText:big}}))},{state:s,bigText:big});await exact(s,label+' import');await click('window');}
 async function inspect(s,big,label){
  const r=sim.getWindowReview(s),v=getWindowReadinessContext(s,r),panel=page.locator('[data-window-readiness]');
  check(label+' exact authoritative issue prose once',json(await panel.locator(':scope > ul > li').allTextContents())===json(r.issues)&&await page.locator('.commit-issues').count()===1);
  check(label+' exact independently derived destinations',json(await panel.locator('[data-action="review-jump"]').evaluateAll(es=>es.map(e=>e.dataset.target)))===json(v.routes.flatMap(r=>r.links.map(l=>l.target))));
  check(label+' pending costs and player agency visible',(await panel.innerText()).includes('成本还未支付')&&(await panel.innerText()).includes('保留哪份安排，仍由你决定'));
  check(label+' authoritative submit remains disabled',await page.locator('[data-action="commit"]').isDisabled());
  const m=await panel.evaluate(e=>{const r=e.getBoundingClientRect(),task=document.querySelector('.task-card');return {width:innerWidth,scroll:document.documentElement.scrollWidth,font:getComputedStyle(document.documentElement).fontSize,top:r.top+scrollY,height:r.height,taskTop:task.getBoundingClientRect().top+scrollY,beforeTasks:!!(e.compareDocumentPosition(task)&Node.DOCUMENT_POSITION_FOLLOWING),overflow:[e,...e.querySelectorAll('*')].filter(n=>{const q=n.getBoundingClientRect();return q.width&&(q.left<-.6||q.right>innerWidth+.6);}).map(n=>n.className),clipped:[e,...e.querySelectorAll('p,h2,h3,li')].filter(n=>{const c=getComputedStyle(n);return ['hidden','clip'].includes(c.overflowY)&&n.scrollHeight>n.clientHeight+1;}).map(n=>n.className)};});
  report.metrics.push({label,...m});check(label+' blocker precedes long task ledger',m.beforeTasks&&m.top<m.taskTop);check(label+' native font, no horizontal overflow or clipped prose',m.font===(big?'32px':'16px')&&m.scroll<=m.width&&!m.overflow.length&&!m.clipped.length,m);
  const targets=[...new Set(v.routes.flatMap(r=>r.links.map(l=>l.target)))];
  for(const target of targets){const link=page.locator(`[data-action="review-jump"][data-target="${target}"]`).first();await link.scrollIntoViewIfNeeded();await link.focus();await page.keyboard.press('Enter');const focus=await page.locator(`[data-review-target="${target}"]`).evaluate(e=>{const r=e.getBoundingClientRect();return {active:document.activeElement===e,top:r.top,bottom:r.bottom,height:innerHeight,outline:getComputedStyle(e).outlineStyle};});check(label+' '+target+' keyboard focus visibly reaches exact heading',focus.active&&focus.top>=0&&focus.top<focus.height&&focus.outline!=='none',focus);await exact(s,label+' '+target+' navigation');await link.dblclick();await exact(s,label+' '+target+' repeated pointer');check(label+' '+target+' repeated pointer stays on review and intended heading',await page.evaluate(target=>window.afterwave.ui.screen==='window'&&document.activeElement?.dataset.reviewTarget===target,target));}
 }
 async function shot(label){const path=`${out}/${label}.png`;await page.locator('[data-window-readiness]').screenshot({path});report.screenshots.push({path,sha256:sha(await fs.readFile(path)),kind:'original Chromium element screenshot'});}
 for(const [producer,api] of [['current',sim],['old',old]])for(const width of [320,390,1280])for(const big of [false,true])for(const kind of ['opening','missing','conflict']){
  const label=`${producer}-${width}-${big?200:100}-${kind}`;await page.setViewportSize({width,height:width===320?568:900});const s=fixture(api,kind);await load(s,big,label);await inspect(s,big,label);if(kind==='conflict'||width===320&&big)await shot(label);
  if(kind==='conflict'){const expected=sim.getWindowReview(s);for(const task of expected.tasks){const card=page.locator(`[data-task-actor="${task.d.actorId}"]`);check(label+' '+task.d.actorId+' original contract and risk retained',(await card.innerText()).includes(task.a.title)&&(await card.innerText()).includes(task.a.risk));}}
 }
 // True no-blocker states: warnings remain risks, not errors or compulsory choices.
 for(const [producer,api] of [['current',sim],['old',old]])for(const kind of ['all-pass','mixed','duplicate-warning']){
  const s=two(api);if(kind==='all-pass'){api.passTask(s,'protagonist');api.passTask(s,'linche');}if(kind==='mixed'){lock(s,'protagonist','B4','local_veto',api);api.passTask(s,'linche');}if(kind==='duplicate-warning'){lock(s,'protagonist','B4','local_veto',api);lock(s,'linche','F6','local_veto',api);}
  await load(s,false,producer+'-'+kind);check(producer+' '+kind+' valid choice stays enabled without blocker strip',await page.locator('[data-window-readiness]').count()===0&&await page.locator('[data-action="commit"]').isEnabled());const warnings=sim.getWindowReview(s).warnings;for(const text of warnings)check(producer+' '+kind+' original warning retained',(await page.locator('.commit-warnings').innerText()).includes(text));await exact(s,producer+' '+kind+' read');
 }
 // Explicit low-balance boundary import, NOT a producer-natural gameplay claim.
 const low=fixture(sim,'conflict');low.cells.find(c=>c.id==='D4').channels.economy=2;check('synthetic low-balance boundary is valid save data',sim.validateState(low).valid);report.fixtures.push({name:'low-balance-import',origin:'Current producer natural conflict, then D4 economy explicitly set to 2 only to exercise valid imported low-balance boundary. Not a naturally reached route.'});
 await page.setViewportSize({width:320,height:568});await load(low,true,'synthetic-low-balance');await inspect(low,true,'synthetic-low-balance');check('cost boundary has both local cost and conflicting actor routes',await page.locator('[data-readiness-kind="cost"] [data-target="cost:D4"]').count()===1&&await page.locator('[data-readiness-kind="conflict"] button').count()===2);await shot('synthetic-low-balance-320-200');await page.reload();await page.locator('[data-window-readiness]').waitFor();await exact(low,'low-balance refresh');await inspect(low,true,'low-balance-refresh');
 // Resolve a naturally produced conflict through actual existing controls.
 const s=fixture(sim,'conflict');await page.setViewportSize({width:390,height:844});await load(s,false,'natural-resolution');await page.locator('[data-action="review-jump"][data-target="actor:linche"]').click();await page.locator('[data-action="edit-draft"][data-actor="linche"]').click();await exact(s,'existing edit opens without replacing');await click('draft-edit-return');await exact(s,'existing edit return keeps both drafts');await page.locator('[data-action="review-jump"][data-target="actor:linche"]').click();await page.locator('[data-action="edit-draft"][data-actor="linche"]').click();await click('home');await click('list');await page.locator('[data-action="select"][data-cell="F6"]').click();await page.locator('[data-primary-action]').click();await page.locator('[data-action="choose"][data-id="local_veto"]').click();await click('confirm');await click('lock');sim.lockTask(s,'linche','F6','local_veto',[]);const expected=JSON.stringify(s);
 const receipt=await page.evaluate(expected=>{const a=window.afterwave,raw=localStorage.getItem('afterwave.save.v1'),disk=raw&&JSON.parse(raw);return {live:JSON.stringify(a.state)===expected&&a.ui.screen==='window',durable:!!disk&&JSON.stringify(disk.state)===expected&&disk.ui.screen==='window',pending:a.storage.pending,error:a.storage.lastError,conflicted:a.storage.conflicted};},expected);
 check('explicit relock matches exact live state and review before storage settles',receipt.live&&!receipt.error&&!receipt.conflicted&&(receipt.durable||receipt.pending>0),receipt);
 await page.waitForFunction(expected=>{const a=window.afterwave,raw=localStorage.getItem('afterwave.save.v1');if(!raw||a.storage.pending||a.storage.lastError||a.storage.conflicted)return false;const disk=JSON.parse(raw);return JSON.stringify(disk.state)===expected&&disk.ui.screen==='window';},expected);
 await exact(s,'explicit relock replaces only selected actor');check('real changed assignment resolves collision without discarding other task',await page.locator('[data-window-readiness]').count()===0&&await page.locator('[data-action="commit"]').isEnabled()&&s.drafts.protagonist.actionId==='free_warning');
 await page.reload();await page.locator('[data-decision-stage="window"]').waitFor();await exact(s,'resolved review refresh');check('resolved refresh keeps no stale targets',await page.locator('[data-action="review-jump"]').count()===0);
 await load(sim.createRun(0),false,'new-world-import');check('new import cannot retain old actor or cost routes',json(await page.locator('[data-action="review-jump"]').evaluateAll(es=>es.map(e=>e.dataset.target)))===json(['actor:protagonist']));
 check('no page or network errors',report.errors.length===0,report.errors);
}catch(e){report.failure=String(e.stack||e);throw e;}finally{
 if(browser)await browser.close();if(server)await server.close();report.inputsAfter=await hashInputs();report.scriptAfter=sha(await fs.readFile(new URL(import.meta.url)));report.checks.push({name:'source, tests and scripts unchanged during run',passed:report.inputsBefore===report.inputsAfter&&report.scriptBefore===report.scriptAfter});if(report.inputsBefore!==report.inputsAfter)report.failure='Inputs changed during run';report.finishedAt=new Date().toISOString();await fs.writeFile(`${out}/report.json`,json(report,null,2));console.log(json({checks:report.checks.length,passed:report.checks.filter(c=>c.passed).length,failure:report.failure||null}));assert.equal(report.failure,undefined);
}
