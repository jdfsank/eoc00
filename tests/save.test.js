import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, lockTask, passTask, commitWindow, advanceYear, advanceToNextWindow, validateState } from '../src/simulation.js';
import { createUi, normalizeUi, restoreSave } from '../src/save.js';

const original = () => ({ state: createRun(0), ui: createUi() });
test('valid save preserves world, seed zero, selection and investigation progress', () => {
  const saved = original();
  Object.assign(saved.ui, { screen: 'avg', selected: 'D4', bigText: true, sessions: { '0:protagonist:D4': { evidence: ['independent_flood_records'], budget: 2 } } });
  const before = JSON.stringify(saved);
  const restored = restoreSave(saved);
  assert.deepEqual(restored, saved);
  assert.equal(restored.state.seed, '0');
  assert.equal(JSON.stringify(saved), before);
});
test('missing or non-object UI gets safe independent defaults', () => {
  for (const ui of [undefined, null, 2, 'world', [], true]) assert.deepEqual(normalizeUi(createRun(), ui), createUi());
  const a = createUi(), b = createUi();
  a.sessions.test = 1;
  assert.deepEqual(b.sessions, {});
});
test('all render-sensitive UI fields are allowlisted rather than merged', () => {
  const ui = normalizeUi(createRun(), { selected: 'Z99', screen: '__proto__', channel: 'bad', actor: {}, filter: null, query: [], sessions: null, focus: 'true', bigText: 'false', mapTrace: 'bad', traceId: {}, evil: true });
  assert.deepEqual(ui, createUi());
});
test('session normalization rejects malformed keys and bounds evidence and budget', () => {
  const ui = normalizeUi(createRun(), { sessions: {
    '0:protagonist:D4': { evidence: ['independent_flood_records', 'independent_flood_records', null, '__proto__', 'unfunded_maintenance', 'resident_testimony', 'successor_consent'], budget: 99 },
    '0:protagonist:B4': { evidence: null, budget: -1 },
    '0:protagonist:E4': null,
    '0:linche:D4': { evidence: [], budget: 3 },
    '10:protagonist:D4': { evidence: [], budget: 3 },
    '0:protagonist:Z9': { evidence: [], budget: 3 },
    '0:protagonist:D4:extra': { evidence: [], budget: 3 },
  } });
  assert.deepEqual(ui.sessions, {
    '0:protagonist:D4': { evidence: ['independent_flood_records', 'unfunded_maintenance', 'resident_testimony'], budget: 0 },
    '0:protagonist:B4': { evidence: [], budget: 3 },
  });
});
test('stale navigation is reconciled with the restored world and map traces are rebuilt', () => {
  const state = createRun();
  assert.equal(normalizeUi(state, { screen: 'playback' }).screen, 'review');
  assert.equal(normalizeUi(state, { screen: 'ending' }).screen, 'world');
  assert.equal(normalizeUi(state, { screen: 'trace', traceId: 'missing' }).screen, 'archive');
  assert.equal(normalizeUi(state, { screen: 'confirm', choice: 'missing' }).screen, 'avg');
  const ui = normalizeUi(state, { traceId: 'arrival', mapTrace: [{ cellId: 'Z99' }] });
  assert.deepEqual(ui.mapTrace, [state.history[0]]);
  passTask(state, 'protagonist'); commitWindow(state);
  assert.equal(normalizeUi(state, { screen: 'avg' }).screen, 'world');
});
test('import resets navigation but never inherits previous-run UI', () => {
  const restored = restoreSave(original(), { imported: true });
  assert.deepEqual(restored.ui, createUi());
  assert.throws(() => restoreSave({ state: null, ui: createUi() }), /存档/);
});
test('malformed institutions are rejected before annual mutation or import', () => {
  const state = createRun(6);
  lockTask(state, 'protagonist', 'D4', 'build_joint', ['independent_flood_records', 'unfunded_maintenance']);
  commitWindow(state); advanceToNextWindow(state); passTask(state, 'protagonist'); commitWindow(state);
  const corruptions = [
    institution => { delete institution.annualSource; },
    institution => { institution.annualSource = {}; },
    institution => { institution.annualSource.science = '1'; },
    institution => { institution.maintenance = null; },
    institution => { institution.active = 'true'; },
    institution => { institution.cellId = 'Z9'; },
  ];
  for (const corrupt of corruptions) {
    const candidate = structuredClone(state); corrupt(candidate.institutions[0]);
    const before = JSON.stringify(candidate);
    assert.equal(validateState(candidate).valid, false);
    assert.throws(() => restoreSave({ state: candidate }), /存档/);
    assert.throws(() => advanceYear(candidate), /年度结算未开始/);
    assert.equal(JSON.stringify(candidate), before);
  }
});
test('other malformed runtime structures fail validation without throwing', () => {
  const corruptions = [
    state => { state.flags = []; },
    state => { state.cells[0].col = .5; },
    state => { state.actors[0].availableFrom = 20; },
    state => { state.actors[0].alive = 'yes'; },
    state => { state.events.push({ id: 'bad' }); },
    state => { state.history[0].title = { toString: {} }; },
    state => { state.cells[0].name = {}; },
    state => { state.drafts.protagonist = { actorId: 'protagonist', window: 0, status: 'locked', cellId: 'D4', actionId: 'build_joint', evidence: {} }; },
    state => { state.promises.push(null); },
    state => { state.flags.networks = '2'; },
    state => { state.flags.crisis = {}; },
  ];
  for (const corrupt of corruptions) { const state = createRun(); corrupt(state); assert.equal(validateState(state).valid, false); }
});
