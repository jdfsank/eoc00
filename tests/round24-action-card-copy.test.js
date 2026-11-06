import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as current from '../src/simulation.js';
import {restoreSave} from '../src/save.js';
import * as previous from './fixtures/pre-decision-flow-producer/simulation.js';
import * as older from './fixtures/pre-training-workload-producer/simulation.js';
import {getActionCardTradeoff} from '../src/action-card-copy.js';

const bytes=JSON.stringify,copy=structuredClone;
const producers=[['current',current],['round21',previous],['round20',older]];
function lock(api,state,actor,cell,id){
  const action=api.getActions(state,cell,actor).find(a=>a.id===id);
  assert.ok(action,`${state.year}/${actor}/${cell}/${id} is a real available action`);
  for(const evidence of action.requireEvidence)if(!api.getInvestigation(state,actor,cell).evidence.includes(evidence))api.investigate(state,actor,cell,evidence);
  api.lockTask(state,actor,cell,id,action.requireEvidence);
}
function commit(api,state){
  for(const actor of api.getActors(state))if(!state.drafts[actor.id])api.passTask(state,actor.id);
  api.commitWindow(state);
}
function next(api,state){commit(api,state);api.advanceToNextWindow(state);}
function year20(api,hasStation){
  const state=api.createRun(0);
  if(hasStation)lock(api,state,'protagonist','D4','build_joint');
  next(api,state);
  lock(api,state,'protagonist','D4',hasStation?'recruit_successor':'recruit_volunteer');
  next(api,state);
  assert.equal(state.year,20);
  assert.equal(state.institutions.some(i=>i.kind==='station'&&i.cellId==='D4'&&i.active),hasStation);
  return state;
}
function exactTerms(action){
  return [
    {field:'reward',label:'若合同兑现',text:action.reward,known:true},
    {field:'risk',label:'仍需承担',text:action.risk,known:true},
  ];
}

for(const directory of ['pre-decision-flow-producer','pre-training-workload-producer'])test(`round24 card copy: ${directory} is an unchanged genuine historical producer`,()=>{
  const root=new URL(`./fixtures/${directory}/`,import.meta.url);
  const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
  assert.match(manifest.sourceCommit,/^[a-f0-9]{40}$/);
  for(const [file,hash]of Object.entries(manifest.files)){
    const content=fs.readFileSync(new URL(file,root));
    assert.equal(createHash('sha256').update(content).digest('hex'),hash,file);
    if(file.endsWith('.js'))for(const [,dependency]of content.toString().matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
      assert.ok(dependency.startsWith('./')&&!dependency.includes('..')&&Object.hasOwn(manifest.files,dependency.slice(2)),`${file}: dependencies remain inside the producer`);
    }
  }
});

for(const [name,api]of producers)for(const hasStation of [true,false])test(`round24 card copy: ${name}, ${hasStation?'real station':'no invented station'} has exact public benefits and costs`,()=>{
  const state=year20(api,hasStation),before=bytes(state);
  const action=api.getActions(state,'D4','protagonist').find(a=>a.id==='relocate_teacher');
  const actionBefore=bytes(action),view=getActionCardTradeoff(action);
  assert.deepEqual(view,exactTerms(action));
  assert.match(view[0].text,/增加教学能力，却损害地方信任/);
  assert.match(view[1].text,/苏岚反对被旧人生定义/);
  if(hasStation)assert.match(view[1].text,/河港现有制度失去维护/);
  else {assert.match(view[1].text,/不会替河港建成测站/);assert.doesNotMatch(view[1].text,/失去维护|停运/);}
  assert.equal(bytes(action),actionBefore);
  assert.equal(bytes(state),before,'reading the card preserves the entire world');
  view[0].text='forged';view[1].label='already consented';view.push({field:'consent'});
  assert.deepEqual(getActionCardTradeoff(action),exactTerms(action),'return value is detached');
  assert.equal(bytes(action),actionBefore);
  const companionActions=api.getActions(state,'D4','linche');
  assert.equal(companionActions.some(a=>a.id==='relocate_teacher'),false,'Linche refuses this action in the actual producer');
  assert.equal(companionActions.filter(a=>getActionCardTradeoff(a)).length,0,'presentation cannot create her refused option');
  assert.equal(bytes(state),before);
});

