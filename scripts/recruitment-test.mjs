import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from '../tests/fixtures/pre-recruitment-simulation.js';
const out='playtest-output';await fs.mkdir(out,{recursive:true});const server=await createServer({server:{host:'127.0.0.1',port:4194,strictPort:true}});await server.listen();
let browser,page;const report={scope:'Real Chromium,390×844 and320×568/200% text. Engine-generated branch fixtures; not device certification.',checks:[],errors:[]};
const check=(name,ok)=>{report.checks.push({name,passed:!!ok});assert.ok(ok,name);};const click=a=>page.locator(`[data-action="${a}"]`).first().click();
const lock=(api,s,c,id)=>{for(const e of api.getActions(s,c).find(a=>a.id===id).requireEvidence)api.investigate(s,'protagonist',c,e);api.lockTask(s,'protagonist',c,id);};
const next=(api,s)=>{for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);api.advanceToNextWindow(s);return s;};
function at10(records=false,api=sim){const s=api.createRun(0);if(records)lock(api,s,'B4','preserve_records');return next(api,s);}
function ending({seed=0,recruit='recruit_risk',choice='free_warning',api=sim}={}){const s=api.createRun(seed);lock(api,s,'D4','build_joint');next(api,s);lock(api,s,'D4',recruit);next(api,s);if(choice)lock(api,s,'D4',choice);next(api,s);next(api,s);return s;}
const fixtures={empty:at10(),records:at10(true),old:at10(false,old),repaired:ending(),archive:ending({seed:6}),successor:ending({recruit:'recruit_successor',choice:null}),forced:ending({recruit:'recruit_successor',choice:'relocate_teacher'}),respected:ending({recruit:'recruit_successor',choice:'present_archive'})};
const restore=async(state,ui={})=>{await page.evaluate(({state,ui})=>sessionStorage.setItem('recruitment.fixture',JSON.stringify({state,ui})),{state,ui});await page.reload();await page.locator('canvas').waitFor();};
const snap=(name,selector)=>selector?page.locator(selector).screenshot({path:`${out}/round5-recruitment-${name}.png`}):page.screenshot({path:`${out}/round5-recruitment-${name}.png`,fullPage:true});
try{
 browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{const f=sessionStorage.getItem('recruitment.fixture');if(f){localStorage.setItem('afterwave.save.v1',f);sessionStorage.removeItem('recruitment.fixture');}});await page.goto('http://127.0.0.1:4194');await page.locator('canvas').waitFor();
 for(const [name,state] of [['empty',fixtures.empty],['records',fixtures.records]]){
  await restore(state);await page.locator('[data-primary-action]').click();check(`${name} has one factual recruitment choice`,await page.locator('[data-action="choose"][data-id^="recruit_"]').count()===1&&await page.locator('[data-id="recruit_volunteer"]').count()===1);
  check(`${name} scene does not invent a job for SuLan`,(await page.locator('.prose').innerText()).includes('没有一个现成岗位'));
 }
 await page.locator('[data-id="recruit_volunteer"]').click();check('Neutral contract preserves the low cost and next-window deployment',(await page.locator('.contract').innerText()).includes('经济 −1')&&(await page.locator('.contract').innerText()).includes('第20年'));
 await snap('neutral-contract-390');await click('confirm');await click('lock');const locked=await page.evaluate(()=>window.afterwave.state);check('Locking neutral recruitment does not spend or create a successor',locked.cells.find(c=>c.id==='D4').channels.economy===fixtures.records.cells.find(c=>c.id==='D4').channels.economy&&!locked.flags.successor);
 await click('commit');check('Submitted neutral recruitment has an empty truthful role snapshot',await page.evaluate(()=>window.afterwave.state.events.find(e=>e.actionId==='recruit_volunteer').departureRoleIds.length===0));await click('step');check('Year11 recruitment is not an early second action',await page.evaluate(()=>window.afterwave.state.actors.find(a=>a.id==='linche').availableFrom===20&&window.afterwave.state.year===11));await click('skip');
 check('Neutral recruitment has no fictional year16 shutdown or free institution',await page.evaluate(()=>window.afterwave.state.year===20&&!window.afterwave.state.history.some(h=>/-unattended$/.test(h.id))&&!window.afterwave.state.institutions.some(i=>['station','archive','school'].includes(i.kind))));
 await click('home');await page.locator('[data-action="actor"][data-actor="linche"]').click();await page.locator('[data-primary-action]').click();check('Linche recalls neutral recruitment rather than an invented vacancy',(await page.locator('.prose').innerText()).includes('没有运转中的河港测站或档案岗位需要交接')&&!(await page.locator('.prose').innerText()).includes('留下过一个岗位缺口'));
 await page.locator('.actor-refusal [data-action="trace"]').click();check('Neutral recruitment refusal links to its actual result',(await page.locator('.causal-chain').innerText()).includes('林澈自愿入局'));
 await click('home');await click('window');for(const a of ['protagonist','linche'])await page.locator(`[data-action="pass"][data-actor="${a}"]`).click();await click('commit');await click('skip');await click('home');await click('window');for(const a of ['protagonist','linche'])await page.locator(`[data-action="pass"][data-actor="${a}"]`).click();await click('commit');await click('skip');await click('ending');
 check('Actual year40 neutral route has two personal endings',await page.locator('.character-epilogue article').count()===2&&(await page.locator('.character-epilogue').innerText()).includes('没有一个不存在的空岗'));
 await snap('neutral-personal-ending-390','.character-epilogue');
 const needles={repaired:'恢复不等于从未停过',archive:'没有重新打开原来的档案站',successor:'维护经费的缺口又变成收费门槛',forced:'不证明她曾同意',respected:'保留了决定今天生活的权利'};
 for(const [name,needle] of Object.entries(needles)){
  await restore(fixtures[name]);const before=await page.evaluate(()=>JSON.stringify(window.afterwave.state));await page.locator('[data-primary-action]').click();check(`${name} personal coda follows its real consequence`,(await page.locator('.character-epilogue').innerText()).includes(needle));check(`${name} personal coda does not mutate the ending history`,before===await page.evaluate(()=>JSON.stringify(window.afterwave.state)));
  if(['repaired','archive','forced'].includes(name))await snap(`${name}-personal-ending-390`,'.character-epilogue');
  await page.locator('.character-epilogue [data-action="trace"]').first().click();check(`${name} personal coda source link reaches actual history`,await page.locator('.causal-chain .event-card').count()>0);
 }
 await restore(fixtures.old);await page.locator('[data-primary-action]').click();check('True f9 prior save retains both issued recruitment alternatives',await page.locator('[data-action="choose"][data-id^="recruit_"]').count()===2&&await page.locator('[data-id="recruit_volunteer"]').count()===0);
 await page.locator('[data-id="recruit_risk"]').click();await click('confirm');await click('lock');await click('commit');await click('skip');check('True f9 old low-cost contract continues without silent migration',await page.evaluate(()=>window.afterwave.state.recruitmentRulesVersion===undefined&&window.afterwave.state.actors.some(a=>a.id==='linche')));
 await page.setViewportSize({width:320,height:568});await restore(fixtures.repaired,{bigText:true});await page.locator('[data-primary-action]').click();check('Personal coda stays within320 at200% text',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.character-epilogue [data-action="trace"]').last().scrollIntoViewIfNeeded();check('Last personal-source button is reachable at320px200%',await page.locator('.character-epilogue [data-action="trace"]').last().isVisible());await snap('personal-ending-320-text200','.character-epilogue');
 check('No runtime or asset errors',report.errors.length===0);
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;if(page)await snap('failure').catch(()=>{});}
finally{await fs.writeFile(`${out}/round5-recruitment-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
