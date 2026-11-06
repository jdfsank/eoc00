import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as previous from './fixtures/pre-decision-flow-producer/simulation.js';
import * as older from './fixtures/pre-training-workload-producer/simulation.js';
import * as preRecruitment from './fixtures/pre-recruitment-simulation.js';
import * as legacy from './fixtures/pre-tradeoffs-simulation.js';
import {sceneFor, evidenceFor} from '../src/story.js';
import {getSuccessionSceneContext} from '../src/succession-scene-context.js';
import {lock, next, commit} from './fixtures/round24-investigation-routes.js';

const bytes = JSON.stringify;
function at10(api, {seed = 0, action = null, cell = 'D4'} = {}) {
  const state = api.createRun(seed);
  if (action) lock(state, api, 'protagonist', cell, action);
  next(state, api);
  assert.equal(state.year, 10);
  return state;
}
const cases = [
  ['merchant failure', {seed:12, action:'build_merchant'}, 'archive'],
  ['joint failure', {seed:6, action:'build_joint'}, 'archive'],
  ['merchant station', {seed:1, action:'build_merchant'}, 'station'],
  ['state station', {action:'build_state'}, 'station'],
  ['joint station', {action:'build_joint'}, 'station'],
  ['no build', {}, 'none'],
  ['B4 records only', {cell:'B4', action:'preserve_records'}, 'none'],
];

for (const [name, api] of [['current',sim], ['round21',previous], ['round20',older]])
for (const [route, options, kind] of cases) test(`${name}: genuine ${route} gets only current local work`, () => {
  const state = at10(api, options), before = bytes(state), scene = bytes(sceneFor(state, 'D4'));
  const context = getSuccessionSceneContext(state);
  assert.equal(context.title, '第10年 · 当前可谈的工作');
  assert.equal(context.body.length, 1);
  assert.ok(context.body[0].length <= 110);
  const text = context.body.join('');
  if (kind === 'archive') {
    assert.deepEqual(sim.getRecruitmentRoles(state).map(role => role.kind), ['archive']);
    assert.match(text, /仍在运转的小型档案站，没有测站可续约/);
    assert.match(text, /重建是另一项工作，不会随招募一并完成/);
    assert.ok(!sim.getActions(state, 'D4').some(action => action.id === 'renew_charter'));
  } else if (kind === 'station') {
    assert.match(text, /测站仍在运转/);
    assert.match(text, /则可续约公开章程/);
    assert.match(text, /安排继任不能代替维护续约/);
  } else {
    assert.deepEqual(sim.getRecruitmentRoles(state), []);
    assert.match(text, /没有运转中的测站或档案岗位/);
    assert.match(text, /招募不会自动补建机构或创造继任者/);
  }
  assert.doesNotMatch(text, /苏岚同意|苏岚接班|已经入局|已经续约|第16年|损失系数|概率/);
  for (const id of sim.getEvidenceIds(state, 'D4', 'protagonist')) assert.ok(!text.includes(evidenceFor(state, id, 'D4').text));
  assert.equal(bytes(state), before);
  assert.equal(bytes(sceneFor(state, 'D4')), scene);
  context.body[0] = 'changed';
  assert.notEqual(getSuccessionSceneContext(state).body[0], 'changed');
});

test('the browser-observed seed12 failure keeps the original succession-window bytes', () => {
  const state = at10(sim, {seed:12, action:'build_merchant'});
  const record = state.history.find(item => item.id === 'succession-window');
  assert.match(record.text, /招募、继任与续约争夺同一名额/);
  const original = bytes(record);
  assert.match(getSuccessionSceneContext(state).body[0], /没有测站可续约/);
  assert.equal(bytes(record), original);
});

test('reading, paid evidence, locked and passed drafts remain completely untouched', () => {
  for (const action of ['recruit_successor','recruit_risk','restore_archive',null]) {
    const state = at10(sim, {seed:12, action:'build_merchant'});
    if (action) lock(state, sim, 'protagonist', 'D4', action);
    else sim.passTask(state, 'protagonist');
    const before = bytes(state), context = getSuccessionSceneContext(state);
    assert.ok(context);
    assert.doesNotMatch(context.body[0], /尚未安排|没有锁定|已经接班|已经重建/);
    assert.equal(bytes(state), before);
    sim.commitWindow(state);
    const committed = bytes(state);
    assert.equal(getSuccessionSceneContext(state), null);
    assert.equal(bytes(state), committed);
  }
});

