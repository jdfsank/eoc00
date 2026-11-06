import {chromium} from 'playwright';
import {boardReadinessPlugin,renderedBoard} from './helpers/board-readiness.mjs';
import cb from '@sparticuz/chromium';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {advanceYear} from '../src/simulation.js';
import {localAt20,localAt30,legacyLocalAt30,lock,submit} from '../tests/helpers/local-crisis.js';
const out='playtest-output';await fs.mkdir(out,{recursive:true});
const report={checks:[],errors:[],scope:'Real Chromium 320/390 widths, app 200% text setting, grayscale, focus and source/list navigation. Legacy unknown is saved data, not zero. Not physical-device certification.'};
const check=(name,ok)=>{report.checks.push({name,passed:!!ok});assert.ok(ok,name);console.log(name);};
const server=await createServer({plugins:[boardReadinessPlugin()],server:{host:'127.0.0.1',port:4266,strictPort:true}});await server.listen();let browser;
try{
 browser=await chromium.launch({executablePath:await cb.executablePath(),args:cb.args,headless:true});const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});page.on('requestfailed',r=>report.errors.push(`${r.failure()?.errorText} ${r.url()}`));
 await page.addInitScript(()=>{const f=sessionStorage.getItem('crisis-map-fixture');if(f){localStorage.setItem('afterwave.save.v1',f);sessionStorage.removeItem('crisis-map-fixture');}});await page.goto('http://127.0.0.1:4266');await renderedBoard(page);
 const warning=localAt20(),loss=localAt30(),zero=localAt30({zero:true}),unknown=legacyLocalAt30();const drafted=structuredClone(warning);lock(drafted,'protagonist','F6','independent_review');const pending=structuredClone(drafted);submit(pending);advanceYear(pending);
 for(const width of [320,390])for(const bigText of [false,true])for(const [name,state] of Object.entries({warning,loss,zero,unknown,drafted,pending})){
  await page.setViewportSize({width,height:width===320?568:844});await page.evaluate(({state,bigText})=>sessionStorage.setItem('crisis-map-fixture',JSON.stringify({state,ui:{screen:'world',selected:'D5',channel:'science',focus:false,bigText}})),{state,bigText});await page.reload();await renderedBoard(page);
  const prefix=`round16-crisis-${width}-${bigText?'200':'100'}-${name}`;
  const markers=await page.evaluate(()=>globalThis.__afterwaveTestBoard.scene.getScenes(true)[0].layer.list.filter(x=>x.name?.startsWith('map-crisis:')).map(x=>x.name));check(`${prefix} canvas draws all four correct stage badges`,markers.length===4&&markers.every(n=>n.endsWith(`:${['drafted','pending'].includes(name)?'warning':name}`)));
  check(`${prefix} legend and selected text`,await page.locator('.crisis-map-legend').count()===1&&await page.locator('.crisis-map-selection').count()===1);
  check(`${prefix} no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.map-frame').screenshot({path:`${out}/${prefix}-map.png`});
  if(bigText&&name==='unknown'){await page.locator('.crisis-map-legend').screenshot({path:`${out}/${prefix}-legend.png`});await page.locator('.crisis-map-selection').screenshot({path:`${out}/${prefix}-selected-text.png`});}
  await page.locator('[data-action="focus"]').click();await renderedBoard(page);await page.locator('.map-frame').evaluate(e=>e.style.filter='grayscale(1)');await page.locator('.map-frame').screenshot({path:`${out}/${prefix}-focus-mono.png`});
  if(name==='pending'){await page.locator('canvas').scrollIntoViewIfNeeded();const b=await page.locator('canvas').boundingBox(),before=await page.evaluate(()=>window.afterwave.mapView);await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+25,b.y+b.height/2+15,{steps:4});await page.mouse.up();check(`${prefix} focused map pans without committing`,(await page.evaluate(()=>window.afterwave.mapView)).centerX!==before.centerX);}
  await page.locator('[data-action="list"]').click();await page.locator('[data-filter="risk"]').click();check(`${prefix} all four recorded places accessible`,await page.locator('.coordinate-row').count()===4);await page.locator('.coordinate-row[data-cell="E4"]').focus();await page.keyboard.press('Enter');await renderedBoard(page);check(`${prefix} keyboard selects E4`,await page.evaluate(()=>window.afterwave.ui.selected)==='E4');
  check(`${prefix} inspection preserves all facts`,await page.evaluate(()=>JSON.stringify(window.afterwave.state))===JSON.stringify(state));
  await page.reload();await renderedBoard(page);check(`${prefix} reload preserves facts and selection`,await page.evaluate(()=>window.afterwave.ui.selected)==='E4'&&await page.evaluate(()=>JSON.stringify(window.afterwave.state))===JSON.stringify(state));
  if(name==='warning'&&!bigText){await page.locator('.crisis-map-selection [data-action="trace"]').click();check(`${prefix} source trace opens`,await page.locator('.crisis-history').count()===1);}
 }
 check('no browser errors',report.errors.length===0);
}finally{await browser?.close();await server.close();await fs.writeFile(`${out}/round16-crisis-map-report.json`,JSON.stringify(report,null,2));}
console.log(`Crisis map browser checks passed: ${report.checks.length}`);
