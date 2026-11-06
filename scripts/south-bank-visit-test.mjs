import {readDecisionDetails} from './helpers/decision-reading.mjs';
import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {advanceYear,advanceToNextWindow,getActions,validateState,traceEvent} from '../src/simulation.js';
import {getSceneVisit} from '../src/scene-visit.js';
import {sceneArt} from '../src/scene-art.js';
import {localAt30,submit} from '../tests/helpers/local-crisis.js';
import {investigateAndLock} from '../tests/helpers/play.js';
import {futureVisualDates} from '../tests/helpers/future-check-visuals.js';

// These fixtures use the authoritative engine, not an AVG invented at 31/40.
// Service closure cases are legal display boundaries, not player shutdown actions.
const out='playtest-output',prefix='round15-d5';
const clone=structuredClone;
const aidAction='action:30:protagonist:D5:mutual_aid';
const aidEvent=`event:${aidAction}`,aidOutcome=`resolved:${aidEvent}`;
const buildAction='action:0:protagonist:D4:build_joint';
const buildEvent=`event:${buildAction}`,buildOutcome=`resolved:${buildEvent}`;
const trainingEvent=`${buildEvent}:training`,trainingOutcome=`resolved:${trainingEvent}`;
const leak=/OTHER FUTURE|DO NOT EXPOSE/;
const report={checks:[],errors:[],scope:'Real D5 read-only visits at years30/31/40 through world, archive, annual playback and ending controls. Natural engine contracts distinguish locking, payment and fulfilment. Teaching comes from the real D4 build/E4 year7 training chain. Independent service closures are legal display fixtures, not new game actions. Importable malformed provenance is preserved in saved state but must not be offered by the new visit. Chromium390/320,200% text and grayscale are browser checks, not physical-device certification.'};
const check=(name,ok,detail)=>{report.checks.push({name,passed:!!ok,...(detail!==undefined?{detail}:{})});assert.ok(ok,name);};
async function runtimeHash(){const files=(await fs.readdir('src',{withFileTypes:true})).filter(f=>f.isFile()).map(f=>f.name).sort();const hash=createHash('sha256');for(const file of files){hash.update(file);hash.update(await fs.readFile(`src/${file}`));}return hash.digest('hex');}
function route(teaching){const start=localAt30({aid:false,teaching}),locked=clone(start);investigateAndLock(locked,'protagonist','D5','mutual_aid');const pending=submit(clone(locked)),y31=clone(pending);advanceYear(y31);const y40=clone(y31);advanceToNextWindow(y40);return {start,locked,pending,y31,y40};}
function closeServices(s,{teaching=true,aid=true}={}){const copy=clone(s);for(const i of copy.institutions.filter(i=>i.cellId==='D5')){if(['training','school'].includes(i.kind))i.active=teaching;if(i.kind==='mutual')i.maintenance=aid?1:0;}return copy;}
const bare=route(false),taught=route(true);
const cases={
 unbuilt30:{state:bare.start,file:'open-shore.svg'},
 locked30:{state:bare.locked,file:'open-shore.svg'},
 pending30:{state:bare.pending,file:'open-shore.svg'},
 aid31:{state:bare.y31,file:'south-bank-aid.svg'},
 aid40:{state:bare.y40,file:'south-bank-aid.svg'},
 teaching30:{state:taught.start,file:'bank-reading.svg'},
 'teaching-locked30':{state:taught.locked,file:'bank-reading.svg'},
 'teaching-pending30':{state:taught.pending,file:'bank-reading.svg'},
 both31:{state:taught.y31,file:'south-bank-learning-aid.svg'},
 both40:{state:taught.y40,file:'south-bank-learning-aid.svg'},
 'teaching-closed40':{state:closeServices(taught.y40,{teaching:false}),file:'south-bank-learning-closed-aid.svg'},
 'aid-closed40':{state:closeServices(taught.y40,{aid:false}),file:'south-bank-learning-aid-closed.svg'},
 'both-closed40':{state:closeServices(taught.y40,{teaching:false,aid:false}),file:'south-bank-learning-closed-aid-closed.svg'},
 'aid-only-closed40':{state:closeServices(bare.y40,{aid:false}),file:'south-bank-aid-closed.svg'},
};
const history=(s,id)=>s.history.find(e=>e.id===id),event=(s,id)=>s.events.find(e=>e.id===id);
const localInstitutions=s=>s.institutions.filter(i=>i.cellId==='D5');
const crisisSnapshot=s=>JSON.stringify({crisis:s.flags.crisis,warning:history(s,'crisis-warning'),impact:history(s,'crisis-impact')});
function future(id){return {id,year:39,cellId:'B4',actionId:'training',kind:'event',title:'OTHER FUTURE EVENT',text:'DO NOT EXPOSE',parentId:null,sourceActionId:null,probability:1,status:'pending'};}
function duplicateParent(s,id){s.history.push({id,year:30,cellId:'B4',kind:'annotation',status:'confirmed',reality:'R1',title:'OTHER FUTURE DUPLICATE',text:'DO NOT EXPOSE',parentId:null,sourceActionId:null});}
function moveEventFuture(s,id){Object.assign(event(s,id),{year:39,status:'pending',title:'OTHER FUTURE PARENT',text:'DO NOT EXPOSE'});delete event(s,id).resolvedYear;}
const corrupt=[];
function corruption(name,mutate,{blocked=[],crisis=false,retain=[],base=taught.y31}={}){const state=clone(base);mutate(state);corrupt.push({name,state,blocked,crisis,retain});}
corruption('aid-outcome-event-collision',s=>s.events.push(future(aidOutcome)),{blocked:[aidOutcome],retain:[trainingOutcome]});
corruption('aid-parent-future',s=>moveEventFuture(s,aidEvent),{blocked:[aidOutcome],retain:[trainingOutcome]});
corruption('aid-parent-cross-table-duplicate',s=>duplicateParent(s,aidEvent),{blocked:[aidOutcome],retain:[trainingOutcome]});
corruption('aid-action-r0',s=>Object.assign(history(s,aidAction),{reality:'R0',title:'OTHER FUTURE R0 SOURCE',text:'DO NOT EXPOSE'}),{blocked:[aidAction,aidOutcome],retain:[trainingOutcome]});
corruption('teaching-outcome-event-collision',s=>s.events.push(future(trainingOutcome)),{blocked:[trainingOutcome],crisis:true,retain:[aidOutcome]});
corruption('teaching-parent-future',s=>moveEventFuture(s,trainingEvent),{blocked:[trainingOutcome],crisis:true,retain:[aidOutcome]});
corruption('teaching-parent-cross-table-duplicate',s=>duplicateParent(s,trainingEvent),{blocked:[trainingOutcome],crisis:true,retain:[aidOutcome]});
corruption('teaching-root-r0',s=>Object.assign(history(s,buildAction),{reality:'R0',title:'OTHER FUTURE R0 ROOT',text:'DO NOT EXPOSE'}),{blocked:[buildAction,buildOutcome,trainingOutcome],crisis:true,retain:[aidOutcome]});
corruption('warning-missing',s=>{s.history=s.history.filter(e=>e.id!=='crisis-warning');},{crisis:true,retain:[aidOutcome,trainingOutcome]});
corruption('warning-r0',s=>Object.assign(history(s,'crisis-warning'),{reality:'R0',title:'OTHER FUTURE R0 WARNING',text:'DO NOT EXPOSE'}),{crisis:true,retain:[aidOutcome,trainingOutcome]});
corruption('warning-event-collision',s=>s.events.push(future('crisis-warning')),{crisis:true,retain:[aidOutcome,trainingOutcome]});
corruption('warning-parent-future',s=>{const id='other-future-warning-parent';s.events.push(future(id));history(s,'crisis-warning').parentId=id;},{crisis:true,retain:[aidOutcome,trainingOutcome]});
corruption('warning-parent-missing',s=>{history(s,'crisis-warning').parentId='missing-warning-parent';},{crisis:true,retain:[aidOutcome,trainingOutcome]});
corruption('impact-event-collision',s=>s.events.push(future('crisis-impact')),{crisis:true,retain:[aidOutcome,trainingOutcome]});
corruption('impact-r0',s=>Object.assign(history(s,'crisis-impact'),{reality:'R0',title:'OTHER FUTURE R0 IMPACT',text:'DO NOT EXPOSE'}),{crisis:true,retain:[aidOutcome,trainingOutcome]});
const earlyAid=localAt30({aid:true,teaching:true}),earlyAction='action:10:protagonist:D5:mutual_aid',earlyEvent=`event:${earlyAction}`,earlyOutcome=`resolved:${earlyEvent}`;
corruption('early-aid-unconfirmed-action',s=>{history(s,earlyAction).status='pending';},{base:earlyAid,blocked:[earlyAction,earlyOutcome],crisis:true,retain:[trainingOutcome]});
for(const kind of ['action','event','outcome'])corruption(`early-aid-wrong-${kind}-actor`,s=>{const row=kind==='event'?event(s,earlyEvent):history(s,kind==='action'?earlyAction:earlyOutcome);row.actorId='wrong-actor';},{base:earlyAid,blocked:[earlyAction,earlyOutcome],crisis:true,retain:[trainingOutcome]});
corruption('warning-unconfirmed',s=>{history(s,'crisis-warning').status='pending';},{crisis:true,retain:[aidOutcome,trainingOutcome]});
corruption('warning-wrong-region',s=>{history(s,'crisis-warning').cellId='B4';},{crisis:true,retain:[aidOutcome,trainingOutcome]});


