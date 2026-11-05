import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneArt } from '../src/scene-art.js';
const state = institutions => ({institutions});
const provider = (kind,cellId,active=true,maintenance=1) => ({kind,cellId,active,maintenance});
test('unbuilt and stopped riverport never show the active station illustration',()=>{
 for(const s of [state([]),state([provider('archive','D4')]),state([provider('station','D4',false)]),state([provider('station','D4',true,0)])]){
  const art=sceneArt(s,'D4');assert.equal(art.file,'archive-desk.svg');assert.match(art.alt,/不表示.*建成测站/);
 }
 assert.equal(sceneArt(state([provider('station','D4')]),'D4').file,'river-room.svg');
});
test('scene geography and educational infrastructure choose different actual illustrations',()=>{
 assert.equal(sceneArt(state([]),'B4').file,'archive-desk.svg');
 assert.equal(sceneArt(state([]),'E4').file,'open-shore.svg');
 assert.equal(sceneArt(state([provider('training','E4')]),'E4').file,'local-classroom.svg');
 assert.equal(sceneArt(state([]),'F6').file,'open-shore.svg');
 assert.equal(sceneArt(state([provider('branch','F6')]),'F6').file,'river-room.svg');
});
test('ending image records history without implying station construction or future events',()=>{
 const art=sceneArt(state([]),'D4',{ending:true});assert.equal(art.file,'archive-desk.svg');assert.match(art.alt,/已经发生/);
});
