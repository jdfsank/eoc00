import {importAndWaitForSave} from './helpers/import-receipt.mjs';
// Real imported producer saves and actual held image responses. No relaxed old checks.
import {chromium} from 'playwright';
import binary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from '../tests/fixtures/pre-training-workload-producer/simulation.js';
import {checkpoints} from '../tests/fixtures/pre-training-workload-scenarios.js';
const out=process.env.AW_OUTPUT||'playtest-output/round45-visit-image-size';
await fs.mkdir(out,{recursive:true});
const json=JSON.stringify,sha=b=>createHash('sha256').update(b).digest('hex');
const report={checks:[],metrics:[],screenshots:[],errors:[],scope:'Held return-image geometry; current and genuine old producer files. No historical coverage replacement or device/balance certification.'};
async function hashInputs(){const rows=[];async function walk(p){for(const e of(await fs.readdir(p,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const f=`${p}/${e.name}`;if(e.isDirectory())await walk(f);else rows.push([f,sha(await fs.readFile(f))]);}}for(const p of ['src','tests','scripts'])await walk(p);return sha(json(rows));}
report.inputsBefore=await hashInputs();report.scriptBefore=sha(await fs.readFile(new URL(import.meta.url)));
const check=(name,passed,detail)=>{report.checks.push({name,passed:!!passed,...(detail===undefined?{}:{detail})});assert.ok(passed,name);};
let browser,page,server,held=false,releases=[],heldCount=0;
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
const geometry=()=>page.evaluate(()=>({scroll:scrollY,height:document.documentElement.scrollHeight,images:[...document.querySelectorAll('.scene-visit .scene-art img,.scene-visit .scene-art-detail img')].map(e=>({src:e.getAttribute('src'),height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width,top:e.getBoundingClientRect().top+scrollY,complete:e.complete,nw:e.naturalWidth,nh:e.naturalHeight})),actor:window.afterwave.ui.actor,cell:window.afterwave.ui.selected,choice:window.afterwave.ui.choice,sessions:JSON.stringify(window.afterwave.ui.sessions),focus:document.activeElement?.dataset.action}));
const exact=async(s,label)=>check(label,await page.evaluate(v=>JSON.stringify(window.afterwave.state)===v&&JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state)===v,json(s)));
const decode=()=>page.locator('.scene-visit').evaluate(async e=>{await Promise.all([...e.querySelectorAll('img')].map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
try{
 server=await createServer({server:{host:'127.0.0.1',port:4846,strictPort:true}});await server.listen();browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});page=await browser.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.errors.push(r.url()+': '+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)report.errors.push(r.url()+': '+r.status());});
 await page.route('**/assets/*.svg',async route=>{const response=await route.fetch();const path=new URL(route.request().url()).pathname;if(held&&(path.endsWith('/local-classroom.svg')||path.endsWith('/east-bank-mandate-authorized.svg'))){heldCount++;await new Promise(resolve=>releases.push(resolve));}await route.fulfill({response,headers:{...response.headers(),'cache-control':'no-store'}});});
 await page.goto('http://127.0.0.1:4846');await page.locator('.selection-card').waitFor();
 for(const [producer,api] of [['current',sim],['old',old]])for(const width of [320,390,1280])for(const big of [false,true]){
  const label=`${producer}-${width}-${big?200:100}`,s=checkpoints(api).ended;await page.setViewportSize({width,height:width===320?568:900});await click('settings');await importAndWaitForSave(page,{name:label+'.json',mimeType:'application/json',buffer:Buffer.from(json({state:s,ui:{bigText:big}}))},{state:s,bigText:big});await exact(s,label+' import');
  await click('home');await page.locator('[data-action="actor"][data-actor="linche"]').click();await click('list');await page.locator('[data-action="select"][data-cell="E4"]').click();await page.locator('.selection-card [data-action="visit"]').click();await decode();
  const source=page.locator('.visit-record-sources [data-action="trace"]').first();await source.scrollIntoViewIfNeeded();await source.focus();const before=await geometry();check(label+' exact audited image assets and intrinsic dimensions',before.images.length===2&&before.images[0].src.endsWith('/local-classroom.svg')&&before.images[0].nw===1000&&before.images[0].nh===500&&before.images[1].src.endsWith('/east-bank-mandate-authorized.svg')&&before.images[1].nw===1000&&before.images[1].nh===390,before);
  await page.keyboard.press('Enter');await page.locator('[data-scene-source-reading]').waitFor();held=true;const prior=heldCount;await page.locator('[data-action="scene-source-return"]').dblclick();await page.waitForFunction(()=>[...document.querySelectorAll('.scene-visit .scene-art img,.scene-visit .scene-art-detail img')].length===2);const deadline=Date.now()+12000;while(heldCount<prior+2&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));const pending=await geometry();check(label+' both real SVG responses held',heldCount===prior+2&&pending.images.every(i=>!i.complete&&i.nw===0),pending);await exact(s,label+' held world and autosave');
  held=false;for(const release of releases.splice(0))release();await decode();const after=await geometry();report.metrics.push({label,before,pending,after});
  check(label+' reserved dimensions and document height equal decoded geometry',pending.height===after.height&&pending.images.every((i,n)=>i.width===after.images[n].width&&i.height===after.images[n].height&&i.top===after.images[n].top),{pending,after});
  for(const [name,g] of [['pending',pending],['decoded',after]])check(label+' '+name+' exact source context and scroll',g.scroll===before.scroll&&g.actor===before.actor&&g.cell===before.cell&&g.choice===before.choice&&g.sessions===before.sessions&&g.focus===before.focus,{before,g});
  check(label+' original loaded image geometry retained',before.images.every((i,n)=>i.width===after.images[n].width&&i.height===after.images[n].height&&i.top===after.images[n].top));await exact(s,label+' decoded world and autosave');
  const path=`${out}/${label}.png`;await page.screenshot({path});report.screenshots.push({path,sha256:sha(await fs.readFile(path))});
 }
 check('No browser or request errors',report.errors.length===0,report.errors);
}catch(e){report.failure=String(e.stack||e);process.exitCode=1;}finally{held=false;for(const release of releases.splice(0))release();await browser?.close();await server?.close();report.inputsAfter=await hashInputs();report.scriptAfter=sha(await fs.readFile(new URL(import.meta.url)));report.checks.push({name:'source and script unchanged during run',passed:report.inputsBefore===report.inputsAfter&&report.scriptBefore===report.scriptAfter});if(report.inputsBefore!==report.inputsAfter||report.scriptBefore!==report.scriptAfter)process.exitCode=1;report.exitCode=process.exitCode||0;await fs.writeFile(`${out}/report.json`,json(report,null,2));console.log(json({checks:report.checks.length,passed:report.checks.filter(c=>c.passed).length,exitCode:report.exitCode,failure:report.failure||null}));}
