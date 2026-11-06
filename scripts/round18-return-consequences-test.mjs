import {readDecisionDetails} from './helpers/decision-reading.mjs';
import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as old from '../tests/fixtures/pre-training-authorization-simulation.js';
import {getSceneVisit} from '../src/scene-visit.js';
import {lock,submit,decade} from '../tests/helpers/local-crisis.js';
import {boardReadinessPlugin,renderedBoard} from './helpers/board-readiness.mjs';

const out='playtest-output/round-18', report={scope:'Independent Chromium end-to-end checks. Natural engine fixtures at21/31/40 plus a fresh seed0 route driven by visible controls. Only malformed-import and service-closure cases are synthetic and explicitly labelled. No production module is edited or replaced; read-only probes count entry into existing planning functions. 390/320px and200% text are browser checks, not physical-device or human certification.',checks:[],errors:[],screenshots:[]};
const check=(name,passed,detail)=>{report.checks.push({name,passed:!!passed,...(detail===undefined?{}:{detail})});assert.ok(passed,name);};
const bytes=JSON.stringify,clone=structuredClone;
const rows=s=>[...s.history,...s.events];
function sourceProblem(s,id){
 const visited=new Set();let next=id;
 while(next){const matches=rows(s).filter(r=>r.id===next);if(matches.length!==1)return `${next}: ambiguous/missing`;const r=matches[0];
  if(visited.has(next))return `${next}: cycle`;
  if(!Number.isInteger(r.year)||r.year>s.year)return `${next}: future/undated`;
  if(r.reality!==undefined&&r.reality!=='R1')return `${next}: other reality`;
  if(r.kind==='action'&&r.status!=='confirmed')return `${next}: unpaid action`;
  if(r.kind==='event'&&(!['success','failed','cancelled'].includes(r.status)||r.resolvedYear!==r.year))return `${next}: unresolved event`;
  if(/DO NOT EXPOSE|FUTURE CONTAMINANT/.test(bytes(r)))return `${next}: contaminated source`;
  visited.add(next);next=r.parentId;
 }return null;
}
function route({seed=0,opening='build_joint',at10='recruit_successor',at20='free_warning',network=true}={}){
 const s=sim.createRun(seed);if(opening)lock(s,'protagonist',opening==='preserve_records'?'B4':'D4',opening);decade(s);
 if(at10)lock(s,'protagonist',at10==='fund_school'?'E4':'D4',at10);decade(s);
 if(at20)lock(s,'protagonist','D4',at20);if(network&&sim.getActors(s).some(a=>a.id==='linche'))lock(s,'linche','E4','train_network');
 const planning=clone(s);submit(s);const pending20=clone(s);sim.advanceYear(s);const y21=clone(s);sim.advanceToNextWindow(s);const y30=clone(s);submit(s);sim.advanceYear(s);const y31=clone(s);sim.advanceToNextWindow(s);return {planning,pending20,y21,y30,y31,y40:s};
}
const joint=route(), resident=route({opening:null,at10:'recruit_volunteer'}), anonymous=route({opening:null,at10:'restore_archive',network:false}), forced=route({at20:'relocate_teacher'}), failed=route({seed:6,network:true}), fee=route({opening:'build_merchant',at10:'recruit_risk',at20:null,network:false}), respected=route({at20:'present_archive'});
const cases=[
 ...['y21','y31','y40'].flatMap(date=>['D4','E4'].map(cell=>({name:`joint-${date}-${cell}`,state:joint[date],cell}))),
 {name:'resident-warning-y21',state:resident.y21,cell:'D4'},
 {name:'anonymous-restored-station-y21',state:anonymous.y21,cell:'D4'},
 {name:'failed-build-archive-y21',state:failed.y21,cell:'D4'},
 {name:'fee-stopped-y31',state:fee.y31,cell:'D4'},
 {name:'forced-relocation-D4-y21',state:forced.y21,cell:'D4'},
 {name:'forced-relocation-E4-y21',state:forced.y21,cell:'E4'},
 {name:'respected-choice-y40',state:respected.y40,cell:'D4'},
 {name:'paid-unfulfilled-warning-y20',state:resident.pending20,cell:'D4'},
 {name:'locked-unpaid-warning-y20',state:resident.planning,cell:'D4'},
];
for(const [name,kind] of [['closed-original-teaching','training'],['closed-new-network','school']]){const s=clone(joint.y31);for(const i of s.institutions.filter(i=>i.cellId==='E4'&&i.kind===kind))i.active=false;cases.push({name,state:s,cell:'E4',boundary:true});}
for(const c of cases)check(`${c.name}: save independently validates`,sim.validateState(c.state).valid,sim.validateState(c.state).errors);
check('Natural E4 fixture has distinct original year7 training and year21 network',joint.y21.institutions.some(i=>i.cellId==='E4'&&i.kind==='training'&&i.startYear===7)&&joint.y21.institutions.some(i=>i.cellId==='E4'&&i.kind==='school'&&i.startYear===21));
check('Natural anonymous station route has no personal succession contract',anonymous.y21.institutions.some(i=>i.cellId==='D4'&&i.kind==='station'&&i.active)&&!anonymous.y21.events.some(e=>e.actionId==='recruit_successor'));
if(process.argv.includes('--fixtures-only')){console.log(bytes(report));process.exit(0);}

