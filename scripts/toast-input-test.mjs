import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setTimeout as hostDelay} from 'node:timers/promises';
import * as sim from '../src/simulation.js';

// Visible-input checks deliberately pause Playwright's clock, not the DOM/CSS.
// Timer boundaries and fresh, unmocked-clock expiry are tested separately below.
// Never hide/recreate a toast, force clicks, retry inputs, or extend its lifetime.
const out='playtest-output',hostDelayMs=4500,toastDurationMs=3500;
await fs.mkdir(out,{recursive:true});
const report={scope:'Actual file imports at320×568; paused-clock visible-input cases (including4500ms host delays), exact3500ms/replacement timer boundaries, and a fresh unmocked-clock expiry case. Real pointer and Tab+Enter targets; unchanged precommit world, exact year20 settlement, and200% status readability. No injected CSS, forced click, input retry, or production lifetime change.',checks:[],errors:[],pointerEvents:[],hostDelays:[],ordinaryExpiry:null,unmockedReplacements:[]};
const check=(name,ok,detail)=>{report.checks.push({name,passed:!!ok,...(detail?{detail}:{})});assert.ok(ok,name);};
async function runtimeHash(){const hash=createHash('sha256');for(const name of (await fs.readdir('src',{withFileTypes:true})).filter(f=>f.isFile()).map(f=>f.name).sort()){hash.update(name);hash.update(await fs.readFile(`src/${name}`));}return hash.digest('hex');}
const hashBefore=await runtimeHash();
const failed=sim.createRun(6);
for(const id of ['independent_flood_records','unfunded_maintenance'])sim.investigate(failed,'protagonist','D4',id);
sim.lockTask(failed,'protagonist','D4','build_joint',['independent_flood_records','unfunded_maintenance']);
sim.commitWindow(failed);sim.advanceToNextWindow(failed);
assert.equal(failed.year,10);assert.ok(!failed.institutions.some(i=>i.kind==='station'&&i.active));
const expectedLocked=structuredClone(failed);sim.lockTask(expectedLocked,'protagonist','D4','recruit_risk');
const expectedCommitted=structuredClone(expectedLocked);sim.commitWindow(expectedCommitted);
const expectedSettled=structuredClone(expectedCommitted);sim.advanceToNextWindow(expectedSettled);
const corrupt=structuredClone(failed);delete corrupt.institutions[0].annualSource;
const server=await createServer({server:{host:'127.0.0.1',port:4211,strictPort:true}});await server.listen();
let browser,page;
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
const worldState=()=>page.evaluate(()=>JSON.stringify(window.afterwave.state));
const savedState=()=>page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state));
async function importFile(state,ui={}){
 await click('settings');
 await page.locator('#import-save').setInputFiles({name:'toast-regression.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({state,ui}))});
}
const toastStatus=()=>page.evaluate(()=>window.readToastStatus());
function readableImport(status,expectedText){return !!status&&status.visible&&status.role==='status'&&status.text.startsWith('已导入。')&&status.text.includes('不回写')&&status.text.includes('不复活')&&status.withinViewport&&status.noTextOverflow&&(!expectedText||status.text===expectedText);}
async function assertImportToast(label,expectedText){
 const status=await toastStatus();
 check(`${label}: original import status remains visible and readable`,readableImport(status,expectedText),status||{missing:true});
 return status.text;
}
async function keyboardActivate(mode,action,id){
 // Navigation focuses the real heading. Reach controls through actual Tab keys.
 let reached=false;
 for(let n=0;n<32;n++){
  const active=await page.evaluate(()=>({action:document.activeElement?.dataset.action,id:document.activeElement?.dataset.id}));
  if(active.action===action&&(!id||active.id===id)){reached=true;break;}
  await page.keyboard.press('Tab');
 }
 check(`${mode}: ${id||action} is reachable with Tab`,reached);
 await page.keyboard.press('Enter');
}
async function newPage(controlled){
 // The bundled single-process Chromium cannot reliably reuse a closed context.
 // Start a fresh browser to keep controlled and native clocks fully independent.
 if(browser)await browser.close();
 browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});
 page=await browser.newPage({viewport:{width:320,height:568}});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(/\[vite\].*(hot updated|page reload)/.test(m.text()))report.errors.push(`HMR:${m.text()}`);});
 page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{
  window.toastInputEvents=[];window.toastObservations=[];
  window.readToastStatus=()=>{
   const el=document.querySelector('.toast');if(!el)return null;
   const r=el.getBoundingClientRect(),style=getComputedStyle(el);
   return {text:el.textContent,role:el.getAttribute('role'),visible:style.visibility==='visible'&&style.display!=='none'&&Number(style.opacity)>0&&r.width>0&&r.height>0,rect:{x:r.x,y:r.y,width:r.width,height:r.height},withinViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,noTextOverflow:el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight};
  };
  let previousToast=null;
  new MutationObserver(()=>{
   const current=document.querySelector('.toast');
   if(current!==previousToast){window.toastObservations.push({kind:current?'shown':'removed',time:performance.now(),screen:window.afterwave?.ui.screen,status:window.readToastStatus()});previousToast=current;}
  }).observe(document,{childList:true,subtree:true});
  for(const type of ['pointerdown','pointerup','click','keydown','keyup'])document.addEventListener(type,e=>{
   const target=e.target.closest?.('[data-action]'),status=window.readToastStatus();
   window.toastInputEvents.push({type,key:e.key||null,trusted:e.isTrusted,screen:window.afterwave?.ui.screen,action:target?.dataset.action||null,id:target?.dataset.id||null,targetClass:typeof e.target.className==='string'?e.target.className:'',pointerType:e.pointerType||null,detail:e.detail,x:e.clientX,y:e.clientY,toastVisible:!!status?.visible,toastRole:status?.role,toastText:status?.text,worldUnchanged:JSON.stringify(window.afterwave?.state)===window.toastExpectedWorld,time:performance.now()});
  },true);
 });
 // Install before navigation, allow startup normally, then pause before any import.
 if(controlled)await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
 await page.goto('http://127.0.0.1:4211');await page.locator('.selection-card').waitFor();
 if(controlled)await page.clock.pauseAt(await page.evaluate(()=>Date.now()+60_000));
}
function assertInputEvents(mode,events,keyboard,importText){
 const screens={avg:'world',choose:'avg',confirm:'choice',lock:'confirm',commit:'window',skip:'playback'};
 check(`${mode}: every captured pointer/key event is trusted and has the same visible status`,events.length>0&&events.every(e=>e.trusted&&e.toastVisible&&e.toastRole==='status'&&e.toastText===importText));
 for(const action of ['avg','choose','confirm','lock','commit','skip']){
  const targetEvents=events.filter(e=>e.action===action&&(action!=='choose'||e.id==='recruit_risk'));
  if(keyboard&&action!=='avg'){
   check(`${mode}: real Enter targets ${action} once`,targetEvents.filter(e=>e.type==='keydown'&&e.key==='Enter'&&e.screen===screens[action]).length===1&&targetEvents.filter(e=>e.type==='click'&&e.detail===0&&e.screen===screens[action]).length===1);
  }else for(const type of ['pointerdown','pointerup','click']){
   const matches=targetEvents.filter(e=>e.type===type);
   check(`${mode}: ${type} targets ${action} once, never the toast`,matches.length===1&&matches[0].pointerType==='mouse'&&matches[0].screen===screens[action],matches[0]);
  }
 }
 const lockIndex=events.findIndex(e=>e.type==='click'&&e.action==='lock');
 check(`${mode}: every input through the lock click sees the unchanged imported world`,lockIndex>=0&&events.slice(0,lockIndex+1).every(e=>e.worldUnchanged));
 if(keyboard)check(`${mode}: keyboard route uses real Tab events`,events.some(e=>e.type==='keydown'&&e.key==='Tab'));
}
try{
 await newPage(true);
 // Keep the original shared-page ordering, including rejection followed by import.
 for(const mode of ['direct','invalid-then-valid','keyboard-200','delayed-direct','delayed-keyboard-200']){
  const keyboard=mode.includes('keyboard'),delayed=mode.startsWith('delayed-');
  if(mode==='invalid-then-valid'){
   await click('settings');
   const before=await worldState(),saveBefore=await page.evaluate(()=>localStorage.getItem('afterwave.save.v1'));
   await page.locator('#import-save').setInputFiles({name:'invalid-toast-regression.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({state:corrupt}))});
   await page.locator('.toast').filter({hasText:'制度结构或年度产出非法'}).waitFor();
   check('Rejected import preserves exact world and autosave',await worldState()===before&&await page.evaluate(()=>localStorage.getItem('afterwave.save.v1'))===saveBefore);
  }
  await importFile(failed,{bigText:keyboard});
  await page.waitForFunction(()=>window.afterwave.state.seed==='6'&&window.afterwave.state.year===10&&window.afterwave.ui.screen==='world');
  const importText=await assertImportToast(`${mode} import`);
  check(`${mode}: actual imported world is byte-identical`,await worldState()===JSON.stringify(failed));
  if(keyboard)check(`${mode}: 320px200% font setting and whole document stay within viewport`,await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize==='32px'&&document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(expected=>{window.toastInputEvents=[];window.toastExpectedWorld=expected;},JSON.stringify(failed));
  if(delayed){
   const browserBefore=await page.evaluate(()=>performance.now()),hostBefore=performance.now();
   await hostDelay(hostDelayMs);
   const delay={mode,requestedHostMs:hostDelayMs,elapsedHostMs:performance.now()-hostBefore,elapsedBrowserMs:await page.evaluate(before=>performance.now()-before,browserBefore)};
   report.hostDelays.push(delay);
   check(`${mode}: host delay exceeds production lifetime while application clock stays paused`,delay.elapsedHostMs>=toastDurationMs&&delay.elapsedBrowserMs===0,delay);
   await assertImportToast(`${mode} after host delay`,importText);
  }
  await click('avg');
  if(keyboard)await keyboardActivate(mode,'choose','recruit_risk');
  else await page.locator('[data-action="choose"][data-id="recruit_risk"]').click();
  check(`${mode}: free preview preserves exact world and autosave`,await worldState()===JSON.stringify(failed)&&await savedState()===JSON.stringify(failed));
  await assertImportToast(`${mode} before confirm`,importText);
  if(keyboard)await keyboardActivate(mode,'confirm');else await click('confirm');
  check(`${mode}: first real confirm input reaches lock review`,await page.evaluate(()=>window.afterwave.ui.screen==='confirm')&&await page.locator('[data-action="lock"]').count()===1);
  await assertImportToast(`${mode} after confirm`,importText);
  check(`${mode}: confirmation still has no draft, cost, history or investigation side effect`,await worldState()===JSON.stringify(failed)&&await savedState()===JSON.stringify(failed));
  await page.screenshot({path:`${out}/round12-toast-${mode}-confirm.png`});
  if(keyboard)await keyboardActivate(mode,'lock');else await click('lock');
  check(`${mode}: locking only adds the expected draft without paying or settling`,await worldState()===JSON.stringify(expectedLocked));
  if(keyboard)await keyboardActivate(mode,'commit');else await click('commit');
  check(`${mode}: submit pays exactly once and records the expected event`,await worldState()===JSON.stringify(expectedCommitted));
  if(keyboard)await keyboardActivate(mode,'skip');else await click('skip');
  const settled=JSON.parse(await worldState());
  check(`${mode}: entire year20 world matches independent engine settlement`,JSON.stringify(settled)===JSON.stringify(expectedSettled));
  check(`${mode}: archive halts at16 and recruit is available at20`,settled.year===20&&settled.phase==='planning'&&!settled.institutions.find(i=>i.kind==='archive').active&&settled.actors.some(a=>a.id==='linche'&&a.availableFrom===20)&&settled.committedWindows.filter(y=>y===10).length===1);
  const events=await page.evaluate(()=>window.toastInputEvents);
  report.pointerEvents.push({mode,clock:'paused Playwright clock',events});
  assertInputEvents(mode,events,keyboard,importText);
 }
 // Clear the shared-page notifications using their real timer callbacks. No DOM edits.
 await page.clock.runFor(toastDurationMs);
 check('Controlled clock: prior import status expires at3500ms',await toastStatus()===null);
 await importFile(failed);
 const singleText=await assertImportToast('Controlled clock single import');
 await page.clock.runFor(toastDurationMs-1);
 await assertImportToast('Controlled clock single import at3499ms',singleText);
 await page.clock.runFor(1);
 check('Controlled clock: single import expires exactly at3500ms',await toastStatus()===null);
 // A prior notification must not remove its replacement before the replacement's timer.
 for(const preceding of ['valid','invalid']){
  await importFile(preceding==='valid'?failed:corrupt);
  await page.locator('.toast').waitFor();
  await page.clock.runFor(1800);
  await importFile(failed);
  const replacementText=await assertImportToast(`Controlled ${preceding}→valid replacement`);
  await page.clock.runFor(1700);
  await assertImportToast(`Controlled ${preceding}→valid survives old timer deadline`,replacementText);
  await page.clock.runFor(1799);
  await assertImportToast(`Controlled ${preceding}→valid at replacement3499ms`,replacementText);
  await page.clock.runFor(1);
  check(`Controlled ${preceding}→valid replacement expires exactly at its own3500ms`,await toastStatus()===null);
  check(`Controlled ${preceding}→valid lifecycle preserves exact world and autosave`,await worldState()===JSON.stringify(failed)&&await savedState()===JSON.stringify(failed));
 }
 await page.close();
 // Separate fresh page/context, no clock installation, timer wrapper or mocked Date.
 // Capture appearance/removal inside the browser; slow tool round trips cannot miss it.
 await newPage(false);
 await importFile(failed,{bigText:true});
 const ordinaryHostStart=performance.now();
 await hostDelay(hostDelayMs);
 await page.waitForFunction(()=>window.toastObservations.some(o=>o.kind==='removed'),null,{polling:100,timeout:15_000});
 const observations=await page.evaluate(()=>window.toastObservations),shown=observations.find(o=>o.kind==='shown'),removed=observations.find(o=>o.kind==='removed');
 report.ordinaryExpiry={clock:'unmocked browser clock',observations,elapsedHostMs:performance.now()-ordinaryHostStart,visibleMs:removed.time-shown.time};
 check('Unmocked clock: browser observer saw the readable actual import status',readableImport(shown.status),report.ordinaryExpiry);
 // Browser timers may fire late under load; never require a slow runner to meet an upper3500ms deadline.
 check('Unmocked clock: import status lasts3500ms before natural removal',report.ordinaryExpiry.visibleMs>=3490&&await toastStatus()===null,report.ordinaryExpiry);
 check('Unmocked clock: natural expiry preserves exact world and autosave',await worldState()===JSON.stringify(failed)&&await savedState()===JSON.stringify(failed));
 await page.evaluate(expected=>{window.toastInputEvents=[];window.toastExpectedWorld=expected;},JSON.stringify(failed));
 await click('avg');await keyboardActivate('Unmocked after expiry','choose','recruit_risk');await keyboardActivate('Unmocked after expiry','confirm');
 check('Unmocked clock: delayed real Tab+Enter still reaches confirmation without world/autosave changes',await page.evaluate(()=>window.afterwave.ui.screen==='confirm')&&await worldState()===JSON.stringify(failed)&&await savedState()===JSON.stringify(failed));
 const expiredEvents=await page.evaluate(()=>window.toastInputEvents);
 report.pointerEvents.push({mode:'unmocked-after-expiry',clock:'unmocked browser clock',events:expiredEvents});
 check('Unmocked clock: delayed confirm is trusted Enter after natural expiry, not a visible-toast claim',expiredEvents.some(e=>e.type==='keydown'&&e.key==='Enter'&&e.action==='confirm'&&e.trusted)&&expiredEvents.some(e=>e.type==='click'&&e.action==='confirm'&&e.detail===0&&e.trusted)&&expiredEvents.every(e=>!e.toastVisible&&e.worldUnchanged));
 await page.close();
 // Native-clock overlap is orchestrated inside the browser, so tool latency cannot
 // consume the overlap window. These lifecycle-only File/change events use the
 // real import handler, not direct state assignment; they are not pointer evidence.
 for(const preceding of ['valid','invalid']){
  await newPage(false);
  await page.evaluate(payload=>{
   window.nativeReplacement={requestedDelayMs:1800,dispatchedAt:null,priorVisible:false,error:null};
   const observer=new MutationObserver(()=>{
    if(!document.querySelector('.toast'))return;
    observer.disconnect();
    setTimeout(()=>{
     try{
      window.nativeReplacement.priorVisible=!!window.readToastStatus()?.visible;
      document.querySelector('[data-action="settings"]').click();
      const input=document.querySelector('#import-save'),transfer=new DataTransfer();
      transfer.items.add(new File([payload],'replacement-toast-regression.json',{type:'application/json'}));
      input.files=transfer.files;
      window.nativeReplacement.dispatchedAt=performance.now();
      input.dispatchEvent(new Event('change',{bubbles:true}));
     }catch(error){window.nativeReplacement.error=error.message;}
    },1800);
   });
   observer.observe(document,{childList:true,subtree:true});
  },JSON.stringify({state:failed,ui:{bigText:true}}));
  await importFile(preceding==='valid'?failed:corrupt,{bigText:true});
  await page.waitForFunction(()=>window.nativeReplacement.error||(window.nativeReplacement.dispatchedAt!==null&&window.toastObservations.some(o=>o.kind==='removed'&&o.time>=window.nativeReplacement.dispatchedAt)),null,{polling:100,timeout:15_000});
  const evidence=await page.evaluate(()=>({replacement:window.nativeReplacement,observations:window.toastObservations}));
  const first=evidence.observations.find(o=>o.kind==='shown'),replacement=evidence.observations.find(o=>o.kind==='shown'&&o.screen==='world'&&o.time>=evidence.replacement.dispatchedAt),removal=evidence.observations.find(o=>o.kind==='removed'&&o.time>=evidence.replacement.dispatchedAt);
  evidence.mode=`${preceding}→valid`;evidence.clock='unmocked browser clock';evidence.input='native browser-scheduled File/change lifecycle test, not a real pointer test';
  evidence.replacementVisibleMs=replacement&&removal?removal.time-replacement.time:null;
  report.unmockedReplacements.push(evidence);
  check(`Unmocked ${preceding}→valid: second file import replaces an actually visible status`,!evidence.replacement.error&&first?.status.visible&&evidence.replacement.priorVisible&&replacement?.time>first.time&&readableImport(replacement.status),evidence);
  check(`Unmocked ${preceding}→valid: old timeout does not shorten replacement3500ms lifetime`,evidence.replacementVisibleMs>=3490&&await toastStatus()===null,evidence);
  check(`Unmocked ${preceding}→valid: import and both timers preserve exact world/autosave`,await worldState()===JSON.stringify(failed)&&await savedState()===JSON.stringify(failed));
  await page.close();
 }
 check('No runtime, asset or hot-reload errors',report.errors.length===0);
 report.runtimeHash={before:hashBefore,after:await runtimeHash()};
 check('Runtime stayed frozen throughout the regression',report.runtimeHash.before===report.runtimeHash.after);
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;if(page&&!page.isClosed()){report.failure.pointerEvents=await page.evaluate(()=>window.toastInputEvents).catch(()=>[]);await page.screenshot({path:`${out}/round12-toast-input-failure.png`,fullPage:true}).catch(()=>{});}}
finally{await fs.writeFile(`${out}/round12-toast-input-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