// Independent provenance oracle: do not trust getSceneVisit to judge its own links.
function sourceProblem(s,id){
 const all=[...s.history,...s.events],seen=new Set();let current=id;
 while(current){
  const matches=all.filter(e=>e.id===current);
  if(matches.length!==1)return `${current}: ${matches.length} records`;
  const row=matches[0];
  if(seen.has(current))return `${current}: cycle`;
  if(!Number.isInteger(row.year)||row.year>s.year)return `${current}: future/unknown year`;
  if(row.reality!==undefined&&row.reality!=='R1')return `${current}: wrong reality`;
  if(row.kind==='action'&&row.status!=='confirmed')return `${current}: unconfirmed action`;
  if(row.sourceActionId&&row.actorId!==undefined&&row.actorId!==row.sourceActionId.split(':')[2])return `${current}: wrong actor`;
  if(row.id==='crisis-warning'&&(row.cellId!=='D4'||row.status!=='confirmed'||row.year!==14))return `${current}: malformed warning`;
  if(row.kind==='event'&&(!['success','failed','cancelled'].includes(row.status)||row.resolvedYear!==row.year))return `${current}: unfulfilled event`;
  if(leak.test(JSON.stringify(row)))return `${current}: contaminated text`;
  seen.add(current);current=row.parentId;
 }
 return null;
}
function fixtureChecks(){
 for(const [name,{state:s,file}] of Object.entries(cases)){
  check(`${name}: fixture is a valid save`,validateState(s).valid,validateState(s).errors);
  check(`${name}: current scene independently matches existing physical services`,sceneArt(s,'D5').file===file);
 }
 for(const {name,state:s} of corrupt)check(`${name}: malformed provenance remains a legally importable save`,validateState(s).valid,validateState(s).errors);
 for(const [label,r] of [['aid-only',bare],['teaching-and-aid',taught]]){
  for(const name of ['start','locked','pending'])check(`${label} ${name}: no mutual institution before fulfilment`,!localInstitutions(r[name]).some(i=>i.kind==='mutual'));
  check(`${label}: lock has no paid source or queued outcome`,!history(r.locked,aidAction)&&!event(r.locked,aidEvent)&&r.locked.drafts.protagonist?.actionId==='mutual_aid');
  check(`${label}: submission is a paid year30 action with a pending year31 event`,history(r.pending,aidAction)?.year===30&&event(r.pending,aidEvent)?.status==='pending'&&event(r.pending,aidEvent)?.year===31&&!history(r.pending,aidOutcome));
  for(const name of ['y31','y40']){
   const s=r[name],carrier=localInstitutions(s).filter(i=>i.kind==='mutual');
   check(`${label} ${name}: exactly one actual year31 carrier has the matching paid action/event/outcome`,carrier.length===1&&carrier[0].startYear===31&&carrier[0].sourceActionId===aidAction&&carrier[0].sourceEventId===aidEvent&&event(s,aidEvent)?.status==='success'&&event(s,aidEvent)?.resolvedYear===31&&history(s,aidOutcome)?.year===31&&history(s,aidOutcome)?.parentId===aidEvent&&history(s,aidOutcome)?.sourceActionId===aidAction);
   check(`${label} ${name}: late aid cannot rewrite the frozen year23 settlement`,crisisSnapshot(s)===crisisSnapshot(r.start));
  }
 }
 const school=localInstitutions(taught.y31).find(i=>i.kind==='training');
 check('Teaching is genuinely sourced through D4 building and E4 year7 training, not invented D5 history',school?.startYear===7&&school.sourceActionId===buildAction&&school.sourceEventId===trainingEvent&&history(taught.y31,buildAction)?.cellId==='D4'&&event(taught.y31,buildEvent)?.year===3&&event(taught.y31,trainingEvent)?.cellId==='E4'&&event(taught.y31,trainingEvent)?.year===7&&history(taught.y31,trainingOutcome)?.cellId==='E4'&&traceEvent(taught.y31,trainingOutcome).map(e=>e.id).join('|')===[buildAction,buildEvent,trainingEvent,trainingOutcome].join('|'));
}
fixtureChecks();
for(const {name,state:s,blocked,crisis,retain} of corrupt){
 const before=JSON.stringify(s),v=getSceneVisit(s,'D5');
 check(`${name}: pure API filters unsafe links and retains independent real sources`,v&&blocked.every(id=>!v.sourceIds.includes(id))&&retain.every(id=>v.sourceIds.includes(id)),v?.sourceIds);
 check(`${name}: pure API offers no unsafe source ancestry`,v.sourceIds.every(id=>!sourceProblem(s,id)));
 if(crisis)check(`${name}: pure API suppresses unsafe crisis destination`,v.art.history?.recordId===null);
 check(`${name}: pure API preserves the complete imported state`,JSON.stringify(s)===before);
}
if(process.argv.includes('--fixtures-only')){console.log(JSON.stringify({fixtureOnly:true,cases:Object.keys(cases).length,malformedImports:corrupt.length,...report},null,2));process.exit(0);}

