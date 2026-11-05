import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneArt } from '../src/scene-art.js';
const state = institutions => ({institutions});
const provider = (kind,cellId,active=true,maintenance=1) => ({kind,cellId,active,maintenance,open:true});
test('unbuilt riverport and failed-build archive never invent a station',()=>{
 for(const s of [state([]),state([provider('archive','D4')])]){
  const art=sceneArt(s,'D4');assert.equal(art.file,'archive-desk.svg');assert.match(art.alt,/不表示.*建成测站/);
 }
 assert.equal(sceneArt(state([provider('station','D4')]),'D4').file,'river-station-public-active.svg');
});
test('stopped riverport retains its actual historical station rather than returning to the unbuilt scene',()=>{
 for(const station of [provider('station','D4',false),provider('station','D4',true,0)]){
  const art=sceneArt(state([station]),'D4');assert.equal(art.file,'river-station-public-stopped.svg');assert.match(art.alt,/已经停运/);assert.match(art.alt,/旧记录仍保留/);
 }
});
test('maintenance and missing staff are separate operating station scenes',()=>{
 const worn=sceneArt(state([provider('station','D4',true,.7)]),'D4');assert.equal(worn.file,'river-station-public-maintenance.svg');assert.match(worn.alt,/仍在运转/);
 const short={...state([provider('station','D4')]),flags:{recruited:true,successor:false}};
 assert.equal(sceneArt(short,'D4').file,'river-station-public-understaffed.svg');assert.doesNotMatch(sceneArt(short,'D4').alt,/屋面.*修补/);
 short.flags.successor=true;assert.equal(sceneArt(short,'D4').file,'river-station-public-active.svg');
 const branch={...state([provider('branch','F6')]),flags:{recruited:true,successor:false}};
 assert.equal(sceneArt(branch,'F6').file,'far-port-branch-none.svg','D4 recruitment does not remove F6 staff');
});
test('restored or newer active station takes precedence over an older stopped institution',()=>{
 const s=state([provider('station','D4',false),{...provider('station','D4'),startYear:12}]);
 const before=structuredClone(s);assert.equal(sceneArt(s,'D4').file,'river-station-public-active.svg');assert.deepEqual(s,before);
 s.institutions[1].active=false;assert.equal(sceneArt(s,'D4').file,'river-station-public-stopped.svg');
 s.institutions[0].active=true;assert.equal(sceneArt(s,'D4').file,'river-station-public-active.svg');
});
test('scene geography and educational infrastructure choose different actual illustrations',()=>{
 assert.equal(sceneArt(state([]),'B4').file,'archive-desk.svg');
 assert.equal(sceneArt(state([]),'E4').file,'open-shore.svg');
 assert.equal(sceneArt(state([provider('training','E4')]),'E4').file,'local-classroom.svg');
 assert.equal(sceneArt(state([]),'F6').file,'open-shore.svg');
 assert.equal(sceneArt(state([provider('branch','F6')]),'F6').file,'far-port-branch-none.svg');
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
