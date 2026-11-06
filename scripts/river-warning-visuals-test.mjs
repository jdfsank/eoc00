import {readDecisionDetails} from './helpers/decision-reading.mjs';
import {chromium} from 'playwright';
import cb from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {getActions,validateState} from '../src/simulation.js';
import {sceneArt} from '../src/scene-art.js';
import {warningAt20,warningPending,warningAt30,lock} from '../tests/helpers/river-warning.js';
const out='playtest-output';await fs.mkdir(out,{recursive:true});
const report={checks:[],errors:[],scope:'Engine-generated unbuilt and failed-archive routes, real resident warning fulfilment at21 and playable return at30. Upkeep/closure are legal boundary fixtures, not newly added actions. Chromium390/320,200% text and grayscale; not physical-device certification. No public AVG is claimed during playback.'};
const check=(name,ok)=>{report.checks.push({name,passed:!!ok});assert.ok(ok,name);};
const before=warningAt20(),locked=structuredClone(before);lock(locked,'protagonist','D4','free_warning');const pending=warningPending();
const active=warningAt30(),archive=warningAt30('archive'),maintenance=structuredClone(active),stopped=structuredClone(active),zero=structuredClone(active);
maintenance.institutions.find(i=>i.kind==='warning').maintenance=.5;stopped.institutions.find(i=>i.kind==='warning').active=false;zero.institutions.find(i=>i.kind==='warning').maintenance=0;
const cases={before,locked,active,archive,maintenance,stopped,zero,'station-restored':warningAt30('station'),'station-stopped':warningAt20('station')};
for(const [name,state]of Object.entries({...cases,pending}))assert.equal(validateState(state).valid,true,name);
const server=await createServer({server:{host:'127.0.0.1',port:4203,strictPort:true}});await server.listen();let browser,page;
const click=async a=>{await page.locator(`[data-action="${a}"]`).first().click();await readDecisionDetails(page);};
async function show(state,bigText=false){
 await click('settings');await page.locator('#import-save').setInputFiles({name:'river-warning.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({state,ui:{selected:'D4',screen:'world',actor:'protagonist',channel:'science',focus:true,bigText}}))});
 await page.waitForFunction(expected=>window.afterwave.ui.screen==='world'&&JSON.stringify(window.afterwave.state)===expected,JSON.stringify(state));await page.locator('canvas').waitFor();await page.locator('.toast').waitFor({state:'detached'});await page.waitForTimeout(80);
}
async function snap(name,selector='.scene-art',mono=false){const target=page.locator(selector);if(mono)await target.evaluate(el=>el.style.filter='grayscale(1)');const pixels=await target.screenshot({path:`${out}/round9-d4-${name}${mono?'-mono':''}.png`});if(mono)await target.evaluate(el=>el.style.filter='');return pixels.toString('base64');}
async function sceneFile(){return (await page.locator('.scene-art img').getAttribute('src')).split('/').at(-1);}
async function canvasPixels(){await page.waitForTimeout(80);return page.locator('canvas').evaluate(c=>c.toDataURL());}
try{
 browser=await chromium.launch({executablePath:await cb.executablePath(),args:cb.args,headless:true});page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});await page.goto('http://127.0.0.1:4203');await page.locator('canvas').waitFor();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===390?844:568});const mono={};
  for(const [name,state]of Object.entries(cases)){
   await show(state);await snap(`${width}-${name}-map`,'.map-frame');await click('avg');
   check(`${width}px ${name}: imported state selects its real scene`,await sceneFile()===sceneArt(state,'D4').file);
   check(`${width}px ${name}: viewing does not mutate any history`,await page.evaluate(()=>JSON.stringify(window.afterwave.state))===JSON.stringify(state));
   await snap(`${width}-${name}-scene`);if(width===390&&name==='active')await page.screenshot({path:`${out}/round9-d4-390-active-avg.png`,fullPage:true});if(['active','maintenance','stopped'].includes(name)){
    mono[name]=await snap(`${width}-${name}-scene`,'.scene-art',true);
    check(`${width}px ${name}: caption does not cover bell or old archive`,await page.locator('.scene-art').evaluate(el=>el.querySelector('span').getBoundingClientRect().top>=el.querySelector('img').getBoundingClientRect().bottom-1));
   }
   if(['active','archive','stopped','station-restored'].includes(name)){
    await page.reload();await page.locator('.scene-art img').waitFor();check(`${width}px ${name}: reload preserves imported service and scene`,await sceneFile()===sceneArt(state,'D4').file&&await page.evaluate(()=>JSON.stringify(window.afterwave.state))===JSON.stringify(state));
   }
  }
  check(`${width}px active, upkeep and stopped scenes remain different in grayscale`,new Set(Object.values(mono)).size===3);
  for(const [name,state]of [['active',active],['archive',archive],['stopped',stopped]]){
   await show(state,true);await click('avg');check(`${width}px200% ${name}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   check(`${width}px200% ${name}: complete caption stays below artwork`,await page.locator('.scene-art').evaluate(el=>{const box=el.getBoundingClientRect(),image=el.querySelector('img').getBoundingClientRect(),caption=el.querySelector('span').getBoundingClientRect();return caption.top>=image.bottom-1&&caption.bottom<=box.bottom+1;}));
   await page.locator('.scene-art').scrollIntoViewIfNeeded();check(`${width}px200% ${name}: visible caption is not covered by a toast or control`,await page.locator('.scene-art>span').evaluate(caption=>{const r=caption.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return top===caption||caption.contains(top);}));
   await snap(`${width}-${name}-text200-scene`);if(width===320&&name==='active')await page.screenshot({path:`${out}/round9-d4-320-active-text200-avg.png`,fullPage:true});await page.locator('.choice-card').last().scrollIntoViewIfNeeded();check(`${width}px200% ${name}: last actual choice is reachable`,await page.locator('.choice-card').last().isVisible());
  }
 }
 // A player-visible route: lock does not build, submission waits, year21
 // fulfils the service, and only the year30 window offers another AVG visit.
 await page.setViewportSize({width:390,height:844});await show(before);await click('avg');const initial=await sceneFile();
 for(const id of getActions(before,'D4','protagonist').find(a=>a.id==='free_warning').requireEvidence){await page.locator(`[data-evidence-id="${id}"] > summary`).click();await page.locator(`[data-action="evidence"][data-id="${id}"]`).click();}
 await page.locator('[data-action="choose"][data-id="free_warning"]').click();await click('confirm');await click('lock');await click('home');await click('avg');check('Actual lock retains archive-only scene',await sceneFile()===initial);
 await click('window');await page.locator('[data-action="pass"][data-actor="linche"]').click();await click('commit');await click('pause-world');
 check('Actual submission remains waiting with no invented warning institution',await page.evaluate(()=>!window.afterwave.state.institutions.some(i=>i.kind==='warning')&&window.afterwave.state.events.some(e=>e.actionId==='free_warning'&&e.status==='pending')));
 await snap('390-actual-pending-map','.map-frame');await click('playback');await click('step');await click('pause-world');
 check('At21 a real fulfilled warning institution replaces the pending promise',await page.evaluate(()=>window.afterwave.state.year===21&&window.afterwave.state.institutions.some(i=>i.kind==='warning'&&i.active)&&!window.afterwave.state.institutions.some(i=>i.kind==='station')&&window.afterwave.state.events.some(e=>e.actionId==='free_warning'&&e.status==='success'&&e.resolvedYear===21)));
 await snap('390-actual-year21-map','.map-frame');await click('playback');await click('skip');await click('home');await click('avg');
 check('Public year30 revisit shows the fulfilled resident bell',await page.evaluate(()=>window.afterwave.state.year===30)&&await sceneFile()==='river-warning-active.svg');await snap('390-actual-year30-scene');
 const saved=await page.evaluate(()=>structuredClone({state:window.afterwave.state,ui:window.afterwave.ui}));await click('settings');const downloadPromise=page.waitForEvent('download');await click('export');const download=await downloadPromise;await download.saveAs(`${out}/round9-warning-export.json`);const exported=JSON.parse(await fs.readFile(`${out}/round9-warning-export.json`,'utf8'));
 check('Export contains the exact fulfilled service and source history',JSON.stringify(saved.state)===JSON.stringify(exported.state));await show(exported.state);const pixels=await canvasPixels();await page.reload();await page.locator('canvas').waitFor();check('Imported export reloads the same map pixels and history',pixels===await canvasPixels()&&JSON.stringify(exported.state)===await page.evaluate(()=>JSON.stringify(window.afterwave.state)));await click('avg');check('Imported export keeps the resident scene without rebuilding a station',await sceneFile()==='river-warning-active.svg');
 check('No runtime or missing asset errors',report.errors.length===0);
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;if(page)await page.screenshot({path:`${out}/round9-d4-warning-failure.png`,fullPage:true}).catch(()=>{});}
finally{await fs.writeFile(`${out}/round9-river-warning-visual-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
