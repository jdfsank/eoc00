import {chromium} from 'playwright';
import binary from '@sparticuz/chromium';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import {next,lock} from '../tests/fixtures/pre-training-workload-scenarios.js';
const seedState=sim.createRun(0);const s=seedState;next(s,sim);lock(s,'protagonist','D4','recruit_volunteer',sim);next(s,sim);lock(s,'protagonist','E4','train_network',sim);next(s,sim);
const output=process.env.AW_OUTPUT||'playtest-output/policy-role/browser';await fs.mkdir(output,{recursive:true});
const report={startedAt:new Date().toISOString(),scope:'Read-only public UI semantics and layout checks, not balance certification',cases:[],errors:[]};
let server,browser;const errors=report.errors;
try{
 server=await createServer({server:{host:'127.0.0.1',port:4852,strictPort:true}});await server.listen();
 browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const actor of ['protagonist','linche'])for(const [width,bigText] of [[390,false],[320,true]]){
  const s=structuredClone(seedState),year=30;
  await page.setViewportSize({width,height:844});
  if(page.url()==='about:blank'){await page.goto('http://127.0.0.1:4852');await page.locator('.selection-card').waitFor();}
  const click=a=>page.locator(`[data-action="${a}"]`).first().click();
  await click('settings');await page.locator('#import-save').setInputFiles({name:'authorized-no-check.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({state:s,ui:{bigText}}))});
  await page.locator('.selection-card').waitFor();if(await page.locator('.toast').count())await page.locator('.toast').waitFor({state:'hidden',timeout:15000});
  await click('home');await page.locator(`[data-action="actor"][data-actor="${actor}"]`).click();await click('list');await page.locator('[data-action="select"][data-cell="E4"]').click();await page.locator('[data-primary-action]').click();
  const card=page.locator('.choice-card[data-id="train_network"]');await card.scrollIntoViewIfNeeded();
  assert.match(await card.locator('[data-teaching-role-cost]').innerText(),/本轮名额/);
  await card.click();await page.locator('[data-decision-stage="preview"]').waitFor();
  const gap=page.locator('[data-teaching-mode="contract"] [data-teaching-role-cost]');assert.equal(await gap.count(),1);assert.match(await gap.innerText(),actor==='protagonist'?/提交本项就不签方针/:/不占.*名额，也不代签/);
  const metrics=await gap.evaluate(e=>({width:innerWidth,scroll:document.documentElement.scrollWidth,font:getComputedStyle(document.documentElement).fontSize,right:e.getBoundingClientRect().right,clipped:['hidden','clip'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+1}));
  assert.ok(metrics.scroll<=metrics.width);assert.ok(metrics.right<=width+.6);assert.equal(metrics.clipped,false);assert.equal(metrics.font,bigText?'32px':'16px');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.afterwave.state)),JSON.stringify(s));
  assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state)),JSON.stringify(s));
  const text=await gap.innerText();
  assert.match(text,/不能代签/);
  if(year===30)assert.match(await page.locator('[data-teaching-mode="contract"]').innerText(),/不能降低已经记下的第23年损失/);
  await gap.scrollIntoViewIfNeeded();const screenshot=`${output}/${actor}-${width}-${bigText?'large':'normal'}.png`;await page.screenshot({path:screenshot});
  await click('confirm');await page.locator('[data-decision-stage="confirm"]').waitFor();assert.equal(await gap.innerText(),text);
  await page.reload();await page.locator('[data-decision-stage="confirm"]').waitFor();assert.equal(await gap.innerText(),text);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.afterwave.state)),JSON.stringify(s));
  assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('afterwave.save.v1')).state)),JSON.stringify(s));
  const row={actor,year,width,bigText,metrics,text,screenshot,screenshotSha256:createHash('sha256').update(await fs.readFile(screenshot)).digest('hex'),stateUnchanged:true,confirmAndReload:true};report.cases.push(row);console.log(JSON.stringify(row));
 }
 assert.deepEqual(errors,[]);console.log('PASS: native card/preview, 390px normal and 320px 200% text, unchanged world/autosave');
}finally{report.finishedAt=new Date().toISOString();await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser?.close();await server?.close();}
