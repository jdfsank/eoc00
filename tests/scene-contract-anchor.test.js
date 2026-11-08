import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as previous from './fixtures/pre-decision-flow-producer/simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import {routes, lock, commit} from './fixtures/round24-investigation-routes.js';
import {getSceneContractAnchor as anchor} from '../src/scene-contract-anchor.js';
import {restoreSave} from '../src/save.js';
const json = JSON.stringify;
const context = {screen:'choice', actorId:'protagonist', cellId:'D4', actionId:'build_joint'};
function freeze(o) {if(o && typeof o === 'object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}

for (const [name, api] of [['current',sim], ['previous',previous], ['original',legacy]]) {
  for (const [year, state] of Object.entries(routes(api))) {
    test(`${name} year ${year}: only actual public contracts are destinations`, () => {
      const before=json(state);freeze(state);
      for (const actor of sim.getActors(state)) for (const cell of state.cells) {
        const actions=sim.getActions(state,cell.id,actor.id);
        for(const action of actions) for(const screen of ['choice','confirm']) {
          const ctx={screen,actorId:actor.id,cellId:cell.id,actionId:action.id};
          assert.deepEqual(anchor(state,ctx),{actionId:action.id,actorId:actor.id,cellId:cell.id,title:action.title});
          const detached=anchor(state,ctx);detached.title='changed';
          assert.equal(anchor(state,ctx).title,action.title);
        }
        assert.equal(anchor(state,{...context,actorId:actor.id,cellId:cell.id,actionId:'unknown'}),null);
      }
      assert.equal(json(state),before);
    });
  }
}

test('no origin, random result, scroll or disclosure data is read or added',()=>{
  const state=sim.createRun(12),before=json(state),reads=[];
  for(const key of ['seed','futureSnapshots','sceneReturn','scrollY','expanded'])Object.defineProperty(state,key,{configurable:true,get(){reads.push(key);throw Error(key);}});
  assert.equal(anchor(state,context)?.actionId,'build_joint');assert.deepEqual(reads,[]);
  for(const key of ['seed','futureSnapshots','sceneReturn','scrollY','expanded'])delete state[key];
  state.seed=JSON.parse(before).seed;
  assert.equal(anchor(state,{...context,screen:'avg'}),null);
});

test('invalid stage, actor, place or action fails closed',()=>{
  const state=sim.createRun(0);
  for(const value of [null,undefined,{},[],{phase:'planning'}])assert.equal(anchor(value,context),null);
  for(const value of [null,{},[],{...context,screen:'avg'},{...context,screen:'world'},
    {...context,actorId:'linche'},{...context,actorId:'missing'},
    {...context,cellId:'B4'},{...context,cellId:'<img>'},
    {...context,actionId:'constructor'},{...context,actionId:'withdraw'}])assert.equal(anchor(state,value),null);
  commit(state,sim);assert.equal(anchor(state,context),null);
});

test('Linche refusal is not made available by a stale protagonist choice',()=>{
  const state=routes(sim)[20],ctx={screen:'choice',cellId:'D4',actorId:'protagonist',actionId:'relocate_teacher'};
  assert.ok(anchor(state,ctx));assert.equal(anchor(state,{...ctx,actorId:'linche'}),null);
});

test('normalized reloaded choice can be located without new save fields',()=>{
  for(const [name,api] of [['current',sim],['previous',previous],['original',legacy]]){
    const state=routes(api)[30],before=json(state);
    const restored=restoreSave({state,ui:{screen:'choice',selected:'D4',actor:'protagonist',choice:'withdraw'}});
    assert.equal(anchor(restored.state,{screen:restored.ui.screen,cellId:restored.ui.selected,actorId:restored.ui.actor,actionId:restored.ui.choice})?.actionId,'withdraw',name);
    assert.equal(json(restored.state),before);
    assert.ok(!Object.hasOwn(restored.ui,'sceneReturn'));
  }
});

test('reading a current contract does not replace a retained draft or adopt evidence',()=>{
  const state=routes(sim)[30];lock(state,sim,'protagonist','D4','share_power');
  const before=json(state),ctx={screen:'choice',cellId:'D4',actorId:'protagonist',actionId:'withdraw'};
  assert.equal(anchor(state,ctx)?.actionId,'withdraw');assert.equal(json(state),before);
  assert.equal(state.drafts.protagonist.actionId,'share_power');
});