async function runtimeHash(){const files=(await fs.readdir('src',{withFileTypes:true})).filter(f=>f.isFile()).map(f=>f.name).sort(),hash=createHash('sha256');for(const f of files){hash.update(f);hash.update(await fs.readFile(`src/${f}`));}return hash.digest('hex');}
const probePlugin={name:'round18-read-only-probe',enforce:'pre',transform(code,id){
 if(id.split('?')[0].endsWith('/src/story.js'))return code.replace("export function sceneFor(state,cell,actorId='protagonist') {","export function sceneFor(state,cell,actorId='protagonist') { globalThis.__planningSceneCalls=(globalThis.__planningSceneCalls||0)+1;");
 if(id.split('?')[0].endsWith('/src/main.js'))return code.replace('function session(){','function session(){globalThis.__sessionCalls=(globalThis.__sessionCalls||0)+1;');
}};
await fs.mkdir(out,{recursive:true});const frozen=await runtimeHash();
const server=await createServer({plugins:[probePlugin,boardReadinessPlugin()],server:{host:'127.0.0.1',port:4218,strictPort:true}});await server.listen();
let browser,page;
const click=async a=>{await page.locator(`[data-action="${a}"]`).first().click();await readDecisionDetails(page);};
const stateBytes=()=>page.evaluate(()=>JSON.stringify(window.afterwave.state));
const sessions=()=>page.evaluate(()=>JSON.stringify(window.afterwave.ui.sessions));
const probes=()=>page.evaluate(()=>JSON.stringify([globalThis.__planningSceneCalls||0,globalThis.__sessionCalls||0]));
const visit=cell=>page.locator(`.scene-visit[data-visit-cell="${cell}"]`);
const allSources=cell=>visit(cell).locator('[data-action="trace"]');
async function show(s,cell='D4',bigText=false){await page.evaluate(({s,cell,bigText})=>sessionStorage.setItem('round18.fixture',JSON.stringify({state:s,ui:{screen:'world',selected:cell,actor:'protagonist',focus:true,bigText}})),{s,cell,bigText});await page.reload();await page.locator('.selection-card').waitFor();}
async function enter(cell){await page.locator(`.selection-card [data-action="visit"][data-cell="${cell}"]`).click();await visit(cell).waitFor();await visit(cell).locator('img').first().evaluate(img=>img.decode());}
async function select(cell,actor=null){await click('home');if(actor)await page.locator(`[data-action="actor"][data-actor="${actor}"]`).click();await click('list');await page.locator(`[data-action="select"][data-cell="${cell}"]`).click();}
async function investigate(id){const d=page.locator(`[data-evidence-id="${id}"]`);if(!await d.evaluate(e=>e.open))await d.locator('summary').click();await d.locator('[data-action="evidence"]').click();}
async function action(cell,actor,id){await select(cell,actor);await page.locator('[data-primary-action]').click();const current=JSON.parse(await stateBytes()),a=sim.getActions(current,cell,actor).find(a=>a.id===id);assert.ok(a,`Actual UI action ${id} is legal`);for(const e of a.requireEvidence)if(!sim.getInvestigation(current,actor,cell).evidence.includes(e))await investigate(e);await page.locator(`[data-action="choose"][data-id="${id}"]`).click();await click('confirm');await click('lock');}
async function capture(name,selector=null){const path=`${out}/${name}.png`;if(selector)await page.locator(selector).first().screenshot({path});else await page.screenshot({path});report.screenshots.push(path);}
async function mandateArt(status){
 const selector=`[data-mandate-art="${status}"]`,panel=page.locator(selector);await panel.waitFor();const sample=await panel.locator('img').evaluate(async img=>{await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {width:c.width,height:c.height,src:img.currentSrc,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].map(n=>n.toString(16).padStart(2,'0')).join('')};});report.mandatePixels??={};report.mandatePixels[status]=sample;await capture(`authorization-${status}-detail-390`,selector);await panel.evaluate(el=>el.style.filter='grayscale(1)');await capture(`authorization-${status}-detail-390-mono`,selector);await panel.evaluate(el=>el.style.filter='');
}
async function inspect(s,cell,label){
 const expected=getSceneVisit(s,cell),body=visit(cell),text=await body.innerText();
 check(`${label}: visit exists at the current year and selected place`,expected?.available&&(await body.locator('.reading-meta').innerText()).includes(`第 ${s.year} 年`)&&await page.evaluate(()=>window.afterwave.ui.selected)===cell);
 check(`${label}: browser art, alt and caption match the sourced current view`,(await body.locator('.scene-art img').getAttribute('src')).endsWith(expected.art.file)&&await body.locator('.scene-art img').getAttribute('alt')===expected.art.alt&&await body.locator('.scene-art > span').innerText()===expected.art.caption);
 check(`${label}: visit includes no investigation, policy, lock or advance controls`,await body.locator('[data-action="avg"],[data-action="evidence"],[data-action="choose"],[data-action="confirm"],[data-action="lock"],[data-action="commit"],[data-action="step"],[data-action="skip"],[data-action="auto"],[data-evidence-id]').count()===0);
 const cards=expected.cards||[];check(`${label}: new current service and consequence cards are actually rendered`,cards.length>0&&cards.every(c=>text.includes(c.title)&&c.paragraphs.every(p=>text.includes(p))),cards.flatMap(c=>[c.title,...c.paragraphs].filter(p=>!text.includes(p))));
 const visibleIds=await allSources(cell).evaluateAll(els=>els.map(e=>e.dataset.id));
 const expectedIds=[...expected.sourceIds,...cards.flatMap(c=>c.sourceIds),...(expected.art.history?.recordId?[expected.art.history.recordId]:[])];
 check(`${label}: every advertised API card/source has a real visible link`,expectedIds.every(id=>visibleIds.includes(id)));
 const unsafe=visibleIds.map(id=>({id,problem:sourceProblem(s,id)})).filter(e=>e.problem);check(`${label}: each visible source independently has unique fulfilled current-reality ancestry`,unsafe.length===0,unsafe);
 check(`${label}: no imported contaminant leaks`,!/DO NOT EXPOSE|FUTURE CONTAMINANT/.test(text));
 check(`${label}: exact world bytes preserve costs, evidence, RNG, drafts, promises and history`,await stateBytes()===bytes(s));
 check(`${label}: no document horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 return visibleIds;
}
async function readonlyEntry(s,cell,label){const beforeSessions=await sessions(),beforeProbes=await probes();await enter(cell);await inspect(s,cell,label);check(`${label}: opening focuses heading without creating sessions or calling planning scenes`,await page.evaluate(()=>document.activeElement===document.querySelector('.scene-visit h1'))&&await sessions()===beforeSessions&&await probes()===beforeProbes);}
async function followSources(s,cell,label){const beforeSessions=await sessions(),ids=[...new Set(await allSources(cell).evaluateAll(els=>els.map(e=>e.dataset.id)))];for(const id of ids){await visit(cell).locator(`[data-action="trace"][data-id="${id}"]`).first().click();check(`${label}: source ${id} opens its actual saved destination read-only`,await page.evaluate(()=>window.afterwave.ui.traceId)===id&&await stateBytes()===bytes(s)&&await sessions()===beforeSessions&&!/DO NOT EXPOSE|FUTURE CONTAMINANT/.test(await page.locator('main').innerText()));await click('home');await enter(cell);}return ids;}
try{
 browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});page.on('console',m=>{if(/\[vite\].*(hot updated|page reload)/.test(m.text()))report.errors.push(`Runtime changed during tests: ${m.text()}`);});
 await page.addInitScript(()=>{const f=sessionStorage.getItem('round18.fixture');if(f){localStorage.setItem('afterwave.save.v1',f);sessionStorage.removeItem('round18.fixture');}});await page.goto('http://127.0.0.1:4218');await page.locator('.selection-card').waitFor();
 // Every chronological transition on this primary path is a real UI action.
 await click('settings');await page.locator('#seed').fill('0');await click('new-confirm');await click('new-run');
 await action('D4','protagonist','build_joint');await click('commit');await click('skip');
 await action('D4','protagonist','recruit_successor');await click('commit');await click('skip');
 await action('B4','protagonist','independent_review');await action('D4','linche','free_warning');await click('commit');await click('step');await click('pause-world');
 const natural21=JSON.parse(await stateBytes());check('Fresh seed0 clicked route actually reaches21 with paid warning, pending22 review and no authorizations',natural21.year===21&&natural21.events.some(e=>e.actionId==='free_warning'&&e.status==='success')&&natural21.events.some(e=>e.actionId==='independent_review'&&e.status==='pending')&&sim.getHandoffReadiness(natural21).authorizedCells.length===0);
 for(const cell of ['D4','E4']){await select(cell);await readonlyEntry(natural21,cell,`Natural21 ${cell}`);await followSources(natural21,cell,`Natural21 ${cell}`);}
 await click('home');await click('playback');await click('skip');const natural30=JSON.parse(await stateBytes()),frozenCrisis=bytes({crisis:natural30.flags.crisis,impact:natural30.history.find(e=>e.id==='crisis-impact')});
 await action('D4','protagonist','share_power');await select('E4','linche');await page.locator('[data-primary-action]').click();
 const auth=sim.getActions(JSON.parse(await stateBytes()),'E4','linche').find(a=>a.id==='authorize_training');check('Year30 original unpaid E4 training offers a genuine local authorization choice',!!auth&&auth.cost.politics===3&&auth.cost.economy===2&&auth.dueIn===1&&auth.requireEvidence.includes('resident_testimony'));
 const beforeResearch=JSON.parse(await stateBytes());await page.locator('[data-action="choose"][data-id="authorize_training"]').click();check('Authorization preview alone creates no grant, cost or evidence',await stateBytes()===bytes(beforeResearch)&&await page.locator('[data-action="confirm"]').isDisabled());
 await click('avg');await investigate('resident_testimony');await page.locator('[data-action="choose"][data-id="authorize_training"]').click();await click('confirm');await click('lock');const locked=JSON.parse(await stateBytes());
 check('Real authorization investigation spends one local round and lock pays nothing or grants nothing',sim.getInvestigation(locked,'linche','E4').budget===2&&bytes(locked.cells)===bytes(beforeResearch.cells)&&sim.getHandoffReadiness(locked).authorizedCells.length===0&&locked.drafts.linche.actionId==='authorize_training');
 await click('home');await readonlyEntry(locked,'E4','Locked authorization30');await click('home');await click('window');await click('commit');const paid=JSON.parse(await stateBytes()),oraclePaid=clone(locked);sim.commitWindow(oraclePaid);
 check('Real unified submit deducts the exact authoritative two-action costs atomically',bytes(paid)===bytes(oraclePaid)&&paid.history.some(h=>h.id==='action:30:linche:E4:authorize_training')&&sim.getHandoffReadiness(paid).authorizedCells.length===0);
 const beforeE4=locked.cells.find(c=>c.id==='E4').channels,paidE4=paid.cells.find(c=>c.id==='E4').channels,beforeD4=locked.cells.find(c=>c.id==='D4').channels,paidD4=paid.cells.find(c=>c.id==='D4').channels;check('Independent arithmetic confirms E4 politics3/economy2 and D4 policy politics3/economy3 paid only once',Math.abs(paidE4.politics-beforeE4.politics+3)<1e-9&&Math.abs(paidE4.economy-beforeE4.economy+2)<1e-9&&paidE4.science===beforeE4.science&&Math.abs(paidD4.politics-beforeD4.politics+3)<1e-9&&Math.abs(paidD4.economy-beforeD4.economy+3)<1e-9);
 await click('pause-world');await readonlyEntry(paid,'E4','Paid pending authorization30');check('Paid authorization card distinguishes unfulfilled contract from present service',await visit('E4').locator('[data-visit-status="pending"]').count()>0);await mandateArt('pending');await click('home');await click('playback');await click('step');const granted=JSON.parse(await stateBytes()),oracle31=clone(paid);sim.advanceYear(oracle31);
 check('Year31 actual settlement matches independent engine oracle exactly',bytes(granted)===bytes(oracle31));
 const orig=natural30.institutions.find(i=>i.cellId==='E4'&&i.kind==='training'),now=granted.institutions.find(i=>i.id===orig.id),sibling=granted.institutions.find(i=>i.cellId==='D5'&&i.kind==='training');
 check('Local grant authorizes only original E4 carrier, creates no carrier and preserves original provenance',now.localHandoffAuthorization&&sim.getHandoffReadiness(granted).authorizedCells.join(',')==='E4'&&!sibling.handoffAuthorization&&!sibling.localHandoffAuthorization&&granted.institutions.length===natural30.institutions.length&&now.sourceActionId===orig.sourceActionId&&now.sourceEventId===orig.sourceEventId&&bytes(now.annualSource)===bytes(orig.annualSource));
 const control31=clone(natural30);lock(control31,'protagonist','D4','share_power');submit(control31);sim.advanceYear(control31);const withoutLocalGrant=institutions=>institutions.map(i=>{const copy=clone(i);delete copy.localHandoffAuthorization;return copy;});check('Independent no-authorization control has exactly the same carriers, retained base source, coverage and trust',bytes(withoutLocalGrant(granted.institutions))===bytes(control31.institutions)&&bytes(sim.getWarningCoverage(granted))===bytes(sim.getWarningCoverage(control31))&&granted.flags.trust===control31.flags.trust&&!sim.getHandoffReadiness(control31).canShare);
 check('New workload changes only the proven original E4 effective source, not its retained base',bytes(sim.getInstitutionEffectiveAnnualSource(granted,now))===bytes(sim.TRAINING_WORKLOAD_RULES.after)&&bytes(sim.getInstitutionEffectiveAnnualSource(control31,control31.institutions.find(i=>i.id===orig.id)))===bytes(orig.annualSource)&&bytes(sim.getInstitutionEffectiveAnnualSource(granted,sibling))===bytes(sibling.annualSource));
 check('Authorization preserves the frozen23 crisis and enables shared handoff only with real B4 check and trust',bytes({crisis:granted.flags.crisis,impact:granted.history.find(e=>e.id==='crisis-impact')})===frozenCrisis&&sim.getHandoffReadiness(granted).canShare&&sim.getHandoffReadiness(granted).checkCells.includes('B4')&&granted.flags.trust===true);
 await click('pause-world');await readonlyEntry(granted,'E4','Granted authorization31');await followSources(granted,'E4','Granted authorization31');await capture('authorization-granted31-390','.scene-visit');await mandateArt('authorized');
 await page.reload();await visit('E4').waitFor();check('Reload restores exact E4 visit and authoritative31 world',await stateBytes()===bytes(granted)&&await page.evaluate(()=>window.afterwave.ui.screen)==='visit');
 await click('home');await click('playback');await click('skip');await click('ending');const natural40=JSON.parse(await stateBytes());
 for(const cell of ['D4','E4']){await page.locator(`.ending [data-action="visit"][data-cell="${cell}"]`).click();await inspect(natural40,cell,`Ending40 ${cell}`);check(`Ending40 ${cell} changes selection to explicit destination`,await page.evaluate(()=>window.afterwave.ui.selected)===cell);await click('home');await click('ending');}
 // A valid interrupted contract can lose its exact carrier before the due year.
 const stopped=clone(paid);stopped.institutions.find(i=>i.id===orig.id).active=false;check('Stopped paid target remains a valid import boundary',sim.validateState(stopped).valid);await show(stopped,'E4');await enter('E4');await inspect(stopped,'E4','Interrupted paid target30');await click('home');await click('playback');await click('step');const cancelled=JSON.parse(await stateBytes()),cancelOracle=clone(stopped);sim.advanceYear(cancelOracle);
 check('Actual interrupted playback cancels without refund or substitute target and matches oracle',bytes(cancelled)===bytes(cancelOracle)&&cancelled.events.find(e=>e.actionId==='authorize_training').status==='cancelled'&&!cancelled.institutions.some(i=>i.localHandoffAuthorization)&&sim.getHandoffReadiness(cancelled).authorizedCells.length===0);await click('pause-world');await enter('E4');await inspect(cancelled,'E4','Cancelled target31');check('Cancelled outcome remains visibly distinct from successful authorization',await visit('E4').innerText().then(t=>/取消/.test(t)));await capture('authorization-cancelled31-390','.scene-visit');await mandateArt('cancelled');check('Pending, granted and cancelled authority use three distinct decoded pixel images',new Set(Object.values(report.mandatePixels).map(p=>p.hash)).size===3);
 // Genuine pre-round18 engine save: eligibility is versioned, never backfilled.
 const oldState=old.createRun(0),oldLock=(cell,actor,id)=>{const a=old.getActions(oldState,cell,actor).find(a=>a.id===id);for(const evidence of a.requireEvidence)old.investigate(oldState,actor,cell,evidence);old.lockTask(oldState,actor,cell,id,a.requireEvidence);},oldNext=()=>{for(const actor of old.getActors(oldState))if(!oldState.drafts[actor.id])old.passTask(oldState,actor.id);old.commitWindow(oldState);old.advanceToNextWindow(oldState);};
 oldLock('D4','protagonist','build_joint');oldNext();oldLock('D4','protagonist','recruit_successor');oldNext();oldLock('B4','protagonist','independent_review');oldLock('D4','linche','free_warning');oldNext();check('Genuine pre-version year30 save remains valid',sim.validateState(oldState).valid&&oldState.trainingAuthorizationRulesVersion===undefined);await show(oldState,'E4');await page.locator('[data-primary-action]').click();check('Genuine old save retains training but receives no new authorization action',await page.locator('[data-action="choose"][data-id="authorize_training"]').count()===0&&await stateBytes()===bytes(oldState));await click('home');await enter('E4');await inspect(oldState,'E4','Genuine old30 E4 visit');
 // Independent legal states broaden chronology, institutional origin and personal consequences.
 for(const c of cases){await show(c.state,c.cell);await readonlyEntry(c.state,c.cell,c.name);if(['anonymous-restored-station-y21','resident-warning-y21'].includes(c.name))check(`${c.name}: anonymous provision does not assign Sulan an unrecorded current job`,!/(苏岚.{0,10}(?:现任|正在担任|如今担任|仍在担任|是测站维护者|是档案保管员))/.test(await visit(c.cell).innerText()));if(c.name==='forced-relocation-E4-y21')check('E4 relocation retains a real D4 source instead of inventing E4 personal history',(await allSources('E4').evaluateAll(els=>els.map(e=>e.dataset.id))).some(id=>id.includes(':D4:relocate_teacher')));}
 // World event, regional archive and active playback provide actual cross-place entries.
 await show(joint.y21,'B4');await renderedBoard(page);const priorView=await page.evaluate(()=>window.afterwave.mapView);await page.locator('.world-side .event-card [data-action="visit"][data-cell="D4"]').first().click();await inspect(joint.y21,'D4','Cross-place world event');await click('home');check('Returning from cross-place event retains destination selection',await page.evaluate(()=>window.afterwave.ui.selected)==='D4');await renderedBoard(page);const returnedView=await page.evaluate(()=>window.afterwave.mapView);check('Cross-region D4 visit resets focused camera to actual D4 instead of the previous B4',returnedView.focus&&Math.abs(returnedView.centerX-288)<1&&Math.abs(returnedView.centerY-136)<1&&Math.abs(priorView.centerX-returnedView.centerX)>1,{priorView,returnedView});
 await click('cell-history');await page.locator('main > section > [data-action="visit"][data-cell="D4"]').first().click();await inspect(joint.y21,'D4','Regional archive entry');
 await click('home');await click('playback');await click('auto');await page.locator('.history-list [data-action="visit"][data-cell="E4"]').first().click();const paused=await stateBytes();await page.waitForTimeout(1100);check('Opening visit stops active annual timer rather than advancing behind the scene',await stateBytes()===paused&&JSON.parse(paused).year===21);
 // Import uses the application’s actual file input; no direct navigate or state assignment.
 for(const cell of ['D4','E4']){await click('settings');await page.locator('#import-save').setInputFiles({name:`round18-${cell}.json`,mimeType:'application/json',buffer:Buffer.from(bytes({state:joint.y40,ui:{screen:'visit',selected:cell}}))});await page.locator('.selection-card').waitFor();check(`Imported40 ${cell} safely returns to world and preserves all original facts`,await stateBytes()===bytes(joint.y40)&&await page.evaluate(()=>window.afterwave.ui.screen)==='world');await enter(cell);await page.reload();await visit(cell).waitFor();check(`Imported40 ${cell} persists a supported read-only visit across reload`,await stateBytes()===bytes(joint.y40)&&await page.evaluate(()=>window.afterwave.ui.screen)==='visit');}
 // Legal imported collision remains preserved, but no misleading destination may be offered.
 const corrupt=clone(joint.y21),badId='resolved:event:action:20:protagonist:D4:free_warning';corrupt.events.push({id:badId,year:39,cellId:'B4',kind:'event',actionId:'training',title:'FUTURE CONTAMINANT',text:'DO NOT EXPOSE',parentId:null,sourceActionId:null,probability:1,status:'pending'});check('Source collision is an importable boundary, not a rejected save',sim.validateState(corrupt).valid);
 await click('settings');await page.locator('#import-save').setInputFiles({name:'round18-colliding-source.json',mimeType:'application/json',buffer:Buffer.from(bytes({state:corrupt,ui:{selected:'D4'}}))});await page.locator('.selection-card').waitFor();await enter('D4');await inspect(corrupt,'D4','Imported ambiguous warning');check('Ambiguous warning outcome is not advertised as a verified source',!(await allSources('D4').evaluateAll(els=>els.map(e=>e.dataset.id))).includes(badId));await followSources(corrupt,'D4','Imported safe retained links');
 // Actual pixels and reachable keyboard controls, including independent closure identities.
 for(const width of [390,320]){await page.setViewportSize({width,height:width===390?844:568});for(const cell of ['D4','E4']){await show(joint.y31,cell);await enter(cell);await inspect(joint.y31,cell,`${width}px ${cell}`);await capture(`${cell.toLowerCase()}-31-${width}`,'.scene-visit');await capture(`${cell.toLowerCase()}-31-${width}-scene`,'.scene-art');if(cell==='E4')for(const c of cases.filter(c=>c.boundary)){await show(c.state,cell);await enter(cell);await capture(`${c.name}-${width}`,'.scene-art');}}
  for(const cell of ['D4','E4']){await show(joint.y31,cell,true);const entry=page.locator(`.selection-card [data-action="visit"][data-cell="${cell}"]`);await entry.scrollIntoViewIfNeeded();await entry.focus();await page.keyboard.press('Enter');await visit(cell).waitFor();await inspect(joint.y31,cell,`${width}px200% ${cell}`);check(`${width}px200% ${cell}: native200% font stays in bounds`,await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize==='32px'&&document.documentElement.scrollWidth<=innerWidth));await visit(cell).locator('h1').scrollIntoViewIfNeeded();await capture(`${cell.toLowerCase()}-31-${width}-text200-heading`);await capture(`${cell.toLowerCase()}-31-${width}-text200-current`,'.scene-visit [data-visit-card^="carrier:"]');const last=allSources(cell).last();await last.scrollIntoViewIfNeeded();await last.focus();check(`${width}px200% ${cell}: last source has visible unobscured keyboard focus`,await last.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return document.activeElement===el&&r.height>=48&&(hit===el||el.contains(hit));}));const id=await last.getAttribute('data-id');await page.keyboard.press('Enter');check(`${width}px200% ${cell}: keyboard source opens original record without spending`,await page.evaluate(()=>window.afterwave.ui.traceId)===id&&await stateBytes()===bytes(joint.y31));}
 }
 report.runtimeHash={before:frozen,after:await runtimeHash()};check('Production sources remained frozen during this entire suite',report.runtimeHash.before===report.runtimeHash.after);check('No browser runtime or asset errors',report.errors.length===0,report.errors);
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;if(page)await page.screenshot({path:`${out}/round18-failure.png`,fullPage:true}).catch(()=>{});}
finally{await fs.writeFile(`${out}/return-consequences-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
