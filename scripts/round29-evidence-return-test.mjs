// Actual browser controls and genuine producer imports; no synthetic world injection.
import {chromium} from 'playwright';
import binary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as legacy from '../tests/fixtures/pre-tradeoffs-simulation.js';
import {getOpeningReadingContext} from '../src/opening-reading-context.js';
const root=process.env.ROUND29_EVIDENCE_OUTPUT||'playtest-output/round29-evidence-return',report={checks:[],errors:[],scope:'Real UI year0 material-return flow and genuine current/legacy producer file imports, exact live/save world checks. Not a full 0–40 route or human playtest.'};
async function hash(){const h=createHash('sha256');async function walk(p){for(const e of(await fs.readdir(p,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const f=`${p}/${e.name}`;if(e.isDirectory())await walk(f);else{h.update(f);h.update(await fs.readFile(f));}}}await walk('src');return h.digest('hex');}
await fs.mkdir(root,{recursive:true});const json=JSON.stringify;report.sourceBefore=await hash();
function check(name,ok){report.checks.push({name,passed:!!ok});assert.ok(ok,name);}
const server=await createServer({server:{host:'127.0.0.1',port:4294,strictPort:true}});await server.listen();let browser,page;
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
async function afterMutation(s,label){
 const expected=JSON.stringify(s);
 const probe=await page.evaluate(expected=>{const a=window.afterwave,raw=localStorage.getItem('afterwave.save.v1');return {live:JSON.stringify(a.state)===expected,durable:!!raw&&JSON.stringify(JSON.parse(raw).state)===expected,pending:a.storage.pending};},expected);
 check(label+' immediately exact live world',probe.live);
 check(label+' disk exact or pending',probe.durable||probe.pending);
 await page.waitForFunction(expected=>{const a=window.afterwave,raw=localStorage.getItem('afterwave.save.v1');return !a.storage.pending&&!!raw&&JSON.stringify(JSON.parse(raw).state)===expected;},expected);
 await exact(s,label+' after settled write');
}
async function exact(s,label){const got=await page.evaluate(()=>({live:JSON.stringify(window.afterwave.state),saved:JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state)}));check(label,got.live===json(s)&&got.saved===json(s));}
async function scene(){await click('home');await click('list');await page.locator('[data-action="select"][data-cell="D4"]').click();await page.locator('[data-primary-action]').click();}
async function origin(id='independent_flood_records'){await page.locator('[data-action="choose"][data-id="build_joint"]').click();await page.locator(`[data-action="preview-evidence"][data-id="${id}"]`).click();check('Explicit contract entry creates exact bookmark',await page.locator('[data-evidence-bookmark="build_joint"]').count()===1);}
async function buy(id,s,old=false){const d=page.locator(`[data-evidence-id="${id}"]`);if(!await d.evaluate(e=>e.open))await d.locator('summary').click();await d.locator('[data-action="evidence"]').click();if(!old)sim.investigate(s,'protagonist','D4',id);await afterMutation(s,`${id} acquisition has exact authorized cost`);}
async function imported(s,name){await click('settings');const path=`${root}/${name}.json`;await fs.writeFile(path,json({state:s,ui:{screen:'world',selected:'D4',actor:'protagonist'}}));await page.locator('#import-save').setInputFiles(path);await page.locator('.selection-card').waitFor();await exact(s,`${name} actual file import`);}
try{
 browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});await page.goto('http://127.0.0.1:4294');await page.locator('.selection-card').waitFor();const s=sim.createRun(12);await exact(s,'Natural fresh world exact');
 const opening=getOpeningReadingContext(s);check('Opening repeats exact verified original arrival',await page.locator('[data-opening-letter] h2').innerText()===opening.title&&await page.locator('[data-opening-letter] p').innerText()===opening.body);check('Opening follows primary and actor picker',await page.locator('.world-entry').evaluate(e=>{const p=e.querySelector('[data-primary-action]'),o=e.querySelector('[data-opening-letter]'),a=e.querySelector('[data-action="actor"]');return !!(p.compareDocumentPosition(o)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(a.compareDocumentPosition(o)&Node.DOCUMENT_POSITION_FOLLOWING);}));
 await scene();await origin();await exact(s,'Free material entry never changes world');await buy('independent_flood_records',s);check('Partial bookmark names missing material',/打开商会的经费账簿/.test(await page.locator('[data-evidence-bookmark] p').innerText()));
 await page.locator('[data-action="evidence-return"]').focus();await page.keyboard.press('Enter');await exact(s,'Keyboard return is free');check('Return opens original preview, not confirmation',await page.locator('[data-decision-stage="preview"] h1').innerText()==='联合管理');check('Missing evidence remains lock blocker',await page.locator('[data-action="confirm"]').isDisabled());
 await page.locator('[data-action="preview-evidence"][data-id="unfunded_maintenance"]').click();await buy('unfunded_maintenance',s);check('Ready bookmark describes evidence only',await page.locator('[data-bookmark-ready="true"]').count()===1);await page.screenshot({path:`${root}/ready-return.png`,fullPage:true});
 await page.locator('[data-action="evidence-return"]').dblclick();await exact(s,'Repeated pointer return cannot spend or lock');check('Repeated return stays original preview',await page.locator('[data-decision-stage="preview"]').count()===1);await click('confirm');await exact(s,'Separate confirmation remains free');await click('lock');sim.lockTask(s,'protagonist','D4','build_joint',['independent_flood_records','unfunded_maintenance']);await afterMutation(s,'Explicit lock keeps normal draft');
 // New natural run exercises interruption boundaries without fabricated state.
 await click('settings');await page.locator('#seed').fill('4');await click('new-confirm');await click('new-run');const fresh=sim.createRun(4);await page.waitForFunction(expected=>{const a=window.afterwave,r=localStorage.getItem("afterwave.save.v1");return a.ui.screen==="world"&&!a.storage.pending&&!!r&&JSON.stringify(JSON.parse(r).state)===expected;},json(fresh));
 for(const interrupt of ['settings','home','archive']){await scene();await origin();await click(interrupt);await scene();check(`${interrupt} clears bookmark`,await page.locator('[data-evidence-bookmark]').count()===0);await exact(fresh,`${interrupt} leaves world exact`);}
 await origin();await page.reload();await page.locator('.scene-planning-page').waitFor();check('Reload cannot reconstruct origin from persisted ui.choice',await page.locator('[data-evidence-bookmark]').count()===0);await exact(fresh,'Reload leaves exact world');
 await origin();await page.locator('[data-action="choose"][data-id="build_state"]').click();await click('avg');check('Choosing another contract clears bookmark',await page.locator('[data-evidence-bookmark]').count()===0);await exact(fresh,'Changing contract is free');
 await origin();await imported(sim.createRun(8),'current-producer');await scene();check('Import clears old-world origin',await page.locator('[data-evidence-bookmark]').count()===0);
 const old=legacy.createRun(12);await imported(old,'pre-tradeoffs-producer');await scene();await origin();await buy('independent_flood_records',old,true);check('Legacy scene spends exactly one local round',await page.evaluate(()=>window.afterwave.ui.sessions['0:protagonist:D4'].budget)===2);await click('evidence-return');await exact(old,'Legacy preview return preserves old world');await page.locator('[data-action="preview-evidence"][data-id="unfunded_maintenance"]').click();await buy('unfunded_maintenance',old,true);await click('evidence-return');check('Legacy evidence enables separate confirmation',!await page.locator('[data-action="confirm"]').isDisabled());await exact(old,'Legacy evidence return never migrates producer world');
 report.sourceAfter=await hash();check('Source recursive path/bytes hash unchanged',report.sourceBefore===report.sourceAfter);check('No browser errors',report.errors.length===0);
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;if(page)await page.screenshot({path:`${root}/failure.png`,fullPage:true});}
finally{report.sourceAfter=await hash();report.exitCode=process.exitCode||0;await fs.writeFile(`${root}/results.json`,json(report,null,2));console.log(json({checks:report.checks.length,passed:report.checks.filter(x=>x.passed).length,exitCode:report.exitCode,failure:report.failure},null,2));if(browser)await browser.close();await server.close();}
