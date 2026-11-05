import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,getActors,passTask,commitWindow,advanceToNextWindow,randomFor} from '../src/simulation.js';
import {investigateAndLock} from '../tests/helpers/play.js';

const out='playtest-output';await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:4189,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{const fixture=sessionStorage.getItem('afterwave.visual.fixture');if(fixture){localStorage.setItem('afterwave.save.v1',fixture);sessionStorage.removeItem('afterwave.visual.fixture');}});
const check=(name,ok)=>{assert.ok(ok,name);checks.push({name,passed:true});};
function decade(state,action,cell='D4'){
 if(action)investigateAndLock(state,'protagonist',cell,action);
 for(const actor of getActors(state))if(!state.drafts[actor.id])passTask(state,actor.id);
 commitWindow(state);advanceToNextWindow(state);return state;
}
function built(success=true){let seed=0;while((randomFor(seed,'event:action:0:protagonist:D4:build_joint')<.7)!==success)seed++;return decade(createRun(seed),'build_joint');}
async function show(state,focus=false,selected='D4'){
 await page.evaluate(({state,focus,selected})=>sessionStorage.setItem('afterwave.visual.fixture',JSON.stringify({state,ui:{selected,screen:'world',channel:'science',focus}})),{state,focus,selected});
 await page.reload();await page.locator('canvas').waitFor();await page.waitForFunction(year=>window.afterwave.state.year===year,state.year);await page.waitForTimeout(300);
}
async function snap(name,full=false){await (full?page:page.locator('.map-frame')).screenshot({path:`${out}/visual-${name}.png`,...(full?{fullPage:true}:{})});}
try{
 await page.goto('http://127.0.0.1:4189');await page.locator('canvas').waitFor();await page.waitForTimeout(300);
 await snap('fresh-overview',true);
 const ready=built();await show(ready,true);await snap('operating-focus');
 check('Operating marker has equivalent text',await page.locator('.institution-status').innerText()==='制度运行中');
 const lapsed=decade(built());await show(lapsed,true);await snap('maintenance-focus');
 check('Numeric maintenance and access barriers have equivalent text',(await page.locator('.institution-status').innerText()).includes('维护不足 · 收费门槛'));
 const halted=decade(built(),'recruit_risk');await show(halted,true);await snap('halted-focus');
 check('Halted building is described as retained, not destroyed',(await page.locator('.institution-status').innerText()).includes('停运 · 原址建筑保留'));
 const failed=built(false);await show(failed,true);await snap('failed-build-focus');
 check('Failed construction keeps records without claiming warning service',(await page.locator('.institution-status').innerText()).includes('档案不等于预警服务'));
 const community=decade(decade(decade(createRun())),'free_warning');await show(community,true);await snap('community-focus');
 check('Resident bell has equivalent text',(await page.locator('.institution-status').innerText()).includes('居民钟报运行中'));
 for(const [name,state,cell,file] of [['archive',createRun(),'D4','archive-desk.svg'],['shore',decade(createRun()),'D5','open-shore.svg'],['classroom',ready,'E4','local-classroom.svg'],['station',lapsed,'F6','river-room.svg']]){
  await show(state,false,cell);await page.locator('[data-action="avg"]').click();await page.locator('.scene-art img').waitFor();
  check(`${name} scene uses a state-appropriate illustration`,(await page.locator('.scene-art img').getAttribute('src')).endsWith(file));
  await page.locator('.scene-art').screenshot({path:`${out}/visual-scene-${name}.png`});
 }
 await show(ready);
 for(const channel of ['politics','economy','science','religion']){
  await page.locator(`[data-action="layer"][data-layer="${channel}"]`).click();await page.waitForTimeout(80);await snap(`layer-${channel}`);
  check(`${channel} layer preserves D4`,await page.evaluate(()=>window.afterwave.ui.selected==='D4'));
  check(`${channel} layer has all five labelled bands`,await page.locator('.heat-legend span').count()===5);
 }
 await page.setViewportSize({width:320,height:568});await snap('320',true);
 check('No horizontal overflow at 320',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.locator('[data-action="settings"]').click();await page.locator('[data-action="text-size"]').click();await page.locator('[data-action="home"]').first().click();await snap('320-text200',true);
 check('No horizontal overflow at 320 with 200% text',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 check('No browser errors',errors.length===0);
 await fs.writeFile(`${out}/visual-results.json`,JSON.stringify({checks,errors},null,2));
 console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();await server.close();}