for(const [name,api]of producers)for(const hasStation of [true,false])test(`round24 card copy: ${name} natural relocation continues to year40 byte-exact (${hasStation?'station':'no station'})`,()=>{
  const expected=year20(api,hasStation),actual=copy(expected);
  for(const year of [20,30]){
    const tasks=year===20?[['protagonist','D4','relocate_teacher'],['linche','B4','independent_review']]:[['protagonist','D4','central_review'],['linche','E4','train_network']];
    for(const [actor,cell,id]of tasks){
      const before=bytes(actual),actions=current.getActions(actual,cell,actor);
      assert.deepEqual(actions,api.getActions(expected,cell,actor),'continued old public contracts stay exact');
      for(const action of actions)getActionCardTradeoff(action);
      assert.equal(bytes(actual),before,'comparison does not acquire evidence, lock or pay');
      lock(api,expected,actor,cell,id);lock(current,actual,actor,cell,id);
      assert.equal(bytes(actual),bytes(expected),'full locked state remains exact');
    }
    commit(api,expected);commit(current,actual);
    assert.equal(bytes(actual),bytes(expected),'whole submitted state remains exact');
    while(expected.phase==='playback'){
      api.advanceYear(expected);current.advanceYear(actual);
      assert.equal(bytes(actual),bytes(expected),`entire annual state at ${actual.year}`);
      assert.equal(bytes(restoreSave({state:copy(actual)}).state),bytes(expected),'save restore changes no world fields');
    }
  }
  assert.equal(actual.year,40);assert.equal(actual.phase,'ended');
  assert.deepEqual(current.getEnding(actual),api.getEnding(expected));
  const relocation=actual.events.find(e=>e.actionId==='relocate_teacher');
  assert.equal(relocation.status,'success');assert.equal(actual.flags.trust,false,'the visible cost is not rewritten into consent');
});

test('round24 card copy: other actions and missing actions do not get a fabricated tradeoff',()=>{
  for(const action of [null,undefined,{}, {id:'share_power'}, {id:'present_archive'}, {id:'build_joint'}, {id:'train_network'}, {id:'authorize_training'}, {id:'relocate_teacher_elsewhere'}])assert.equal(getActionCardTradeoff(action),null);
});

for(const [name,api]of producers)test(`round24 card copy: ${name} failed construction keeps the real archive duty separate from a station`,()=>{
  const state=api.createRun(6);
  lock(api,state,'protagonist','D4','build_joint');next(api,state);
  assert.equal(state.events.find(e=>e.actionId==='build_joint').status,'failed');
  lock(api,state,'protagonist','D4','recruit_successor');next(api,state);
  assert.ok(state.institutions.some(i=>i.kind==='archive'&&i.cellId==='D4'&&i.active));
  assert.equal(state.institutions.some(i=>i.kind==='station'&&i.cellId==='D4'),false);
  const before=bytes(state),action=api.getActions(state,'D4','protagonist').find(a=>a.id==='relocate_teacher');
  const view=getActionCardTradeoff(action);
  assert.deepEqual(view,exactTerms(action));
  assert.match(view[1].text,/河港现有制度失去维护/);
  assert.doesNotMatch(view[1].text,/测站停运|苏岚.*造成/);
  assert.equal(bytes(state),before);
});

test('round24 card copy: valid terms are copied byte-for-byte without truncating conditions or normalizing whitespace',()=>{
  const action=Object.freeze({id:'relocate_teacher',reward:'  若兑现，增加教学能力；却损害地方信任。\n',risk:'\n河港原岗位仍须核对；苏岚反对被旧人生定义。'.repeat(50)+'  '});
  assert.deepEqual(getActionCardTradeoff(action),exactTerms(action));
  assert.equal(getActionCardTradeoff(action)[1].text.length,action.risk.length);
});

for(const field of ['reward','risk'])test(`round24 card copy: absent or malformed ${field} remains explicitly unknown`,()=>{
  for(const value of [undefined,null,'',' \n\t',false,0,{},[]]){
    const action={id:'relocate_teacher',reward:'原结果',risk:'原代价',[field]:value};
    const before=bytes(action),view=getActionCardTradeoff(action);
    const item=view.find(item=>item.field===field),other=view.find(item=>item.field!==field);
    assert.equal(item.known,false);assert.equal(item.text,null);
    assert.equal(other.known,true);assert.equal(other.text,action[other.field]);
    assert.equal(bytes(action),before);
  }
  const missing=getActionCardTradeoff({id:'relocate_teacher'});
  assert.deepEqual(missing.map(item=>[item.known,item.text]),[[false,null],[false,null]]);
});

test('round24 card copy: only the available public action ID and its two terms are read',()=>{
  const source={id:'relocate_teacher',reward:'若兑现的公开结果',risk:'公开代价'};
  const action=new Proxy(source,{get(target,key){assert.ok(['id','reward','risk'].includes(key),`unexpected field read: ${String(key)}`);return target[key];}});
  assert.deepEqual(getActionCardTradeoff(action),exactTerms(source));
  const nonTarget=new Proxy({id:'present_archive'},{get(target,key){assert.equal(key,'id','other actions do not read terms or private data');return target[key];}});
  assert.equal(getActionCardTradeoff(nonTarget),null);
});
