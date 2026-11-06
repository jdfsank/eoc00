import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as sim from '../src/simulation.js';
import * as prior from './fixtures/pre-training-authorization-simulation.js';
import {getEndingArt} from '../src/ending-art.js';
import {lock,decade,submit} from './helpers/local-crisis.js';
function at30(){const s=sim.createRun(0);lock(s,'protagonist','D4','build_joint');decade(s);lock(s,'protagonist','D4','recruit_successor');decade(s);lock(s,'protagonist','B4','independent_review');lock(s,'linche','D4','free_warning');decade(s);return s;}
function ending(last){const s=at30();lock(s,'protagonist','D4','share_power');if(last)lock(s,'linche','E4',last);decade(s);assert.equal(sim.validateState(s).valid,true);return s;}
const target=s=>s.institutions.find(i=>i.kind==='training'&&i.cellId==='E4');
const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;};
test('natural endings distinguish original mandate, new teaching, and no new agreement without counting buildings',()=>{
 for(const [action,motif]of [['authorize_training','authorized'],['train_network','network'],[null,'unwritten']]){
  const s=ending(action),before=JSON.stringify(s),a=getEndingArt(s);assert.equal(a.motif,motif);assert.match(a.alt,/没有人物/);assert.ok(fs.existsSync(`public/assets/${a.file}`));assert.equal(JSON.stringify(s),before);
  for(const id of a.sourceIds){const found=[...s.history,...s.events].filter(r=>r.id===id);assert.equal(found.length,1);assert.ok(found[0].year<=40);}
 }
});
test('an illustration of a signed past does not assert the original training still operates',()=>{
 const s=ending('authorize_training');target(s).active=false;const a=getEndingArt(s);assert.equal(a.motif,'authorized-stopped');assert.match(a.caption,/授权页仍在.*停运/);assert.match(a.alt,/束带收起/);
 const n=ending('train_network');n.institutions.find(i=>i.kind==='school').active=false;assert.equal(getEndingArt(n).motif,'network-stopped');assert.match(getEndingArt(n).caption,/曾经兑现.*停运/);
});
test('unpaid, future and planning views do not get an ending scene',()=>{
 const s=at30();lock(s,'linche','E4','authorize_training');assert.equal(getEndingArt(s),null);submit(s);assert.equal(getEndingArt(s),null);sim.advanceYear(s);assert.equal(getEndingArt(s),null);
 const before=sim.createRun(0);assert.equal(getEndingArt(before),null);
});
test('cancellation has a retained rolled contract, not a signature, missing page, or disaster',()=>{
 const s=at30();lock(s,'linche','E4','authorize_training');submit(s);target(s).active=false;sim.advanceToNextWindow(s);assert.equal(sim.validateState(s).valid,true);const a=getEndingArt(s);assert.equal(a.motif,'cancelled');assert.match(a.alt,/卷起.*没有签署/);assert.match(a.caption,/没有新增授权/);
});
test('unknown or non-current-reality provenance never acquires a signature or new teaching tools',()=>{
 for(const action of ['authorize_training','train_network'])for(const edit of ['missing','duplicate','future','other-reality']){
  const s=ending(action),id=`resolved:event:action:30:linche:E4:${action}`,r=s.history.find(h=>h.id===id);
  if(edit==='missing')s.history=s.history.filter(h=>h!==r);if(edit==='duplicate')s.history.push({...r});if(edit==='future')r.year=41;if(edit==='other-reality')r.reality='R0';
  const a=getEndingArt(s);assert.equal(a.motif,'unknown',`${action}/${edit}`);assert.match(a.alt,/虚线缺口/);assert.equal(a.sourceIds.length,0);
 }
});
test('flags and unrelated schools cannot fabricate a fulfilled new network',()=>{
 const s=ending(null);s.flags.networks=99;s.flags.localHandoffAuthorization=true;assert.equal(getEndingArt(s).motif,'unwritten');
 s.institutions.push({id:'fake',kind:'school',cellId:'E4',active:true,maintenance:1,startYear:31,sourceEventId:'fake',sourceActionId:'fake'});assert.equal(getEndingArt(s).motif,'unwritten');
});
test('reads are frozen safe, detached and independent of seed, random draws and record prose',()=>{
 for(const action of ['authorize_training','train_network',null]){
  const s=ending(action),expected=getEndingArt(s);assert.deepEqual(getEndingArt(freeze(structuredClone(s))),expected);
  Object.defineProperty(s,'seed',{get(){throw Error('seed');}});for(const r of [...s.history,...s.events])for(const key of ['roll','probability','text','title'])Object.defineProperty(r,key,{get(){throw Error(key);}});
  assert.deepEqual(getEndingArt(s),expected);expected.sourceIds.push('invented');assert.ok(!getEndingArt(s).sourceIds.includes('invented'));
 }
});
test('genuine pre-authorization producer keeps its original state and uses only recorded new teaching',()=>{
 const s=prior.createRun(0);function oldNext(){for(const a of prior.getActors(s))if(!s.drafts[a.id])prior.passTask(s,a.id);prior.commitWindow(s);prior.advanceToNextWindow(s);}
 function choose(actor,cell,id){const a=prior.getActions(s,cell,actor).find(a=>a.id===id);for(const evidence of a.requireEvidence)prior.investigate(s,actor,cell,evidence);prior.lockTask(s,actor,cell,id);}
 choose('protagonist','D4','build_joint');oldNext();choose('protagonist','D4','recruit_successor');oldNext();oldNext();choose('linche','E4','train_network');oldNext();const before=JSON.stringify(s);assert.equal(getEndingArt(s).motif,'network');assert.equal(JSON.stringify(s),before);
});
test('all nine local still lifes use original vector geometry and non-color semantic marks',()=>{
 const motifs=['recorded','authorized','authorized-stopped','network','network-stopped','both','unwritten','cancelled','unknown'];
 const content=motifs.map(m=>fs.readFileSync(`public/assets/ending-${m}.svg`,'utf8'));
 assert.equal(new Set(content).size,motifs.length);
 for(const svg of content){assert.match(svg,/viewBox="0 0 1000 420"/);assert.doesNotMatch(svg,/<image|<script|<foreignObject|https?:\/\/(?!www.w3.org)/);}
 assert.match(content[1],/id="signed-page"/);assert.match(content[2],/id="closed-tools"/);assert.match(content[3],/id="new-teaching-tools"/);assert.match(content[4],/id="closed-network"/);assert.match(content[6],/id="unsigned-page"/);assert.match(content[7],/id="cancelled-scroll"/);assert.match(content[8],/id="unverified-folio"/);
});
