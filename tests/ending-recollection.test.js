import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as previous from './fixtures/pre-training-authorization-simulation.js';
import * as original from './fixtures/pre-handoff-simulation.js';
import {characterEpilogue} from '../src/story.js';
import {getEndingRecollection} from '../src/ending-recollection.js';

function lock(s,actor,cell,id,api=sim) {
  const action=api.getActions(s,cell,actor).find(action=>action.id===id);
  assert.ok(action,`${s.year} ${actor}/${cell}/${id}`);
  for(const evidence of action.requireEvidence) if(!api.getInvestigation(s,actor,cell).evidence.includes(evidence)) api.investigate(s,actor,cell,evidence);
  api.lockTask(s,actor,cell,id);
}
function submit(s,api=sim) {
  for(const actor of api.getActors(s))if(!s.drafts[actor.id])api.passTask(s,actor.id);
  api.commitWindow(s);return s;
}
function next(s,api=sim) {submit(s,api);api.advanceToNextWindow(s);assert.equal(api.validateState(s).valid,true);return s;}
function at30({api=sim,personal='present_archive',review=true}={}) {
  const s=api.createRun(0);lock(s,'protagonist','D4','build_joint',api);next(s,api);
  lock(s,'protagonist','D4','recruit_successor',api);next(s,api);
  if(personal)lock(s,'protagonist','D4',personal,api);
  if(review)lock(s,'linche','B4','independent_review',api);
  return next(s,api);
}
function finish({api=sim,policy='share_power',work='authorize_training',actor='linche',personal='present_archive',review=true}={}) {
  const s=at30({api,personal,review});
  if(policy)lock(s,'protagonist','D4',policy,api);
  if(work)lock(s,actor,work==='mutual_aid'?'D5':'E4',work,api);
  return next(s,api);
}
const card=(view,actor='linche')=>view.lastInterventions.find(card=>card.actorId===actor);
const person=(view,name='林澈')=>view.people.find(person=>person.name===name);
function freeze(value){if(value&&typeof value==='object'){for(const member of Object.values(value))freeze(member);Object.freeze(value);}return value;}

test('only an actual year40 ended state receives a final recollection',()=>{
  assert.equal(getEndingRecollection(null),null);
  for(const [year,phase]of[[0,'planning'],[30,'planning'],[30,'playback'],[39,'playback'],[40,'planning'],[41,'ended']])assert.equal(getEndingRecollection({...sim.createRun(),year,phase}),null);
  assert.equal(getEndingRecollection({year:40,phase:'ended'}),null);
});

test('authorizing existing trainees and creating a new school receive different final work prose',()=>{
  const authorization=finish(),training=finish({work:'train_network'});
  assert.equal(sim.getEnding(authorization).text,sim.getEnding(training).text);
  const a=getEndingRecollection(authorization),t=getEndingRecollection(training);
  assert.equal(a.opening,t.opening);
  assert.equal(card(a).actionId,'authorize_training');assert.equal(card(t).actionId,'train_network');
  assert.match(card(a).outcome,/原东岸学徒.*本地承接签名.*没有新建学校/);
  assert.match(card(t).outcome,/新的轮值维护网络开始工作/);
  assert.notEqual(card(a).responsibility,card(t).responsibility);
});

test('protagonist work is acknowledged without crediting it to the companion or granting a free policy',()=>{
  const a=getEndingRecollection(finish({policy:null,actor:'protagonist'}));
  const t=getEndingRecollection(finish({policy:null,actor:'protagonist',work:'train_network'}));
  assert.match(a.opening,/已兑现的工作.*没有签署新的治理方针/);
  assert.match(card(a,'protagonist').outcome,/原东岸学徒/);
  assert.match(card(t,'protagonist').outcome,/新的轮值维护网络/);
  for(const view of [a,t]){
    assert.equal(card(view).status,'passed');assert.equal(card(view).actionId,null);
    assert.doesNotMatch(person(view).paragraphs.join(''),/第30年|第31年.*签名|第31年.*网络/);
    assert.doesNotMatch(JSON.stringify(view),/下一次介入/);
  }
});

test('a shared declaration missing only authorization names that exact gap',()=>{
  const s=finish({work:null}),ready=sim.getEnding(s).handoff;
  assert.deepEqual(ready.staffCells,['E4','D5']);assert.deepEqual(ready.checkCells,['B4']);assert.equal(ready.trust,true);
  const view=getEndingRecollection(s);
  assert.equal(view.opening,'共享纠错权的方针已经签下；现有人手仍缺地方承接授权。');
  assert.doesNotMatch(view.opening,/人手不足|信任不足|缺.*校验/);
  assert.match(view.recordNote,/原结局评语采用概括口径.*实际缺口：现有人手仍缺地方承接授权/);
});

