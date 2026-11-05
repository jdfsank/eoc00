import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,getActors,passTask,commitWindow,advanceYear,advanceToNextWindow,randomFor} from '../src/simulation.js';
import {investigateAndLock} from '../tests/helpers/play.js';

const out='playtest-output';await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:4192,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{const fixture=sessionStorage.getItem('afterwave.station.fixture');if(fixture){localStorage.setItem('afterwave.save.v1',fixture);sessionStorage.removeItem('afterwave.station.fixture');}});
const check=(name,ok)=>{assert.ok(ok,name);checks.push({name,passed:true});};
function submit(state,action){
 if(action)investigateAndLock(state,'protagonist','D4',action);
 for(const actor of getActors(state))if(!state.drafts[actor.id])passTask(state,actor.id);
 commitWindow(state);return state;
}
function decade(state,action){submit(state,action);advanceToNextWindow(state);return state;}
function built(success=true){let seed=0;while((randomFor(seed,'event:action:0:protagonist:D4:build_joint')<.7)!==success)seed++;return decade(createRun(seed),'build_joint');}
async function show(state,{cell='D4',inspectPlayback=false}={}){
 await page.evaluate(({state,cell})=>sessionStorage.setItem('afterwave.station.fixture',JSON.stringify({state,ui:{selected:cell,screen:'world',channel:'science'}})),{state,cell});
 await page.reload();await page.locator('canvas').waitFor();
 await page.waitForFunction(({year,cell})=>window.afterwave.state.year===year&&window.afterwave.ui.selected===cell,{year:state.year,cell});
 if(inspectPlayback)await page.evaluate(()=>window.afterwave.navigate('avg'));
 else await page.locator('[data-action="avg"]').click();
 await page.locator('.scene-art img').waitFor();
}
async function snapshot(name,file){
 check(`${name} chooses the matching scene`,(await page.locator('.scene-art img').getAttribute('src')).endsWith(file));
 await page.locator('.scene-art').screenshot({path:`${out}/round4-d4-${name}-scene.png`});
}
try{
 await page.goto('http://127.0.0.1:4192');await page.locator('canvas').waitFor();
 const active=built(),maintenance=decade(built()),failed=built(false),unbuilt=decade(decade(createRun()));
 const understaffed=submit(built(),'recruit_risk');advanceYear(understaffed);
 const stopped=decade(built(),'recruit_risk'),restored=decade(structuredClone(stopped),'free_warning');
 await show(unbuilt);await snapshot('unbuilt','archive-desk.svg');
 check('Unbuilt state explicitly does not imply station construction',(await page.locator('.scene-art img').getAttribute('alt')).includes('不表示'));
 await show(failed);await snapshot('failed-archive','archive-desk.svg');
 check('Failed construction remains archive-only',await page.evaluate(()=>!window.afterwave.state.institutions.some(i=>i.kind==='station')));
 await show(active);await snapshot('active','river-station-active.svg');
 await show(maintenance);await snapshot('maintenance','river-station-maintenance.svg');
 check('Maintenance scene explicitly remains operational',(await page.locator('.scene-art img').getAttribute('alt')).includes('仍在运转'));
 // Directly inspect a real year-11 simulation state. This is visual coverage,
 // not a claim that playback offers a new intervention or AVG route.
 await show(understaffed,{inspectPlayback:true});await snapshot('understaffed','river-station-understaffed.svg');
 check('Missing successor does not imply a ruined station',(await page.locator('.scene-art img').getAttribute('alt')).includes('不表示站房已毁'));
 await show(stopped);await snapshot('stopped','river-station-stopped.svg');
 check('Stopped scene retains the historical place and records',(await page.locator('.scene-art img').getAttribute('alt')).includes('旧记录仍保留'));
 check('Stopped scene and prose agree on closure',(await page.locator('.prose').innerText()).includes('门关着'));
 await page.screenshot({path:`${out}/round4-d4-stopped-avg.png`,fullPage:true});
 const before=await page.evaluate(()=>JSON.stringify(window.afterwave.state));await page.reload();
 check('Scene reload does not change the world',before===await page.evaluate(()=>JSON.stringify(window.afterwave.state)));
 check('Scene reload preserves stopped history',(await page.locator('.scene-art img').getAttribute('src')).endsWith('river-station-stopped.svg'));
 await show(restored);await snapshot('restored','river-station-active.svg');
 check('Restoring the station removes the obsolete closure scene',await page.evaluate(()=>window.afterwave.state.institutions.some(i=>i.kind==='station'&&i.active&&i.maintenance===1)));
 await show(stopped,{cell:'F6'});check('D4 closure does not imply F6 closure',(await page.locator('.scene-art img').getAttribute('src')).endsWith('far-port-branch-none.svg'));
 await show(stopped);await page.setViewportSize({width:320,height:568});await page.locator('[data-action="settings"]').click();await page.locator('[data-action="text-size"]').click();await page.locator('[data-action="home"]').first().click();await page.locator('[data-action="avg"]').click();
 await page.screenshot({path:`${out}/round4-d4-stopped-320-text200.png`,fullPage:true});
 check('320px / 200% stopped scene has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check('200% historical caption stays below the picture without clipping',await page.locator('.scene-art').evaluate(scene=>{
  const image=scene.querySelector('img').getBoundingClientRect(),caption=scene.querySelector('span').getBoundingClientRect(),bounds=scene.getBoundingClientRect();
  return caption.top>=image.bottom-1&&caption.bottom<=bounds.bottom+1;
 }));
 await page.locator('.choice-card').last().scrollIntoViewIfNeeded();check('Last stopped-station choice remains reachable',await page.locator('.choice-card').last().isVisible());
 check('No script or asset errors',errors.length===0);
 const result={checks,errors,notes:['The understaffed year-11 scene is inspected directly from a real simulation state; this test does not add or claim a playback intervention route.']};
 await fs.writeFile(`${out}/round4-station-visual-results.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await server.close();}
