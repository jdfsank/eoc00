import {readEndingDetails} from './helpers/ending-reading.mjs';
import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='playtest-output';await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:4191,strictPort:true}});await server.listen();
let browser,page;const report={scope:'Headless Chromium, 390×844 and 320×568, plus 200% text. Not physical-device certification.',checks:[],errors:[]};
const check=(name,ok)=>{report.checks.push({name,passed:!!ok});assert.ok(ok,name);};
const click=async action=>{await page.locator(`[data-action="${action}"]`).first().click();if(action==='ending')await readEndingDetails(page);};
const restore=async (state,ui={})=>{await page.evaluate(({state,ui})=>sessionStorage.setItem('handoff.fixture',JSON.stringify({state,ui})),{state,ui});await page.reload();await page.locator('canvas').waitFor();};
const snap=name=>page.screenshot({path:`${out}/round3-handoff-${name}.png`,fullPage:true});
try{
 browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(()=>{const f=sessionStorage.getItem('handoff.fixture');if(f){localStorage.setItem('afterwave.save.v1',f);sessionStorage.removeItem('handoff.fixture');}});
 await page.goto('http://127.0.0.1:4191');await page.locator('canvas').waitFor();
 const fixtures=await page.evaluate(async()=>{
  const sim=await import('/src/simulation.js'),old=await import('/tests/fixtures/pre-handoff-simulation.js');
  const lock=(s,a,c,id,api=sim)=>{for(const e of api.getActions(s,c,a).find(x=>x.id===id).requireEvidence)api.investigate(s,a,c,e);api.lockTask(s,a,c,id);};
  const next=(s,api=sim)=>{for(const a of api.getActors(s))if(!s.drafts[a.id])api.passTask(s,a.id);api.commitWindow(s);api.advanceToNextWindow(s);};
  const build=(action,api=sim)=>{const s=api.createRun(0);lock(s,'protagonist','D4','build_joint',api);next(s,api);lock(s,'protagonist','D4','renew_charter',api);next(s,api);if(action)lock(s,'protagonist','B4',action,api);next(s,api);return s;};
  const consent=action=>{const s=sim.createRun(0);lock(s,'protagonist','D4','build_joint');next(s);lock(s,'protagonist','D4','recruit_successor');next(s);lock(s,'protagonist','D4',action);lock(s,'linche','B4','independent_review');next(s);return s;};
  return {avoided:build('independent_review'),contained:build('local_veto'),disaster:build(),legacy:build('independent_review',old),unmandated:consent('free_warning'),respected:consent('present_archive'),forced:consent('relocate_teacher')};
 });
 const narratives={};
 for(const [name,needle] of [['avoided','共同失效被拦在错误指令发出之前'],['contained','剩余损失已经发生'],['disaster','不可逆的地方损失']]){
  await restore(fixtures[name]);const before=await page.evaluate(()=>JSON.stringify(window.afterwave.state));await page.locator('[data-primary-action]').click();narratives[name]=await page.locator('.prose').innerText();
  check(`${name} year30 narrative acknowledges its actual crisis`,narratives[name].includes(needle));
  check(`${name} recollection and diagnosis do not change world history`,before===await page.evaluate(()=>JSON.stringify(window.afterwave.state)));
  if(name!=='contained')await snap(`${name}-return-390`);
 }
 check('All three year30 consequence narratives differ',new Set(Object.values(narratives)).size===3);
 await restore(fixtures.avoided);await page.locator('[data-primary-action]').click();await page.locator('[data-action="choose"][data-id="share_power"]').click();
 check('Prepared handoff preview names training people, authorization and a different checking site',(await page.locator('.contract').innerText()).includes('承接人手：E4、D5')&&(await page.locator('.contract').innerText()).includes('已获地方授权：E4、D5')&&(await page.locator('.contract').innerText()).includes('异源校验：B4')&&(await page.locator('.contract').innerText()).includes('当前交班条件齐备'));
 await click('confirm');await click('lock');check('Locked policy review uses the same three-part readiness',(await page.locator('.handoff-readiness').innerText()).includes('当前交班条件齐备'));
 await snap('prepared-review-390');await click('commit');await click('skip');await click('ending');
 check('Actual year40 shared ending rewards preserved training rather than counting it as zero',(await page.locator('h1').innerText())==='许多人签署的历史'&&await page.evaluate(()=>window.afterwave.state.year===40&&window.afterwave.state.flags.crisis.damage===0));
 check('Ending separates people, authorization and independent checking instead of a numeric threshold',(await page.locator('.ending').innerText()).includes('已授权承接地域')&&(await page.locator('.ending').innerText()).includes('异源校验地域')&&(await page.locator('.ending').innerText()).includes('不按机构总数给结局加分'));
 await snap('shared-ending-390');
 await restore(fixtures.unmandated);await page.locator('[data-primary-action]').click();await page.locator('[data-action="choose"][data-id="withdraw"]').click();
 check('Riverport trust does not silently authorize distant trainees',(await page.locator('.contract').innerText()).includes('现有人手尚缺地方承接授权')&&await page.evaluate(()=>window.afterwave.state.flags.trust===true));
 for(const [name,needle] of [['respected','苏岚自己写下的选择'],['forced','苏岚从东岸寄来的信没有替迁任补上同意']]){
  await restore(fixtures[name]);await page.locator('[data-primary-action]').click();check(`${name} agreement history gets its own voice`,(await page.locator('.prose').innerText()).includes(needle));
  if(name==='forced')await snap('forced-letter-390');
 }
 await restore(fixtures.legacy);await click('settings');check('Real previous-version save clearly retains its original ending rules',(await page.locator('main').innerText()).includes('保留本局原结局规则'));await click('home');await page.locator('[data-primary-action]').click();await page.locator('[data-action="choose"][data-id="share_power"]').click();await click('confirm');await click('lock');await click('commit');await click('skip');await click('ending');
 check('Previous-version prepared route is not silently rescored',(await page.locator('h1').innerText())==='纸上的共同作者'&&await page.evaluate(()=>window.afterwave.state.handoffRulesVersion===undefined));
 await page.setViewportSize({width:320,height:568});await restore(fixtures.avoided);await page.locator('[data-primary-action]').click();await page.locator('[data-action="choose"][data-id="share_power"]').click();
 check('New handoff contract has no horizontal overflow at320',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await snap('contract-320');
 await click('settings');await click('text-size');await click('home');await page.locator('[data-primary-action]').click();
 check('Long consequence and readiness prose remains within320 at200% text',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check('Large caption stays below illustration without overlap',await page.locator('.scene-art').evaluate(el=>el.querySelector('span').getBoundingClientRect().top>=el.querySelector('img').getBoundingClientRect().bottom-1));
 await snap('return-320-text200');check('No browser runtime errors',report.errors.length===0);
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;if(page)await snap('failure').catch(()=>{});}
finally{await fs.writeFile(`${out}/round3-handoff-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