await fs.mkdir(out,{recursive:true});
const frozenRuntime=await runtimeHash();
const server=await createServer({server:{host:'127.0.0.1',port:4217,strictPort:true}});await server.listen();
let browser,page;
const click=async a=>{await page.locator(`[data-action="${a}"]`).first().click();await readDecisionDetails(page);};
const savedState=()=>page.evaluate(()=>JSON.stringify(window.afterwave.state));
const sessions=()=>page.evaluate(()=>JSON.stringify(window.afterwave.ui.sessions));
const section=()=>page.locator('.scene-visit[data-visit-cell="D5"]');
const sourceButtons=()=>section().locator('.scene-visit-sources [data-action="trace"]');
const allVisitSources=()=>section().locator('[data-action="trace"]');
const forbidden=['avg','evidence','preview-evidence','choose','confirm','lock','unlock','pass','commit','step','skip','auto','assign'];
async function show(s,bigText=false,cell='D5'){
 await page.evaluate(({s,bigText,cell})=>sessionStorage.setItem('afterwave.south.visit.fixture',JSON.stringify({state:s,ui:{screen:'world',selected:cell,actor:'protagonist',channel:'science',focus:true,bigText}})),{s,bigText,cell});
 await page.reload();await page.locator('.selection-card').waitFor();
}
async function enter(){await page.locator('.selection-card [data-action="visit"][data-cell="D5"]').click();await section().waitFor();await section().locator('.scene-art img').evaluate(img=>img.decode());}
async function stableView(){return page.evaluate(async()=>{let key='',same=0,canvasBefore=null;const start=performance.now();while(performance.now()-start<5000){await new Promise(r=>setTimeout(r,60));const canvas=document.querySelector('canvas'),v=window.afterwave.mapView;let drawn=false;const pixels=canvas?.getContext('2d')?.getImageData(0,0,canvas.width,canvas.height).data;for(let i=3;pixels&&i<pixels.length;i+=4)if(pixels[i]){drawn=true;break;}const next=JSON.stringify({v,width:canvas?.width,height:canvas?.height});if(drawn&&v&&['centerX','centerY','zoom'].every(k=>Number.isFinite(v[k]))&&canvas===canvasBefore&&next===key)same++;else same=0;key=next;canvasBefore=canvas;if(same>=3)return v;}throw Error('Returning map did not render and stabilize');});}
async function imageSample(img){return img.evaluate(async image=>{await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,r=image.getBoundingClientRect(),style=getComputedStyle(image),parent=getComputedStyle(image.parentElement);return {rgba:[...new Uint8Array(await crypto.subtle.digest('SHA-256',rgba))].map(v=>v.toString(16).padStart(2,'0')).join(''),src:image.currentSrc,native:[canvas.width,canvas.height],display:{width:r.width,height:r.height,filter:style.filter,opacity:style.opacity,transform:style.transform,objectFit:style.objectFit,objectPosition:style.objectPosition,imageRendering:style.imageRendering,visibility:style.visibility,display:style.display,parentFilter:parent.filter,parentOpacity:parent.opacity,parentTransform:parent.transform}};});}
const sameImage=(a,b)=>a.rgba===b.rgba&&a.src===b.src&&JSON.stringify(a.native)===JSON.stringify(b.native)&&JSON.stringify(a.display)===JSON.stringify(b.display);
async function snap(name,mono=false){const target=section().locator('.scene-art');if(mono)await target.evaluate(el=>el.style.filter='grayscale(1)');const bytes=await target.screenshot({path:`${out}/${prefix}-${name}${mono?'-mono':''}.png`});if(mono)await target.evaluate(el=>el.style.filter='');return bytes.toString('base64');}
async function contents(s,name,file=sceneArt(s,'D5').file){
 const before=JSON.stringify(s),v=getSceneVisit(s,'D5'),img=section().locator('.scene-art img');
 check(`${name}: pure visit API does not change the input save`,JSON.stringify(s)===before);
 check(`${name}: public view uses current physical asset rather than a fabricated outcome`,(await img.getAttribute('src')).endsWith(file)&&v.art.file===file&&await img.getAttribute('alt')===v.art.alt&&await section().locator('.scene-art > span').innerText()===v.art.caption);
 check(`${name}: current year and exact summary match saved facts`,await section().locator('.prose').innerText()===v.summary.join('\n\n')&&(await section().locator('.reading-meta').innerText()).includes(`第 ${s.year} 年`));
 check(`${name}: read-only view offers no investigation or simulation controls`,await section().locator(forbidden.map(a=>`[data-action="${a}"]`).join(',')).count()===0&&await section().locator('[data-evidence-id]').count()===0);
 const ids=await sourceButtons().evaluateAll(els=>els.map(el=>el.dataset.id));
 check(`${name}: displayed source IDs match public API`,JSON.stringify(ids)===JSON.stringify(v.sourceIds));
 const unsafe=ids.map(id=>({id,problem:sourceProblem(s,id)})).filter(e=>e.problem);
 check(`${name}: every offered source independently resolves through unique current-reality history`,unsafe.length===0,unsafe);
 if(v.art.captionBelow)check(`${name}: caption stays below both physical services`,await section().locator('.scene-art').evaluate(el=>el.querySelector('span').getBoundingClientRect().top>=el.querySelector('img').getBoundingClientRect().bottom-1));
 const originalHistory=sceneArt(s,'D5').history;
 if(originalHistory&&originalHistory.status!=='pending'){const panel=section().locator('.local-crisis-history');check(`${name}: safe-link filtering retains original local settlement summary and numbers`,await panel.locator(':scope > p').first().innerText()===originalHistory.summary&&(await panel.innerText()).includes(originalHistory.detail[0]));}
 check(`${name}: no import contaminant is leaked on the visit`,!leak.test(await section().innerText()));
 check(`${name}: opening changes no world, draft, investigation or RNG field`,await savedState()===before);
}
async function openEverySource(s,name){
 const before=await savedState(),beforeSessions=await sessions(),ids=await allVisitSources().evaluateAll(els=>els.map(el=>el.dataset.id));
 for(const id of [...new Set(ids)]){
  await section().locator(`[data-action="trace"][data-id="${id}"]`).first().click();
  check(`${name}: source ${id} opens its saved destination without future/other-reality text`,await page.evaluate(()=>window.afterwave.ui.traceId)===id&&!leak.test(await page.locator('main').innerText()));
  check(`${name}: following ${id} is read-only for state and investigation sessions`,await savedState()===before&&await sessions()===beforeSessions);
  await click('home');await enter();
 }
 check(`${name}: all linked sources leave the original save untouched`,await savedState()===JSON.stringify(s)&&await sessions()===beforeSessions);
}
async function importSave(s,name){await click('settings');await page.locator('#import-save').setInputFiles({name:`${prefix}-${name}.json`,mimeType:'application/json',buffer:Buffer.from(JSON.stringify({state:s,ui:{screen:'visit',selected:'D5'}}))});await page.locator('.selection-card').waitFor();await page.locator('.toast').waitFor({state:'detached'});check(`${name}: real file import returns safely to world and preserves the complete payload`,await page.evaluate(()=>window.afterwave.ui.screen)==='world'&&await savedState()===JSON.stringify(s));}
async function unobscuredFocus(button){await button.scrollIntoViewIfNeeded();await button.focus();await button.evaluate(async el=>{let before='',same=0;for(let n=0;n<80;n++){await new Promise(r=>setTimeout(r,40));const box=el.getBoundingClientRect(),key=[box.x,box.y,box.width,box.height].join('|');if(key===before)same++;else same=0;before=key;if(same>=3)return;}throw Error('Focus geometry did not stabilize');});return button.evaluate(el=>{const r=el.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return document.activeElement===el&&(top===el||el.contains(top))&&r.height>=48&&r.top>=0&&r.bottom<=innerHeight;});}
// Deliberate DOM-only negative controls for the exact image oracle. These are
// test instrumentation, not normal player interaction or visual game evidence.
async function verifyImageOracleControls(){
 report.oracleNegativeControls=[];const verify=(name,ok)=>{report.oracleNegativeControls.push({name,passed:!!ok});assert.ok(ok,`Image oracle negative control: ${name}`);};
 await show(bare.start);await enter();const img=section().locator('.scene-art img'),beforeState=await savedState(),beforeSessions=await sessions(),before=await imageSample(img),original=await img.evaluate(el=>({src:el.getAttribute('src'),style:el.getAttribute('style')}));
 try{
  await img.evaluate(el=>{el.src=new URL('south-bank-aid.svg',el.src).href;});const wrongAsset=await imageSample(img);
  verify('Deliberate wrong-source image is rejected by exact source and native RGBA comparison',wrongAsset.src!==before.src&&wrongAsset.rgba!==before.rgba&&!sameImage(before,wrongAsset));
  await img.evaluate((el,src)=>el.setAttribute('src',src),original.src);await img.evaluate(el=>el.decode());
  await img.evaluate(el=>{el.style.imageRendering=getComputedStyle(el).imageRendering==='pixelated'?'auto':'pixelated';});const wrongRendering=await imageSample(img);
  verify('Deliberate imageRendering-only change is rejected while source and native pixels remain equal',wrongRendering.src===before.src&&wrongRendering.rgba===before.rgba&&wrongRendering.display.imageRendering!==before.display.imageRendering&&!sameImage(before,wrongRendering));
 }finally{await img.evaluate((el,original)=>{el.setAttribute('src',original.src);if(original.style===null)el.removeAttribute('style');else el.setAttribute('style',original.style);},original);await img.evaluate(el=>el.decode());}
 verify('Negative controls restore the exact original display and never alter world or sessions',sameImage(before,await imageSample(img))&&await savedState()===beforeState&&await sessions()===beforeSessions);
}

