import {readDecisionDetails} from './helpers/decision-reading.mjs';
import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from '../tests/fixtures/pre-tradeoffs-simulation.js';
import {investigateAndLock} from '../tests/helpers/play.js';
import {evidenceFor} from '../src/story.js';
const out='playtest-output';await fs.mkdir(out,{recursive:true});const server=await createServer({server:{host:'127.0.0.1',port:4204,strictPort:true}});await server.listen();let browser,page;
const report={scope:'Real Chromium390×844 and320×568/200%. Natural default0→10→20 route; true historical engine save; same actual UI actions and a separately labelled synthetic disabled-control bypass check.',checks:[],errors:[]};
const check=(name,ok)=>{report.checks.push({name,passed:!!ok});assert.ok(ok,name);};
function next(s,api=sim){for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);api.advanceToNextWindow(s);return s;}
function bare(api=sim){const s=api.createRun(12);next(s,api);return next(s,api);}
function identity(seed,build,ten){const s=sim.createRun(seed);if(build)investigateAndLock(s,'protagonist','D4',build);next(s);investigateAndLock(s,'protagonist','D4',ten);return next(s);}
const click=async a=>{await page.locator(`[data-action="${a}"]`).first().click();await readDecisionDetails(page);};
const choose=id=>page.locator(`[data-action="choose"][data-id="${id}"]`).click();
const worldState=()=>page.evaluate(()=>JSON.stringify(window.afterwave.state));
const restore=async(state,ui={})=>{await page.evaluate(({state,ui})=>sessionStorage.setItem('contract-preview.fixture',JSON.stringify({state,ui})),{state,ui});await page.reload();await page.locator('main h1,[data-primary-action]').first().waitFor();};
const select=async cell=>{await click('home');await click('list');await page.locator(`[data-action="select"][data-cell="${cell}"]`).click();await page.locator('[data-primary-action]').click();};
const investigate=async id=>{const d=page.locator(`[data-evidence-id="${id}"]`);if(!await d.evaluate(e=>e.open))await d.locator('summary').click();await d.locator('[data-action="evidence"]').click();};
const snapshot=name=>page.screenshot({path:`${out}/round10-${name}.png`,fullPage:true});
try{
 browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{const f=sessionStorage.getItem('contract-preview.fixture');if(f){localStorage.setItem('afterwave.save.v1',f);sessionStorage.removeItem('contract-preview.fixture');}});
 await page.goto('http://127.0.0.1:4204');await page.locator('canvas').waitFor();
 for(let i=0;i<2;i++){await click('window');await page.locator('[data-action="pass"][data-actor="protagonist"]').click();await click('commit');await click('skip');await click('home');}
 check('Natural default route reaches20 with all3 investigation rounds',await page.evaluate(()=>window.afterwave.state.year===20&&window.afterwave.state.seed==='12'));await select('B4');
 const untouched=await worldState(),hidden=evidenceFor(JSON.parse(untouched),'anomaly_records','B4','protagonist').text;
 check('Uninvestigated review card is a real enabled preview button',await page.locator('[data-action="choose"][data-id="independent_review"]').isEnabled());
 await choose('independent_review');const contract=await page.locator('.contract').innerText();
 check('Before spending, full contract exposes55 percent, failure destination and nonrefund',contract.includes('55%')&&contract.includes('不退')&&contract.includes('失败'));
 check('Preview never exposes the unread anomaly document',!(await page.locator('main').innerText()).includes(hidden));
 check('Preview has no simulation, draft, cost or investigation side effect',await worldState()===untouched);
 check('Missing evidence disables commitment, not contract reading',await page.locator('.missing-evidence').isVisible()&&await page.locator('[data-action="confirm"]').isDisabled());await snapshot('free-contract-390');
 await page.reload();await page.locator('.contract').waitFor();check('Reload preserves unread state and keeps the contract inspectable',await worldState()===untouched&&await page.locator('[data-action="confirm"]').isDisabled());
 // A hostile/stale UI event cannot turn free reading into evidence or a lock.
 await page.locator('[data-action="confirm"]').evaluate(el=>{el.disabled=false;el.dataset.action='lock';el.click();});await page.locator('.toast').waitFor();
 check('Synthetic disabled-control bypass is rejected without state or autosave damage',await worldState()===untouched&&await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state))===untouched&&(await page.locator('.toast').innerText()).includes('证据'));
 await page.reload();await page.locator('.contract').waitFor();await click('preview-evidence');
 check('Return targets the actual unread evidence summary with keyboard focus',await page.locator('[data-evidence-id="anomaly_records"] summary').evaluate(el=>document.activeElement===el));
 check('Opening the entry does not read its document or consume a round',await worldState()===untouched&&(await page.locator('.evidence-panel [role="status"]').innerText()).includes('3 / 3')&&!(await page.locator('main').innerText()).includes(hidden));
 await choose('local_veto');check('Player can compare the basic deterministic fallback before investigating',(await page.locator('.contract').innerText()).includes('0.30'));await click('avg');await investigate('evacuation_routes');
 check('Free comparison leaves the real2round alternative affordable',(await page.locator('.evidence-panel [role="status"]').innerText()).includes('1 / 3'));
 await choose('independent_review');check('After choosing route evidence the review remains readable but cannot be locked',await page.locator('[data-action="confirm"]').isDisabled());await click('avg');await choose('local_veto');
 check('The actual route survey now gives the original0.20 fallback',(await page.locator('.contract').innerText()).includes('0.20'));await click('confirm');const beforeLock=await page.evaluate(()=>JSON.stringify(window.afterwave.state.cells));await click('lock');
 check('Only an actual lock creates the task and still does not pay costs',await page.evaluate(()=>window.afterwave.state.drafts.protagonist.actionId==='local_veto')&&await page.evaluate(()=>JSON.stringify(window.afterwave.state.cells))===beforeLock);await click('commit');await click('skip');
 check('Actual23year settlement still follows the unchanged strengthened veto rule',await page.evaluate(()=>window.afterwave.state.flags.crisis.damage===.2));
 const legacy=bare(old);await restore(legacy,{screen:'avg',selected:'B4'});const oldBefore=await worldState();await choose('independent_review');
 check('True pre-tradeoffs contract is freely readable but still requires its own evidence',await page.locator('[data-action="confirm"]').isDisabled()&&(await page.locator('.contract').innerText()).includes('第 21 年'));
 check('Legacy preview does not migrate or mutate the saved world',await worldState()===oldBefore);await click('preview-evidence');await investigate('anomaly_records');await choose('independent_review');check('Legacy local investigation still unlocks the original contract',await page.locator('[data-action="confirm"]').isEnabled());
 const draft=bare();sim.lockTask(draft,'protagonist','B4','local_veto');await restore(draft,{screen:'avg',selected:'B4'});const draftBefore=await worldState();await choose('independent_review');await click('avg');check('Comparing another incomplete contract never replaces an already locked task',await worldState()===draftBefore);
 for(const [name,s,title] of [['rebuilt',identity(12,null,'restore_archive'),'河港居民'],['station-successor',identity(0,'build_joint','recruit_successor'),'河港的维护者'],['archive-successor',identity(6,'build_joint','recruit_successor'),'河港档案保管员'],['renewed',identity(0,'build_joint','renew_charter'),'河港居民']]){
  await restore(s,{screen:'avg',selected:'D4'});const before=await worldState(),speaker=await page.locator('.prose > .eyebrow').innerText();check(`${name}:speaker follows personal appointment rather than technical staffing`,speaker.includes(title));check(`${name}:reading identity preserves all engine facts`,before===await worldState());await snapshot(`personal-role-${name}-390`);
 }
 await page.setViewportSize({width:320,height:568});await restore(bare(),{screen:'avg',selected:'B4',bigText:true});await page.locator('[data-action="choose"][data-id="independent_review"]').focus();await page.keyboard.press('Enter');
 check('Keyboard opens an unread contract at320 and200percent',await page.locator('.contract').isVisible());check('Contract and missing-evidence notice do not overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('[data-action="preview-evidence"]').scrollIntoViewIfNeeded();check('Return-to-evidence control is reachable at200percent',await page.locator('[data-action="preview-evidence"]').isVisible());await snapshot('free-contract-320-text200');await click('preview-evidence');check('Keyboard focus returns to the exact evidence entry at200percent',await page.locator('[data-evidence-id="anomaly_records"] summary').evaluate(el=>document.activeElement===el));
 check('No browser or asset errors',report.errors.length===0);
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;if(page)await snapshot('contract-preview-failure').catch(()=>{});}
finally{await fs.writeFile(`${out}/round10-contract-preview-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
