// Independent actual-input regression. File.text completion is gated; a read-only probe waits for actual Phaser readiness.
// Never replace the browser world or mutate a producer's rule/version fields.
import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import {boardReadinessPlugin,renderedBoard} from './helpers/board-readiness.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as producer from '../tests/fixtures/pre-decision-flow-producer/simulation.js';
import * as older from '../tests/fixtures/pre-training-workload-producer/simulation.js';
import * as legacy from '../tests/fixtures/pre-tradeoffs-simulation.js';
import {routes} from '../tests/fixtures/round24-investigation-routes.js';
const root=process.env.ROUND26_IMPORT_QA_OUTPUT||'playtest-output/round26-import-safety';
const report={startedAt:new Date().toISOString(),checks:[],errors:[],requestFailures:[],downloadTransfers:[],cases:[],screenshots:[],scope:'Real file inputs, navigation, new-run, investigation, lock/submit and annual controls. Genuine historical producers are the oracle. File.text timing/rejection is test-controlled without changing file bytes or browser world. The existing read-only board probe exposes the real Phaser instance only to await load completion and postrender; renderer behavior is unchanged. This deterministic timing fault injection does not establish natural occurrence frequency, physical-device or screen-reader certification.'};
const bytes=JSON.stringify;
function check(name,ok,detail){report.checks.push({name,passed:!!ok,...(detail===undefined?{}:{detail})});assert.ok(ok,name);}
async function hash(){const h=createHash('sha256');async function walk(dir){for(const f of(await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=`${dir}/${f.name}`;if(f.isDirectory())await walk(p);else{h.update(p);h.update(await fs.readFile(p));}}}await walk('src');return h.digest('hex');}
await fs.mkdir(root,{recursive:true});report.sourceBefore=await hash();
const server=await createServer({plugins:[boardReadinessPlugin()],server:{host:'127.0.0.1',port:Number(process.env.ROUND26_IMPORT_QA_PORT||4214),strictPort:true}});await server.listen();let browser,page;
const files={};let currentStep='startup';
function verifiedDownloadTransfer(f,transfers){return f.url.startsWith('blob:')&&f.reason==='net::ERR_ABORTED'&&transfers.some(d=>d.url===f.url&&d.saved&&d.failure===null&&d.completeWorldExact);}
async function file(name,content){const path=`${root}/${name}`;await fs.writeFile(path,typeof content==='string'?content:bytes(content));files[name]=path;return path;}
const A=producer.createRun(101),B=producer.createRun(202);
await file('slow-valid.json',{state:A});await file('fast-valid.json',{state:B});await file('slow-invalid.json','{ invalid json');await file('fast-invalid.json','{ invalid json');await file('slow-read-error.json',{state:A});await file('invalid-world.json',{state:null});await file('too-large.json',' '.repeat(5_000_001));
async function settled(){if(await page.evaluate(()=>window.afterwave?.ui.screen==='world'))await renderedBoard(page);}
const click=async a=>{currentStep=`click:${a}`;await settled();await page.locator(`[data-action="${a}"]`).first().click();await settled();};
const read=()=>page.evaluate(()=>({world:JSON.stringify(window.afterwave.state),saved:JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state),ui:JSON.stringify(window.afterwave.ui),screen:window.afterwave.ui.screen,toast:document.querySelector('.toast')?.textContent||''}));
async function afterMutation(s,label){
 const expected=JSON.stringify(s);
 const probe=await page.evaluate(expected=>{const a=window.afterwave,raw=localStorage.getItem('afterwave.save.v1');return {live:JSON.stringify(a.state)===expected,durable:!!raw&&JSON.stringify(JSON.parse(raw).state)===expected,pending:a.storage.pending};},expected);
 check(label+' immediately exact live world',probe.live);
 check(label+' disk exact or pending',probe.durable||probe.pending);
 await page.waitForFunction(expected=>{const a=window.afterwave,raw=localStorage.getItem('afterwave.save.v1');return !a.storage.pending&&!!raw&&JSON.stringify(JSON.parse(raw).state)===expected;},expected);
 await exact(s,label+' after settled write');
}
async function exact(s,label){const actual=await read();check(`${label}: complete world exact`,actual.world===bytes(s));check(`${label}: complete saved world exact`,actual.saved===bytes(s));}
async function settings(){await click('settings');await page.locator('#import-save').waitFor();}
async function input(name,{expected='success'}={}){
 currentStep=`input:${name}`;
 await page.evaluate(()=>window.__round26PriorToast=document.querySelector('.toast'));
 await page.locator('#import-save').setInputFiles(files[name]);
 if(expected==='pending')return;
 await page.waitForFunction(expected=>{const t=document.querySelector('.toast');return t&&t!==window.__round26PriorToast&&(expected==='success'?window.afterwave.ui.screen==='world'&&t.textContent.startsWith('已导入。'):window.afterwave.ui.screen==='settings'&&!t.textContent.startsWith('已导入。'));},expected);await settled();
}
async function importWorld(s,label,ui={}){await file(`${label}.json`,{state:s,ui});await settings();await input(`${label}.json`);await exact(s,`${label} import`);}
async function hold(name){await page.evaluate(name=>{delete window.__round26Reads[name];window.__round26ReadPlans[name]={hold:true};},name);}
async function pending(name){await settings();await hold(name);await input(name,{expected:'pending'});await page.waitForFunction(name=>window.__round26Reads[name]?.ready,name);check(`${name}: reading status is visible`,await page.locator('[role="status"]').filter({hasText:'正在读取存档'}).isVisible());}
async function release(name,{reject=false}={}){
 currentStep=`release:${name}:${reject?'reject':'resolve'}`;
 await page.evaluate(({name,reject})=>{const c=window.__round26Reads[name];reject?c.reject(new Error('受控读取失败')):c.release();},{name,reject});
 await page.waitForFunction(name=>window.__round26Reads[name]?.done,name);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await settled();
}
async function stale(name,s,label,{reject=false}={}){
 const before=await read();await release(name,{reject});const after=await read();
 await exact(s,label);check(`${label}: navigation and UI unchanged`,after.ui===before.ui);
 check(`${label}: stale result adds no success or error message`,after.toast===before.toast||(!after.toast&&!!before.toast));
 check(`${label}: no pending status remains`,await page.locator('[role="status"]').filter({hasText:'正在读取存档'}).count()===0);
 report.cases.push({label,completeWorldPreserved:after.world===before.world,completeSavedWorldPreserved:after.saved===before.saved,uiPreserved:after.ui===before.ui,staleToastAbsent:after.toast===before.toast||(!after.toast&&!!before.toast)});
}
async function capture(name){const path=`${root}/${name}.png`;await page.screenshot({path});const data=await fs.readFile(path);report.screenshots.push({path,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
try{
 browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});report.browserVersion=await browser.version();page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.requestFailures.push({url:r.url(),reason:r.failure()?.errorText,type:r.resourceType(),step:currentStep}));page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:')&&r.status()>=400)report.errors.push(`HTTP ${r.status()} ${r.url()}`);});page.on('console',m=>{if(/\[vite\].*(hot updated|page reload)/.test(m.text()))report.errors.push(m.text());});
 await page.addInitScript(()=>{
  window.__round26DocumentId=`${Date.now()}:${Math.random()}`;window.__round26ReadPlans={};window.__round26Reads={};const original=File.prototype.text;
  File.prototype.text=async function(){
   const name=this.name,plan=window.__round26ReadPlans[name];
   const value=await original.call(this);
   if(!plan?.hold)return value;
   delete window.__round26ReadPlans[name];
   const control=window.__round26Reads[name]={ready:true,done:false};
   try{await new Promise((resolve,reject)=>{control.release=resolve;control.reject=reject;});return value;}finally{control.done=true;}
  };
 });
 await page.goto(`http://127.0.0.1:${process.env.ROUND26_IMPORT_QA_PORT||4214}`);await page.locator('.selection-card').waitFor();
 // Older successful import must lose to a newer actual import.
 await pending('slow-valid.json');await input('fast-valid.json');await exact(B,'newer B before stale A');await stale('slow-valid.json',B,'slow A / fast B');
 // Both a stale parse error and a stale read rejection must stay silent.
 for(const [name,reject]of [['slow-invalid.json',false],['slow-read-error.json',true]]){
  await pending(name);await input('fast-valid.json');await stale(name,B,`${name} after newer B`,{reject});
 }
 // A newer invalid file is still newer intent and must cancel older A.
 await pending('slow-valid.json');await input('fast-invalid.json',{expected:'error'});await exact(B,'invalid newer B keeps original world');await stale('slow-valid.json',B,'slow A / invalid fast B');
 // Current errors are reported, remove busy state, and never damage the current save.
 for(const name of ['invalid-world.json','too-large.json']){
  await pending('slow-valid.json');await input(name,{expected:'error'});await exact(B,`${name} current rejection preserves world`);await stale('slow-valid.json',B,`slow A / rejected ${name}`);
 }
 await pending('slow-read-error.json');await release('slow-read-error.json',{reject:true});
 check('Current read rejection is visibly reported',/受控读取失败/.test((await read()).toast));await exact(B,'current read rejection');
 check('Current read rejection removes busy message',await page.locator('[role="status"]').filter({hasText:'正在读取存档'}).count()===0);
 // Canceling the chooser supplies no file and does not cancel an earlier real read.
 await pending('slow-valid.json');await page.locator('#import-save').setInputFiles([]);await exact(B,'empty chooser while A pending');
 check('Empty chooser leaves reading status visible',await page.locator('[role="status"]').filter({hasText:'正在读取存档'}).isVisible());
 await release('slow-valid.json');await page.waitForFunction(()=>window.afterwave.ui.screen==='world');await exact(A,'A completes after empty chooser');
 // Merely opening confirmation is not a new world. Actual confirmation is.
 await pending('slow-valid.json');await page.locator('#seed').fill('303');await click('new-confirm');await release('slow-valid.json');await exact(A,'unexecuted new-run confirmation keeps A eligible');
 await pending('slow-valid.json');await page.locator('#seed').fill('303');await click('new-confirm');await click('new-run');const fresh=producer.createRun(303);await page.waitForFunction(expected=>{const a=afterwave,raw=localStorage.getItem('afterwave.save.v1');return a.ui.screen==='world'&&!!document.querySelector('.selection-card')&&a.storage.pending===0&&!a.storage.lastError&&JSON.stringify(a.state)===expected&&raw&&JSON.stringify(JSON.parse(raw).state)===expected;},JSON.stringify(fresh));check('Older native file is still held before actual seed-303 map and save are established',await page.evaluate(()=>window.__round26Reads['slow-valid.json']?.ready&&!window.__round26Reads['slow-valid.json']?.done));await exact(fresh,'confirmed new world before stale A');await stale('slow-valid.json',fresh,'slow A / confirmed new world');
 // Every real navigation cancels; coming back never resurrects the request.
 for(const [name,reject]of [['slow-valid.json',false],['slow-invalid.json',false],['slow-read-error.json',true]]){
  await pending(name);await click('home');await settings();await stale(name,fresh,`${name} leave and re-enter settings`,{reject});
 }
 // A synthetic pagehide dispatch checks only the handler, not browser cache behavior.
 await pending('slow-valid.json');await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await stale('slow-valid.json',fresh,'explicit synthetic pagehide handler cancellation');
 await page.reload();await page.waitForFunction(()=>window.afterwave&&!afterwave.storage.closed&&!afterwave.storage.pending);
 await exact(fresh,'fresh writable document after isolated synthetic lifecycle case');
 // Real browser history navigation is separate. Record whether the same document survived.
 await pending('slow-valid.json');const documentBefore=await page.evaluate(()=>window.__round26DocumentId);
 await page.waitForLoadState('networkidle');await page.goto('about:blank');await page.goBack();await page.waitForFunction(()=>!!window.afterwave);
 const sameDocument=await page.evaluate(id=>window.__round26DocumentId===id,documentBefore);
 await exact(fresh,'actual external navigation and browser Back');
 check('Browser Back shows no pending loading status',await page.locator('[role="status"]').filter({hasText:'正在读取存档'}).count()===0);
 report.cases.push({label:'actual external navigation and browser Back',sameDocumentRestored:sameDocument,scope:sameDocument?'Same document observed; this single route is not general BFCache certification.':'Fresh document observed; BFCache restoration was not exercised.'});
 if(sameDocument&&await page.evaluate(()=>window.__round26Reads['slow-valid.json']?.ready&&!window.__round26Reads['slow-valid.json']?.done))await stale('slow-valid.json',fresh,'held read after same-document browser Back');
 // A read-only setting and export remain permitted while the request is active.
 await pending('slow-valid.json');await click('text-size');check('Text-size setting leaves reading status visible',await page.locator('[role="status"]').filter({hasText:'正在读取存档'}).isVisible());
 const downloadPromise=page.waitForEvent('download');await click('export');const download=await downloadPromise;await download.saveAs(`${root}/export-while-reading.json`);
 const exported=JSON.parse(await fs.readFile(`${root}/export-while-reading.json`,'utf8'));check('Export while reading contains complete current world',bytes(exported.state)===bytes(fresh));report.downloadTransfers.push({url:download.url(),saved:true,failure:await download.failure(),completeWorldExact:bytes(exported.state)===bytes(fresh)});
 await release('slow-valid.json');await page.waitForFunction(()=>window.afterwave.ui.screen==='world');await exact(A,'read finishes after text size and export');
 // Navigation into real irreversible play invalidates A before state changes.
 await importWorld(producer.createRun(0),'play-baseline');let expected=producer.createRun(0);await pending('slow-valid.json');await click('home');await page.waitForLoadState('networkidle');await page.locator('[data-primary-action]').click();
 for(const id of ['independent_flood_records','unfunded_maintenance']){const panel=page.locator(`[data-evidence-id="${id}"]`);await panel.locator(':scope > summary').click();await panel.locator('[data-action="evidence"]').click();producer.investigate(expected,'protagonist','D4',id);await afterMutation(expected,`paid investigation ${id}`);}
 await page.locator('[data-action="choose"][data-id="build_joint"]').click();await click('confirm');await click('lock');producer.lockTask(expected,'protagonist','D4','build_joint',['independent_flood_records','unfunded_maintenance']);await afterMutation(expected,'lock while old read is pending');
 await click('commit');producer.commitWindow(expected);await click('step');producer.advanceYear(expected);await afterMutation(expected,'commit and annual advance while old read pending');await stale('slow-valid.json',expected,'slow A / investigation, lock, commit and year');
 // Normal same-file imports remain fresh operations, including every genuine producer.
 for(let attempt=1;attempt<=2;attempt++){await settings();await input('fast-valid.json');await exact(B,`same file normal import ${attempt}`);check(`same file import ${attempt} finishes on world`,await page.evaluate(()=>window.afterwave.ui.screen==='world'));}
 for(const [name,api]of [['round21',producer],['round20',older],['per-scene',legacy]])for(const year of [0,20,30]){
  const s=routes(api)[year];await importWorld(s,`${name}-${year}`);
  check(`${name}/${year} rule markers remain exactly from producer`,await page.evaluate(s=>JSON.stringify(Object.entries(window.afterwave.state).filter(([key])=>/RulesVersion$/.test(key)))===JSON.stringify(Object.entries(s).filter(([key])=>/RulesVersion$/.test(key))),s));
  await settled();await page.reload();await page.locator('.selection-card').waitFor();await exact(s,`${name}/${year} reload`);
 }
 // Status readability and interaction targets use native doubled text, no CSS injection.
 for(const width of [320,390]){
  await page.setViewportSize({width,height:width===320?568:844});await settings();if(await page.evaluate(()=>!window.afterwave.ui.bigText))await click('text-size');
  await hold('slow-valid.json');await input('slow-valid.json',{expected:'pending'});await page.waitForFunction(()=>window.__round26Reads['slow-valid.json']?.ready);
  const status=page.locator('[role="status"]').filter({hasText:'正在读取存档'});await status.scrollIntoViewIfNeeded();
  const layout=await status.evaluate(e=>{const r=e.getBoundingClientRect();return{font:getComputedStyle(document.documentElement).fontSize,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,left:r.left,right:r.right,height:r.height,text:e.textContent};});
  check(`${width}/200 reading status retains all instructions`,layout.text.includes('选择其他文件')&&layout.text.includes('离开设置')&&layout.text.includes('取消'));
  check(`${width}/200 native text and no horizontal overflow`,layout.font==='32px'&&layout.scrollWidth<=layout.width&&layout.left>=0&&layout.right<=layout.width,layout);
  await capture(`reading-${width}-200`);await release('slow-valid.json');await page.waitForFunction(()=>window.afterwave.ui.screen==='world');await exact(A,`${width}/200 actual import completes`);
 }
 const transferProbe={url:'blob:test-success',saved:true,failure:null,completeWorldExact:true};
 check('Download classification accepts only an exact verified completed export',verifiedDownloadTransfer({url:'blob:test-success',reason:'net::ERR_ABORTED'},[transferProbe]));
 for(const [label,f,transfers]of [
  ['unknown blob',{url:'blob:unknown',reason:'net::ERR_ABORTED'},[transferProbe]],
  ['different failure',{url:'blob:test-success',reason:'net::ERR_FAILED'},[transferProbe]],
  ['HTTP resource',{url:'http://example.test/asset.png',reason:'net::ERR_ABORTED'},[{...transferProbe,url:'http://example.test/asset.png'}]],
  ['unverified content',{url:'blob:test-success',reason:'net::ERR_ABORTED'},[{...transferProbe,completeWorldExact:false}]],
 ])check(`Download classification rejects ${label}`,!verifiedDownloadTransfer(f,transfers));
 for(const failure of report.requestFailures){failure.verifiedDownloadTransfer=verifiedDownloadTransfer(failure,report.downloadTransfers);if(!failure.verifiedDownloadTransfer)report.errors.push(`${failure.url} ${failure.reason} (${failure.step})`);}
 report.sourceAfter=await hash();check('Complete source tree remains frozen',report.sourceBefore===report.sourceAfter);check('No browser, network or HMR errors',report.errors.length===0,report.errors);
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;if(page)await page.screenshot({path:`${root}/failure.png`}).catch(()=>{});}
finally{report.completedAt=new Date().toISOString();report.sourceAfter=await hash();await fs.writeFile(`${root}/import-safety-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
