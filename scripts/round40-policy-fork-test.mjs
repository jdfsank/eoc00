// Real controls and naturally produced worlds. No injected world or DOM.
import {chromium} from 'playwright';
import binary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as previous from '../tests/fixtures/pre-decision-flow-producer/simulation.js';
import * as legacy from '../tests/fixtures/legacy-simulation.js';
import {getPolicyChoiceFork} from '../src/policy-choice-fork.js';
import {getInvestigationPlan} from '../src/investigation-plan.js';
import {renderActionResearch} from '../src/investigation-plan-view.js';
import {sceneFor} from '../src/story.js';
import {lock,next,routes} from '../tests/fixtures/round24-investigation-routes.js';
const out=process.env.AW_OUTPUT||'playtest-output/round40-policy-fork';
await fs.mkdir(out,{recursive:true});
const json=JSON.stringify,report={scope:'Natural current and genuine archived producers; actual free directory, original contracts, keyboard and retained draft flows. Native320/390/1280 at100/200%. Not physical device or human balance certification.',checks:[],screenshots:[],metrics:[],errors:[]};
const check=(name,passed,detail)=>{report.checks.push({name,passed:!!passed,...(detail===undefined?{}:{detail})});assert.ok(passed,name);};
async function hash(){const h=createHash('sha256');async function walk(p){for(const e of(await fs.readdir(p,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const f=`${p}/${e.name}`;if(e.isDirectory())await walk(f);else{h.update(f);h.update(await fs.readFile(f));}}}await walk('src');return h.digest('hex');}
function at30(api,mode){
 const s=api.createRun(0);
 if(mode==='ready')lock(s,api,'protagonist','D4','build_joint');
 if(mode==='archive')lock(s,api,'protagonist','B4','preserve_records');
 next(s,api);
 lock(s,api,'protagonist','D4',mode==='ready'?'renew_charter':'recruit_volunteer');next(s,api);
 if(mode==='ready')lock(s,api,'protagonist','F6','independent_review');
 else {lock(s,api,'protagonist','D4','free_warning');lock(s,api,'linche','E4','train_network');}
 next(s,api);return s;
}
report.startedAt=new Date().toISOString();report.scriptBefore=createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');report.sourceBefore=await hash();
const server=await createServer({server:{host:'127.0.0.1',port:4440,strictPort:true}});await server.listen();let browser,page;
const click=a=>page.locator(`[data-action="${a}"]`).first().click(),card=id=>page.locator(`.choice-card[data-id="${id}"]`),link=id=>page.locator(`.scene-choice-link[data-id="${id}"]`);
async function exact(s,label){const got=await page.evaluate(()=>[JSON.stringify(window.afterwave.state),JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state)]);check(label+' whole world and autosave exact',got.every(v=>v===json(s)));}
async function imported(s,big,label){await click('settings');await page.locator('#import-save').setInputFiles({name:label+'.json',mimeType:'application/json',buffer:Buffer.from(json({state:s,ui:{bigText:big}}))});await page.locator('.selection-card').waitFor();if(await page.locator('.toast').count())await page.locator('.toast').waitFor({state:'hidden',timeout:6000});await exact(s,label+' import');}
async function enter(cell='D4',actor='protagonist'){await click('home');if(actor!=='protagonist')await page.locator(`[data-action="actor"][data-actor="${actor}"]`).click();await click('list');await page.locator(`[data-action="select"][data-cell="${cell}"]`).click();await click('avg');await page.locator('.scene-planning-page').waitFor();}
async function shot(label){const path=`${out}/${label}.png`;await page.screenshot({path});const bytes=await fs.readFile(path);report.screenshots.push({path,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),sha256:createHash('sha256').update(bytes).digest('hex'),kind:'original Chromium viewport'});}
async function tabTo(selector,label){for(let n=0;n<180;n++){if(await page.locator(selector).evaluate(e=>e===document.activeElement))return;await page.keyboard.press('Tab');}throw Error(label+' unreachable '+selector);}
async function original(s,label){const scene=sceneFor(s,'D4','protagonist'),actions=sim.getActions(s,'D4'),plan=getInvestigationPlan(s,'D4','protagonist');
 for(const para of scene.body)check(label+' original narrative '+para.slice(0,10),(await page.locator('.scene-testimony').innerText()).includes(para));
 for(const a of actions){const c=card(a.id);check(label+'/'+a.id+' original title',await c.locator('.choice-title').textContent()===a.title+' ↗');check(label+'/'+a.id+' original description',await c.locator(':scope > span').nth(1).textContent()===a.description);if(plan)check(label+'/'+a.id+' original research/cost markup',await c.locator('[data-action-research]').evaluate(e=>e.outerHTML)===renderActionResearch(plan.actions.find(x=>x.actionId===a.id),plan.budget));}
 await exact(s,label+' originals');
}
async function inspect(s,label,big){
 const fork=getPolicyChoiceFork(s,'D4');check(label+' guarded model',!!fork);
 check(label+' exactly3 policies',await page.locator('[data-policy-fork]').count()===1&&await page.locator('[data-policy-choice]').count()===3);
 check(label+'31/40 boundaries exact',await page.locator('[data-policy-timing]').innerText()==='三种方针的时点\n'+fork.timing+'\n'+fork.assessment);
 await original(s,label);
 for(const c of fork.choices){const d=page.locator(`[data-policy-choice="${c.actionId}"]`),a=sim.getActions(s,'D4').find(x=>x.id===c.actionId);
  for(const field of ['effect','responsibility','current'])check(label+'/'+c.actionId+'/'+field+' exact public text',await d.locator(`[data-policy-${field}]`).textContent()===c[field]);
  check(label+'/'+c.actionId+' original accessible title/description',await link(c.actionId).getAttribute('aria-label')==='免费定位完整合同：'+a.title&&await link(c.actionId).getAttribute('aria-describedby')==='policy-fork-timing policy-fork-'+c.actionId&&await link(c.actionId).locator(':scope > span').first().textContent()===a.title);
  check(label+'/'+c.actionId+' supplementary artwork only',await d.locator('svg[aria-hidden=true]').count()===1&&await d.locator('button,a,input').count()===0);
 }
 await page.locator('[data-action="scene-section"][data-section="choices"]').first().click();
 const m=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,font:getComputedStyle(document.documentElement).fontSize,clipped:[...document.querySelectorAll('[data-policy-fork],[data-policy-choice],[data-policy-current],[data-policy-effect],[data-policy-responsibility]')].some(e=>['hidden','clip'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+1),bounds:[...document.querySelectorAll('.policy-choice-link')].map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};})}));
 report.metrics.push({label,...m});check(label+' native text no overflow/clipping',m.font===(big?'32px':'16px')&&m.width>=m.scrollWidth&&!m.clipped&&m.bounds.every(r=>r.left>=0&&r.right<=m.width),m);const first=await link(fork.choices[0].actionId).locator(':scope > span').first().boundingBox();check(label+' first original title visible at section landing',first&&first.y>=0&&first.y+first.height<=(await page.viewportSize()).height,first);await shot(label+'-directory');
 for(const c of fork.choices){await link(c.actionId).dblclick();check(label+'/'+c.actionId+' repeated positioning only',await card(c.actionId).evaluate(e=>document.activeElement===e)&&await page.locator('[data-decision-stage=preview]').count()===0);await exact(s,label+' position');
  await page.keyboard.press('Enter');await page.locator('[data-decision-stage=preview]').waitFor();const a=sim.getActions(s,'D4').find(x=>x.id===c.actionId);
  check(label+'/'+a.id+' unchanged full description and risk/reward',await page.locator('.decision-page .lead').textContent()===a.description&&(await page.locator('.contract').innerText()).includes(a.risk)&&(await page.locator('.contract').innerText()).includes(a.reward));await exact(s,label+' preview');await click('avg');
 }
 await tabTo('.scene-choice-link[data-id="withdraw"]',label);await page.keyboard.press('Enter');check(label+' keyboard positions original withdraw',await card('withdraw').evaluate(e=>e===document.activeElement));await page.keyboard.press('Space');await page.locator('[data-decision-stage=preview]').waitFor();await exact(s,label+' keyboard');await click('avg');
}
try{
 browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});page=await browser.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.errors.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)report.errors.push({url:r.url(),status:r.status()});});page.on('console',m=>{if(/\[vite\].*(hot updated|page reload)/.test(m.text()))report.errors.push(m.text());});
 await page.goto('http://127.0.0.1:4440');await page.locator('.selection-card').waitFor();
 for(const [width,height] of [[320,568],[390,844],[1280,900]])for(const big of [false,true])for(const mode of ['missing','ready','archive']){
  const s=at30(sim,mode),label=`current-${mode}-${width}-${big?200:100}`;await page.setViewportSize({width,height});await imported(s,big,label);await enter();await inspect(s,label,big);
 }
 for(const mode of ['missing','ready','archive']){const s=at30(previous,mode),label='genuine-previous-'+mode;await page.setViewportSize({width:390,height:844});await imported(s,false,label);await enter();await inspect(s,label,false);}
 const old=routes(legacy)[30];await imported(old,true,'genuine-original');await enter();check('Original producer has no modern policy fork',await page.locator('[data-policy-fork],[data-policy-choice]').count()===0);await original(old,'genuine-original');await shot('genuine-original');
 const s=at30(sim,'missing');await imported(s,false,'draft');await enter();await card('share_power').click();await click('confirm');await click('lock');sim.lockTask(s,'protagonist','D4','share_power');await exact(s,'new original draft');await page.locator('[data-action="edit-draft"][data-actor="protagonist"]').click();await inspect(s,'retained-share-draft',false);
 await card('withdraw').click();await page.waitForLoadState('networkidle',{timeout:12000});await page.reload();await page.locator('[data-decision-stage=preview]').waitFor();await exact(s,'reload before replacing');await click('avg');await inspect(s,'reload-keeps-share-draft',false);
 await card('withdraw').click();await click('confirm');await click('lock');sim.lockTask(s,'protagonist','D4','withdraw');await exact(s,'explicitly replace original draft');
 await click('home');await page.locator('[data-action=actor][data-actor=linche]').click();await click('list');await page.locator('[data-action=select][data-cell=D4]').click();check('Linche still cannot sign policies or enter a phantom policy scene',sim.getActions(s,'D4','linche').length===0&&await page.locator('[data-action=avg],[data-policy-fork],.choice-card').count()===0);await exact(s,'actor restriction');
 await enter('B4');check('Other site has no policy reading',await page.locator('[data-policy-fork]').count()===0);await exact(s,'other site');
 for(const year of [0,10,20]){const world=routes(sim)[year];await imported(world,false,'year-'+year);await enter();check('Year'+year+' has no policy reading',await page.locator('[data-policy-fork]').count()===0);await exact(world,'other year');}
 check('No page/network/hot-update errors',!report.errors.length,report.errors);
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;if(page)await shot('failure').catch(()=>{});}
finally{await browser?.close();await server.close();report.scriptAfter=createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');if(report.scriptBefore!==report.scriptAfter)process.exitCode=1;report.sourceAfter=await hash();report.sourceStable=report.sourceBefore===report.sourceAfter;if(!report.sourceStable)process.exitCode=1;report.exitCode=process.exitCode||0;await fs.writeFile(`${out}/results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,screenshots:report.screenshots.length,sourceStable:report.sourceStable,exitCode:report.exitCode,failure:report.failure}));}
