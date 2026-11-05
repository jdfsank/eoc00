import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';

// Exercise the real import notification. Do not hide it, wait for dismissal,
// force clicks, retry missed inputs, or inject CSS: it must not consume input.
const out='playtest-output';
await fs.mkdir(out,{recursive:true});
const report={scope:'Actual file imports at320×568, direct and invalid→valid; real pointer targets, unchanged precommit world, exact year20 settlement, and200% keyboard/status readability. No injected CSS, forced click, retry, or toast-dismissal wait.',checks:[],errors:[],pointerEvents:[]};
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
async function toastStatus(){return page.locator('.toast').evaluate(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,role:el.getAttribute('role'),visible:getComputedStyle(el).visibility!=='hidden'&&r.width>0&&r.height>0,rect:{x:r.x,y:r.y,width:r.width,height:r.height},withinViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,noTextOverflow:el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight};});}
async function assertImportToast(label,expectedText){
 const status=await toastStatus();
 check(`${label}: original import status remains visible and readable`,status.visible&&status.role==='status'&&status.text.startsWith('已导入。')&&status.text.includes('不回写')&&status.text.includes('不复活')&&status.withinViewport&&status.noTextOverflow&&(!expectedText||status.text===expectedText),status);
 return status.text;
}
async function keyboardActivate(action,id){
 // Navigation focuses the real heading. Reach controls through actual Tab keys.
 let reached=false;
 for(let n=0;n<32;n++){
  const active=await page.evaluate(()=>({action:document.activeElement?.dataset.action,id:document.activeElement?.dataset.id}));
  if(active.action===action&&(!id||active.id===id)){reached=true;break;}
  await page.keyboard.press('Tab');
 }
 check(`200%: ${id||action} is reachable with Tab`,reached);
 await page.keyboard.press('Enter');
}
try{
 browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});
 page=await browser.newPage({viewport:{width:320,height:568}});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(/\[vite\].*(hot updated|page reload)/.test(m.text()))report.errors.push(`HMR:${m.text()}`);});
 page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{
  window.toastInputEvents=[];
  for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,e=>{
   const target=e.target.closest?.('[data-action]'),toast=document.querySelector('.toast');
   window.toastInputEvents.push({type,screen:window.afterwave?.ui.screen,action:target?.dataset.action||null,id:target?.dataset.id||null,targetClass:typeof e.target.className==='string'?e.target.className:'',pointerType:e.pointerType||null,detail:e.detail,x:e.clientX,y:e.clientY,toastVisible:!!toast&&toast.getBoundingClientRect().height>0,toastRole:toast?.getAttribute('role'),toastText:toast?.textContent,time:performance.now()});
  },true);
 });
 await page.goto('http://127.0.0.1:4211');await page.locator('.selection-card').waitFor();
 for(const mode of ['direct','invalid-then-valid','keyboard-200']){
  if(mode==='invalid-then-valid'){
   await click('settings');
   const before=await worldState(),saveBefore=await page.evaluate(()=>localStorage.getItem('afterwave.save.v1'));
   await page.locator('#import-save').setInputFiles({name:'invalid-toast-regression.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({state:corrupt}))});
   await page.locator('.toast').filter({hasText:'制度结构或年度产出非法'}).waitFor();
   check('Rejected import preserves exact world and autosave',await worldState()===before&&await page.evaluate(()=>localStorage.getItem('afterwave.save.v1'))===saveBefore);
  }
  await importFile(failed,{bigText:mode==='keyboard-200'});
  await page.waitForFunction(()=>window.afterwave.state.seed==='6'&&window.afterwave.state.year===10&&window.afterwave.ui.screen==='world');
  const importText=await assertImportToast(`${mode} import`);
  check(`${mode}: actual imported world is byte-identical`,await worldState()===JSON.stringify(failed));
  if(mode==='keyboard-200')check('320px200%: font setting and whole document stay within viewport',await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize==='32px'&&document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{window.toastInputEvents=[];});
  await click('avg');
  if(mode==='keyboard-200')await keyboardActivate('choose','recruit_risk');
  else await page.locator('[data-action="choose"][data-id="recruit_risk"]').click();
  check(`${mode}: free preview preserves exact world and autosave`,await worldState()===JSON.stringify(failed)&&await savedState()===JSON.stringify(failed));
  await assertImportToast(`${mode} before confirm`,importText);
  if(mode==='keyboard-200')await keyboardActivate('confirm');else await click('confirm');
  check(`${mode}: first real confirm input reaches lock review`,await page.evaluate(()=>window.afterwave.ui.screen==='confirm')&&await page.locator('[data-action="lock"]').count()===1);
  await assertImportToast(`${mode} after confirm`,importText);
  check(`${mode}: confirmation still has no draft, cost, history or investigation side effect`,await worldState()===JSON.stringify(failed)&&await savedState()===JSON.stringify(failed));
  const events=await page.evaluate(()=>window.toastInputEvents);
  report.pointerEvents.push({mode,events});
  if(mode==='keyboard-200')check('200%: Enter activates confirm while status is visible',events.some(e=>e.type==='click'&&e.action==='confirm'&&e.detail===0&&e.toastVisible&&e.toastRole==='status'));
  else for(const type of ['pointerdown','pointerup','click']){
   const event=events.filter(e=>e.type===type&&e.screen==='choice').at(-1);
   check(`${mode}: ${type} targets confirm, never the toast`,event?.action==='confirm'&&event.toastVisible&&event.toastRole==='status',event);
  }
  await page.screenshot({path:`${out}/round12-toast-${mode}-confirm.png`});
  if(mode==='keyboard-200')await keyboardActivate('lock');else await click('lock');
  check(`${mode}: locking only adds the expected draft without paying or settling`,await worldState()===JSON.stringify(expectedLocked));
  if(mode==='keyboard-200')await keyboardActivate('commit');else await click('commit');
  check(`${mode}: submit pays exactly once and records the expected event`,await worldState()===JSON.stringify(expectedCommitted));
  if(mode==='keyboard-200')await keyboardActivate('skip');else await click('skip');
  const settled=JSON.parse(await worldState());
  check(`${mode}: entire year20 world matches independent engine settlement`,JSON.stringify(settled)===JSON.stringify(expectedSettled));
  check(`${mode}: archive halts at16 and recruit is available at20`,settled.year===20&&settled.phase==='planning'&&!settled.institutions.find(i=>i.kind==='archive').active&&settled.actors.some(a=>a.id==='linche'&&a.availableFrom===20)&&settled.committedWindows.filter(y=>y===10).length===1);
 }
 check('No runtime, asset or hot-reload errors',report.errors.length===0);
 report.runtimeHash={before:hashBefore,after:await runtimeHash()};
 check('Runtime stayed frozen throughout the regression',report.runtimeHash.before===report.runtimeHash.after);
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;if(page){report.failure.pointerEvents=await page.evaluate(()=>window.toastInputEvents).catch(()=>[]);await page.screenshot({path:`${out}/round12-toast-input-failure.png`,fullPage:true}).catch(()=>{});}}
finally{await fs.writeFile(`${out}/round12-toast-input-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
