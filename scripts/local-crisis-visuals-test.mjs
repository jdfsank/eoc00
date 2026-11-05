import {chromium} from 'playwright';
import cb from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {getLocalCrisisRecord} from '../src/local-crisis-record.js';
import {sceneArt} from '../src/scene-art.js';
import {institutionVisual} from '../src/board-visuals.js';
import {advanceYear,validateState,getActions} from '../src/simulation.js';
import {localAt20,localAt30,legacyLocalAt30,submit,lock,decade} from '../tests/helpers/local-crisis.js';
const out='playtest-output';await fs.mkdir(out,{recursive:true});
const report={checks:[],errors:[],scope:'Real year23 local settlement and independent current D5 services. Grayscale archive markers describe recorded loss, recorded zero and unknown old details; no population, injury or building damage is inferred. Closed-service and 0.0001 precision cases are legal display boundaries, not newly added actions or claimed natural outcomes. Only public AVG entries are exercised; world and regional archives cover every affected place. Four-region source links retain the actual shared record and its unmodified narrative. Chromium390/320 and200% text; not physical-device certification.'};
const check=(name,ok)=>{report.checks.push({name,passed:!!ok});assert.ok(ok,name);};
const before=localAt20(),y22=structuredClone(before);submit(y22);advanceYear(y22);advanceYear(y22);const y23=structuredClone(y22);advanceYear(y23);
const loss=localAt30(),zero=localAt30({zero:true}),legacy=legacyLocalAt30(),missing=structuredClone(loss),partial=structuredClone(loss),closed=structuredClone(loss);
missing.history=missing.history.filter(h=>h.id!=='crisis-impact');delete partial.flags.crisis.damageByCell;delete partial.flags.crisis.coverageByCell;
for(const i of closed.institutions.filter(i=>i.cellId==='D5'))i.active=false;
const late=structuredClone(closed);lock(late,'protagonist','D5','mutual_aid');decade(late);
const cases={before,y22,y23,loss,zero,legacy,missing,partial,closed,'aid-only':localAt30({teaching:false}),'teaching-only':localAt30({aid:false}),empty:localAt30({teaching:false,aid:false}),late};
for(const [name,s]of Object.entries(cases))assert.equal(validateState(s).valid,true,name);
const server=await createServer({server:{host:'127.0.0.1',port:4205,strictPort:true}});await server.listen();let browser,page;
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
const panel=(cell='D5')=>page.locator(`.local-crisis-history[data-crisis-cell="${cell}"]`);
async function show(state,bigText=false,cell='D5'){await page.evaluate(({state,bigText,cell})=>sessionStorage.setItem('afterwave.tally.fixture',JSON.stringify({state,ui:{screen:'world',selected:cell,actor:'protagonist',channel:'science',focus:true,bigText}})),{state,bigText,cell});await page.reload();await page.locator('canvas').waitFor();await page.waitForTimeout(130);}
async function snap(name,selector='.local-crisis-history',mono=false){const target=page.locator(selector);if(mono)await target.evaluate(el=>el.style.filter='grayscale(1)');const data=await target.screenshot({path:`${out}/round10-d5-${name}${mono?'-mono':''}.png`});if(mono)await target.evaluate(el=>el.style.filter='');return data.toString('base64');}
async function source(record){await panel().locator('[data-action="trace"]').click();await page.locator('.crisis-history').waitFor();check(`${record.status} source link opens the real year23 record`,await page.evaluate(()=>window.afterwave.ui.traceId)==='crisis-impact'&&(await page.locator('.crisis-recorded-impact').innerText()).includes('第23年'));}
try{
 browser=await chromium.launch({executablePath:await cb.executablePath(),args:cb.args,headless:true});page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{const value=sessionStorage.getItem('afterwave.tally.fixture');if(value){localStorage.setItem('afterwave.save.v1',value);sessionStorage.removeItem('afterwave.tally.fixture');}});await page.goto('http://127.0.0.1:4205');await page.locator('canvas').waitFor();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===390?844:568});const physical={},semantics={},markers={};
  for(const [name,state]of Object.entries(cases)){
   await show(state);const history=getLocalCrisisRecord(state,'D5'),visual=institutionVisual(state,'D5'),art=sceneArt(state,'D5');
   check(`${width}px ${name}: world shows only a settled historical marker`,history.status==='pending'?!await panel().count():await panel().getAttribute('data-crisis-status')===history.status);
   check(`${width}px ${name}: current service status remains independent`,visual?(await page.locator('.institution-status').innerText())===visual.label:!await page.locator('.institution-status').count());
   if(history.status!=='pending'){
    check(`${width}px ${name}: source button exists only for a verified original record`,await panel().locator('[data-action="trace"]').count()===(history.recordId?1:0));
    check(`${width}px ${name}: world displays the exact local history summary`,(await panel().innerText()).includes(history.summary));
   }
   if(state.phase==='planning'){
    await click('avg');check(`${width}px ${name}: current physical illustration stays factual`,(await page.locator('.scene-art img').getAttribute('src')).endsWith(art.file));
    if(history.status!=='pending'){
     check(`${width}px ${name}: annotation is separate and below the current scene`,await panel().evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.scene-art').getBoundingClientRect().bottom-1));
     check(`${width}px ${name}: full detail distinguishes history from people or building counts`,(await panel().innerText()).includes('不是人口或伤亡统计')&&(await panel().innerText()).includes('不证明建筑毁损'));
     check(`${width}px ${name}: saved local coefficient precision stays intact`,(await panel().innerText()).includes(history.detail[0]));
     await snap(`${width}-${name}-tally`);
     if(['loss','zero','legacy'].includes(name)){markers[name]=await snap(`${width}-${name}-tally`,'.local-crisis-history',true);physical[name]=await snap(`${width}-${name}-current-scene`,'.scene-art img');semantics[name]=await page.locator('.scene-art').evaluate(el=>JSON.stringify({file:el.querySelector('img').getAttribute('src'),alt:el.querySelector('img').alt,caption:el.querySelector('span').textContent}));}
     if(width===390&&name==='loss')await page.screenshot({path:`${out}/round10-d5-390-loss-avg.png`,fullPage:true});
    }
   }
   check(`${width}px ${name}: rendering preserves exact saved facts`,await page.evaluate(()=>JSON.stringify(window.afterwave.state))===JSON.stringify(state));
  }
  check(`${width}px loss and zero keep identical current asset, alt and caption`,semantics.loss===semantics.zero);
  check(`${width}px loss and zero do not manufacture different current damage scenery`,physical.loss===physical.zero);
  check(`${width}px loss, zero and unknown are distinguishable in grayscale`,new Set(Object.values(markers)).size===3);
  for(const [name,state]of [['loss',loss],['zero',zero],['legacy',legacy],['missing',missing]]){
   await show(state,true);await click('avg');check(`${width}px200% ${name}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   check(`${width}px200% ${name}: marker stays small and heading gets the full line`,await panel().locator('.crisis-tally-heading').evaluate(el=>{const icon=el.querySelector('img').getBoundingClientRect(),title=el.querySelector('h2').getBoundingClientRect(),box=el.getBoundingClientRect();return Math.abs(icon.width-48)<1&&title.top>=icon.bottom&&title.width>=box.width*.8;}));
   const record=getLocalCrisisRecord(state,'D5');await snap(`${width}-${name}-text200-tally`);
   if(record.recordId){
    const button=panel().locator('[data-action="trace"]');await button.scrollIntoViewIfNeeded();await button.focus();
    check(`${width}px200% ${name}: source control has visible, unobscured keyboard focus`,await button.evaluate(el=>{const r=el.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return document.activeElement===el&&(top===el||el.contains(top))&&r.height>=48&&r.top>=0&&r.bottom<=innerHeight;}));
    await page.keyboard.press('Enter');await page.locator('.crisis-history').waitFor();check(`${width}px200% ${name}: keyboard opens the real source without spending`,await page.evaluate(()=>window.afterwave.ui.traceId==='crisis-impact')&&await page.evaluate(()=>JSON.stringify(window.afterwave.state))===JSON.stringify(state));
   }
  }
 }
 // Actual local-history entry includes the existing shared source record,
 // retaining its D4 storage tag rather than forging a D5-authored event.
 await page.setViewportSize({width:390,height:844});await show(loss);await click('cell-history');
 const originalCard=page.locator('.history-list .event-card').filter({has:page.locator('[data-action="trace"][data-id="crisis-impact"]')});
 check('D5 regional history now includes the real shared impact record once',await originalCard.count()===1&&(await originalCard.locator('.event-meta').innerText()).includes('D4'));
 await snap('390-regional-history','.history-list');await originalCard.locator('[data-action="trace"][data-id="crisis-impact"]').click();await page.locator('.crisis-history').waitFor();
 check('The D5 source shows saved local coefficients, not a recomputed present value',(await page.locator('.crisis-recorded-impact').innerText()).includes(`D5：已存覆盖系数${String(loss.flags.crisis.coverageByCell.D5)}；已存损失系数${String(loss.flags.crisis.damageByCell.D5)}`));
 check('Regional archive and source navigation do not mutate state',await page.evaluate(()=>JSON.stringify(window.afterwave.state))===JSON.stringify(loss));
 await show(missing);await click('cell-history');check('Missing original record has neither a fabricated card nor a source button',!await page.locator('.history-list [data-action="trace"][data-id="crisis-impact"]').count());
 // Actual pass-and-step path: marker appears at23, never at20,21,22.
 await show(before);await click('window');await page.locator('[data-action="pass"][data-actor="protagonist"]').click();await click('commit');await click('pause-world');
 for(const year of [21,22,23]){await click('playback');await click('step');await click('pause-world');check(`Actual year${year} marker follows settlement time`,await page.evaluate(()=>window.afterwave.state.year)===year&&(year<23?!await panel().count():await panel().getAttribute('data-crisis-status')==='loss'));}
 await snap('390-actual-year23-world','.selection-card');await click('playback');await click('skip');await click('home');await click('avg');check('Public year30 revisit retains both current services and the historical page',await panel().getAttribute('data-crisis-status')==='loss'&&(await page.locator('.scene-art img').getAttribute('src')).endsWith('south-bank-learning-aid.svg'));
 // A real old-engine save imports without invented per-place records.
 await click('settings');await page.locator('#import-save').setInputFiles({name:'old-local-history.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({state:legacy,ui:{selected:'D5'}}))});await page.locator('.toast').waitFor({state:'detached'});await panel().waitFor();
 check('Legacy import preserves unknown local loss and a real original source',await panel().getAttribute('data-crisis-status')==='unknown'&&await panel().locator('[data-action="trace"]').count()===1&&await page.evaluate(()=>JSON.stringify(window.afterwave.state))===JSON.stringify(legacy));
 await page.reload();await panel().waitFor();check('Reload does not manufacture missing local history',await panel().getAttribute('data-crisis-status')==='unknown'&&await page.evaluate(()=>JSON.stringify(window.afterwave.state))===JSON.stringify(legacy));
 await source(getLocalCrisisRecord(legacy,'D5'));check('Legacy source explicitly preserves missing per-place detail',(await page.locator('.crisis-recorded-impact').innerText()).includes('缺项未知'));
 // All four affected places expose the same original record without changing
 // its storage coordinate or narrative text. The tiny values below are a
 // legal saved-data precision boundary, not a claimed natural new outcome.
 const tiny=structuredClone(loss);tiny.flags.crisis.damage=.0001;
 for(const cell of ['D4','E4','D5','F6']){tiny.flags.crisis.damageByCell[cell]=.0001;tiny.flags.crisis.coverageByCell[cell]=.7268;}
 assert.equal(validateState(tiny).valid,true);
 for(const [name,state]of [['current',loss],['legacy',legacy],['missing',missing],['precision',tiny]])for(const cell of ['D4','E4','D5','F6']){
  await show(state,false,cell);const record=getLocalCrisisRecord(state,cell),original=state.history.find(h=>h.id==='crisis-impact');
  check(`${name} ${cell}: world exposes its own factual summary and source eligibility`,await panel(cell).getAttribute('data-crisis-status')===record.status&&(await panel(cell).innerText()).includes(record.summary)&&await panel(cell).locator('[data-action="trace"]').count()===(record.recordId?1:0));
  if(record.recordId){
   await panel(cell).locator('[data-action="trace"]').click();await page.locator('.crisis-history').waitFor();const sourceText=await page.locator('.crisis-recorded-impact').innerText();
   check(`${name} ${cell}: world button opens the actual shared original record`,await page.evaluate(()=>window.afterwave.ui.traceId)==='crisis-impact');
   check(`${name} ${cell}: source preserves exact local precision or explicit legacy unknown`,record.damage===null?sourceText.includes('缺项未知')&&!sourceText.includes(`${cell}：已存覆盖系数`):sourceText.includes(`${cell}：已存覆盖系数${String(record.coverage)}；已存损失系数${String(record.damage)}`));
   if(name==='precision')check(`${cell}: source also preserves the tiny aggregate rather than rounding to zero`,sourceText.includes('第23年已存整体损失系数：0.0001。'));
   await click('home');
  }
  if(await page.locator('[data-action="avg"]').count()){await click('avg');check(`${name} ${cell}: public local visit uses the same complete historical detail`,(await panel(cell).innerText()).includes(record.detail[0])&&await panel(cell).getAttribute('data-crisis-status')===record.status);await click('home');}
  else check(`${name} ${cell}: no unplayable AVG route is invented`,getActions(state,cell,'protagonist').length===0);
  await click('cell-history');const card=page.locator('.history-list .event-card').filter({has:page.locator('[data-action="trace"][data-id="crisis-impact"]')});
  check(`${name} ${cell}: regional archive includes exactly the real source when available`,await card.count()===(record.recordId?1:0));
  if(record.recordId){
   check(`${name} ${cell}: original D4 tag and history narrative stay unchanged`,(await card.locator('.event-meta').innerText()).includes('D4')&&await card.locator('p').innerText()===original.text);
   await card.locator('[data-action="trace"][data-id="crisis-impact"]').click();await page.locator('.crisis-history').waitFor();check(`${name} ${cell}: regional source button resolves to the original event`,await page.evaluate(()=>window.afterwave.ui.traceId)==='crisis-impact');
  }
  check(`${name} ${cell}: full source navigation leaves every saved fact unchanged`,await page.evaluate(()=>JSON.stringify(window.afterwave.state))===JSON.stringify(state));
 }
 for(const cell of ['D4','E4','D5','F6']){await show(before,false,cell);check(`${cell}: no four-region history is revealed before settlement`,!await page.locator('.local-crisis-history').count());}
 await show(loss,false,'B4');check('Unrelated B4 has no shared-crisis local marker',!await page.locator('.local-crisis-history').count());if(await page.locator('[data-action="avg"]').count()){await click('avg');check('Unrelated B4 visit does not borrow another region tally',!await page.locator('.local-crisis-history').count());await click('home');}else check('No B4 visit is fabricated when no local contract is available',getActions(loss,'B4','protagonist').length===0);await click('cell-history');check('Unrelated B4 archive does not invent the shared source association',!await page.locator('.history-list [data-action="trace"][data-id="crisis-impact"]').count());
 check('No runtime or asset errors',report.errors.length===0);
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;if(page)await page.screenshot({path:`${out}/round10-d5-failure.png`,fullPage:true}).catch(()=>{});}
finally{await fs.writeFile(`${out}/round10-local-crisis-visual-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
