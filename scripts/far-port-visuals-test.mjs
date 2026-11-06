import {chromium} from 'playwright';
import {boardReadinessPlugin,renderedBoard,assertReloadPreserved} from './helpers/board-readiness.mjs';
import cb from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {advanceYear,advanceToNextWindow,validateState} from '../src/simulation.js';
import {farPortVisual} from '../src/far-port-visuals.js';
import {sceneArt} from '../src/scene-art.js';
import {portAt20,portAt30,portRecovery,lock} from '../tests/helpers/far-port.js';
const out='playtest-output';await fs.mkdir(out,{recursive:true});
const report={checks:[],errors:[],scope:'Engine-generated F6 branch, failed review, pending contract and actual32/40 recovery routes. Closed-service fixtures are legal boundary states, not a new shutdown action. At32/40 there is no public AVG entry: screenshots are real world maps and separately labelled asset previews, not a playable visit. Chromium390/320 and200% text, not physical-device certification.'};
const check=(name,ok)=>{report.checks.push({name,passed:!!ok});assert.ok(ok,name);};
const branch=portAt20(),failed=portAt30(),locked=structuredClone(failed);lock(locked,'protagonist','F6','complete_review');
const pending=portRecovery(structuredClone(failed)),y31=structuredClone(pending);advanceYear(y31);const y32=structuredClone(y31);advanceYear(y32);const y40=structuredClone(y32);advanceToNextWindow(y40);
const noBranch=portAt30(1,false),cancelled=portRecovery(structuredClone(noBranch));advanceToNextWindow(cancelled);
let verified;for(let seed=0;seed<6;seed++){const s=portAt30(seed);if(farPortVisual(s)?.stage==='verified'){verified=s;break;}}
const branchClosed=structuredClone(y40);branchClosed.institutions.filter(i=>i.kind==='branch').forEach(i=>i.active=false);
const checkClosed=structuredClone(y40);checkClosed.institutions.filter(i=>i.sourceActionId.endsWith(':complete_review')).forEach(i=>i.maintenance=0);
const recordsClosed=structuredClone(noBranch);recordsClosed.institutions.filter(i=>i.cellId==='F6').forEach(i=>i.active=false);
const cases={branch,failed,locked,pending,y31,y32,y40,verified,'no-branch':noBranch,cancelled,'branch-closed':branchClosed,'check-closed':checkClosed,'records-closed':recordsClosed};
for(const [name,s] of Object.entries(cases))assert.equal(validateState(s).valid,true,name);
const server=await createServer({plugins:[boardReadinessPlugin()],server:{host:'127.0.0.1',port:4201,strictPort:true}});await server.listen();let browser,page,artPage;
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
async function show(state,bigText=false){await page.evaluate(({state,bigText})=>sessionStorage.setItem('afterwave.port.fixture',JSON.stringify({state,ui:{screen:'world',selected:'F6',actor:'protagonist',channel:'science',focus:true,bigText}})),{state,bigText});await page.reload();await renderedBoard(page);}
async function snap(name,selector='.map-frame',mono=false){const target=page.locator(selector);if(mono)await target.evaluate(el=>el.style.filter='grayscale(1)');await target.screenshot({path:`${out}/round8-f6-${name}${mono?'-mono':''}.png`});if(mono)await target.evaluate(el=>el.style.filter='');}
async function pixels(){return (await renderedBoard(page)).pixels;}
try{
 browser=await chromium.launch({executablePath:await cb.executablePath(),args:cb.args,headless:true});page=await browser.newPage({viewport:{width:390,height:844}});artPage=await browser.newPage({viewport:{width:390,height:195}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{const f=sessionStorage.getItem('afterwave.port.fixture');if(f){localStorage.setItem('afterwave.save.v1',f);sessionStorage.removeItem('afterwave.port.fixture');}});await page.goto('http://127.0.0.1:4201');await page.locator('canvas').waitFor();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===390?844:568});await artPage.setViewportSize({width,height:width/2});const captures={};
  for(const [name,state] of Object.entries(cases)){
   await show(state);const visual=farPortVisual(state),art=sceneArt(state,'F6');
   check(`${width}px ${name} map names the actual branch and review history`,await page.locator('.institution-status').innerText()===visual.label);captures[name]=await pixels();await snap(`${width}-${name}-map`);
   if(['failed','pending','y40','branch-closed'].includes(name))await snap(`${width}-${name}-map`,'.map-frame',true);
   check(`${width}px ${name} rendering does not change any world fact`,await page.evaluate(()=>JSON.stringify(window.afterwave.state))===JSON.stringify(state));
   if(await page.locator('[data-action="avg"]').count()){
    await click('avg');check(`${width}px ${name} public AVG uses the matching scene`,(await page.locator('.scene-art img').getAttribute('src')).endsWith(art.file));
    check(`${width}px ${name} caption does not cover historical objects`,await page.locator('.scene-art').evaluate(el=>el.querySelector('span').getBoundingClientRect().top>=el.querySelector('img').getBoundingClientRect().bottom-1));await snap(`${width}-${name}-avg-scene`,'.scene-art');
   }else{
    // Art QA only. Do not claim an AVG screen exists during playback or at40.
    await artPage.setContent(`<style>html,body{margin:0}img{display:block;width:100%;height:auto}</style><img src="http://127.0.0.1:4201/assets/${art.file}" alt="Asset preview only">`);await artPage.locator('img').evaluate(img=>img.decode());await artPage.screenshot({path:`${out}/round8-f6-${width}-${name}-asset-preview.png`});
   }
  }
  check(`${width}px20/30/40 branch history changes visibly`,new Set([captures.branch,captures.failed,captures.y40]).size===3);
  check(`${width}px pending is distinguishable from failed and fulfilled`,new Set([captures.failed,captures.pending,captures.y32]).size===3);
  check(`${width}px independent closure states do not hide the other carrier`,captures['branch-closed']!==captures.y40&&captures['check-closed']!==captures.y40&&captures['branch-closed']!==captures['check-closed']);
  for(const [name,state] of [['failed',failed],['fulfilled',y40]]){
   await show(state,true);check(`${width}px200% ${name} readable status has no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await snap(`${width}-${name}-text200-map`);await page.locator('.selection-card').screenshot({path:`${out}/round8-f6-${width}-${name}-text200-status.png`});
   if(name==='failed'){await click('avg');check(`${width}px200% failure scene caption remains below image`,await page.locator('.scene-art').evaluate(el=>el.querySelector('span').getBoundingClientRect().top>=el.querySelector('img').getBoundingClientRect().bottom-1));await snap(`${width}-failed-text200-scene`,'.scene-art');}
  }
 }
 // Actual UI: initial failed record, fresh investigation, lock, wait31, fulfil32.
 await page.setViewportSize({width:390,height:844});await show(failed);const frozen=await page.evaluate(()=>JSON.stringify({crisis:window.afterwave.state.flags.crisis,failure:window.afterwave.state.events.find(e=>e.actionId==='independent_review')}));
 await click('avg');const beforeArt=await page.locator('.scene-art img').getAttribute('src');await page.locator('[data-evidence-id="anomaly_records"] > summary').click();await page.locator('[data-action="evidence"][data-id="anomaly_records"]').click();await page.locator('[data-action="choose"][data-id="complete_review"]').click();await click('confirm');await click('lock');await click('home');await click('avg');check('Actual locking preserves failed-record scene, with no early new check',await page.locator('.scene-art img').getAttribute('src')===beforeArt&&await page.evaluate(()=>!window.afterwave.state.institutions.some(i=>i.sourceActionId.endsWith(':complete_review'))));
 await click('window');await page.locator('[data-action="pass"][data-actor="linche"]').click();await click('commit');await click('pause-world');check('Actual submitted contract is pending, not a working group',(await page.locator('.institution-status').innerText()).includes('尚未形成新校验组'));
 await click('playback');await click('step');await click('pause-world');check('At31 the same branch coexists with pending paperwork',await page.evaluate(()=>window.afterwave.state.year===31)&&(await page.locator('.institution-status').innerText()).includes('远港分站运行中')&&(await page.locator('.institution-status').innerText()).includes('尚未形成新校验组'));
 await click('playback');await click('step');await click('pause-world');check('At32 the actual outcome adds the new check and retains failure',(await page.locator('.institution-status').innerText()).includes('第22年复核失败记录保留')&&(await page.locator('.institution-status').innerText()).includes('第32年兑现，只面向今后'));
 check('Viewing and recovery do not rewrite the old failure or crisis',frozen===await page.evaluate(()=>JSON.stringify({crisis:window.afterwave.state.flags.crisis,failure:window.afterwave.state.events.find(e=>e.actionId==='independent_review')})));await snap('390-actual-year32-map');
 const before=await page.evaluate(()=>JSON.stringify(window.afterwave.state));await page.locator('[data-action="layer"][data-layer="politics"]').click();await click('focus');await click('focus');check('Camera and layer controls preserve all source facts',before===await page.evaluate(()=>JSON.stringify(window.afterwave.state)));
 const rendered=await renderedBoard(page);await page.reload();const reloaded=await renderedBoard(page);assertReloadPreserved(rendered,reloaded);check('Reload preserves fulfilled history and exact pixels',reloaded.state===before&&reloaded.pixels===rendered.pixels);
 check('No runtime or asset errors',report.errors.length===0);
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;if(page)await page.screenshot({path:`out/round8-f6-failure.png`.replace('out/',`${out}/`),fullPage:true}).catch(()=>{});}
finally{await fs.writeFile(`${out}/round8-far-port-visual-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