// Separate appendix for this round's from-zero B4 future-check visuals.
// Its fixtures and assertions deliberately do not inflate the D5 fixture count.
async function verifyFutureCheckVisit(){
 report.b4Checks=[];const checkB4=(name,ok,detail)=>{report.b4Checks.push({name,passed:!!ok,...(detail!==undefined?{detail}:{})});assert.ok(ok,`B4 future: ${name}`);};
 const dates=futureVisualDates(),cancelled=futureVisualDates({staff:false}).y40,closed=clone(dates.y40);
 const action='action:30:linche:B4:establish_future_check',eventId=`event:${action}`,result=`resolved:${eventId}`;
 closed.institutions.filter(i=>i.cellId==='B4'&&i.sourceActionId===action).forEach(i=>i.maintenance=0);
 const views={before:{state:dates.before,file:'monastery-none-none.svg',ids:[]},locked:{state:dates.locked,file:'monastery-none-none.svg',ids:[]},pending:{state:dates.pending,file:'monastery-none-pending.svg',ids:[action]},y33:{state:dates.y33,file:'monastery-none-pending.svg',ids:[action]},y34:{state:dates.y34,file:'monastery-none-verified.svg',ids:[action,result]},y40:{state:dates.y40,file:'monastery-none-verified.svg',ids:[action,result]},closed40:{state:closed,file:'monastery-none-closed.svg',ids:[action,result]},cancelled40:{state:cancelled,file:'monastery-none-none.svg',ids:[action,result]}};
 const b4=()=>page.locator('.scene-visit[data-visit-cell="B4"]');
 const enterB4=async()=>{await page.locator('.selection-card [data-action="visit"][data-cell="B4"]').click();await b4().waitFor();await b4().locator('.scene-art img').evaluate(img=>img.decode());};
 for(const [name,{state:s,file,ids}] of Object.entries(views)){
  checkB4(`${name}: independently valid save with exact promised physical asset`,validateState(s).valid&&sceneArt(s,'B4').file===file);
  checkB4(`${name}: no previous B4 review failure has been invented`,!s.events.some(e=>e.cellId==='B4'&&['independent_review','complete_review'].includes(e.actionId))&&!s.history.some(e=>e.cellId==='B4'&&e.kind==='failure'));
  if(['before','locked','pending','y33','cancelled40'].includes(name))checkB4(`${name}: no future-check carrier before real success`,!s.institutions.some(i=>i.sourceActionId===action));
  else checkB4(`${name}: physical carrier genuinely began at34 from the correct action/event/outcome`,s.institutions.some(i=>i.sourceActionId===action&&i.sourceEventId===eventId&&i.startYear===34)&&event(s,eventId)?.status==='success'&&history(s,result)?.year===34);
  checkB4(`${name}: exact source IDs are the actual paid action and recorded result`,JSON.stringify(getSceneVisit(s,'B4').sourceIds)===JSON.stringify(ids));
 }
 checkB4('Cancelled contract records cancellation rather than an unseen successful table',event(cancelled,eventId)?.status==='cancelled'&&history(cancelled,result)?.kind==='cancelled');
 for(const width of [390,320]){
  const big=width===320;await page.setViewportSize({width,height:big?568:844});const images={},samples={};
  for(const [name,{state:s,file,ids}] of Object.entries(views)){
   await show(s,big,'B4');const beforeSessions=await sessions(),button=page.locator('.selection-card [data-action="visit"][data-cell="B4"]');
   if(big){checkB4(`${width}px200% ${name}: real public entry receives unobscured keyboard focus`,await unobscuredFocus(button));await page.keyboard.press('Enter');await b4().waitFor();}else await enterB4();
   const img=b4().locator('.scene-art img');await img.evaluate(i=>i.decode());
   checkB4(`${width}px${big?'200%':''} ${name}: visible asset and caption depict the real current state`,(await img.getAttribute('src')).endsWith(file)&&await img.getAttribute('alt')===sceneArt(s,'B4').alt&&await b4().locator('.scene-art > span').innerText()===sceneArt(s,'B4').caption);
   checkB4(`${width}px${big?'200%':''} ${name}: visit offers only saved action/result sources`,JSON.stringify(await b4().locator('.scene-visit-sources [data-action="trace"]').evaluateAll(els=>els.map(el=>el.dataset.id)))===JSON.stringify(ids));
   checkB4(`${width}px${big?'200%':''} ${name}: no AVG or world-changing controls`,await b4().locator(forbidden.map(a=>`[data-action="${a}"]`).join(',')).count()===0&&await b4().locator('[data-evidence-id]').count()===0);
   checkB4(`${width}px${big?'200%':''} ${name}: readable below-image caption and no overflow`,await b4().locator('.scene-art').evaluate(el=>el.querySelector('span').getBoundingClientRect().top>=el.querySelector('img').getBoundingClientRect().bottom-1)&&await page.evaluate(big=>document.documentElement.scrollWidth<=innerWidth&&(!big||getComputedStyle(document.documentElement).fontSize==='32px'),big));
   if(['pending','y33'].includes(name))checkB4(`${width}px ${name}: pending shows a blank order, not a completed table`,(await img.getAttribute('alt')).includes('空白工单')&&(await img.getAttribute('alt')).includes('尚无新对照台'));
   if(['y34','y40'].includes(name))checkB4(`${width}px ${name}: new table is explicitly from34 with no invented old failure bag`,(await img.getAttribute('alt')).includes('第34年真实建成')&&(await img.getAttribute('alt')).includes('没有凭空添加旧失败底稿'));
   samples[name]=await imageSample(img);images[name]=(await img.screenshot({path:`${out}/round15-b4-future-${width}-${name}${big?'-text200':''}-image.png`})).toString('base64');
   if(['y33','y34','closed40'].includes(name)){await img.evaluate(el=>el.style.filter='grayscale(1)');await img.screenshot({path:`${out}/round15-b4-future-${width}-${name}${big?'-text200':''}-mono.png`});await img.evaluate(el=>el.style.filter='');}
   if(name==='y34')await page.screenshot({path:`${out}/round15-b4-future-${width}-${name}${big?'-text200':''}-visit.png`,fullPage:true});
   checkB4(`${width}px${big?'200%':''} ${name}: reading preserves every field and investigation session`,await savedState()===JSON.stringify(s)&&await sessions()===beforeSessions);
   if(ids.length){const source=b4().locator('.scene-visit-sources [data-action="trace"]').last(),id=ids.at(-1);if(big){checkB4(`${width}px200% ${name}: source receives unobscured keyboard focus`,await unobscuredFocus(source));await page.keyboard.press('Enter');}else await source.click();checkB4(`${width}px ${name}: actual source opens without changing any world or session field`,await page.evaluate(()=>window.afterwave.ui.traceId)===id&&await savedState()===JSON.stringify(s)&&await sessions()===beforeSessions&&!leak.test(await page.locator('main').innerText()));}
  }
  report.b4ImageSamples??={};report.b4ImageSamples[width]=samples;
  checkB4(`${width}px: lock cannot create furniture before payment`,sameImage(samples.before,samples.locked));
  checkB4(`${width}px: real pending, confirmed and stopped table images differ without captions`,new Set([images.y33,images.y34,images.closed40]).size===3);
  checkB4(`${width}px: cancellation leaves the original library with no new table`,sameImage(samples.cancelled40,samples.before));
 }
 await page.setViewportSize({width:390,height:844});await show(dates.y33,false,'B4');await enterB4();checkB4('Real year33 visit begins from pending order only',(await b4().locator('.scene-art img').getAttribute('src')).endsWith('monastery-none-pending.svg'));
 await click('home');await click('playback');await click('step');await click('pause-world');const at34=await savedState(),sessions34=await sessions();await enterB4();
 checkB4('Actual annual step34 creates the new table and public visit remains read-only',await page.evaluate(()=>window.afterwave.state.year===34)&&(await b4().locator('.scene-art img').getAttribute('src')).endsWith('monastery-none-verified.svg')&&await savedState()===at34&&await sessions()===sessions34);
 await page.reload();await b4().waitFor();checkB4('Refresh retains the real34 B4 visit and exact save',await page.evaluate(()=>window.afterwave.ui.screen==='visit'&&window.afterwave.ui.selected==='B4')&&await savedState()===at34);
 await click('home');await click('playback');await click('skip');await click('home');await click('ending');const at40=await savedState(),sessions40=await sessions();await page.locator('.ending [data-action="visit"][data-cell="B4"]').click();await b4().waitFor();
 checkB4('Actual year40 ending reaches the existing new table without fictional AVG',await page.evaluate(()=>window.afterwave.state.year===40)&&(await b4().locator('.scene-art img').getAttribute('src')).endsWith('monastery-none-verified.svg')&&await savedState()===at40&&await sessions()===sessions40);
}

