import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from '../tests/fixtures/pre-aftermath-simulation.js';
const out='playtest-output';await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:4193,strictPort:true}});await server.listen();
let browser,page;const report={scope:'Real Chromium UI at390×844 and320×568/200% text. No physical-device certification.',checks:[],errors:[]};
const check=(name,ok)=>{report.checks.push({name,passed:!!ok});assert.ok(ok,name);};
const click=action=>page.locator(`[data-action="${action}"]`).first().click();
function lock(s,actor,cell,id,api=sim){for(const e of api.getActions(s,cell,actor).find(a=>a.id===id).requireEvidence)if(!api.getInvestigation(s,actor,cell).evidence.includes(e))api.investigate(s,actor,cell,e);api.lockTask(s,actor,cell,id);}
function next(s,api=sim){for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);api.advanceToNextWindow(s);return s;}
function recruited(action,api=sim){const s=api.createRun(0);lock(s,'protagonist','D4','build_joint',api);next(s,api);lock(s,'protagonist','D4',action,api);return next(s,api);}
function lateAid(early=false){const s=sim.createRun(0);next(s);if(early)lock(s,'protagonist','D5','mutual_aid');next(s);next(s);return s;}
function submittedForgery(){const s=recruited('recruit_successor');lock(s,'linche','D4','present_archive');sim.passTask(s,'protagonist');sim.commitWindow(s);const e=s.events.find(e=>e.actionId==='present_archive');e.actionId='relocate_teacher';e.sourceActionId=null;return s;}
const fixtures={successor:recruited('recruit_successor'),risk:recruited('recruit_risk'),legacy:recruited('recruit_successor',old),first:lateAid(),expand:lateAid(true)};
const restore=async(state,ui={})=>{await page.evaluate(({state,ui})=>sessionStorage.setItem('aftermath.fixture',JSON.stringify({state,ui})),{state,ui});await page.reload();await page.locator('canvas').waitFor();};
const snap=name=>page.screenshot({path:`${out}/round4-aftermath-${name}.png`,fullPage:true});
try{
 browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{const f=sessionStorage.getItem('aftermath.fixture');if(f){localStorage.setItem('afterwave.save.v1',f);sessionStorage.removeItem('aftermath.fixture');}});
 await page.goto('http://127.0.0.1:4193');await page.locator('canvas').waitFor();
 const forged=submittedForgery();
 const missingDate=structuredClone(fixtures.successor);delete missingDate.events.find(e=>e.actionId==='recruit_successor').resolvedYear;
 for(const [name,broken] of [['forged-null-source-relocation',forged],['missing-recruitment-date',missingDate]]){
  await restore(fixtures.successor);await click('settings');const before=await page.evaluate(()=>JSON.stringify(window.afterwave.state));
  await page.locator('#import-save').setInputFiles({name:`${name}.json`,mimeType:'application/json',buffer:Buffer.from(JSON.stringify({state:broken}))});await page.locator('.toast').waitFor();
  check(`${name} import is rejected with a visible explanation`,/来源|迁任|兑现年代|损坏/.test(await page.locator('.toast').innerText()));
  check(`${name} import preserves current world and autosave`,before===await page.evaluate(()=>JSON.stringify(window.afterwave.state))&&before===await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state)));
 }

 for(const [name,needle] of [['successor','苏岚同意接班后才入局'],['risk','离开时没有安排继任']]){
  await restore(fixtures[name],{actor:'linche',selected:'D4'});const before=await page.evaluate(()=>JSON.stringify(window.afterwave.state));await page.locator('[data-primary-action]').click();
  check(`${name} refusal uses the actual recruitment history`,(await page.locator('.prose').innerText()).includes(needle));
  check(`${name} Linche cannot select forced relocation`,await page.locator('[data-action="choose"][data-id="relocate_teacher"]').count()===0);
  check(`${name} refusal explains no action or investigation payment`,(await page.locator('.actor-refusal').innerText()).includes('不占用本窗口名额'));
  check(`${name} viewing refusal leaves actual state unchanged`,before===await page.evaluate(()=>JSON.stringify(window.afterwave.state)));
  if(name==='successor')await snap('linche-refusal-390');
  await page.locator('.actor-refusal [data-action="trace"]').click();check(`${name} refusal links to the actual recruitment source`,(await page.locator('.causal-chain').innerText()).includes(name==='successor'?'苏岚同意接班':'河港暂缺维护者'));
 }
 await restore(fixtures.successor,{actor:'protagonist',selected:'D4'});await page.locator('[data-primary-action]').click();
 check('Protagonist still has the consequential relocation choice',await page.locator('[data-action="choose"][data-id="relocate_teacher"]').count()===1);
 await page.locator('[data-action="choose"][data-id="relocate_teacher"]').click();await click('confirm');await click('lock');await page.locator('[data-action="pass"][data-actor="linche"]').click();await click('commit');await click('skip');
 check('Protagonist relocation still applies real institutional and relationship costs',await page.evaluate(()=>window.afterwave.state.flags.forced===true&&window.afterwave.state.flags.trust===false&&window.afterwave.state.institutions.some(i=>i.kind==='station'&&!i.active)));
 await restore(fixtures.legacy,{actor:'linche',selected:'D4'});await page.locator('[data-primary-action]').click();
 check('True previous-version Linche contract is not silently restricted',await page.locator('[data-action="choose"][data-id="relocate_teacher"]').count()===1&&await page.locator('.actor-refusal').count()===0);
 await page.locator('[data-action="choose"][data-id="relocate_teacher"]').click();await click('confirm');await click('lock');await page.locator('[data-action="pass"][data-actor="protagonist"]').click();await click('commit');await click('skip');
 check('True old relocation still resolves with the original result',await page.evaluate(()=>window.afterwave.state.flags.forced===true&&window.afterwave.state.flags.trust===false&&window.afterwave.state.aftermathRulesVersion===undefined));
 for(const [name,title] of [['first','设立南岸互助仓'],['expand','扩充南岸互助轮值']]){
  await restore(fixtures[name],{selected:'D5'});await page.locator('[data-primary-action]').click();
  const card=page.locator('[data-action="choose"][data-id="mutual_aid"]');check(`${name} aid clearly distinguishes first warehouse from added shifts`,(await card.innerText()).includes(title));await card.click();
  check(`${name} late contract promises future livelihoods, not old flood protection`,(await page.locator('.contract').innerText()).includes('第31年起')&&(await page.locator('.contract').innerText()).includes('不会降低第23年已结算的损失'));
  await click('confirm');await click('lock');check(`${name} locked review states accurate no-stacking and no-history-rewrite terms`,(await page.locator('.aid-contract').innerText()).includes(name==='expand'?'不是第二层危机保护':'首次设立实际互助载体')&&(await page.locator('.locked-outcome').innerText()).includes('不会降低第23年'));
  if(name==='expand')await snap('expanded-aid-review-390');
  await click('commit');await click('skip');const actual=await page.evaluate(()=>window.afterwave.state);
  check(`${name} actual late aid creates a new productive shift at31`,actual.institutions.filter(i=>i.kind==='mutual'&&i.startYear===31&&i.active&&i.annualSource.economy===.6).length===1);
  check(`${name} actual late aid preserves the complete historical crisis and year23 board`,JSON.stringify(actual.flags.crisis)===JSON.stringify(fixtures[name].flags.crisis)&&JSON.stringify(actual.snapshots[23])===JSON.stringify(fixtures[name].snapshots[23]));
  await click('ending');check(`${name} ending distinguishes present aid from irreversible loss`,(await page.locator('.ending').innerText()).includes('后续产出不抵销历史损失'));
  if(name==='first')await snap('late-aid-ending-390');
 }
 await page.setViewportSize({width:320,height:568});await restore(fixtures.successor,{selected:'D4',actor:'linche',bigText:true});await page.locator('[data-primary-action]').click();
 check('320px200% refusal and remaining choices do not overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.choice-card').last().scrollIntoViewIfNeeded();check('Remaining Linche action stays reachable at320px200%',await page.locator('.choice-card').last().isVisible());await snap('refusal-320-text200');
 await restore(fixtures.expand,{selected:'D5',bigText:true});await page.locator('[data-primary-action]').click();await page.locator('[data-action="choose"][data-id="mutual_aid"]').click();check('Expanded aid contract remains within320px200%',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await snap('aid-320-text200');
 check('No browser or asset errors',report.errors.length===0);
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;if(page)await snap('failure').catch(()=>{});}
finally{await fs.writeFile(`${out}/round4-aftermath-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
