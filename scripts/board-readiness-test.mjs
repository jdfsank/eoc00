import {chromium} from 'playwright';
import cb from '@sparticuz/chromium';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {boardReadinessPlugin,renderedBoard,assertReloadPreserved} from './helpers/board-readiness.mjs';
import {portAt30,portRecovery} from '../tests/helpers/far-port.js';
import {advanceYear} from '../src/simulation.js';

const report={checks:[],errors:[],negativeControls:[]};
const check=(name,assertion,negative=false)=>{
 const result={name,passed:false};report.checks.push(result);
 if(negative)report.negativeControls.push(result);
 assertion();result.passed=true;
};
let browser,server;
try{
 const state=portRecovery(portAt30());advanceYear(state);advanceYear(state);
 server=await createServer({plugins:[boardReadinessPlugin()],server:{host:'127.0.0.1',port:4239,strictPort:true}});
 await server.listen();
 browser=await chromium.launch({executablePath:await cb.executablePath(),args:cb.args,headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('response',response=>{if(response.url().includes('/assets/')&&response.status()>=400)report.errors.push(`${response.status()} ${response.url()}`);});
 await page.addInitScript(state=>{
  if(!localStorage.getItem('afterwave.save.v1'))localStorage.setItem('afterwave.save.v1',JSON.stringify({state,ui:{screen:'world',selected:'F6',actor:'protagonist',channel:'politics',focus:true}}));
 },state);
 await page.goto('http://127.0.0.1:4239');
 const before=await renderedBoard(page);
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/assets/props/*.png',async route=>{await gate;await route.continue();});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('canvas').waitFor();
 // Reproduce the old 70 ms sample while preload is deliberately still pending.
 await page.waitForTimeout(70);
 const early=await page.evaluate(()=>({pixels:document.querySelector('canvas').toDataURL(),state:JSON.stringify(window.afterwave.state)}));
 check('World facts survive delayed preload',()=>assert.equal(early.state,before.state,'World facts survive even while the renderer is waiting'));
 check('Old timer captures unfinished canvas',()=>assert.notEqual(early.pixels,before.pixels,'Old timer captures unfinished canvas'),true);
 let completed=false;const pending=renderedBoard(page).then(value=>{completed=true;return value;});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 check('Readiness waits for preload',()=>assert.equal(completed,false,'Readiness does not accept a blank canvas during preload'));
 release();const after=await pending;check('Delayed preload preserves exact state and pixels',()=>assertReloadPreserved(before,after));
 await page.unroute('**/assets/props/*.png');
 console.log('PASS: delayed preload reproduces old pixel failure with identical world facts; readiness waits and exact pixels pass');

 // Pause actual rendering after a real scene has loaded, independently of assets.
 const listeners=await page.evaluate(()=>{const game=globalThis.__afterwaveTestBoard;game.loop.sleep();return game.events.listenerCount('postrender');});
 completed=false;const delayedRender=renderedBoard(page).then(value=>{completed=true;return value;});
 await page.waitForFunction(count=>globalThis.__afterwaveTestBoard.events.listenerCount('postrender')>count,listeners);
 check('Readiness waits for actual postrender',()=>assert.equal(completed,false,'Readiness requires an actual render, not scene creation alone'));
 await page.evaluate(()=>globalThis.__afterwaveTestBoard.loop.wake());
 const rendered=await delayedRender;check('Delayed rendering preserves exact state and pixels',()=>assertReloadPreserved(before,rendered));
 console.log('PASS: delayed render waits for postrender, then preserves exact pixels');

 await page.evaluate(()=>window.afterwave.state.year++);
 const wrongState=await renderedBoard(page);
 check('Changed world facts are rejected',()=>assert.throws(()=>assertReloadPreserved(before,wrongState),/fulfilled world facts/),true);
 await page.evaluate(()=>window.afterwave.state.year--);
 console.log('PASS: state mismatch is rejected');
 await page.evaluate(()=>globalThis.__afterwaveTestBoard.scene.getScenes(true)[0].layer.setAlpha(.5));
 const wrongPixels=await renderedBoard(page);
 check('Wrong-pixel control preserves world facts',()=>assert.equal(wrongPixels.state,before.state));
 check('Settled wrong pixels are rejected',()=>assert.throws(()=>assertReloadPreserved(before,wrongPixels),/exact rendered pixels/),true);
 console.log('PASS: settled wrong pixels are rejected without tolerance or retry-until-match');
 check('No runtime or asset errors',()=>assert.equal(report.errors.length,0));
}catch(error){
 report.failure={message:error.message,stack:error.stack};process.exitCode=1;
}finally{
 await fs.mkdir('playtest-output',{recursive:true});
 await fs.writeFile('playtest-output/round16-board-readiness-results.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 await browser?.close();await server?.close();
}

