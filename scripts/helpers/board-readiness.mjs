import assert from 'node:assert/strict';

// Expose only the actual game instance in this test server. No application code
// or renderer behavior is replaced: readiness comes from Phaser's own lifecycle.
export function boardReadinessPlugin(){
 return {name:'test-board-readiness',enforce:'pre',transform(source,id){
  if(!id.split('?')[0].endsWith('/src/board.js'))return;
  const marker='return {update(state,selected,channel,trace=null)';
  assert.equal(source.split(marker).length,2,'Board test probe must attach to exactly one game');
  return source.replace(marker,`globalThis.__afterwaveTestBoard=game;\n ${marker}`);
 }};
}

export async function renderedBoard(page,{timeout=10000}={}){
 await page.locator('#board canvas').waitFor({timeout});
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>{
  const game=globalThis.__afterwaveTestBoard;
  return game?.canvas===document.querySelector('#board canvas')&&game.isRunning&&
   game.scene.getScenes(true).some(scene=>scene.layer?.length>0&&!scene.load.isLoading());
 },null,{timeout});
 // Scene.create populates display objects, but the canvas is still blank until
 // postrender. Capture in that event, not after a guessed delay or a pixel match.
 return page.evaluate(timeout=>new Promise((resolve,reject)=>{
  const game=globalThis.__afterwaveTestBoard;
  const timer=setTimeout(()=>{game.events.off('postrender',capture);reject(new Error('Board did not complete a render'));},timeout);
  function capture(){
   clearTimeout(timer);
   resolve({pixels:game.canvas.toDataURL(),state:JSON.stringify(window.afterwave.state)});
  }
  game.events.once('postrender',capture);
 }),timeout);
}

export function assertReloadPreserved(before,after){
 assert.equal(after.state,before.state,'Reload preserves fulfilled world facts');
 // Never wait for expected pixels: a settled but incorrect render must fail.
 assert.ok(after.pixels===before.pixels,'Reload preserves exact rendered pixels');
}
