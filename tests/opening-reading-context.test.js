import test from 'node:test';
import assert from 'node:assert/strict';
import {getOpeningReadingContext} from '../src/opening-reading-context.js';
import * as current from '../src/simulation.js';
import * as old from './fixtures/pre-training-workload-producer/simulation.js';
import * as legacy from './fixtures/pre-tradeoffs-simulation.js';

const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
for (const [name, api] of [['current', current], ['old', old], ['legacy', legacy]]) {
  test(`${name}: original arrival prose is preserved exactly and read-only`, () => {
    const state = freeze(api.createRun(12)), before = JSON.stringify(state);
    const arrival = state.history.find(row => row.id === 'arrival');
    assert.deepEqual(getOpeningReadingContext(state), {
      recordId: arrival.id, label: '第一次委托 · 已存抵达记录', title: arrival.title, body: arrival.text,
    });
    assert.equal(JSON.stringify(state), before);
  });
  test(`${name}: actual submission and all later years omit opening`, () => {
    const state = api.createRun(12);
    for (let window = 0; window < 4; window++) {
      assert.equal(!!getOpeningReadingContext(state), window === 0);
      for (const actor of api.getActors(state)) api.passTask(state, actor.id);
      api.commitWindow(state);
      for (let year = 0; year < 10; year++) {
        const before = JSON.stringify(state);
        assert.equal(getOpeningReadingContext(state), null);
        assert.equal(JSON.stringify(state), before);
        api.advanceYear(state);
      }
    }
    assert.equal(getOpeningReadingContext(state), null);
    assert.equal(api.validateState(state).valid, true);
  });
}
test('public phase gate rejects unknown or inappropriate clocks', () => {
  for (const input of [null, {}, {year: '0', phase: 'planning'}, {year: 0, phase: 'ended'},
    {year: 1, phase: 'planning'}, {year: 10, phase: 'planning'}, {year: 0, phase: 'unknown'}]) {
    assert.equal(getOpeningReadingContext(input), null);
  }
});
test('missing, duplicate and cross-table arrival identities never invent a premise', () => {
  for (const alter of [
    s => { s.history = []; }, s => { s.events = undefined; }, s => { s.history = {}; },
    s => s.history.push({...s.history[0]}), s => s.events.push({...s.history[0]}),
    s => s.history.push({...s.history[0], id: 'other-arrival'}),
    s => s.events.push({...s.history[0], id: 'other-arrival'}),
    s => { s.events.push(s.history.pop()); },
    s => { s.reality = 'R0'; },
  ]) {
    const state = current.createRun(); alter(state);
    const before = JSON.stringify(state);
    assert.equal(getOpeningReadingContext(state), null);
    assert.equal(JSON.stringify(state), before);
  }
});
test('every provenance field and original prose must match retained producer', () => {
  const changes = {id: 'fake', year: 10, cellId: 'B4', kind: 'action', title: '改写标题',
    text: '没有洪水。', parentId: 'other', sourceActionId: 'other', status: 'success',
    reality: 'R0', actorId: 'linche', actionId: 'build_joint', resolvedYear: 0};
  for (const [field, value] of Object.entries(changes)) {
    const state = current.createRun(); state.history[0][field] = value;
    assert.equal(getOpeningReadingContext(state), null, field);
  }
});
test('missing provenance does not become an assumed original', () => {
  for (const field of Object.keys(current.createRun().history[0])) {
    const state = current.createRun(); delete state.history[0][field];
    assert.equal(getOpeningReadingContext(state), null, field);
  }
});
test('does not inspect hidden outcomes, draft choices, budgets or private randomness', () => {
  const state = current.createRun();
  for (const field of ['drafts', 'investigations', 'actors', 'institutions', 'flags', 'seed', 'roll', 'snapshots']) {
    Object.defineProperty(state, field, {get() { throw Error(`forbidden ${field}`); }});
  }
  assert.equal(getOpeningReadingContext(state).recordId, 'arrival');
});
test('untrusted accessors cannot supply provenance or execute', () => {
  for (const target of ['state', 'record']) {
    const state = current.createRun();
    Object.defineProperty(target === 'state' ? state : state.history[0], target === 'state' ? 'history' : 'text', {
      get() { throw Error('must not execute'); },
    });
    assert.equal(getOpeningReadingContext(state), null);
  }
});
