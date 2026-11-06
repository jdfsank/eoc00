import {readDecisionDetails} from './helpers/decision-reading.mjs';
import {chromium} from 'playwright';
import cb from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRun,advanceYear,advanceToNextWindow,validateState,getActions} from '../src/simulation.js';
import {getSceneVisit} from '../src/scene-visit.js';
import {portAt20,portAt30,portRecovery,lock} from '../tests/helpers/far-port.js';

const out='playtest-output';await fs.mkdir(out,{recursive:true});
async function runtimeHash(){const files=(await fs.readdir('src',{withFileTypes:true})).filter(f=>f.isFile()).map(f=>f.name).sort();const hash=createHash('sha256');for(const file of files){hash.update(file);hash.update(await fs.readFile(`src/${file}`));}return hash.digest('hex');}
const frozenRuntime=await runtimeHash();
const report={checks:[],errors:[],scope:'Public, independent read-only F6 visit through actual UI entries at31/32/40, including real year-by-year fulfilment, source links, refresh/import and unchanged world/investigation data. Unbuilt and cancelled paths are natural engine routes; separately closed services are legal display boundaries, not new shutdown actions. Chromium390/320 and200% text/grayscale, not physical-device certification.'};
const check=(name,ok,detail)=>{report.checks.push({name,passed:!!ok,...(detail?{detail}:{})});assert.ok(ok,name);};
const failed=portAt30(),locked=structuredClone(failed);lock(locked,'protagonist','F6','complete_review');
const pending=portRecovery(structuredClone(failed)),y31=structuredClone(pending);advanceYear(y31);const y32=structuredClone(y31);advanceYear(y32);const y40=structuredClone(y32);advanceToNextWindow(y40);
const cancelled=portRecovery(portAt30(1,false));advanceToNextWindow(cancelled);
const checkClosed=structuredClone(y40);checkClosed.institutions.filter(i=>i.sourceActionId.endsWith(':complete_review')).forEach(i=>i.maintenance=0);
const bothClosed=structuredClone(checkClosed);bothClosed.institutions.filter(i=>i.kind==='branch').forEach(i=>i.active=false);
const cases={unbuilt:createRun(0),branch:portAt20(),failed,locked,pending,y31,y32,y40,cancelled,'check-closed':checkClosed,'both-closed':bothClosed};
for(const [name,state] of Object.entries(cases))assert.equal(validateState(state).valid,true,name);
const server=await createServer({server:{host:'127.0.0.1',port:4207,strictPort:true}});await server.listen();let browser,page;
const click=async a=>{await page.locator(`[data-action="${a}"]`).first().click();await readDecisionDetails(page);};
const state=()=>page.evaluate(()=>JSON.stringify(window.afterwave.state));
const sessions=()=>page.evaluate(()=>JSON.stringify(window.afterwave.ui.sessions));
const section=()=>page.locator('.scene-visit[data-visit-cell="F6"]');
const forbidden=['avg','evidence','preview-evidence','choose','confirm','lock','unlock','pass','commit','step','skip','auto','assign'];
async function show(s,bigText=false,cell='F6'){
 await page.evaluate(({s,bigText,cell})=>sessionStorage.setItem('afterwave.visit.fixture',JSON.stringify({state:s,ui:{screen:'world',selected:cell,actor:'protagonist',channel:'science',focus:true,bigText}})),{s,bigText,cell});
 await page.reload();await page.locator('.selection-card').waitFor();
}
async function stableView(){return page.evaluate(async()=>{let key='',same=0,canvasBefore=null;const start=performance.now();while(performance.now()-start<5000){await new Promise(r=>setTimeout(r,60));const canvas=document.querySelector('canvas'),v=window.afterwave.mapView;let drawn=false;const pixels=canvas?.getContext('2d')?.getImageData(0,0,canvas.width,canvas.height).data;for(let i=3;pixels&&i<pixels.length;i+=4)if(pixels[i]){drawn=true;break;}const next=JSON.stringify({v,width:canvas?.width,height:canvas?.height});if(drawn&&v&&['centerX','centerY','zoom'].every(k=>Number.isFinite(v[k]))&&canvas===canvasBefore&&next===key)same++;else same=0;key=next;canvasBefore=canvas;if(same>=3)return v;}throw Error('Returning map did not render and stabilize');});}
async function enter(){await page.locator('.selection-card [data-action="visit"]').click();await section().waitFor();await section().locator('.scene-art img').evaluate(img=>img.decode());}
async function snap(name,selector='.scene-art',mono=false){const target=section().locator(selector);if(mono)await target.evaluate(el=>el.style.filter='grayscale(1)');const bytes=await target.screenshot({path:`${out}/round11-f6-${name}${mono?'-mono':''}.png`});if(mono)await target.evaluate(el=>el.style.filter='');return bytes.toString('base64');}
async function contents(s,name){
 const v=getSceneVisit(s,'F6'),img=section().locator('.scene-art img');
 check(`${name}: public view uses exact current asset, alt and caption`,(await img.getAttribute('src')).endsWith(v.art.file)&&await img.getAttribute('alt')===v.art.alt&&await section().locator('.scene-art > span').innerText()===v.art.caption);
 check(`${name}: facts and year match saved state`,(await section().locator('.prose').innerText())===v.summary.join('\n\n')&&(await section().locator('.reading-meta').innerText()).includes(`第 ${s.year} 年`));
 check(`${name}: no investigation, commitment or annual progression controls`,await section().locator(forbidden.map(a=>`[data-action="${a}"]`).join(',')).count()===0&&!await section().locator('[data-evidence-id]').count());
 check(`${name}: only actual stored local sources are linked`,JSON.stringify(await section().locator('.scene-visit-sources [data-action="trace"]').evaluateAll(els=>els.map(el=>el.dataset.id)))===JSON.stringify(v.sourceIds));
 if(v.art.captionBelow)check(`${name}: caption is below physical objects`,await section().locator('.scene-art').evaluate(el=>el.querySelector('span').getBoundingClientRect().top>=el.querySelector('img').getBoundingClientRect().bottom-1));
 check(`${name}: opening scene changes no world fact`,await state()===JSON.stringify(s));
}
try{
 browser=await chromium.launch({executablePath:await cb.executablePath(),args:cb.args,headless:true});page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',message=>{if(/\[vite\].*(hot updated|page reload)/.test(message.text()))report.errors.push(`Unexpected source edit during browser test: ${message.text()}`);});page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{const f=sessionStorage.getItem('afterwave.visit.fixture');if(f){localStorage.setItem('afterwave.save.v1',f);sessionStorage.removeItem('afterwave.visit.fixture');}});
 await page.goto('http://127.0.0.1:4207');await page.locator('.selection-card').waitFor();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===390?844:568});const captures={};
  for(const [name,s] of Object.entries(cases)){
   await show(s);const beforeSessions=await sessions(),primary=page.locator('[data-primary-action]');
   check(`${width}px ${name}: visit is secondary and preserves one legal primary`,await primary.count()===1&&await primary.getAttribute('data-action')===(s.phase==='playback'?'playback':s.phase==='ended'?'ending':getActions(s,'F6','protagonist').length?'avg':'cell-history')&&await page.locator('.selection-card [data-action="visit"]').count()===1);
   await enter();await contents(s,`${width}px ${name}`);
   check(`${width}px ${name}: visit focuses heading without creating investigation sessions`,await page.evaluate(()=>document.activeElement===document.querySelector('.scene-visit h1'))&&await sessions()===beforeSessions);
   check(`${width}px ${name}: layout has no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(['unbuilt','failed','y31','y32','y40','cancelled','check-closed','both-closed'].includes(name)){
    captures[name]=await snap(`${width}-${name}-scene`);if(['y31','y32','check-closed'].includes(name))await snap(`${width}-${name}-scene`,'.scene-art',true);
   }
   if(width===390&&['y31','y32','y40'].includes(name))await page.screenshot({path:`${out}/round11-f6-${width}-${name}-visit.png`,fullPage:true});
   await click('home');check(`${width}px ${name}: return leaves the year, institutions, drafts and RNG unchanged`,await state()===JSON.stringify(s)&&await sessions()===beforeSessions);
  }
  check(`${width}px pending/fulfilled/closed have distinct displayed illustrations`,new Set([captures.y31,captures.y32,captures['check-closed']]).size===3);
  for(const [name,s] of [['y31',y31],['y32',y32],['y40',y40]]){
   await show(s,true);const button=page.locator('.selection-card [data-action="visit"]');await button.scrollIntoViewIfNeeded();await button.focus();
   check(`${width}px200% ${name}: real entry is keyboard focused and unobscured`,await button.evaluate(el=>{const r=el.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return document.activeElement===el&&(top===el||el.contains(top))&&r.height>=48&&r.top>=0&&r.bottom<=innerHeight;}));
   await page.keyboard.press('Enter');await section().waitFor();await contents(s,`${width}px200% ${name}`);
   check(`${width}px200% ${name}: full size text and page remain in bounds`,await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize==='32px'&&document.documentElement.scrollWidth<=innerWidth));
   await snap(`${width}-${name}-text200-scene`);if(width===320&&name==='y32')await page.screenshot({path:`${out}/round11-f6-320-y32-text200-visit.png`,fullPage:true});
   const source=section().locator('.scene-visit-sources [data-action="trace"]').last(),id=await source.getAttribute('data-id');await source.scrollIntoViewIfNeeded();await source.focus();
   check(`${width}px200% ${name}: source has reachable unobscured keyboard focus`,await source.evaluate(el=>{const r=el.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return document.activeElement===el&&(top===el||el.contains(top))&&r.height>=48;}));
   await page.keyboard.press('Enter');check(`${width}px200% ${name}: source resolves to original history without spending`,await page.evaluate(()=>window.afterwave.ui.traceId)===id&&await state()===JSON.stringify(s));
  }
 }
 // Every route is exercised through visible controls, not navigate('avg').
 await page.setViewportSize({width:390,height:844});await show(y32);await click('cell-history');await page.locator('main [data-action="visit"]').first().click();check('Regional archive has a real read-only return to the current F6 scene',await section().count()===1&&await state()===JSON.stringify(y32));
 await page.reload();await section().waitFor();check('Refreshing current visit preserves read-only screen, exact year and state',await page.evaluate(()=>window.afterwave.ui.screen)==='visit'&&await state()===JSON.stringify(y32));
 await click('settings');await page.locator('#import-save').setInputFiles({name:'f6-current-visit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({state:y40,ui:{screen:'visit',selected:'F6'}}))});await page.locator('.toast').waitFor({state:'detached'});
 check('Import safely returns to world without changing40-year facts',await page.evaluate(()=>window.afterwave.ui.screen)==='world'&&await state()===JSON.stringify(y40));await enter();await contents(y40,'Imported year40');
 await show(y40,false,'D4');await page.locator('[data-primary-action]').click();await page.locator('.ending [data-action="visit"][data-cell="F6"]').click();
 check('Ending can explicitly visit F6 even when the prior selection was D4',await page.evaluate(()=>window.afterwave.ui.selected)==='F6'&&await section().count()===1&&await state()===JSON.stringify(y40));
 await click('home');await page.waitForFunction(()=>window.afterwave.mapView);
 const returnedView=await stableView();check('Cross-region ending visit resets focus to the selected F6 instead of old D4',returnedView.focus===true&&Math.abs(returnedView.centerX-288)<=1&&Math.abs(returnedView.centerY-200)<=1,returnedView);
 // Natural32 recent event can target F6 while a live world camera is on D4.
 await show(y32,false,'D4');const oldView=await stableView(),oldState=await state();await page.locator('.world-side .event-card [data-action="visit"]').click();await section().waitFor();check('World event can cross from D4 to current F6 without pretending to move an actor',await page.evaluate(()=>window.afterwave.ui.selected)==='F6'&&await state()===oldState);await click('home');const eventReturn=await stableView();
 check('Live world camera resets after teardown when a visit changes region',oldView.centerY===136&&eventReturn.focus===true&&Math.abs(eventReturn.centerX-288)<=1&&Math.abs(eventReturn.centerY-200)<=1,{oldView,eventReturn});
 const canvas=await page.locator('canvas').boundingBox();await page.mouse.move(canvas.x+canvas.width*.5,canvas.y+canvas.height*.5);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width*.5+32,canvas.y+canvas.height*.5+16,{steps:6});await page.mouse.up();const draggedView=await stableView();await enter();await click('home');const samePlaceReturn=await stableView();
 check('Same-place visit preserves a manually dragged camera rather than forcing a reset',Math.abs(draggedView.centerX-eventReturn.centerX)>1&&Math.abs(samePlaceReturn.centerX-draggedView.centerX)<=1&&Math.abs(samePlaceReturn.centerY-draggedView.centerY)<=1&&Math.abs(samePlaceReturn.zoom-draggedView.zoom)<.001,{draggedView,samePlaceReturn});
 check('Cross-place and same-place camera visits preserve every world field',await state()===oldState);
 // Leaving active annual playback for a visit must stop its timer.
 await show(y32);await click('playback');await click('auto');await page.locator('.history-list [data-action="visit"]').first().click();const paused=await state();await page.waitForTimeout(1150);
 check('A visit pauses active playback rather than advancing underneath the image',await page.evaluate(()=>window.afterwave.ui.screen)==='visit'&&await state()===paused&&await page.evaluate(()=>window.afterwave.state.year)===32);
 // Actual player path: lock30, submit, wait31, realise32, finish40.
 await show(failed);const frozen=await page.evaluate(()=>JSON.stringify({crisis:window.afterwave.state.flags.crisis,failure:window.afterwave.state.events.find(e=>e.actionId==='independent_review')}));
 await enter();const failedArt=await section().locator('.scene-art img').getAttribute('src');await click('home');await click('avg');await page.locator('[data-evidence-id="anomaly_records"] > summary').click();await page.locator('[data-action="evidence"][data-id="anomaly_records"]').click();await page.locator('[data-action="choose"][data-id="complete_review"]').click();await click('confirm');await click('lock');await click('home');const beforeLocked=await state();await enter();
 check('Actual locking does not prematurely change the read-only scene or spend on viewing',await section().locator('.scene-art img').getAttribute('src')===failedArt&&await state()===beforeLocked);
 await click('home');await click('window');await page.locator('[data-action="pass"][data-actor="linche"]').click();await click('commit');await click('pause-world');
 for(const year of [30,31,32]){
  if(year>30){await click('playback');await click('step');await click('pause-world');}
  const beforeVisit=await state();await enter();check(`Actual year${year} visit follows committed timing only`,await page.evaluate(()=>window.afterwave.state.year)===year&&(await section().locator('.scene-art img').getAttribute('src')).endsWith(year<32?'far-port-branch-pending.svg':'far-port-branch-recovered.svg'));
  check(`Actual year${year} revisit does not alter source outcomes or investigations`,await state()===beforeVisit);await click('home');
 }
 await click('playback');await click('skip');await click('home');await click('ending');await page.locator('.ending [data-action="visit"][data-cell="F6"]').click();
 check('Actual year40 ending leads to fulfilled on-site history, not a fabricated AVG',await page.evaluate(()=>window.afterwave.state.year)===40&&(await section().locator('.scene-art img').getAttribute('src')).endsWith('far-port-branch-recovered.svg')&&!await section().locator('[data-action="evidence"],[data-action="lock"]').count());
 check('All actual visits retain original failure and frozen crisis',frozen===await page.evaluate(()=>JSON.stringify({crisis:window.afterwave.state.flags.crisis,failure:window.afterwave.state.events.find(e=>e.actionId==='independent_review')})));
 await show(y40,false,'E4');const eastBefore=await state();await page.locator('.selection-card [data-action="visit"][data-cell="E4"]').click();check('Supported E4 remains a read-only current-site return at40',await page.locator('.scene-visit[data-visit-cell="E4"]').count()===1&&!await page.locator('.scene-visit [data-action="evidence"],.scene-visit [data-action="lock"]').count()&&await state()===eastBefore);
 // A valid old/imported state may reuse a history ID in the event queue.
 // traceEvent indexes events last. Keep the data and import compatibility,
 // but never advertise a link that would resolve to a future/other-place row.
 const collision=structuredClone(y31),normalSources=getSceneVisit(y31,'F6').sourceIds;
 const collidedId=collision.history.find(h=>h.kind==='failure'&&h.cellId==='F6').id;
 const originalHistory=JSON.stringify(collision.history);
 collision.events.push({id:collidedId,year:39,cellId:'B4',actionId:'training',kind:'event',title:'OTHER REGION FUTURE EVENT',text:'DO NOT EXPOSE',parentId:null,sourceActionId:null,probability:1,status:'pending'});
 assert.equal(validateState(collision).valid,true);
 await click('settings');await page.locator('#import-save').setInputFiles({name:'f6-colliding-source.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({state:collision,ui:{screen:'visit',selected:'F6'}}))});await page.locator('.toast').waitFor({state:'detached'});
 check('Actual import still accepts cross-table duplicate IDs and preserves the old history',await page.evaluate(()=>window.afterwave.ui.screen)==='world'&&await state()===JSON.stringify(collision)&&await page.evaluate(()=>JSON.stringify(window.afterwave.state.history))===originalHistory);
 await enter();const safeSources=await section().locator('.scene-visit-sources [data-action="trace"]').evaluateAll(els=>els.map(el=>el.dataset.id));
 check('Imported visit suppresses only the ambiguous source and retains every unambiguous link',normalSources.length===4&&JSON.stringify(safeSources)===JSON.stringify(normalSources.filter(id=>id!==collidedId)));
 check('Colliding queued event does not invent a new scene or leak another place or future result',(await section().locator('.scene-art img').getAttribute('src')).endsWith('far-port-branch-pending.svg')&&(await section().locator('.prose').innerText()).includes('第22年复核失败记录保留')&&!/OTHER REGION FUTURE EVENT|DO NOT EXPOSE/.test(await section().innerText()));
 for(const id of safeSources){
  await section().locator(`.scene-visit-sources [data-action="trace"][data-id="${id}"]`).click();
  check(`Imported unambiguous source ${id} opens actual history without leaked collision`,await page.evaluate(()=>window.afterwave.ui.traceId)===id&&!/OTHER REGION FUTURE EVENT|DO NOT EXPOSE/.test(await page.locator('main').innerText())&&await state()===JSON.stringify(collision));
  await click('home');await enter();
 }
 await page.reload();await section().waitFor();
 check('Refresh preserves imported facts and keeps the colliding source suppressed',await state()===JSON.stringify(collision)&&await section().locator('.scene-visit-sources [data-action="trace"]').evaluateAll((els,id)=>els.every(el=>el.dataset.id!==id)&&els.length===3,collidedId));
 report.runtimeHash={before:frozenRuntime,after:await runtimeHash()};check('Runtime sources remained frozen during the entire visit suite',report.runtimeHash.before===report.runtimeHash.after);
 check('No browser runtime or asset errors',report.errors.length===0);
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;if(page)await page.screenshot({path:`${out}/round11-f6-visit-failure.png`,fullPage:true}).catch(()=>{});}
finally{await fs.writeFile(`${out}/round11-scene-visit-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