test('missing collaboration and explicit rejection remain different facts',()=>{
  const absent=getEndingRecollection(finish({personal:null,work:'train_network'}));
  const rejected=getEndingRecollection(finish({personal:'relocate_teacher',work:'train_network'}));
  assert.match(absent.opening,/河港尚未作出合作承诺/);
  assert.match(rejected.opening,/河港明确拒绝当前安排/);
  assert.match(person(rejected,'苏岚').paragraphs.join(''),/不证明她曾同意/);
  assert.match(person(rejected).paragraphs.join(''),/不等于认可/);
});

test('all missing dependencies fit a short opening without a fictional personal ending',()=>{
  const s=sim.createRun(0);for(let n=0;n<3;n++)next(s);lock(s,'protagonist','D4','share_power');next(s);
  const view=getEndingRecollection(s);
  assert.match(view.opening,/尚缺运转中的教学人手/);assert.match(view.opening,/尚缺有效的异源校验/);
  assert.match(view.opening,/河港尚未作出合作承诺/);assert.ok(view.opening.length<=60,view.opening);
  assert.equal(view.lastInterventions.length,1);assert.doesNotMatch(person(view).paragraphs.join(''),/第20年，林澈|第30年，林澈/);
});

test('withdrawal and centralized coordination retain their distinct real outcome',()=>{
  const withdrawn=getEndingRecollection(finish({policy:'withdraw'}));
  assert.match(withdrawn.opening,/接住了退出后的责任/);
  const centralized=getEndingRecollection(finish({policy:'central_review',work:'mutual_aid'}));
  assert.match(centralized.opening,/保留协调权.*已有校验/);assert.match(card(centralized).outcome,/支持生计/);
  const unfinished=getEndingRecollection(finish({policy:'central_review',work:null,review:false}));
  assert.match(unfinished.opening,/共同标准还缺少有效复核/);
  assert.doesNotMatch(unfinished.opening,/已完成交班|接住了退出/);
});

test('an authorization cancelled at31 stays cancelled at40 and keeps its paid choice',()=>{
  const s=at30();lock(s,'protagonist','D4','share_power');lock(s,'linche','E4','authorize_training');submit(s);
  s.institutions.find(i=>i.cellId==='E4'&&i.kind==='training').active=false;
  sim.advanceToNextWindow(s);assert.equal(sim.validateState(s).valid,true);
  const view=getEndingRecollection(s),late=card(view);
  assert.equal(late.status,'cancelled');assert.equal(late.actionId,'authorize_training');
  assert.match(late.outcome,/取消，没有新增授权/);assert.match(late.responsibility,/成本不退/);
  assert.doesNotMatch(late.outcome,/按已协商的条件留下本地承接签名/);
  assert.match(view.opening,/地方承接授权/);
});

test('a cancelled future check does not become an accomplished service',()=>{
  const s=sim.createRun(2);next(s);lock(s,'protagonist','D4','recruit_volunteer');next(s);next(s);
  lock(s,'protagonist','B4','establish_future_check');next(s);
  const view=getEndingRecollection(s),late=card(view,'protagonist');
  assert.equal(late.status,'cancelled');assert.match(late.outcome,/第34年.*未来校验席取消/);
  assert.match(view.historicalNote,/第23年.*损失/);
});

test('earlier companion review is retained once, final work and year23 are not copied into her coda',()=>{
  const s=finish(),view=getEndingRecollection(s),text=person(view).paragraphs.join('');
  assert.equal((text.match(/第20年，林澈/g)||[]).length,1);
  assert.match(text,/第22年.*异源复核确认/);assert.doesNotMatch(text,/第30年|第23年/);
  assert.match(view.historicalNote,/第23年四地.*为0.*不是没有洪水/);
  assert.equal((JSON.stringify(view).match(/第23年/g)||[]).length,1);
  assert.match(text,/第11年.*苏岚同意接班/);assert.match(text,/第16年.*收费门槛/);
});

test('earlier failed review and later cancelled recovery remain separate from the historical loss',()=>{
  const s=sim.createRun(2);next(s);lock(s,'protagonist','D4','recruit_volunteer');next(s);
  lock(s,'linche','F6','independent_review');next(s);assert.equal(s.events.find(e=>e.actionId==='independent_review').status,'failed');
  lock(s,'protagonist','D4','central_review');lock(s,'linche','F6','complete_review');next(s);
  const view=getEndingRecollection(s);assert.match(person(view).paragraphs.join(''),/第22年.*没有修正本次共同指令/);
  assert.equal(card(view).status,'cancelled');assert.match(view.historicalNote,/第23年.*损失/);
});

test('passing the final window is neither missing history nor a promise of another playable window',()=>{
  const s=finish({policy:null,work:null}),view=getEndingRecollection(s);
  assert.match(view.opening,/没有再安排介入/);
  for(const c of view.lastInterventions){assert.equal(c.status,'passed');assert.match(c.choice,/明确放弃/);assert.doesNotMatch(c.responsibility,/下一次介入/);}
});

