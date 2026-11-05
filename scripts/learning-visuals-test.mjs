import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,getActors,passTask,commitWindow,advanceToNextWindow,randomFor} from '../src/simulation.js';
import {investigateAndLock} from '../tests/helpers/play.js';

const out='playtest-output';await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:4190,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],checks=[],loaded=new Set();
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);if(r.ok())loaded.add(r.url().split('/').at(-1));});
await page.addInitScript(()=>{const fixture=sessionStorage.getItem('afterwave.learning.fixture');if(fixture){localStorage.setItem('afterwave.save.v1',fixture);sessionStorage.removeItem('afterwave.learning.fixture');}});
const check=(name,ok)=>{assert.ok(ok,name);checks.push({name,passed:true});};
function decade(state,action,cell='D4'){
 if(action)investigateAndLock(state,'protagonist',cell,action);
 for(const actor of getActors(state))if(!state.drafts[actor.id])passTask(state,actor.id);
 commitWindow(state);advanceToNextWindow(state);return state;
}
function trained(){let seed=0;while(randomFor(seed,'event:action:0:protagonist:D4:build_joint')>=.7)seed++;return decade(createRun(seed),'build_joint');}
async function show(state,selected='E4',focus=true){
 await page.evaluate(({state,selected,focus})=>sessionStorage.setItem('afterwave.learning.fixture',JSON.stringify({state,ui:{selected,screen:'world',channel:'science',focus}})),{state,selected,focus});
 await page.reload();await page.locator('canvas').waitFor();await page.waitForFunction(({year,selected})=>window.afterwave.state.year===year&&window.afterwave.ui.selected===selected,{year:state.year,selected});await page.waitForTimeout(200);
}
async function map(name){await page.locator('.map-frame').screenshot({path:`${out}/round3-${name}-map.png`});}
async function scene(name,file){
 await page.locator('[data-action="avg"]').click();await page.locator('.scene-art img').waitFor();
 check(`${name} uses its actual local scene`,(await page.locator('.scene-art img').getAttribute('src')).endsWith(file));
 await page.locator('.scene-art').screenshot({path:`${out}/round3-${name}-scene.png`});
}
try{
 await page.goto('http://127.0.0.1:4190');await page.locator('canvas').waitFor();
 const absent=decade(createRun()),training=trained(),school=decade(trained(),'fund_school','E4');
 await show(absent);await map('e4-before-learning');await scene('e4-before-learning','open-shore.svg');
 check('Unbuilt E4 scene does not invent current pupils',!(await page.locator('.scene-art img').getAttribute('alt')).includes('学员'));
 await show(training);await map('e4-training');await scene('e4-training','local-classroom.svg');
 check('E4 scene is explicitly wall-free',(await page.locator('.scene-art img').getAttribute('alt')).includes('没有围墙'));
 check('E4 illustration and prose both use the embankment',(await page.locator('.prose').innerText()).includes('河堤'));
 await page.screenshot({path:`${out}/round3-e4-training-avg.png`,fullPage:true});
 await show(school);await map('e4-school');await scene('e4-school','local-classroom.svg');
 await show(training,'D5');await map('d5-reading-circle');await scene('d5-reading-circle','bank-reading.svg');
 check('D5 scene does not invent a roof',(await page.locator('.scene-art img').getAttribute('alt')).includes('没有屋顶'));
 // Valid field-boundary probe, not an assertion that this authored branch occurs.
 const stopped=structuredClone(school);for(const institution of stopped.institutions.filter(i=>i.cellId==='E4'))institution.active=false;
 await show(stopped);await map('e4-stopped');check('Stopped learning preserves a marked physical place',(await page.locator('.institution-status').innerText()).includes('停运'));
 await scene('e4-stopped','closed-classroom.svg');check('Stopped learning has no active class claim',(await page.locator('.scene-art img').getAttribute('alt')).includes('没有正在上课的人'));
 await show(training,'E4',false);
 const original=await page.evaluate(()=>JSON.stringify(window.afterwave.state));
 for(const channel of ['politics','economy','science','religion'])await page.locator(`[data-action="layer"][data-layer="${channel}"]`).click();
 await page.locator('[data-action="focus"]').click();await page.locator('[data-action="focus"]').click();
 check('Layer and focus changes do not mutate the world',original===await page.evaluate(()=>JSON.stringify(window.afterwave.state)));
 check('New local props actually load',loaded.has('riverside_school.png')&&loaded.has('bank_reading_circle.png'));
 await page.setViewportSize({width:320,height:568});await page.locator('[data-action="settings"]').click();await page.locator('[data-action="text-size"]').click();await page.locator('[data-action="home"]').first().click();
 await page.screenshot({path:`${out}/round3-e4-320-text200-world.png`,fullPage:true});
 check('320px / 200% map has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('[data-action="avg"]').click();await page.screenshot({path:`${out}/round3-e4-320-text200-avg.png`,fullPage:true});
 check('320px / 200% scene has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check('200% scene caption flows below the image without overlap or clipping',await page.locator('.scene-art').evaluate(scene=>{
  const image=scene.querySelector('img').getBoundingClientRect(),caption=scene.querySelector('span').getBoundingClientRect(),bounds=scene.getBoundingClientRect();
  return caption.top>=image.bottom-1&&caption.bottom<=bounds.bottom+1;
 }));
 await page.locator('.choice-card').last().scrollIntoViewIfNeeded();check('Last E4 choice remains reachable',await page.locator('.choice-card').last().isVisible());
 check('No script or asset errors',errors.length===0);
 const result={checks,errors,notes:['The stopped-classroom screenshot is a valid field-boundary fixture, not a new authored gameplay route.']};
 await fs.writeFile(`${out}/round3-learning-visual-results.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await server.close();}
