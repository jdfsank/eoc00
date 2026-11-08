// Real-control navigation, natural producer states, no injected DOM or world.
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
const out=process.env.AW_OUTPUT||'playtest-output/round41-contract-resume';
await fs.mkdir(out,{recursive:true});
const json=JSON.stringify,report={startedAt:new Date().toISOString(),scope:'Explicit current-contract resume, independent of expired scene history. Natural current and real archived producers; keyboard, pointer repetition, import, settings and actor boundaries. Native CSS 320/390/1280 at 100/200%. Not physical-device or screen-reader certification.',checks:[],screenshots:[],metrics:[],errors:[]};
const check=(name,passed,detail)=>{report.checks.push({name,passed:!!passed,...(detail===undefined?{}:{detail})});assert.ok(passed,name);};
async function hash(){const h=createHash('sha256');async function walk(p){for(const e of(await fs.readdir(p,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const f=`${p}/${e.name}`;if(e.isDirectory())await walk(f);else{h.update(f);h.update(await fs.readFile(f));}}}await walk('src');return h.digest('hex');}
report.sourceBefore=await hash();report.scriptBefore=createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');
const server=await createServer({server:{host:'127.0.0.1',port:4441,strictPort:true}});await server.listen();let browser,page;
const click=a=>page.locator(`[data-action="${a}"]`).first().click(),card=id=>page.locator(`.choice-card[data-id="${id}"]`),resume=()=>page.locator('[data-action="resume-contract"],[data-resume-contract]').first();
async function exact(s,label){const worlds=await page.evaluate(()=>[JSON.stringify(window.afterwave.state),JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state)]);check(label+' world/autosave exact',worlds.every(w=>w===json(s)));}
async function imported(s,big,label){await click('settings');await page.locator('#import-save').setInputFiles({name:label+'.json',mimeType:'application/json',buffer:Buffer.from(json({state:s,ui:{bigText:big}}))});await page.locator('.selection-card').waitFor();if(await page.locator('.toast').count())await page.locator('.toast').waitFor({state:'hidden',timeout:6000});await exact(s,label+' import');}
async function enter(cell='D4',actor='protagonist'){await click('home');await page.locator(`[data-action="actor"][data-actor="${actor}"]`).click();await click('list');await page.locator(`[data-action="select"][data-cell="${cell}"]`).click();await click('avg');await page.locator('.scene-planning-page').waitFor();}
async function preview(id){await page.locator(`.scene-choice-link[data-id="${id}"]`).click();await card(id).press('Enter');await page.locator('[data-decision-stage="preview"]').waitFor();}
async function reload(stage='preview'){await page.waitForLoadState('networkidle',{timeout:12000});await page.reload();await page.locator(`[data-decision-stage="${stage}"]`).waitFor();}
async function shot(label){const path=`${out}/${label}.png`;await page.screenshot({path});const b=await fs.readFile(path);report.screenshots.push({path,sha256:createHash('sha256').update(b).digest('hex'),width:b.readUInt32BE(16),height:b.readUInt32BE(20),kind:'original Chromium viewport'});}
async function landed(s,id,label,big){
 const m=await card(id).evaluate(e=>{const r=e.querySelector('.choice-title').getBoundingClientRect();return {focused:e===document.activeElement,marker:e.hasAttribute('data-contract-resume'),top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,font:getComputedStyle(document.documentElement).fontSize,shadow:getComputedStyle(e).boxShadow,outline:getComputedStyle(e).outlineStyle};});
 report.metrics.push({label,...m});check(label+' focused original contract/title visible',m.focused&&m.marker&&m.top>=0&&m.bottom<=m.height,m);
 check(label+' native text/viewport/no horizontal overflow',m.font===(big?'32px':'16px')&&m.scrollWidth<=m.width,m);
 check(label+' paper bookmark and original focus feedback',m.shadow!=='none'&&m.outline==='solid',m);
 check(label+' no preview or lock triggered',await page.locator('[data-decision-stage],[data-action="lock"],[data-action="resume-contract"],[data-resume-contract]').count()===0);
 await exact(s,label);
}
try{
 browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});page=await browser.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.errors.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)report.errors.push({url:r.url(),status:r.status()});});page.on('console',m=>{if(/\[vite\].*(hot updated|page reload)/.test(m.text()))report.errors.push(m.text());});
 await page.goto('http://127.0.0.1:4441');await page.locator('.selection-card').waitFor();
 for(const[width,height]of [[320,568],[390,844],[1280,900]])for(const big of [false,true]){
  const s=routes(sim)[30],id='withdraw',label=`current-${width}-${big?200:100}`;
  await page.setViewportSize({width,height});await imported(s,big,label);await enter();
  const material=page.locator('[data-evidence-id="resident_testimony"]');await material.locator('summary').click();
  await preview(id);check(label+' normal origin adds no extra upper chrome',await page.locator('.contract-resume-link').count()===0);
  await resume().click();await landed(s,id,label+' normal',big);check(label+' valid origin preserves open unread material',await material.evaluate(e=>e.open));
  await card(id).press('Enter');await reload();
  check(label+' reload offers both original scene return and explicit resume',await page.locator('[data-action="avg"].back').count()===1&&await page.locator('.contract-resume-link').count()===1);
  check(label+' named current contract without claiming lock',await resume().getAttribute('aria-label')==='回到现场方案：逐步退出独占控制，继续比较');
  await resume().scrollIntoViewIfNeeded();await shot(label+'-preview-resume');
  await resume().dblclick();await landed(s,id,label+' reload double',big);
  check(label+' expired disclosures not invented',!await material.evaluate(e=>e.open));await shot(label+'-resumed-contract');
  await card(id).press('Enter');await click('confirm');await reload('confirm');await click('choose');
  check(label+' confirm reload keeps original free preview return',await page.locator('[data-decision-stage="preview"]').count()===1);
  await resume().focus();await page.keyboard.press('Enter');await landed(s,id,label+' confirm keyboard',big);
  await card(id).press('Space');await reload();await click('avg');
  check(label+' original return still invalidates old origin',await page.evaluate(()=>document.activeElement?.dataset.action)==='scene-section'&&!await material.evaluate(e=>e.open));await exact(s,label+' original return');
 }
 for(const[name,api]of [['previous',previous],['original',legacy]]){
  const s=routes(api)[20],label='genuine-'+name;await page.setViewportSize({width:320,height:568});await imported(s,true,label);await enter();await preview('relocate_teacher');await reload();await resume().click();await landed(s,'relocate_teacher',label,true);await shot(label+'-resumed');
 }
 // A genuine retained original draft survives restart; resume itself cannot
 // reinstate the ephemeral draft-edit mode or replace that original contract.
 const s=routes(sim)[30];lock(s,sim,'protagonist','D4','share_power');await imported(s,false,'retained-draft');await enter();await preview('withdraw');await reload();await resume().click();await landed(s,'withdraw','retained original draft',false);check('Original draft remains share power',await page.evaluate(()=>window.afterwave.state.drafts.protagonist.actionId)==='share_power');
 await card('withdraw').press('Enter');await click('settings');await click('home');await enter();check('Settings and new scene never advertise stale resume',await page.locator('[data-action="resume-contract"],[data-resume-contract],[data-contract-resume]').count()===0);await exact(s,'settings boundary');
 await enter('E4','linche');check('Actor/place switch has no stale bookmark',await page.locator('[data-contract-resume],[data-action="resume-contract"],[data-resume-contract]').count()===0);await exact(s,'actor/place boundary');
 const other=sim.createRun(0);await imported(other,false,'replacement');await enter();check('New import cannot reuse old contract destination',await page.locator('[data-contract-resume],[data-action="resume-contract"],[data-resume-contract]').count()===0);await exact(other,'import boundary');
 await preview('build_joint');await reload();await resume().click();await landed(other,'build_joint','missing evidence resume',false);await card('build_joint').press('Enter');check('Resume never acquires required records',await page.locator('[data-action="confirm"]').isDisabled());await exact(other,'evidence remains missing');
 check('No page/network/hot-update errors',!report.errors.length,report.errors);
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;if(page)await shot('failure').catch(()=>{});}
finally{await browser?.close();await server.close();report.completedAt=new Date().toISOString();report.sourceAfter=await hash();report.scriptAfter=createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');report.sourceStable=report.sourceBefore===report.sourceAfter;report.scriptStable=report.scriptBefore===report.scriptAfter;if(!report.sourceStable||!report.scriptStable)process.exitCode=1;report.exitCode=process.exitCode||0;await fs.writeFile(`${out}/results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,screenshots:report.screenshots.length,sourceStable:report.sourceStable,scriptStable:report.scriptStable,exitCode:report.exitCode,failure:report.failure}));}
