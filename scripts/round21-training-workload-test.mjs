// Independent browser QA. Never writes production or docs. --explore uses a
// separate output directory; --fixtures-only runs only the route preflight.
import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as old from '../tests/fixtures/pre-training-workload-producer/simulation.js';
import {getTrainingChoiceComparison} from '../src/training-choice-comparison.js';
import {restoreSave} from '../src/save.js';
import {bytes, copy, checkpoints, finalLocks, commit} from '../tests/fixtures/pre-training-workload-scenarios.js';

const exploratory=process.argv.includes('--explore');
const root=`playtest-output/round-21${exploratory?'/exploratory':''}`, shots=`${root}/screenshots`;
const report={startedAt:new Date().toISOString(),scope:'Independent Chromium real-control play from fresh 0 to 40, actual file-import restoration of new and genuine old producer states, per-year complete state comparisons, read-only disclosure/navigation/export/reload, 390/320px with native 100/200% text. Not physical-device, screen-reader, human-playtest or universal-balance certification.',exploratory,checks:[],errors:[],screenshots:[],routes:{},runtimeHash:{}};
function check(name,ok,detail){report.checks.push({name,passed:!!ok,...(detail===undefined?{}:{detail})});assert.ok(ok,name);}
const fixtures={};
for(const [version,api] of [['new',sim],['old',old]])for(const support of ['authorize_training','train_network']){
 const key=`${version}-${support}`;fixtures[key]=checkpoints(api,{support});
 for(const [phase,state]of Object.entries(fixtures[key]))check(`${key}/${phase}: valid and exact restore`,sim.validateState(state).valid&&bytes(restoreSave({state:copy(state)}).state)===bytes(state));
 const s=fixtures[key].ended;report.routes[key]={ending:api.getEnding(s).title,channels:s.cells.find(c=>c.id==='E4').channels,workloadVersion:s.trainingWorkloadRulesVersion??null,institutions:s.institutions.filter(i=>i.cellId==='E4').map(i=>({id:i.id,kind:i.kind,savedSource:i.annualSource,effectiveSource:sim.getInstitutionEffectiveAnnualSource?.(s,i)??i.annualSource}))};
}
check('New runs explicitly identify workload-v1',fixtures['new-authorize_training'].planning.trainingWorkloadRulesVersion==='training-workload-v1');
check('True old producer does not carry workload version',!Object.hasOwn(fixtures['old-authorize_training'].planning,'trainingWorkloadRulesVersion'));
const a=report.routes['new-authorize_training'].channels,t=report.routes['new-train_network'].channels;
report.naturalDifference=Object.fromEntries(sim.CHANNELS.map(k=>[k,+(a[k]-t[k]).toFixed(4)]));
check('Natural seed0 offers actual coordination versus teaching outcome, without changing the title',a.politics>t.politics&&a.economy>t.economy&&a.science<t.science&&report.routes['new-authorize_training'].ending===report.routes['new-train_network'].ending,report.naturalDifference);
if(process.argv.includes('--fixtures-only')){console.log(JSON.stringify(report,null,2));process.exit(0);}

