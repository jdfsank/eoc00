import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,commitWindow,advanceToNextWindow,advanceYear,randomFor,validateState} from '../src/simulation.js';
import {investigateAndLock} from '../tests/helpers/play.js';

const out='playtest-output';await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:4195,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.addInitScript(()=>{const fixture=sessionStorage.getItem('afterwave.maintenance.fixture');if(fixture){localStorage.setItem('afterwave.save.v1',fixture);sessionStorage.removeItem('afterwave.maintenance.fixture');}});
const check=(name,ok)=>{assert.ok(ok,name);checks.push({name,passed:true});};
let seed=0;while(randomFor(seed,'event:action:0:protagonist:D4:build_joint')>=.7)seed++;
const base=createRun(seed);investigateAndLock(base,'protagonist','D4','build_joint');commitWindow(base);advanceToNextWindow(base);
investigateAndLock(base,'protagonist','D4','recruit_risk');commitWindow(base);advanceYear(base);advanceYear(base);
function fixture({staff=false,maintenance=1,active=true}={}){
 const state=structuredClone(base),station=state.institutions.find(i=>i.kind==='station');
 state.flags.recruited=true;state.flags.successor=!staff;station.maintenance=maintenance;station.active=active;
 assert.equal(validateState(state).valid,true);return state;
}
const states={normal:fixture(),staffing:fixture({staff:true}),maintenance:fixture({maintenance:.7}),both:fixture({staff:true,maintenance:.7}),stopped:fixture({staff:true,maintenance:.7,active:false}),restored:fixture()};
const expected={normal:'制度运行中 · 基本预警公开准入',staffing:'维护者缺席 · 基本预警公开准入',maintenance:'维护不足 · 基本预警公开准入',both:'维护者缺席 · 维护不足 · 基本预警公开准入',stopped:'停运 · 原址建筑保留 · 旧公开规约封存（当前不提供服务）',restored:'制度运行中 · 基本预警公开准入'};
async function show(state,bigText=false){
 await page.evaluate(({state,bigText})=>sessionStorage.setItem('afterwave.maintenance.fixture',JSON.stringify({state,ui:{selected:'D4',screen:'world',channel:'science',focus:true,bigText}})),{state,bigText});
 await page.reload();await page.locator('canvas').waitFor();await page.waitForTimeout(200);
}
async function pixels(){return page.locator('canvas').evaluate(canvas=>{
 const {width,height}=canvas,pixels=canvas.getContext('2d').getImageData(0,0,width,height).data,view=window.afterwave.mapView;
 // D4's lower duty-board slot is the only geometry a staffing-only change
 // may touch. Bounds are in the unchanged world coordinate system.
 const x0=Math.floor((281-view.centerX)*view.zoom+width/2),x1=Math.ceil((296-view.centerX)*view.zoom+width/2);
 const y0=Math.floor((160-view.centerY)*view.zoom+height/2),y1=Math.ceil((168-view.centerY)*view.zoom+height/2);
 const inside=[],outside=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const target=x>=x0&&x<=x1&&y>=y0&&y<=y1?inside:outside,index=(y*width+x)*4;
  target.push(pixels[index],pixels[index+1],pixels[index+2],pixels[index+3]);
 }
 return {inside,outside};
});}
const same=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
async function snap(name,monochrome=false){
 const frame=page.locator('.map-frame');if(monochrome)await frame.evaluate(element=>element.style.filter='grayscale(1)');
 await frame.screenshot({path:`${out}/round5-map-${name}${monochrome?'-mono':''}.png`});
 if(monochrome)await frame.evaluate(element=>element.style.filter='');
}
try{
 await page.goto('http://127.0.0.1:4195');await page.locator('canvas').waitFor();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===390?844:568});const captures={};
  for(const [name,state] of Object.entries(states)){
   await show(state);check(`${width}px ${name} exposes the exact non-color status`,await page.locator('.institution-status').innerText()===expected[name]);
   captures[name]=await pixels();await snap(`${width}-${name}`);
   if(['staffing','maintenance','both','stopped'].includes(name))await snap(`${width}-${name}`,true);
  }
  check(`${width}px staffing leaves every pixel outside the empty duty slot unchanged`,same(captures.normal.outside,captures.staffing.outside));
  check(`${width}px staffing has a visible shape change in its duty slot`,!same(captures.normal.inside,captures.staffing.inside));
  check(`${width}px adding staffing to maintenance changes only the duty slot`,same(captures.maintenance.outside,captures.both.outside)&&!same(captures.maintenance.inside,captures.both.inside));
  check(`${width}px restoration exactly restores the normal map`,same(captures.normal.outside,captures.restored.outside)&&same(captures.normal.inside,captures.restored.inside));
  check(`${width}px map has no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await show(states.stopped);
  await page.evaluate(()=>{
   document.querySelector('canvas').dataset.testMarker='same-map';
   const state=window.afterwave.state,station=state.institutions.find(i=>i.kind==='station');
   station.active=true;station.maintenance=1;state.flags.successor=true;
   window.afterwave.navigate('world');
  });
  await page.waitForTimeout(100);const liveRestored=await pixels();
  check(`${width}px recovery reuses the existing canvas`,await page.locator('canvas').getAttribute('data-test-marker')==='same-map');
  check(`${width}px in-place recovery clears every obsolete mark`,same(captures.normal.outside,liveRestored.outside)&&same(captures.normal.inside,liveRestored.inside));
 }
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===390?844:568});await show(states.both,true);await snap(`${width}-both-text200`);
  await page.screenshot({path:`${out}/round5-map-${width}-both-text200-world.png`,fullPage:true});
  check(`${width}px / 200% both causes remain written out`,await page.locator('.institution-status').innerText()===expected.both);
  check(`${width}px / 200% has no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const before=await page.evaluate(()=>JSON.stringify(window.afterwave.state));
  await page.locator('[data-action="layer"][data-layer="politics"]').click();await page.locator('[data-action="focus"]').click();await page.locator('[data-action="focus"]').click();
  check(`${width}px layer and camera controls preserve the world`,before===await page.evaluate(()=>JSON.stringify(window.afterwave.state)));
  check(`${width}px layer and camera controls preserve both status causes`,await page.locator('.institution-status').innerText()===expected.both);
 }
 check('No script or asset errors',errors.length===0);
 const result={checks,errors,notes:['The six images use validated same-year field-boundary fixtures after a real risky recruitment, so only staffing, maintenance and operation differ. They are not six new authored gameplay branches. Monochrome views are visual checks, not accessibility certification.']};
 await fs.writeFile(`${out}/round5-maintenance-visual-results.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await server.close();}