try{
 browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',message=>{if(/\[vite\].*(hot updated|page reload)/.test(message.text()))report.errors.push(`Unexpected source edit during browser test: ${message.text()}`);});page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{const f=sessionStorage.getItem('afterwave.south.visit.fixture');if(f){localStorage.setItem('afterwave.save.v1',f);sessionStorage.removeItem('afterwave.south.visit.fixture');}});
 await page.goto('http://127.0.0.1:4217');await page.locator('.selection-card').waitFor();
 await verifyImageOracleControls();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===390?844:568});const captures={},monoCaptures={},samples={};
  for(const [name,{state:s,file}] of Object.entries(cases)){
   await show(s);const beforeSessions=await sessions(),primary=page.locator('[data-primary-action]');
   check(`${width}px ${name}: visit remains secondary beside the one legal primary action`,await primary.count()===1&&await primary.getAttribute('data-action')===(s.phase==='playback'?'playback':s.phase==='ended'?'ending':getActions(s,'D5','protagonist').length?'avg':'cell-history')&&await page.locator('.selection-card [data-action="visit"][data-cell="D5"]').count()===1);
   if(s.year>=31)check(`${width}px ${name}: no fictional investigation entry at year${s.year}`,await page.locator('[data-action="avg"]').count()===0);
   await enter();await contents(s,`${width}px ${name}`,file);
   check(`${width}px ${name}: visit focuses its heading without creating a session`,await page.evaluate(()=>document.activeElement===document.querySelector('.scene-visit h1'))&&await sessions()===beforeSessions);
   check(`${width}px ${name}: page has no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   samples[name]=await imageSample(section().locator('.scene-art img'));captures[name]=await snap(`${width}-${name}-scene`);
   if(['pending30','aid31','both31','both40','teaching-closed40','aid-closed40','both-closed40'].includes(name))monoCaptures[name]=await snap(`${width}-${name}-scene`,true);
   if(width===390&&['aid31','both31','both40'].includes(name))await page.screenshot({path:`${out}/${prefix}-${width}-${name}-visit.png`,fullPage:true});
   await click('home');check(`${width}px ${name}: returning preserves every state field and session`,await savedState()===JSON.stringify(s)&&await sessions()===beforeSessions);
  }
  report.imageSamples??={};report.imageSamples[width]=samples;
  check(`${width}px locked and pending promises do not prematurely change the bare-shore picture`,sameImage(samples.unbuilt30,samples.locked30)&&sameImage(samples.locked30,samples.pending30));
  check(`${width}px year31 real fulfilment visibly adds the aid shed`,captures.pending30!==captures.aid31);
  check(`${width}px teaching, aid and their separate closures remain distinct shapes`,new Set(['both40','teaching-closed40','aid-closed40','both-closed40'].map(name=>captures[name])).size===4);
  check(`${width}px grayscale retains distinct coexistence and separate-closure views`,new Set(['both40','teaching-closed40','aid-closed40','both-closed40'].map(name=>monoCaptures[name])).size===4);
  for(const name of ['aid31','both31','both40','both-closed40']){
   const {state:s,file}=cases[name];await show(s,true);const beforeSessions=await sessions(),button=page.locator('.selection-card [data-action="visit"][data-cell="D5"]');
   check(`${width}px200% ${name}: real entry is keyboard reachable and unobscured`,await unobscuredFocus(button));
   await page.keyboard.press('Enter');await section().waitFor();await contents(s,`${width}px200% ${name}`,file);
   check(`${width}px200% ${name}: actual text scale and page remain in bounds`,await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize==='32px'&&document.documentElement.scrollWidth<=innerWidth));
   await snap(`${width}-${name}-text200-scene`);if(width===320&&name==='both31')await page.screenshot({path:`${out}/${prefix}-320-both31-text200-visit.png`,fullPage:true});
   const source=sourceButtons().last(),id=await source.getAttribute('data-id');
   check(`${width}px200% ${name}: source is keyboard reachable and unobscured`,await unobscuredFocus(source));await page.keyboard.press('Enter');
   check(`${width}px200% ${name}: keyboard source navigation is read-only`,await page.evaluate(()=>window.afterwave.ui.traceId)===id&&await savedState()===JSON.stringify(s)&&await sessions()===beforeSessions);
  }
 }
 // Positive provenance checks are deliberately independent of getSceneVisit.
 await page.setViewportSize({width:390,height:844});
 for(const name of ['aid31','both31','both40','teaching-pending30']){
  const s=cases[name].state;await show(s);await enter();const ids=await sourceButtons().evaluateAll(els=>els.map(el=>el.dataset.id));
  const required=name==='aid31'?[aidAction,aidOutcome]:name==='teaching-pending30'?[buildAction,trainingOutcome,aidAction]:[buildAction,trainingOutcome,aidAction,aidOutcome];
  check(`${name}: real paid aid and inherited teaching sources remain publicly reachable`,required.every(id=>ids.includes(id)),{required,ids});
  if(name==='teaching-pending30')check('Pending aid never links its future event or missing outcome',!ids.includes(aidEvent)&&!ids.includes(aidOutcome));
  await openEverySource(s,name);
 }
 // Real archive, refresh, import and ending entries, not navigate('avg').
 await show(taught.y31);const archiveSessions=await sessions();await click('cell-history');await page.locator('main > section > [data-action="visit"][data-cell="D5"]').click();await section().waitFor();
 check('Regional archive offers a real read-only D5 return',await savedState()===JSON.stringify(taught.y31)&&await sessions()===archiveSessions);
 await page.reload();await section().waitFor();check('Refreshing retains the D5 visit and exact year31 payload',await page.evaluate(()=>window.afterwave.ui.screen==='visit'&&window.afterwave.ui.selected==='D5')&&await savedState()===JSON.stringify(taught.y31));
 await importSave(taught.y40,'current-visit40');await enter();await contents(taught.y40,'Imported current year40');
 await show(taught.y40,false,'D4');await page.locator('[data-primary-action]').click();await page.locator('.ending [data-action="visit"][data-cell="D5"]').click();await section().waitFor();
 check('Ending explicitly visits D5 from a prior D4 selection without changing the ending',await page.evaluate(()=>window.afterwave.ui.selected)==='D5'&&await savedState()===JSON.stringify(taught.y40));
 await click('home');const endingView=await stableView();check('Ending cross-region return centers current D5 instead of old D4',endingView.focus===true&&Math.abs(endingView.centerX-256)<=1&&Math.abs(endingView.centerY-152)<=1,endingView);
 await show(taught.y31,false,'D4');const oldView=await stableView(),cameraState=await savedState(),cameraSessions=await sessions();await page.locator('.world-side .event-card [data-action="visit"][data-cell="D5"]').click();await section().waitFor();
 check('Actual year31 world event can visit D5 without moving an actor',await page.evaluate(()=>window.afterwave.ui.selected)==='D5'&&await savedState()===cameraState);
 await click('home');const eventView=await stableView();check('Cross-place visit discards the torn-down D4 camera',Math.abs(oldView.centerY-136)<=1&&Math.abs(eventView.centerX-256)<=1&&Math.abs(eventView.centerY-152)<=1,{oldView,eventView});
 const canvas=await page.locator('canvas').boundingBox();await page.mouse.move(canvas.x+canvas.width*.5,canvas.y+canvas.height*.5);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width*.5+32,canvas.y+canvas.height*.5+16,{steps:6});await page.mouse.up();const dragged=await stableView();await enter();await click('home');const samePlace=await stableView();
 check('Same-place revisit preserves a manually dragged camera',Math.abs(dragged.centerX-eventView.centerX)>1&&Math.abs(samePlace.centerX-dragged.centerX)<=1&&Math.abs(samePlace.centerY-dragged.centerY)<=1&&Math.abs(samePlace.zoom-dragged.zoom)<.001,{dragged,samePlace});
 check('Camera navigation preserves all state and investigation sessions',await savedState()===cameraState&&await sessions()===cameraSessions);
 await show(taught.y31);await click('playback');await click('auto');await page.locator('.history-list [data-action="visit"][data-cell="D5"]').first().click();const paused=await savedState(),pausedSessions=await sessions();await page.waitForTimeout(1150);
 check('Entering a visit stops active annual autoplay',await page.evaluate(()=>window.afterwave.ui.screen==='visit'&&window.afterwave.state.year===31)&&await savedState()===paused&&await sessions()===pausedSessions);
 // Actual player flow starts in the legitimate year30 investigation window.
 for(const [label,r,file31] of [['aid-only',bare,'south-bank-aid.svg'],['teaching-and-aid',taught,'south-bank-learning-aid.svg']]){
  await show(r.start);const frozen=await page.evaluate(()=>JSON.stringify({crisis:window.afterwave.state.flags.crisis,warning:window.afterwave.state.history.find(e=>e.id==='crisis-warning'),impact:window.afterwave.state.history.find(e=>e.id==='crisis-impact')}));
  await enter();const beforeArt=await section().locator('.scene-art img').getAttribute('src');await click('home');await click('avg');await page.locator('[data-action="choose"][data-id="mutual_aid"]').click();await click('confirm');await click('lock');await click('home');
  const locked=await savedState(),lockedSessions=await sessions();await enter();check(`${label}: actual lock retains the old scene and spends nothing on viewing`,await section().locator('.scene-art img').getAttribute('src')===beforeArt&&await savedState()===locked&&await sessions()===lockedSessions&&await page.evaluate(()=>!window.afterwave.state.institutions.some(i=>i.cellId==='D5'&&i.kind==='mutual')));await click('home');
  await click('window');while(await page.locator('[data-action="pass"]').count())await page.locator('[data-action="pass"]').first().click();await click('commit');await click('pause-world');const pending=await savedState(),pendingSessions=await sessions();await enter();
  check(`${label}: real paid year30 commitment still has no warehouse`,await section().locator('.scene-art img').getAttribute('src')===beforeArt&&await savedState()===pending&&await sessions()===pendingSessions&&await page.evaluate(id=>window.afterwave.state.events.find(e=>e.id===id)?.status==='pending',aidEvent));await click('home');
  await click('playback');await click('step');await click('pause-world');const fulfilled=await savedState(),fulfilledSessions=await sessions();await enter();
  check(`${label}: actual year31 creates exactly one matching mutual institution and outcome`,await page.evaluate(({aidEvent,aidOutcome})=>{const s=window.afterwave.state;return s.year===31&&s.events.find(e=>e.id===aidEvent)?.status==='success'&&s.history.find(e=>e.id===aidOutcome)?.year===31&&s.institutions.filter(i=>i.cellId==='D5'&&i.kind==='mutual'&&i.startYear===31).length===1;},{aidEvent,aidOutcome})&&(await section().locator('.scene-art img').getAttribute('src')).endsWith(file31)&&await savedState()===fulfilled&&await sessions()===fulfilledSessions);
  await click('home');await click('playback');await click('skip');await click('home');await click('ending');const ended=await savedState(),endedSessions=await sessions();await page.locator('.ending [data-action="visit"][data-cell="D5"]').click();
  check(`${label}: actual year40 ending uses only the realised read-only site`,await page.evaluate(()=>window.afterwave.state.year===40&&window.afterwave.ui.screen==='visit')&&(await section().locator('.scene-art img').getAttribute('src')).endsWith(file31)&&await section().locator('[data-action="evidence"],[data-action="lock"]').count()===0&&await savedState()===ended&&await sessions()===endedSessions);
  check(`${label}: all real visits keep the original warning and crisis settlement`,frozen===await page.evaluate(()=>JSON.stringify({crisis:window.afterwave.state.flags.crisis,warning:window.afterwave.state.history.find(e=>e.id==='crisis-warning'),impact:window.afterwave.state.history.find(e=>e.id==='crisis-impact')})));
 }
 // Import each bad-source case separately. Current scene and saved history stay
 // untouched; only unsafe links in this NEW visit are suppressed.
 for(const {name,state:s,blocked,crisis,retain} of corrupt){
  await importSave(s,name);const beforeSessions=await sessions(),storedHistory=JSON.stringify(s.history),art=sceneArt(s,'D5');
  await enter();await contents(s,`Imported ${name}`,art.file);const ids=await sourceButtons().evaluateAll(els=>els.map(el=>el.dataset.id));
  check(`${name}: dangerous destinations are absent while independent safe sources remain`,blocked.every(id=>!ids.includes(id))&&retain.every(id=>ids.includes(id)),{blocked,retain,ids});
  if(crisis)check(`${name}: unsafe original-crisis link is not offered by the visit`,await section().locator('.local-crisis-history [data-action="trace"]').count()===0);
  check(`${name}: filtering does not alter current art, stored history, or investigations`,(await section().locator('.scene-art img').getAttribute('src')).endsWith(art.file)&&await page.evaluate(()=>JSON.stringify(window.afterwave.state.history))===storedHistory&&await sessions()===beforeSessions);
  await openEverySource(s,`Imported ${name}`);await page.reload();await section().waitFor();
  check(`${name}: refreshed visit preserves safe source list and all imported fields`,JSON.stringify(await sourceButtons().evaluateAll(els=>els.map(el=>el.dataset.id)))===JSON.stringify(ids)&&await savedState()===JSON.stringify(s));
  if(crisis)check(`${name}: refresh cannot restore an unsafe crisis button`,await section().locator('.local-crisis-history [data-action="trace"]').count()===0);
 }
 await verifyFutureCheckVisit();
 await show(taught.y40,false,'A1');check('Unsupported A1 does not acquire a fictional visit',await page.locator('.selection-card [data-action="visit"]').count()===0);
 report.runtimeHash={before:frozenRuntime,after:await runtimeHash()};check('Runtime sources stayed frozen for the complete browser suite',report.runtimeHash.before===report.runtimeHash.after);
 check('No browser runtime, hot-update or asset errors',report.errors.length===0);
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;if(page)await page.screenshot({path:`${out}/${prefix}-visit-failure.png`,fullPage:true}).catch(()=>{});}
finally{report.runtimeHash={before:frozenRuntime,after:await runtimeHash()};await fs.writeFile(`${out}/${prefix}-visit-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
