import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as current from '../src/simulation.js';
import {restoreSave} from '../src/save.js';
import * as previous from './fixtures/pre-decision-flow-producer/simulation.js';
import * as older from './fixtures/pre-training-workload-producer/simulation.js';
import {getPlaybackJournal,getPlaybackRecordIds,hasNewPlaybackRecord} from '../src/playback-journal.js';
import {ROUTES,makeRoute,lock,commit,nextRecordedYear,importantHistory} from './fixtures/round23-playback-routes.js';
const copy=structuredClone,bytes=JSON.stringify;
const fixtures=Object.fromEntries([['round21',previous],['round20',older]].map(([version,api])=>[version,Object.fromEntries(Object.keys(ROUTES).map(name=>[name,makeRoute(api,name)]))]));
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const deny=(target,key)=>Object.defineProperty(target,key,{get(){throw Error(`Forbidden future/private read: ${key}`);},enumerable:true,configurable:true});
const recordIds=view=>view.turns.map(t=>t.id);

for(const directory of ['pre-decision-flow-producer','pre-training-workload-producer'])test(`round23 ${directory}: genuine archived producer hashes and closed dependencies`,()=>{
 const root=new URL(`./fixtures/${directory}/`,import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
 assert.match(manifest.sourceCommit,/^[a-f0-9]{40}$/);
 for(const [file,hash]of Object.entries(manifest.files)){
  const content=fs.readFileSync(new URL(file,root));assert.equal(createHash('sha256').update(content).digest('hex'),hash,file);
  if(file.endsWith('.js'))for(const [,dependency]of content.toString().matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g))assert.ok(dependency.startsWith('./')&&!dependency.includes('..')&&Object.hasOwn(manifest.files,dependency.slice(2)),`${file}: frozen local dependency`);
 }
});
test('round23 simulation, save and all producer dependencies are byte-identical to the genuine prior production',()=>{
 const root=new URL('./fixtures/pre-decision-flow-producer/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
 for(const [file,hash]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(`../src/${file}`,import.meta.url))).digest('hex'),hash,file);
});
test('round23 protected pre-round23 source remains byte-exact to f7e3506bf5e926e9290ea65ae1358405dc941cc5',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/round23-protected-source-manifest.json',import.meta.url)));
 for(const [file,hash]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(`../src/${file}`,import.meta.url))).digest('hex'),hash,file);
});
for(const [version,api]of [['round21',previous],['round20',older]])for(const name of Object.keys(ROUTES))for(const mode of ['step','next-record','skip'])test(`round23 ${version}/${name}/${mode}: natural 0→40 full state, save and ending are exact`,()=>{
 const fixture=fixtures[version][name],state=copy(fixture.years[0]);
 for(const year of [0,10,20,30]){
  assert.equal(bytes(state),bytes(fixture.years[year]));
  for(const task of fixture.tasks[year])lock(current,state,...task);
  commit(current,state);assert.equal(bytes(state),bytes(fixture.committed[year]));
  while(state.phase==='playback'){
   const beforeYear=state.year,beforeIds=getPlaybackRecordIds(state);
   if(mode==='step')current.advanceYear(state);
   else if(mode==='skip')current.advanceToNextWindow(state);
   else {do {current.advanceYear(state);}while(state.phase==='playback'&&!hasNewPlaybackRecord(beforeIds,state));const oracle=copy(fixture.years[beforeYear]||fixture.committed[beforeYear]);if([0,10,20,30].includes(beforeYear))Object.assign(oracle,copy(fixture.committed[beforeYear]));nextRecordedYear(api,oracle);assert.equal(state.year,oracle.year,'independent history-only stopping oracle');}
   assert.equal(bytes(state),bytes(fixture.years[state.year]),`entire annual world ${state.year}`);
   assert.equal(bytes(restoreSave({state:copy(state)}).state),bytes(state),`full save ${state.year}`);
  }
 }
 assert.equal(bytes(state),bytes(fixture.ended));assert.equal(bytes(current.getEnding(state)),bytes(api.getEnding(fixture.ended)));
});
for(const [version,routes]of Object.entries(fixtures))for(const [name,fixture]of Object.entries(routes))test(`round23 ${version}/${name}: every annual journal is pure, finite, chronological and current-decade only`,()=>{
 for(const state of [...Object.values(fixture.years),...Object.values(fixture.committed)]){
  const before=bytes(state),view=getPlaybackJournal(freeze(copy(state)));if(state.phase==='planning'&&state.year===0){assert.equal(view,null);continue;}assert.equal(view.year,state.year);
  const ids=recordIds(view);assert.equal(new Set(ids).size,ids.length,'no duplicate turn');
  for(const turn of view.turns){assert.ok(turn.year<=state.year&&turn.year>=view.start);assert.ok(turn.year>view.start||turn.year===0,'no prior-decade outcome leaks');assert.ok(state.history.some(h=>h.id===turn.id&&h.year===turn.year));assert.deepEqual(turn.sourceIds,[turn.id]);}
  assert.equal(bytes(state),before);assert.deepEqual(getPlaybackJournal(state),view);
  if(view.turns.length){const detached=getPlaybackJournal(state);detached.turns[0].title='forged';if(detached.turns[0].record)detached.turns[0].record.title='forged';assert.equal(bytes(state),before);assert.deepEqual(getPlaybackJournal(state),view);}
 }
});
test('round23 natural witnesses prove branch, warning, maintenance, loss, failure and cancellation are all retained',()=>{
 const success=fixtures.round21.success,failed=fixtures.round21['failure-cancellation'],risk=fixtures.round21.maintenance;
 for(const [state,id]of [[success.years[19],'resolved:event:action:0:protagonist:D4:build_joint:training:branch'],[success.years[19],'crisis-warning'],[success.years[19],'charter-lapsed'],[risk.years[19],'station-unattended'],[failed.years[29],'crisis-impact'],[failed.years[29],'resolved:event:action:20:protagonist:B4:independent_review'],[failed.years[39],'resolved:event:action:30:linche:B4:complete_review']])assert.ok(recordIds(getPlaybackJournal(state)).includes(id),id);
 const v=getPlaybackJournal(failed.years[33]);assert.match(v.turns.find(t=>t.id.endsWith('complete_review')).summary,/取消|未完成|未落实/);
});
test('round23 future event payloads, RNG, snapshots and private investigations are never read',()=>{
 for(const year of [0,1,11,13,21,24,31,33]){
  const state=copy(fixtures.round21.success.years[year]),expected=getPlaybackJournal(state),ids=getPlaybackRecordIds(state);
  for(const key of ['seed','baseline','snapshots','investigations','drafts','promises','flags','institutions','actors','cells'])deny(state,key);
  for(const event of state.events)for(const key of ['roll','probability','text','title','description'])deny(event,key);deny(state,'events');
  for(const row of state.history)deny(row,'roll');
  const future={year:40};for(const key of ['id','kind','status','title','text','cellId','sourceActionId','parentId','reality'])deny(future,key);state.history.push(future);
  assert.deepEqual(getPlaybackJournal(state),expected);assert.deepEqual(getPlaybackRecordIds(state),ids);
 }
});
test('round23 no-new-record detection ignores replaying, reordered history and harmless reads',()=>{
 const state=copy(fixtures.round21.success.years[15]),before=bytes(state),ids=getPlaybackRecordIds(state);
 assert.equal(hasNewPlaybackRecord(ids,state),false);assert.equal(hasNewPlaybackRecord(ids,{...state,history:[...state.history].reverse()}),false);assert.equal(bytes(state),before);
 const later=copy(state);current.advanceYear(later);assert.equal(hasNewPlaybackRecord(ids,later),true);assert.equal(hasNewPlaybackRecord(getPlaybackRecordIds(later),later),false);
});
// Malformed boundary tests are deliberately not presented as accepted old saves.
// Unknown must remain unknown instead of generating a verified provenance link.
for(const fault of ['duplicate','conflicting','missing-id','missing-year','missing-text'])test(`round23 ${fault}: damaged records never acquire invented successful provenance`,()=>{
 const state=copy(fixtures.round21['failure-cancellation'].years[24]),id='resolved:event:action:20:protagonist:B4:independent_review',row=state.history.find(h=>h.id===id);
 if(fault==='duplicate')state.history.push(copy(row));
 if(fault==='conflicting')state.history.push({...copy(row),status:'success',kind:'outcome',text:'forged success'});
 if(fault==='missing-id')delete row.id;
 if(fault==='missing-year')delete row.year;
 if(fault==='missing-text')delete row.text;
 const before=bytes(state),view=getPlaybackJournal(state);assert.equal(bytes(state),before);assert.equal(new Set(recordIds(view)).size,view.turns.length);
 const target=view.turns.find(t=>t.id===id);if(fault==='missing-text'){assert.equal(target.category,'failure','explicit failure fact remains known');assert.equal(target.record.text,undefined,'missing narrative is not fabricated');assert.equal(view.currentRecords.some(r=>r.id===id&&r.text),false);}else assert.ok(!target||target.category==='unknown'||target.sourceIds.length===0,'unverifiable row omitted or explicitly unknown without verified source');
});

test('round23 unknown historical kinds and mismatched statuses remain explicitly unknown',()=>{
 for(const patch of [{kind:'older-unclassified-kind',status:'confirmed'},{kind:'outcome',status:'failed'},{kind:'failure',status:undefined},{kind:undefined,status:'success'}]){
  const state=copy(fixtures.round21.success.years[21]),row=state.history.find(h=>h.year===21);Object.assign(row,patch);
  const view=getPlaybackJournal(state),turn=view.turns.find(t=>t.id===row.id);assert.equal(turn.category,'unknown');assert.match(turn.summary,/不足|不补/);
  assert.equal(hasNewPlaybackRecord(getPlaybackRecordIds(fixtures.round21.success.committed[20]),state),true,'unknown reached history is still a reading stop');
 }
});
test('round23 future and other-reality duplicate identities cannot hide an already-published record',()=>{
 const state=copy(fixtures.round21.success.years[21]),expected=getPlaybackJournal(state),row=state.history.find(h=>h.year===21);
 for(const patch of [{year:39},{reality:'R0'},{status:'pending'}]){
  const altered=copy(state);altered.history.push({...copy(row),...patch,title:'UNPUBLISHED'});assert.deepEqual(getPlaybackJournal(altered),expected);
 }
});