const corruptions={
  'missing result':(s,a,e,r)=>s.history=s.history.filter(row=>row!==r),
  'duplicate result':(s,a,e,r)=>s.history.push(structuredClone(r)),
  'wrong result year':(s,a,e,r)=>r.year=39,
  'wrong result location':(s,a,e,r)=>r.cellId='F6',
  'R0 result':(s,a,e,r)=>r.reality='R0',
  'cross-table result':(s,a,e,r)=>s.events.push({id:r.id,year:41,kind:'event',title:'FUTURE SECRET'}),
  'cross-table result ancestor':(s,a,e,r)=>s.history.push({...e,kind:'observation'}),
  'action plus pass':(s,a,e,r)=>s.history.push({id:'pass:30:linche',year:30,cellId:'D4',kind:'pass',status:'confirmed',parentId:null,sourceActionId:null}),
};
for(const [name,change]of Object.entries(corruptions))test(`${name}: an unverified final result is not narrated as a signature`,()=>{
  const s=finish(),e=s.events.find(e=>e.actionId==='authorize_training'),a=s.history.find(h=>h.id===e.sourceActionId),r=s.history.find(h=>h.id===`resolved:${e.id}`);
  change(s,a,e,r);const before=structuredClone(s),view=getEndingRecollection(s),late=card(view);
  assert.equal(late.status,'unknown');assert.match(late.outcome,/未知|不一致/);
  assert.doesNotMatch(late.outcome,/按已协商的条件留下|FUTURE SECRET/);assert.deepEqual(s,before);
  for(const id of late.sourceIds)assert.equal([...s.history,...s.events].filter(row=>row.id===id).length,1);
});

test('missing choice is not an invented pass, and policy flags cannot invent a final signature',()=>{
  const s=finish({policy:null,work:null});s.history=s.history.filter(row=>row.id!=='pass:30:protagonist');s.flags.policy='share_power';
  const view=getEndingRecollection(s);assert.equal(card(view,'protagonist').status,'unknown');
  assert.doesNotMatch(view.opening,/共享纠错权.*签下|实际承接/);assert.doesNotMatch(card(view,'protagonist').choice,/明确放弃/);
});

test('missing historical original and genuine old aggregate data are not repaired from today',()=>{
  const s=finish();s.history=s.history.filter(row=>row.id!=='crisis-impact');
  assert.match(getEndingRecollection(s).historicalNote,/原件缺失.*未知/);
  const old=finish({api:original,work:'train_network'}),before=structuredClone(old);
  const view=getEndingRecollection(old);assert.match(view.opening,/本局原规则/);
  assert.deepEqual(old,before);assert.deepEqual(sim.getEnding(old),original.getEnding(old));
});

test('genuine pre-authorization producer endings retain scores, contracts, history and existing default coda',()=>{
  for(const api of [previous,original])for(const policy of ['share_power','withdraw','central_review']){
    const s=finish({api,policy,work:'train_network'}),before=structuredClone(s),ending=api.getEnding(s),oldCoda=characterEpilogue(s);
    assert.ok(getEndingRecollection(s));assert.deepEqual(s,before);assert.deepEqual(sim.getEnding(s),ending);
    assert.deepEqual(characterEpilogue(s),oldCoda);assert.deepEqual(characterEpilogue(s,{includeDeploymentRecollections:true}),oldCoda);
  }
});

test('deeply frozen reads are deterministic and return data detached from the state',()=>{
  const s=finish(),before=structuredClone(s),expected=getEndingRecollection(s);
  assert.deepEqual(getEndingRecollection(freeze(structuredClone(s))),expected);
  expected.lastInterventions[0].sourceIds.push('not-a-record');expected.people[0].paragraphs.push('not-history');
  assert.deepEqual(s,before);assert.notDeepEqual(getEndingRecollection(s),expected);
});

test('ending reads neither seeds, drafts, hidden event rolls nor unpublished event prose',()=>{
  const s=finish(),expected=getEndingRecollection(s);
  for(const key of ['seed','drafts'])Object.defineProperty(s,key,{get(){throw Error(key);}});
  for(const event of s.events)for(const key of ['roll','title','text'])Object.defineProperty(event,key,{get(){throw Error(key);}});
  assert.deepEqual(getEndingRecollection(s),expected);
});

test('every new final-work and personal source is a unique real history record at or before40',()=>{
  for(const options of [{},{work:'train_network'},{policy:null,actor:'protagonist'},{work:'mutual_aid'},{work:null},{personal:'relocate_teacher',work:'train_network'}]){
    const s=finish(options),view=getEndingRecollection(s);
    for(const id of [...view.lastInterventions.flatMap(card=>card.sourceIds),...view.people.flatMap(person=>person.sources)]){
      const matches=[...s.history,...s.events].filter(row=>row.id===id);assert.equal(matches.length,1,id);
      assert.ok(s.history.includes(matches[0]),id);assert.ok(matches[0].year<=40,id);assert.ok(sim.traceEvent(s,id).length,id);
    }
  }
});