test('other years, locations, actors and later rereading never infer year10 contracts', () => {
  const state = sim.createRun(0);
  assert.equal(getSuccessionSceneContext(state), null);
  next(state, sim);
  for (const cell of ['B4','E4','F6','A1',null]) assert.equal(getSuccessionSceneContext(state, cell), null);
  for (const actor of ['linche','missing',null]) assert.equal(getSuccessionSceneContext(state,'D4',actor), null);
  for (const year of [20,30,40]) {
    next(state,sim); assert.equal(state.year,year);
    assert.ok(state.history.some(item => item.id === 'succession-window'));
    assert.equal(getSuccessionSceneContext(state),null);
  }
});

for (const [name,api] of [['pre-recruitment',preRecruitment],['per-scene',legacy]])
test(`genuine older ${name} producer retains its original reading`, () => {
  for (const options of [{}, {action:'build_joint'}, {seed:12,action:'build_merchant'}]) {
    const state = at10(api,options), before = bytes(state);
    assert.equal(getSuccessionSceneContext(state),null);
    assert.equal(bytes(state),before);
  }
});

test('unknown or damaged public facts do not create a role or a current-work paragraph', () => {
  const mutations = [
    s => s.planningRulesVersion='unknown', s => s.recruitmentRulesVersion='unknown',
    s => s.staffingRulesVersion='unknown', s => s.actors=[], s => s.actors[0].name='',
    s => s.institutions=null, s => s.cells=[], s => s.events[0].probability=NaN,
    s => s.institutions[0].sourceEventId='missing', s => s.institutions[0].sourceActionId='missing',
    s => s.institutions[0].startYear=1, s => s.events[0].status='success',
    s => s.history=s.history.filter(item => item.kind!=='failure'),
    s => s.history=s.history.filter(item => item.kind!=='action'),
  ];
  for (const mutate of mutations) {
    const state = at10(sim,{seed:12,action:'build_merchant'});mutate(state);
    const before=bytes(state);assert.equal(getSuccessionSceneContext(state),null);assert.equal(bytes(state),before);
  }
  for (const value of [null,undefined,{},[],{year:10,phase:'planning'}]) assert.equal(getSuccessionSceneContext(value),null);
});

test('private randomness, saved prose and unused future results are never read', () => {
  for (const options of [{seed:12,action:'build_merchant'},{action:'build_joint'},{}]) {
    const state=at10(sim,options),reads=[];
    const forbid=(object,key)=>Object.defineProperty(object,key,{get(){reads.push(key);throw Error(`private ${key}`);},configurable:true});
    for(const key of ['seed','baseline','snapshots','futureSnapshots'])forbid(state,key);
    for(const event of state.events)for(const key of ['roll','text'])forbid(event,key);
    for(const record of state.history)for(const key of ['text','title'])forbid(record,key);
    assert.ok(getSuccessionSceneContext(state));assert.deepEqual(reads,[]);
  }
});

for (const [name,api] of [['round21',previous],['round20',older]])
for (const options of [{seed:12,action:'build_merchant'},{action:'build_joint'},{}])
test(`${name}/${options.action||'no build'}: displaying context never changes later annual settlement`, () => {
  const state=at10(api,options),reference=structuredClone(state);
  const id=api.getActions(state,'D4').some(action=>action.id==='recruit_successor')?'recruit_successor':'recruit_volunteer';
  assert.ok(getSuccessionSceneContext(state));
  lock(state,sim,'protagonist','D4',id);lock(reference,api,'protagonist','D4',id);
  assert.ok(getSuccessionSceneContext(state));assert.equal(bytes(state),bytes(reference));
  while(state.year<40){
    commit(state,sim);commit(reference,api);assert.equal(bytes(state),bytes(reference));
    while(state.phase==='playback'){
      assert.equal(getSuccessionSceneContext(state),null);
      sim.advanceYear(state);api.advanceYear(reference);assert.equal(bytes(state),bytes(reference));
    }
  }
});

test('protected simulation, story and historical producers remain original', () => {
  const protectedFiles=JSON.parse(fs.readFileSync(new URL('./fixtures/round23-protected-source-manifest.json',import.meta.url)));
  for(const[file,hash]of Object.entries(protectedFiles.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(`../src/${file}`,import.meta.url))).digest('hex'),hash,file);
  for(const directory of ['pre-decision-flow-producer','pre-training-workload-producer']){
    const root=new URL(`./fixtures/${directory}/`,import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
    for(const[file,hash]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),hash,file);
  }
});