async function runtimeHash(){const h=createHash('sha256');async function walk(path){for(const d of(await fs.readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const f=`${path}/${d.name}`;if(d.isDirectory())await walk(f);else{h.update(f);h.update(await fs.readFile(f));}}}await walk('src');return h.digest('hex');}
await fs.mkdir(shots,{recursive:true});report.runtimeHash.before=await runtimeHash();
const server=await createServer({server:{host:'127.0.0.1',port:4224,strictPort:true}});await server.listen();let browser,page;
const click=action=>page.locator(`[data-action="${action}"]`).first().click();
const stateBytes=()=>page.evaluate(()=>JSON.stringify(window.afterwave.state));
const savedBytes=()=>page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state));
async function unchanged(before,label){check(`${label}: entire memory and saved world unchanged`,await stateBytes()===before&&await savedBytes()===before);}
async function select(cell,actor='protagonist'){await click('home');await page.locator(`[data-action="actor"][data-actor="${actor}"]`).click();await click('list');await page.locator(`[data-action="select"][data-cell="${cell}"]`).click();await page.locator('[data-primary-action]').click();}
async function investigate(evidence){const d=page.locator(`[data-evidence-id="${evidence}"]`);if(!await d.evaluate(e=>e.open))await d.locator(':scope > summary').click();await d.locator('[data-action="evidence"]').click();}
async function visibleLock(cell,actor,id){await select(cell,actor);const s=JSON.parse(await stateBytes()),action=sim.getActions(s,cell,actor).find(a=>a.id===id);check(`Available UI choice ${actor}/${cell}/${id}`,!!action);for(const evidence of action.requireEvidence)if(!sim.getInvestigation(s,actor,cell).evidence.includes(evidence))await investigate(evidence);await page.locator(`[data-action="choose"][data-id="${id}"]`).click();await click('confirm');await click('lock');}
async function advanceYears(expected,api,label){if(await page.evaluate(()=>window.afterwave.ui.screen)!=='playback')await page.locator('[data-action="playback"]').first().click();while(expected.phase==='playback'){api.advanceYear(expected);await click('step');check(`${label}: visible annual ${expected.year} equals entire independent producer state`,await stateBytes()===bytes(expected));}}
async function submitAndAdvance(label,api=sim){const expected=JSON.parse(await stateBytes());api.commitWindow(expected);await click('commit');check(`${label}: exact unified submission`,await stateBytes()===bytes(expected));await advanceYears(expected,api,label);}
async function importWorld(state,big=false,label='import'){await click('settings');await page.locator('#import-save').setInputFiles({name:`round21-${label}-y${state.year}.json`,mimeType:'application/json',buffer:Buffer.from(bytes({state,ui:{screen:'ending',selected:'E4',bigText:big}}))});await page.locator('.selection-card').waitFor();check(`${label}: actual file import is byte exact and safely opens world`,await stateBytes()===bytes(state)&&await page.evaluate(()=>window.afterwave.ui.screen)==='world');}
async function capture(name,selector){
 await page.mouse.move(0,0);await page.locator('.toast').first().waitFor({state:'hidden',timeout:6000}).catch(()=>{});
 const record=async(path,extra={})=>{const b=await fs.readFile(path);report.screenshots.push({path,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),...extra});};
 const locator=selector?page.locator(selector).first():null,box=locator?await locator.boundingBox():null;
 if(box&&box.height>7000){
  // Chromium's tall-element capture may wrap its texture at 8192px. Capture
  // actual scroll positions at the original 390x844 / 320x568 viewport instead.
  // No stitching, resizing, reconstructed pixels or synthetic long PNG.
  await fs.unlink(`${shots}/${name}.png`).catch(e=>{if(e.code!=='ENOENT')throw e;});
  const scroll=await page.evaluate(()=>scrollY),start=box.y+scroll,end=start+box.height,viewport=page.viewportSize(),world=await stateBytes();
  let position=start,part=0,last=-1,covered=start;
  while(covered<end-.5){
   await page.evaluate(y=>scrollTo(0,y),position);await page.evaluate(()=>new Promise(requestAnimationFrame));
   const actual=await page.evaluate(()=>scrollY);check(`${name}: segment ${part+1} advances without skipped pixels`,actual>last&&actual<=covered+.5,{scrollY:actual,previousCovered:covered});
   const path=`${shots}/${name}-part-${String(++part).padStart(2,'0')}.png`;await page.screenshot({path,fullPage:false});await record(path,{capture:'actual-viewport-segment',group:name,part,scrollY:actual,viewport,elementStart:start,elementEnd:end});
   last=actual;covered=actual+viewport.height;if(covered<end-.5)position=covered-64;
  }
  await page.evaluate(y=>scrollTo(0,y),scroll);await unchanged(world,`${name}: bounded screenshot scrolling`);return;
 }
 const path=`${shots}/${name}.png`;if(locator)await locator.screenshot({path});else await page.screenshot({path});await record(path,{capture:selector?'bounded-element':'viewport'});
}
async function layout(label){const result=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,font:getComputedStyle(document.documentElement).fontSize,overflow:[...document.querySelectorAll('main section, main article, main details, main summary, main button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left<-.5||r.right>innerWidth+.5);}).map(e=>e.className||e.tagName)}));check(`${label}: document and components fit viewport`,result.scroll<=result.width&&result.overflow.length===0,result);return result;}
async function keyboardOpen(locator,label){await locator.scrollIntoViewIfNeeded();await page.keyboard.press('Tab');await locator.focus();const details=await locator.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {focused:document.activeElement===e,height:r.height,uncovered:hit===e||e.contains(hit),outline:getComputedStyle(e).outlineStyle};});check(`${label}: visible keyboard focus and hit target`,details.focused&&details.height>=44&&details.uncovered&&details.outline!=='none',details);await page.keyboard.press('Enter');}
async function downloadExact(expected,label){const wait=page.waitForEvent('download');await click('export');const d=await wait,stream=await d.createReadStream(),parts=[];for await(const p of stream)parts.push(p);check(`${label}: actual downloaded state exact`,bytes(JSON.parse(Buffer.concat(parts).toString()).state)===expected);}
try{
 browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});report.browserVersion=await browser.version();page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});page.on('console',m=>{if(/\[vite\].*(hot updated|page reload)/.test(m.text()))report.errors.push(`Source changed: ${m.text()}`);});
 await page.goto('http://127.0.0.1:4224');await page.locator('.selection-card').waitFor();await click('settings');await page.locator('#seed').fill('0');await click('new-confirm');await click('new-run');
 await visibleLock('D4','protagonist','build_joint');await submitAndAdvance('Fresh0→10');await visibleLock('D4','protagonist','recruit_successor');await submitAndAdvance('Fresh10→20');await visibleLock('B4','protagonist','independent_review');await visibleLock('D4','linche','free_warning');await submitAndAdvance('Fresh20→30');
 check('Fresh visible0→30 exactly matches natural independent route',await stateBytes()===bytes(fixtures['new-authorize_training'].planning));
 await select('E4','linche');const before=await stateBytes();await keyboardOpen(page.locator('[data-training-choice-comparison] > summary'),'Fresh comparison');await keyboardOpen(page.locator('[data-training-choice-detail] > summary'),'Fresh comparison limits');check('Real comparison contains both concrete annual-source alternatives',await page.locator('[data-training-choice]').count()===2);await unchanged(before,'Fresh comparison reading');
 await visibleLock('D4','protagonist','share_power');await visibleLock('E4','linche','authorize_training');await submitAndAdvance('Fresh30→40');check('Real-click complete0→40 equals entire independent new authorization state',await stateBytes()===bytes(fixtures['new-authorize_training'].ended));
 // Import all real producer phases, then complete them using visible actions.
 for(const [version,api]of [['new',sim],['old',old]])for(const support of ['authorize_training','train_network'])for(const phase of ['planning','locked','committed','settled','year35','ended']){
  const key=`${version}-${support}`,label=`${key}/${phase}`,source=fixtures[key][phase],expected=copy(source);await importWorld(source,false,label);await click('settings');check(`${label}: settings identifies the original rule, without upgrading`,await page.locator('[data-training-workload-rules]').getAttribute('data-training-workload-rules')===(version==='new'?'training-workload-v1':'preserved'));await unchanged(bytes(source),`${label} settings reading`);await click('home');
  if(phase==='planning'){await visibleLock('D4','protagonist','share_power');await visibleLock('E4','linche',support);finalLocks(expected,api,{support});check(`${label}: lock order preserves complete state`,await stateBytes()===bytes(expected));}
  if(expected.phase==='planning'){if(await page.evaluate(()=>window.afterwave.ui.screen)!=='window')await click('window');commit(expected,api);await click('commit');check(`${label}: browser submission exact`,await stateBytes()===bytes(expected));}
  if(expected.phase==='playback')await advanceYears(expected,api,label);
  await click('ending');check(`${label}: ending matches original producer`,await page.locator('.ending h1').innerText()===api.getEnding(expected).title);await unchanged(bytes(expected),`${label} ending`);await page.reload();await page.locator('.ending').waitFor();await unchanged(bytes(expected),`${label} reload`);
 }
 // These are legal imported boundaries, explicitly not natural player actions.
 for(const kind of ['cancelled-target','stopped-after-success']){
  const source=copy(fixtures['new-authorize_training'][kind==='cancelled-target'?'committed':'year35']);source.institutions.find(i=>i.kind==='training'&&i.cellId==='E4').active=false;
  check(`Synthetic ${kind}: legal before file import`,sim.validateState(source).valid);await importWorld(source,false,`synthetic-${kind}`);const expected=copy(source);await advanceYears(expected,sim,`synthetic-${kind}`);await click('ending');await capture(`synthetic-${kind}-ending-390`,'[data-last-interventions]');await unchanged(bytes(expected),`synthetic-${kind} ending reading`);
  const status=sim.getTrainingAuthorizationStatus(expected).status;check(`Synthetic ${kind}: settled status is not invented success`,status===(kind==='cancelled-target'?'cancelled':'authorized'),status);report.routes[`synthetic-${kind}`]={natural:false,authorization:status,ending:sim.getEnding(expected).title};
  await page.locator('.ending [data-action="visit"][data-cell="E4"]').click();await capture(`synthetic-${kind}-visit-390`,'main > section');await unchanged(bytes(expected),`synthetic-${kind} visit reading`);
 }
 const custom=copy(fixtures['new-authorize_training'].planning);custom.institutions.find(i=>i.kind==='training'&&i.cellId==='E4').annualSource.science=.9;await importWorld(custom,false,'synthetic-custom-source');await select('E4','linche');check('Legal custom source UI preserves new training and offers no fixed reassignment',await page.locator('[data-action="choose"][data-id="train_network"]').count()===1&&await page.locator('[data-action="choose"][data-id="authorize_training"]').count()===0&&await page.locator('[data-training-choice-comparison]').count()===0);await unchanged(bytes(custom),'Synthetic custom source read');
 // Native big text is a real app setting, never screenshot magnification.
 for(const width of [390,320])for(const big of [false,true]){
  await page.setViewportSize({width,height:width===390?844:568});const mode=`${width}-${big?'text200':'text100'}`,state=fixtures['new-authorize_training'].planning;await importWorld(state,false,mode);if(big){await click('settings');await click('text-size');await click('home');}await select('E4','linche');const original=bytes(state);
  await layout(`${mode} free scene`);await capture(`free-scene-${mode}`,'.prose');await keyboardOpen(page.locator('[data-training-choice-comparison] > summary'),`${mode} comparison`);await keyboardOpen(page.locator('[data-training-choice-detail] > summary'),`${mode} conditions`);
  const l=await layout(`${mode} comparison`);check(`${mode}: actual root typography`,l.font===(big?'32px':'16px'));await capture(`comparison-${mode}`,'[data-training-choice-comparison]');
  for(let n=0;n<3;n++){await page.locator('[data-training-choice-detail] > summary').click();await page.locator('[data-training-choice-detail] > summary').click();}await unchanged(original,`${mode} repeated comparison`);
  await investigate('resident_testimony');const afterEvidence=await stateBytes();await page.locator('[data-action="choose"][data-id="authorize_training"]').click();await layout(`${mode} choice`);await capture(`authorization-preview-${mode}`,'main > section');await unchanged(afterEvidence,`${mode} choice reading`);await click('confirm');await layout(`${mode} confirmation`);await capture(`authorization-confirm-${mode}`,'main > section');await unchanged(afterEvidence,`${mode} confirmation reading`);
  await click('lock');await visibleLock('D4','protagonist','share_power');await layout(`${mode} locked review`);await capture(`locked-review-${mode}`,'main > section');const locked=await stateBytes();await click('settings');await downloadExact(locked,`${mode} locked archive`);await unchanged(locked,`${mode} export`);
  await importWorld(fixtures['new-authorize_training'].ended,big,`${mode} finished`);await click('ending');await layout(`${mode} ending`);await capture(`ending-work-${mode}`,'[data-last-interventions]');const ended=await stateBytes();const actor=page.locator('[data-ending-actor="linche"]');const disclosure=actor.locator('[data-ending-disclosure]');if(await disclosure.count()&&!await disclosure.evaluate(e=>e.open))await disclosure.locator(':scope > summary').click();const source=actor.locator('[data-action="trace"]').last();await source.scrollIntoViewIfNeeded();await source.focus();await page.keyboard.press('Enter');await click('ending-return');check(`${mode}: return focuses the original workload source`,await source.evaluate(e=>document.activeElement===e));await unchanged(ended,`${mode} ending source loop`);
  const visit=page.locator('.ending [data-action="visit"][data-cell="E4"]');await visit.click();await layout(`${mode} E4 visit`);await capture(`e4-visit-${mode}`,'main > section');await click('ending-return');await unchanged(ended,`${mode} E4 visit loop`);
 }
 // The old contract remains an actual old promise in the new UI.
 await page.setViewportSize({width:390,height:844});await importWorld(fixtures['old-authorize_training'].planning,false,'old comparison');await select('E4','linche');await page.locator('[data-training-choice-comparison] > summary').click();await capture('old-contract-comparison-390','[data-training-choice-comparison]');await unchanged(bytes(fixtures['old-authorize_training'].planning),'Old comparison read');
 const publicFacts=getTrainingChoiceComparison(fixtures['old-authorize_training'].planning,'E4','linche');check('Old comparison does not promise the new coordination vector',publicFacts.options[0].workload?.mode==='authorize-only'&&Object.values(publicFacts.options[0].annualSourceChange).every(n=>n===0));
 report.runtimeHash.after=await runtimeHash();check('All production source bytes remained frozen during formal run',report.runtimeHash.before===report.runtimeHash.after);check('No browser runtime, missing asset or hot reload errors',report.errors.length===0,report.errors);
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;if(page)await page.screenshot({path:`${root}/failure.png`,fullPage:true}).catch(()=>{});}
finally{report.completedAt=new Date().toISOString();report.runtimeHash.after=await runtimeHash();await fs.writeFile(`${root}/training-workload-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
