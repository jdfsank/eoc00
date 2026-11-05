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

test('east-bank teaching stays wall-free and south-bank teaching has no roof',()=>{
 for(const kind of ['training','school']){
  const east=sceneArt(state([provider(kind,'E4')]),'E4');
  assert.equal(east.file,'local-classroom.svg');assert.match(east.alt,/敞开河堤.*没有围墙/);assert.doesNotMatch(east.alt,/黑板|独立异源|成功复核/);
  const south=sceneArt(state([provider(kind,'D5')]),'D5');
  assert.equal(south.file,'bank-reading.svg');assert.match(south.alt,/没有屋顶与围墙/);
 }
 for(const kind of ['training','school']){
  for(const place of ['E4','D5']){
   const file=place==='D5'?'closed-bank-reading.svg':'closed-classroom.svg';
   assert.equal(sceneArt(state([provider(kind,place,false)]),place).file,file);
   assert.equal(sceneArt(state([provider(kind,place,true,0)]),place).file,file);
   assert.match(sceneArt(state([provider(kind,place,false)]),place).alt,/没有正在上课的人/);
  }
 }
});
