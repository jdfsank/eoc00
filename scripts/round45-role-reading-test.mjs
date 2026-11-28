import {importAndWaitForSave} from './helpers/import-receipt.mjs';
import {chromium} from 'playwright';
import binary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as old from '../tests/fixtures/pre-training-workload-producer/simulation.js';
import {ready,lock} from '../tests/fixtures/pre-training-workload-scenarios.js';
import {getRoleReadingChoice} from '../src/role-reading-choice.js';
const out=process.env.AW_OUTPUT||'playtest-output/round45-role-reading';
await fs.mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),json=JSON.stringify;
const report={scope:'Real file imports and UI routing for final-window role opportunity. Public-API current and genuine old producer saves. No universal balance, human or physical-device certification.',checks:[],screenshots:[],errors:[]};
async function hashInputs(){const rows=[];async function walk(p){for(const e of(await fs.readdir(p,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const f=`${p}/${e.name}`;if(e.isDirectory())await walk(f);else rows.push([f,sha(await fs.readFile(f))]);}}for(const p of ['src','tests','scripts'])await walk(p);return sha(json(rows));}
report.inputsBefore=await hashInputs();report.scriptBefore=sha(await fs.readFile(new URL(import.meta.url)));
const check=(name,ok,detail)=>{report.checks.push({name,passed:!!ok,...(detail===undefined?{}:{detail})});assert.ok(ok,name);};
let server,browser,page;
try{
 server=await createServer({server:{host:'127.0.0.1',port:4845,strictPort:true}});await server.listen();
 browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});page=await browser.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.errors.push(r.url()));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('http://127.0.0.1:4845');await page.locator('.selection-card').waitFor();
 const click=a=>page.locator(`[data-action="${a}"]`).first().click();
 async function exact(s,label){const actual=await page.evaluate(()=>({world:JSON.stringify(window.afterwave.state),save:JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state)}));check(label+' exact world and autosave',actual.world===json(s)&&actual.save===json(s));}
 async function load(s,big,label){await click('settings');await importAndWaitForSave(page,{name:label+'.json',mimeType:'application/json',buffer:Buffer.from(json({state:s,ui:{bigText:big}}))},{state:s,bigText:big});await exact(s,label+' import');}
 async function select(cell,actor='protagonist'){await click('home');await page.locator(`[data-action="actor"][data-actor="${actor}"]`).click();await click('list');await page.locator(`[data-action="select"][data-cell="${cell}"]`).click();await page.locator('[data-primary-action]').click();}
 async function preview(id){await select('E4');await page.locator(`[data-action="choose"][data-id="${id}"]`).click();await page.locator('[data-role-choice]').waitFor();}
 async function inspect(loc,big,label){const m=await loc.evaluate(e=>({font:getComputedStyle(document.documentElement).fontSize,width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[e,...e.querySelectorAll('*')].filter(n=>{const r=n.getBoundingClientRect();return r.width&&(r.left<-.6||r.right>innerWidth+.6);}).map(n=>n.className),clipped:[e,...e.querySelectorAll('p,h2,h3,h4')].filter(n=>{const c=getComputedStyle(n);return ['hidden','clip'].includes(c.overflowY)&&n.scrollHeight>n.clientHeight+1;}).map(n=>n.className)}));check(label+' native font, no horizontal overflow or clipped prose',m.font===(big?'32px':'16px')&&m.scroll<=m.width&&!m.overflow.length&&!m.clipped.length,m);}
 async function shot(loc,label){await loc.scrollIntoViewIfNeeded();const path=`${out}/${label}.png`;await loc.screenshot({path});report.screenshots.push({path,sha256:sha(await fs.readFile(path)),kind:'original Chromium element screenshot'});}
 async function destination(actor,cell,screen,label){const u=await page.evaluate(()=>window.afterwave.ui);check(label+' exact destination',u.actor===actor&&u.selected===cell&&u.screen===screen,u);}
 for(const [producer,api] of [['current',sim],['old',old]])for(const width of [320,390,1280])for(const big of [false,true]){
  const label=`${producer}-${width}-${big?200:100}`;await page.setViewportSize({width,height:width===320?568:900});
  const s=ready(api);lock(s,'protagonist','D4','share_power',api);lock(s,'linche','E4','train_network',api);api.investigate(s,'protagonist','E4','resident_testimony');
  await load(s,big,label);await preview('authorize_training');
  const pair=page.locator('[data-role-choice]'),v=getRoleReadingChoice(s,{actorId:'protagonist',cellId:'E4',actionId:'authorize_training'});
  for(const role of v.roles){const slot=page.locator(`[data-role-slot="${role.actorId}"]`);const text=await slot.innerText();check(label+' '+role.actorId+' full duty, arrangement, budget and requirement visible',text.includes(role.duty)&&text.includes(role.arrangement)&&text.includes(`剩余 ${role.budget} / 3`)&&text.includes(`E4本项仍需 ${role.requiredRounds} 轮`));}
  check(label+' full narrative explanation and boundary visible',(await pair.innerText()).includes(v.explanation)&&(await pair.innerText()).includes(v.boundary));
  await inspect(pair,big,label);await exact(s,label+' read');await shot(pair,label);
  const metrics=await pair.evaluate(e=>{const r=e.getBoundingClientRect(),link=e.querySelector('[data-action="opportunity-route"]'),slot=e.querySelector('[data-role-slot]'),p=slot.querySelector('[data-role-arrangement]');return {height:r.height,linkOffset:link.getBoundingClientRect().top-r.top,textWidth:p.getBoundingClientRect().width,linksBeforeFacts:!!(link.compareDocumentPosition(slot)&Node.DOCUMENT_POSITION_FOLLOWING)};});
  (report.metrics??=[]).push({label,...metrics});
  if(!process.env.AW_BASELINE){check(label+' free reading directory precedes detailed comparison',metrics.linksBeforeFacts);if(big&&width===320)check(label+' large-text route and reading-column budget',metrics.linkOffset<800&&metrics.textWidth>=220,metrics);}
  const link=page.locator('[data-action="opportunity-route"][data-id="companion"]');await link.scrollIntoViewIfNeeded();await link.focus();await page.keyboard.press('Enter');await destination('linche','E4','choice',label+' companion');await exact(s,label+' route');await click('opportunity-return');await exact(s,label+' return');
  check(label+' returning keeps full readable facts',await page.locator('[data-role-slot]').count()===2);
 }
 check('browser has no page or network errors',report.errors.length===0,report.errors);
}catch(e){report.failure=String(e.stack||e);throw e;}finally{
 if(browser)await browser.close();if(server)await server.close();report.inputsAfter=await hashInputs();report.scriptAfter=sha(await fs.readFile(new URL(import.meta.url)));report.checks.push({name:'all source, tests and scripts unchanged during run',passed:report.inputsBefore===report.inputsAfter&&report.scriptBefore===report.scriptAfter});if(report.inputsBefore!==report.inputsAfter)report.failure='Inputs changed during run';report.finishedAt=new Date().toISOString();await fs.writeFile(`${out}/report.json`,json(report,null,2));console.log(json({checks:report.checks.length,passed:report.checks.filter(c=>c.passed).length,failure:report.failure||null}));assert.equal(report.failure,undefined);
}
