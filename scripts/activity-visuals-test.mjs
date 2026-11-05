import {chromium} from 'playwright';
import chromiumBinary from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRun,passTask,commitWindow,advanceToNextWindow,advanceYear,validateState} from '../src/simulation.js';
import {investigateAndLock} from '../tests/helpers/play.js';
import {mapActivity} from '../src/board-visuals.js';

const out='playtest-output';await fs.mkdir(out,{recursive:true});
const report={checks:[],errors:[],scope:'Real engine-generated routes, Chromium at390 and320, including200% text. Monochrome is a visual check, not device or accessibility certification.'};
const check=(name,ok)=>{report.checks.push({name,passed:!!ok});assert.ok(ok,name);};
const server=await createServer({server:{host:'127.0.0.1',port:4197,strictPort:true}});await server.listen();let browser,page;
function pair(){
 const s=createRun(0);passTask(s,'protagonist');commitWindow(s);advanceToNextWindow(s);
 investigateAndLock(s,'protagonist','D4','recruit_volunteer');commitWindow(s);advanceToNextWindow(s);
 investigateAndLock(s,'protagonist','B4','independent_review');investigateAndLock(s,'linche','D5','mutual_aid');assert.equal(validateState(s).valid,true);return s;
}
const locked=pair(),pending=structuredClone(locked);commitWindow(pending);
const y21=structuredClone(pending);advanceYear(y21);const y22=structuredClone(y21);advanceYear(y22);
const collision=pair();investigateAndLock(collision,'linche','B4','local_veto');
const build=createRun(0);investigateAndLock(build,'protagonist','D4','build_joint');
const born=structuredClone(build);commitWindow(born);advanceYear(born);advanceYear(born);advanceYear(born);
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
async function show(state,cell='B4',bigText=false,focus=true){
 await page.evaluate(({state,cell,bigText,focus})=>sessionStorage.setItem('afterwave.activity.fixture',JSON.stringify({state,ui:{screen:'world',selected:cell,actor:'protagonist',channel:'science',focus,bigText}})),{state,cell,bigText,focus});
 await page.reload();await page.locator('canvas').waitFor();await canvas();
}
async function select(cell){await click('list');await page.locator(`[data-action="select"][data-cell="${cell}"]`).click();await page.waitForTimeout(100);}
async function snap(name,mono=false,full=false){
 const frame=page.locator('.map-frame');if(mono)await frame.evaluate(el=>el.style.filter='grayscale(1)');
 await (full?page:frame).screenshot({path:`${out}/round6-map-${name}${mono?'-mono':''}.png`,...(full?{fullPage:true}:{})});
 if(mono)await frame.evaluate(el=>el.style.filter='');
}
async function canvas(){
 // Leaving world destroys Phaser's canvas; returning creates and loads a new
 // one asynchronously. A visible <canvas> and a fixed 70ms delay can still
 // capture an empty/loading frame. Wait for nonempty pixels that remain
 // identical over three samples spanning at least 100ms, without consulting
 // the expected image. A wrong but stable image must still fail below.
 const sample=await page.locator('canvas').evaluate(async c=>{
  const started=performance.now();let previous=null,stableSince=0,matches=0,lastSample=0;
  while(performance.now()-started<5000){
   await new Promise(resolve=>requestAnimationFrame(resolve));const now=performance.now();
   if(now-lastSample<50)continue;lastSample=now;
   const rgba=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let visible=false;for(let i=3;i<rgba.length;i+=4)if(rgba[i]){visible=true;break;}
   if(!visible){previous=null;matches=0;continue;}
   const pixels=c.toDataURL();
   if(pixels===previous)matches++;else{previous=pixels;stableSince=now;matches=1;}
   if(matches>=3&&now-stableSince>=100)return {pixels,width:c.width,height:c.height,view:window.afterwave.mapView,waitedMs:Math.round(now-started),samples:matches};
  }
  throw Error('World canvas did not reach a nonempty stable rendered frame within 5s');
 });
 (report.renderSamples??=[]).push({width:sample.width,height:sample.height,view:sample.view,waitedMs:sample.waitedMs,samples:sample.samples,bytes:sample.pixels.length});
 return sample.pixels;
}
async function chipCenter(cell){return page.locator('canvas').evaluate((canvas,cell)=>{
 const col=cell.charCodeAt(0)-65,row=Number(cell[1])-1,view=window.afterwave.mapView;
 const x=Math.round((288+(col-row)*32+18-view.centerX)*view.zoom+canvas.width/2),y=Math.round((60+(col+row)*16-40-view.centerY)*view.zoom+canvas.height/2);
 const rgba=[...canvas.getContext('2d').getImageData(x,y,1,1).data];return {rgba,x,y,width:canvas.width,height:canvas.height};
},cell);}
try{
 browser=await chromium.launch({executablePath:await chromiumBinary.executablePath(),args:chromiumBinary.args,headless:true});page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.addInitScript(()=>{const f=sessionStorage.getItem('afterwave.activity.fixture');if(f){localStorage.setItem('afterwave.save.v1',f);sessionStorage.removeItem('afterwave.activity.fixture');}});
 await page.goto('http://127.0.0.1:4197');await page.locator('canvas').waitFor();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===390?844:568});
  for(const [name,state,cell] of [['protagonist',locked,'B4'],['linche',locked,'D5'],['pending-b4',pending,'B4'],['pending-d5',pending,'D5'],['after-aid',y21,'D5'],['after-review',y22,'B4'],['two-drafts',collision,'B4'],['build-draft',build,'D4'],['training-pending',born,'E4']]){
   await show(state,cell);const expected=mapActivity(state,cell).map(a=>a.label),visible=await page.locator('.map-activity').count()?await page.locator('.map-activity').innerText():'';
   check(`${width}px ${name} text matches actual intent or pending event`,expected.length?expected.every(label=>visible.includes(label)):!await page.locator('.map-activity li').count());
   check(`${width}px ${name} viewing preserves all simulation facts`,await page.evaluate(()=>JSON.stringify(window.afterwave.state))===JSON.stringify(state));
   if(['protagonist','linche'].includes(name)){
    const pixel=await chipCenter(cell);check(`${width}px ${name} chip is opaque above foreground props`,pixel.rgba.join(',')==='24,56,62,255'&&pixel.x>0&&pixel.x<pixel.width&&pixel.y>0&&pixel.y<pixel.height);
   }
   await snap(`${width}-${name}`);if(['protagonist','linche','pending-b4'].includes(name))await snap(`${width}-${name}`,true);
  }
  await show(locked,'B4',true);check(`${width}px 200% legend identifies both shapes and waiting`,(await page.locator('.map-activity-legend').innerText()).includes('主角')&&(await page.locator('.map-activity-legend').innerText()).includes('林澈')&&(await page.locator('.map-activity-legend').innerText()).includes('待兑现'));
  check(`${width}px 200% legend and actor status do not overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await snap(`${width}-text200`,false,true);
  const before=await page.evaluate(()=>JSON.stringify(window.afterwave.state));await page.locator('[data-action="layer"][data-layer="politics"]').click();await click('focus');await snap(`${width}-overview-text200`);await click('focus');
  check(`${width}px layer/focus does not spend, commit, or draw RNG`,before===await page.evaluate(()=>JSON.stringify(window.afterwave.state)));
 }
 // A real UI sequence exercises rollback, relock, commit, pause and annual resolution.
 await page.setViewportSize({width:390,height:844});await show(locked);const first=await canvas();const firstLayout=await page.locator('canvas').evaluate(c=>({width:c.width,height:c.height,view:window.afterwave.mapView}));
 await click('window');await page.locator('[data-action="unlock"][data-actor="protagonist"]').click();
 check('Actual unlock removes only the selected actor draft',await page.evaluate(()=>!window.afterwave.state.drafts.protagonist&&window.afterwave.state.drafts.linche.status==='locked'));
 check('Actual unlock removes its map chip',await canvas()!==first&&!await page.locator('.map-activity li').count());await snap('390-unlocked');
 await click('avg');await page.locator('[data-action="choose"][data-id="independent_review"]').click();await click('confirm');await click('lock');
 // Deliberately cover the loader race in the ordinary regression run too.
 const assetDelay=Number(process.env.AFTERWAVE_ACTIVITY_ASSET_DELAY_MS??180);
 if(assetDelay)await page.route('**/assets/props/*.png',async route=>{await new Promise(resolve=>setTimeout(resolve,assetDelay));await route.continue();});
 await click('home');
 const relockPixels=await canvas(),relockCells=await page.evaluate(()=>JSON.stringify(window.afterwave.state.cells));
 report.relockDiagnostic={assetDelay,pixelMatch:relockPixels===first,cellsMatch:relockCells===JSON.stringify(locked.cells),firstBytes:first.length,relockBytes:relockPixels.length,firstLayout,relockLayout:await page.locator('canvas').evaluate(c=>({width:c.width,height:c.height,view:window.afterwave.mapView}))};
 if(assetDelay)await page.unroute('**/assets/props/*.png');
 check('Actual relock restores the same chip without spending costs',relockPixels===first&&relockCells===JSON.stringify(locked.cells));
 await click('window');await click('commit');await click('pause-world');
 check('Actual commit replaces both drafts with pending events',await page.evaluate(()=>Object.keys(window.afterwave.state.drafts).length===0&&window.afterwave.state.events.filter(e=>e.status==='pending').length===2));
 check('B4 wait is not labelled as an outcome or institution',await page.locator('.map-activity').innerText()===mapActivity(pending,'B4')[0].label&&(await page.locator('.institution-status').innerText()).includes('尚未形成新成果')&&await page.evaluate(()=>!window.afterwave.state.institutions.some(i=>i.cellId==='B4')));
 await snap('390-committed-b4');await select('D5');check('D5 wait is visible before any warehouse exists',(await page.locator('.map-activity').innerText()).includes('第21年待兑现')&&!await page.locator('.institution-status').count());
 await click('playback');await click('step');await click('pause-world');check('Year21 aid resolution replaces the wait with a real institution',!await page.locator('.map-activity li').count()&&(await page.locator('.institution-status').innerText()).includes('互助仓运行中'));
 await select('B4');check('B4 remains pending while D5 has resolved',(await page.locator('.map-activity').innerText()).includes('第22年待兑现'));
 await click('playback');await click('step');await click('pause-world');check('Year22 review resolution removes its waiting mark',!await page.locator('.map-activity li').count()&&await page.locator('.institution-status').count()===1);
 await snap('390-resolved-b4');
 await show(locked);const stateBefore=await page.evaluate(()=>JSON.stringify(window.afterwave.state));const imageBefore=await canvas();await page.reload();await page.locator('canvas').waitFor();check('Reload preserves locked intent and identical pixels',await canvas()===imageBefore&&stateBefore===await page.evaluate(()=>JSON.stringify(window.afterwave.state)));
 check('No browser or asset errors',report.errors.length===0);
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;if(page)await snap('failure',false,true).catch(()=>{});}
finally{await fs.writeFile(`${out}/round6-activity-visual-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await server.close();}
