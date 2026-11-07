import test from 'node:test';
import assert from 'node:assert/strict';
import * as current from '../src/simulation.js';
import * as old from './fixtures/pre-port-access-simulation.js';
import {getSceneSourceReading as read} from '../src/scene-source-reading.js';
function freeze(v){if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;}
function fixture(api){const s=api.createRun(0);const a=api.getActions(s,'D4','protagonist').find(a=>a.id==='build_joint');for(const id of a.requireEvidence)api.investigate(s,'protagonist','D4',id);api.lockTask(s,'protagonist','D4',a.id);api.commitWindow(s);api.advanceToNextWindow(s);return s;}
const context={screen:'avg',cellId:'E4',actorId:'protagonist'};
for(const [name,api] of [['current',current],['real old producer',old]])test(`${name}: exact original cross-region source on frozen state`,()=>{
 const s=fixture(api),record=s.history.find(r=>r.kind==='outcome'||r.kind==='failure');const before=JSON.stringify(s);freeze(s);
 const value=read(s,{...context,sourceId:record.id});assert.ok(value);assert.equal(value.sourceTitle,record.title);assert.equal(value.sourceYear,record.year);assert.equal(value.contextLabel,'E4 · 第10年现场');assert.match(value.notice,/不构成新的同意/);assert.equal(JSON.stringify(s),before);
});
test('unknown, ambiguous, future, pending and alternate realities cannot acquire source headings',()=>{
 for(const variant of ['missing','duplicate','future','pending','R0','P1','emptyTitle','futureResolution']){
  const s=fixture(current),source=s.history.find(r=>r.kind==='outcome'||r.kind==='failure'),id=source.id;
  if(variant==='missing')s.history=s.history.filter(r=>r!==source);
  if(variant==='duplicate')s.events.push({...source});
  if(variant==='future')source.year=11;
  if(variant==='pending')source.status='pending';
  if(['R0','P1'].includes(variant))source.reality=variant;
  if(variant==='emptyTitle')source.title=' ';
  if(variant==='futureResolution')source.resolvedYear=11;
  assert.equal(read(s,{...context,sourceId:id}),null,variant);
 }
});
test('navigation context validates stage, actor and supported visits without fabricating returns',()=>{
 const s=fixture(current),sourceId=s.history.find(r=>r.kind==='action').id;
 assert.equal(read(s,{...context,sourceId,actorId:'unknown'}),null);
 assert.equal(read(s,{...context,sourceId,screen:'trace'}),null);
 assert.equal(read(s,{...context,sourceId,cellId:'Z9'}),null);
 assert.equal(read(s,{...context,sourceId,screen:'visit',cellId:'A1'}),null);
 for(const phase of ['planning','playback','ended']){const v={...s,phase};assert.ok(read(v,{screen:'visit',cellId:'D4',sourceId}));if(phase!=='planning')assert.equal(read(v,{...context,sourceId}),null);}
 assert.equal(read(null),null);assert.equal(read(s),null);
});

test('source metadata never reads seeds, draws, snapshots or investigation inventories',()=>{
 for(const api of [current,old])for(const screen of ['avg','visit'])for(const cellId of ['D4','E4','D5','B4','F6']){
  const s=fixture(api),sourceId=s.history.find(r=>r.kind==='action').id,touched=[];
  for(const key of ['seed','draws','snapshots','investigations','rng','randomState'])Object.defineProperty(s,key,{get(){touched.push(key);throw Error(`Forbidden read ${key}`);},configurable:true});
  for(const record of [...s.history,...s.events])for(const key of ['roll','draw','draws','seed','futureOutcome'])Object.defineProperty(record,key,{get(){touched.push(`record.${key}`);throw Error(`Forbidden read ${key}`);},configurable:true});
  assert.ok(read(s,{screen,cellId,actorId:'protagonist',sourceId}),`${screen} ${cellId}`);
  assert.deepEqual(touched,[],`${screen} ${cellId}`);
 }
});
test('identity uniqueness spans both collections and never trims or coerces an identifier',()=>{
 for(const location of ['history','events']){
  const s=fixture(current),record=s.history.find(r=>r.kind==='action');s[location].push({...record});
  assert.equal(read(s,{...context,sourceId:record.id}),null,location);
 }
 const s=fixture(current),record=s.history.find(r=>r.kind==='action');
 for(const sourceId of ['',null,undefined,0,{},` ${record.id}`,`${record.id} `])assert.equal(read(s,{...context,sourceId}),null);
});
test('heading metadata keeps literal titles and accepts only already-dated source years',()=>{
 for(const title of [null,undefined,7,{},'', '   ']){const s=fixture(current),r=s.history[0];r.title=title;assert.equal(read(s,{...context,sourceId:r.id}),null);}
 for(const year of [-1,NaN,Infinity,1.5,'0',null,undefined,11]){const s=fixture(current),r=s.history[0];r.year=year;assert.equal(read(s,{...context,sourceId:r.id}),null);}
 const s=fixture(current),r=s.history[0];r.title='  原标题 <em>不解释为HTML</em>  ';
 assert.equal(read(s,{...context,sourceId:r.id}).sourceTitle,r.title);
 assert.equal(read(s,{...context,sourceId:r.id}).sourceYear,0);
 r.year=s.year;assert.equal(read(s,{...context,sourceId:r.id}).sourceYear,s.year);
});

test('late recovery visits do not inspect hidden randomness or investigation inventories',async()=>{
 const {portAt30,portRecovery}=await import('./helpers/far-port.js');
 const pending=portRecovery(portAt30()),resolved=structuredClone(pending);current.advanceYear(resolved);current.advanceYear(resolved);
 const ended=structuredClone(resolved);current.advanceToNextWindow(ended);
 for(const s of [pending,resolved,ended]){
  const sourceId=s.history.find(r=>r.kind==='action').id,touched=[];
  for(const key of ['seed','draws','snapshots','investigations'])Object.defineProperty(s,key,{get(){touched.push(key);throw Error(`Forbidden read ${key}`);},configurable:true});
  for(const cellId of ['D4','E4','D5','B4','F6'])assert.ok(read(s,{screen:'visit',cellId,sourceId}),`${s.year} ${cellId}`);
  assert.deepEqual(touched,[]);
 }
});
