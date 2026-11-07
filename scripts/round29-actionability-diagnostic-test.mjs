// Detached fault pages/mocks only, never a game route or CI failure reproduction.
import {chromium} from 'playwright';
import binary from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {collectActionabilityDiagnostic as collect} from './helpers/actionability-diagnostic.mjs';
const report={scope:'Detached browser fault pages and collector mocks; proves failure-only diagnostics are bounded and read-only. Does not reproduce or fix the remote CI failure.',checks:[],samples:[]};
function check(name,value){report.checks.push({name,passed:!!value});assert.ok(value,name);}
let browser;
try{
 const start=performance.now(),stalled=await collect({evaluate:()=>new Promise(()=>{})},{timeoutMs:80});check('Unresponsive renderer collection has bounded host deadline',stalled.status==='unavailable'&&performance.now()-start<1000);report.samples.push({name:'host-stalled-mock',value:stalled});
 const rejected=await collect({evaluate:()=>Promise.reject(new Error('detached page'))});check('Evaluation failure becomes unavailable, not thrown',rejected.status==='unavailable'&&rejected.reason.includes('detached page'));
 const thrown=await collect({evaluate:()=>{throw Error('closed transport')}});check('Synchronous transport failure remains bounded unavailable',thrown.status==='unavailable');
 browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});
 for(const kind of ['normal','no-animation-frames','disabled','covered']){
 await page.setContent(`<div style="height:1700px">Detached diagnostic page</div><button data-action="list" ${kind==='disabled'?'disabled':''} onclick="window.clicks++">List</button><div style="height:1000px"></div>${kind==='covered'?'<div style="position:fixed;inset:0;z-index:100"></div>':''}<script>window.clicks=0;window.world={year:30,example:'detached'};${kind==='no-animation-frames'?'window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};':''}</script>`);
 const before=await page.evaluate(()=>({dom:document.body.innerHTML,scrollX,scrollY,world:JSON.stringify(window.world),clicks:window.clicks,active:document.activeElement.tagName}));
 const at=performance.now(),d=await collect(page);const elapsed=performance.now()-at;report.samples.push({name:kind,elapsed,value:d});
 const after=await page.evaluate(()=>({dom:document.body.innerHTML,scrollX,scrollY,world:JSON.stringify(window.world),clicks:window.clicks,active:document.activeElement.tagName}));
 check(`${kind}: diagnostics never alter DOM, scroll, focus, world or clicks`,JSON.stringify(before)===JSON.stringify(after));check(`${kind}: bounded observed geometry`,d.status==='observed'&&d.before.target.rect.y>=1700&&elapsed<1500);
 if(kind==='no-animation-frames')check('No RAF records explicit missing frame observation',d.frameObservation.outcome==='frame-window-expired'&&d.frameObservation.frames===0);
 if(kind==='disabled')check('Disabled control state recorded without activation',d.before.target.disabled===true);
 }
 // Original failure remains the failure even when diagnostics cannot be collected.
 const original=new Error('original locator timeout'),failure={message:original.message,stack:original.stack};await collect({evaluate:()=>Promise.reject(new Error('diagnostic unavailable'))});check('Collector cannot replace retained original failure',failure.message===original.message&&failure.stack===original.stack);
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;}
finally{if(browser)await browser.close();await fs.mkdir('playtest-output/round29-actionability-diagnostic',{recursive:true});report.exitCode=process.exitCode||0;await fs.writeFile('playtest-output/round29-actionability-diagnostic/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,passed:report.checks.filter(x=>x.passed).length,exitCode:report.exitCode,failure:report.failure},null,2));}
