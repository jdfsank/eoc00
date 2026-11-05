import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,passTask,commitWindow,advanceToNextWindow,advanceYear,validateState} from '../src/simulation.js';
import {investigateAndLock} from '../tests/helpers/play.js';
import {sceneArt} from '../src/scene-art.js';
import {institutionVisual} from '../src/board-visuals.js';
const out='playtest-output';await fs.mkdir(out,{recursive:true});
const report={checks:[],errors:[],scope:'Real engine routes build aid at11 and revisit at20. Separate legal boundary fixtures turn teaching/aid off independently; the game does not expose a shutdown button. Restart then follows the actual mutual-aid action. Chromium390/320 and200% text, not device/accessibility certification.'};
const check=(name,ok)=>{report.checks.push({name,passed:!!ok});assert.ok(ok,name);};
const next=s=>{if(!s.drafts.protagonist)passTask(s,'protagonist');commitWindow(s);advanceToNextWindow(s);return s;};
const empty10=next(createRun(0)),empty20=next(structuredClone(empty10));
const aid10=structuredClone(empty10);investigateAndLock(aid10,'protagonist','D5','mutual_aid');const aid20=next(structuredClone(aid10));
const teaching10=createRun(0);investigateAndLock(teaching10,'protagonist','D4','build_joint');next(teaching10);
const teaching20=next(structuredClone(teaching10));const both20=structuredClone(teaching10);investigateAndLock(both20,'protagonist','D5','mutual_aid');next(both20);
function boundary(s,{teaching=true,aid=true}={}){const v=structuredClone(s);for(const i of v.institutions.filter(i=>i.cellId==='D5'))if(['training','school'].includes(i.kind))i.active=teaching;else if(i.kind==='mutual')i.maintenance=aid?1:0;assert.equal(validateState(v).valid,true);return v;}
const aidClosed=boundary(aid20,{aid:false}),learningClosed=boundary(both20,{teaching:false}),shedClosed=boundary(both20,{aid:false}),bothClosed=boundary(both20,{teaching:false,aid:false});
const restarted=structuredClone(bothClosed);investigateAndLock(restarted,'protagonist','D5','mutual_aid');next(restarted);
const cases={unbuilt:empty20,locked:aid10,aid:aid20,teaching:teaching20,both:both20,'aid-closed':aidClosed,'learning-closed':learningClosed,'shed-closed':shedClosed,'both-closed':bothClosed,restarted};
const server=await createServer({server:{host:'127.0.0.1',port:4199,strictPort:true}});await server.listen();let browser,page;
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
async function show(state,bigText=false){await page.evaluate(({state,bigText})=>sessionStorage.setItem('afterwave.south.fixture',JSON.stringify({state,ui:{screen:'world',selected:'D5',actor:'protagonist',channel:'science',focus:true,bigText}})),{state,bigText});await page.reload();await page.locator('canvas').waitFor();await page.waitForTimeout(130);}
async function shot(name,selector='.map-frame',mono=false){const target=page.locator(selector);if(mono)await target.evaluate(el=>el.style.filter='grayscale(1)');await target.screenshot({path:`${out}/round7-d5-${name}${mono?'-mono':''}.png`});if(mono)await target.evaluate(el=>el.style.filter='');}
async function pixels(){await page.waitForTimeout(70);return page.locator('canvas').evaluate(c=>c.toDataURL());}
try{
 browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{const f=sessionStorage.getItem('afterwave.south.fixture');if(f){localStorage.setItem('afterwave.save.v1',f);sessionStorage.removeItem('afterwave.south.fixture');}});await page.goto('http://127.0.0.1:4199');await page.locator('canvas').waitFor();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===390?844:568});const captures={};
  for(const [name,state] of Object.entries(cases)){
   await show(state);const visual=institutionVisual(state,'D5'),art=sceneArt(state,'D5');
   check(`${width}px ${name} map text names only existing service states`,visual?await page.locator('.institution-status').innerText()===visual.label:!await page.locator('.institution-status').count());
   captures[name]=await pixels();await shot(`${width}-${name}-map`);if(['both','both-closed','restarted'].includes(name))await shot(`${width}-${name}-map`,'.map-frame',true);
   await click('avg');check(`${width}px ${name} scene chooses the correct physical history`,(await page.locator('.scene-art img').getAttribute('src')).endsWith(art.file));check(`${width}px ${name} caption agrees with independent states`,await page.locator('.scene-art img').getAttribute('alt')===art.alt);
   if(art.captionBelow)check(`${width}px ${name} standard caption does not hide either service`,await page.locator('.scene-art').evaluate(el=>el.querySelector('span').getBoundingClientRect().top>=el.querySelector('img').getBoundingClientRect().bottom-1));
   await shot(`${width}-${name}-scene`,'.scene-art');check(`${width}px ${name} viewing has no simulation side effects`,await page.evaluate(()=>JSON.stringify(window.afterwave.state))===JSON.stringify(state));
  }
  check(`${width}px a real aid outcome visibly changes the map`,captures.unbuilt!==captures.aid);
  check(`${width}px coexisting aid is visible beyond the teaching silhouette`,captures.teaching!==captures.both);
  check(`${width}px independently closed services use different shapes`,new Set([captures.both,captures['learning-closed'],captures['shed-closed'],captures['both-closed']]).size===4);
  await show(bothClosed,true);await shot(`${width}-closed-text200-map`);check(`${width}px 200% map has no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await click('avg');await shot(`${width}-closed-text200-scene`,'.scene-art');
  check(`${width}px 200% caption is below the illustration`,await page.locator('.scene-art').evaluate(el=>el.querySelector('span').getBoundingClientRect().top>=el.querySelector('img').getBoundingClientRect().bottom-1));check(`${width}px 200% scene has no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${out}/round7-d5-${width}-closed-text200-avg.png`,fullPage:true});
 }
 // Real UI: lock at10, wait, apply at11, and revisit at20. No premature warehouse.
 await page.setViewportSize({width:390,height:844});await show(empty10);await click('avg');await page.locator('[data-action="choose"][data-id="mutual_aid"]').click();await click('confirm');await click('lock');await click('home');
 check('Actual lock shows only intent and no mutual institution',await page.locator('.map-activity').count()===1&&!await page.locator('.institution-status').count());await click('avg');check('Locked contract retains the unbuilt shore',(await page.locator('.scene-art img').getAttribute('src')).endsWith('open-shore.svg'));await click('window');await click('commit');await click('pause-world');
 check('Submitted contract remains a wait rather than an operating shed',await page.locator('.map-activity').count()===1&&!await page.locator('.institution-status').count());await click('playback');await click('step');await click('pause-world');
 check('Actual year11 outcome creates the aid visual and removes waiting',await page.evaluate(()=>window.afterwave.state.year===11)&&!await page.locator('.map-activity').count()&&(await page.locator('.institution-status').innerText()).includes('互助仓运行中'));await shot('390-year11-map');await click('playback');await click('skip');await click('home');await click('avg');check('Actual year20 return retains the working aid shed',(await page.locator('.scene-art img').getAttribute('src')).endsWith('south-bank-aid.svg'));await shot('390-year20-return-scene','.scene-art');
 // Mixed reactivation on the same canvas must clear only the aid closure.
 await show(bothClosed);const closed=await pixels();await page.evaluate(()=>{document.querySelector('canvas').dataset.reuse='same';const s=window.afterwave.state;s.institutions.find(i=>i.kind==='mutual'&&i.cellId==='D5').maintenance=1;window.afterwave.navigate('world');});
 check('Same-canvas reopening removes the shed closure but retains stopped teaching',await page.locator('canvas').getAttribute('data-reuse')==='same'&&await pixels()!==closed&&(await page.locator('.institution-status').innerText()).includes('读尺班停运')&&(await page.locator('.institution-status').innerText()).includes('互助仓运行中'));
 const before=await page.evaluate(()=>JSON.stringify(window.afterwave.state));await click('focus');await page.locator('[data-action="layer"][data-layer="politics"]').click();await click('focus');check('Focus and layer controls preserve independent service states',before===await page.evaluate(()=>JSON.stringify(window.afterwave.state)));
 check('No runtime or asset errors',report.errors.length===0);
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;if(page)await page.screenshot({path:`${out}/round7-d5-failure.png`,fullPage:true}).catch(()=>{});}
finally{await fs.writeFile(`${out}/round7-south-bank-visual-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
