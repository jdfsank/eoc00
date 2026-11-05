import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import * as preTradeoffs from './fixtures/pre-tradeoffs-simulation.js';
import * as preHandoff from './fixtures/pre-handoff-simulation.js';
import * as preAftermath from './fixtures/pre-aftermath-simulation.js';
import * as preRecruitment from './fixtures/pre-recruitment-simulation.js';
import * as preRecovery from './fixtures/pre-recovery-simulation.js';
import * as prePortAccess from './fixtures/pre-port-access-simulation.js';
import { getChannelHistory } from '../src/channel-history.js';
import { restoreSave } from '../src/save.js';

const copy = structuredClone;
const row = (view, key = 'science') => view.channels.find(channel => channel.key === key);
const saved = (state, year, id = 'D4') => state.snapshots[year].find(cell => cell.id === id);
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
function choose(api, state, actionId) {
  const action = api.getActions(state, 'D4', 'protagonist').find(action => action.id === actionId);
  assert.ok(action, `natural ${actionId} contract exists at year${state.year}`);
  if (api.usesTradeoffs?.(state)) for (const evidence of action.requireEvidence) {
    if (!api.getInvestigation(state, 'protagonist', 'D4').evidence.includes(evidence)) api.investigate(state, 'protagonist', 'D4', evidence);
  }
  api.lockTask(state, 'protagonist', 'D4', actionId, action.requireEvidence);
}
function submit(api, state) {
  for (const actor of api.getActors(state)) if (!state.drafts[actor.id]) api.passTask(state, actor.id);
  api.commitWindow(state);
}
function runTo(year = 20, api = sim, seed = 0) {
  const state = api.createRun(seed);
  while (state.year < year) {
    if (state.phase === 'planning') {
      if (state.year === 0) choose(api, state, 'build_joint');
      if (state.year === 10) choose(api, state, 'recruit_risk');
      submit(api, state);
    }
    api.advanceYear(state);
  }
  return state;
}

test('natural joint-station recruitment history exposes opposite D4/F6 net science changes', () => {
  const state = runTo(), before = copy(state);
  const local = getChannelHistory(state, 'D4'), distant = getChannelHistory(state, 'F6');
  assert.deepEqual(row(local.latestComparison), {
    key: 'science', label: '科学', from: 40.5012, to: 39.0916,
    fromText: '40.5012', toText: '39.0916', delta: -1.4096, deltaText: '−1.4096', status: 'recorded',
  });
  assert.deepEqual(row(distant.latestComparison), {
    key: 'science', label: '科学', from: 41.89, to: 50.0536,
    fromText: '41.89', toText: '50.0536', delta: 8.1636, deltaText: '+8.1636', status: 'recorded',
  });
  assert.deepEqual([local.latestComparison.fromYear, local.latestComparison.toYear], [10, 20]);
  assert.deepEqual(local.checkpoints.map(page => page.year), [0, 10, 20]);
  assert.deepEqual(local.snapshots.map(page => page.year), Array.from({ length: 21 }, (_, year) => year));
  assert.deepEqual(state, before);
});

for (const year of [0, 1, 9, 10, 11, 19, 20, 23, 30, 31, 39, 40]) test(`year${year}: only completed decade comparisons, no upcoming window`, () => {
  const state = runTo(year), view = getChannelHistory(state, 'D4');
  const end = Math.floor(year / 10) * 10;
  assert.equal(view.currentYear, year);
  assert.equal(view.comparisons.length, Math.floor(year / 10));
  assert.ok(view.snapshots.every(page => page.year <= year));
  assert.ok(view.checkpoints.every(page => page.year <= year));
  if (end) assert.deepEqual([view.latestComparison.fromYear, view.latestComparison.toYear], [end - 10, end]);
  else { assert.equal(view.latestComparison, null); assert.equal(view.status, 'pending'); }
});

test('all four channels and all 64 regions use their own saved pages, not world averages', () => {
  const state = runTo(40);
  for (const cell of state.snapshots[0]) {
    const view = getChannelHistory(state, cell.id);
    for (const comparison of view.comparisons) {
      assert.equal(comparison.status, 'recorded');
      assert.deepEqual(comparison.channels.map(channel => channel.key), sim.CHANNELS);
      for (const channel of comparison.channels) {
        assert.equal(channel.from, saved(state, comparison.fromYear, cell.id).channels[channel.key]);
        assert.equal(channel.to, saved(state, comparison.toYear, cell.id).channels[channel.key]);
        assert.equal(channel.delta, Number((channel.to - channel.from).toFixed(4)));
      }
    }
  }
});

test('initial and window pages remain before new contract costs during lock and submission', () => {
  const state = sim.createRun(0), initial = getChannelHistory(state, 'D4');
  choose(sim, state, 'build_joint');
  assert.deepEqual(getChannelHistory(state, 'D4'), initial, 'locking does not alter a historical page');
  submit(sim, state);
  assert.equal(state.cells.find(cell => cell.id === 'D4').channels.economy, saved(state, 0).channels.economy - 6);
  assert.deepEqual(getChannelHistory(state, 'D4'), initial, 'paid current cells do not replace year0');
  sim.advanceToNextWindow(state);
  const at10 = getChannelHistory(state, 'D4');
  choose(sim, state, 'recruit_risk'); submit(sim, state);
  assert.equal(state.cells.find(cell => cell.id === 'D4').channels.economy, saved(state, 10).channels.economy - 1);
  assert.deepEqual(getChannelHistory(state, 'D4'), at10, 'year10 record is not rewritten after submission');
  sim.advanceYear(state);
  const at11 = getChannelHistory(state, 'D4');
  assert.deepEqual(at11.latestComparison, at10.latestComparison);
  assert.equal(row(at11.snapshots.at(-1), 'economy').value, saved(state, 11).channels.economy);
  assert.match(at11.notes.join(' '), /第0年.*成本前.*结算后.*不会回写/);
});

test('snapshot timing, shared effects and unreversed historical losses are explained', () => {
  const view = getChannelHistory(runTo(), 'D4'), text = view.notes.join(' ');
  for (const pattern of [/不是未来预测/, /不是某项行动单独/, /第0年.*成本前/, /年度产出结算后/, /费用不会回写/, /草案尚未付费/, /缺页不拿当前值/, /通道回升不抵销/]) assert.match(text, pattern);
});

for (const missing of [0, 10, 20]) test(`missing year${missing} stays unknown and is never bridged or silently replaced`, () => {
  const state = runTo(), untouched = copy(state.snapshots);
  delete state.snapshots[missing];
  const before = copy(state), view = getChannelHistory(state, 'D4');
  assert.equal(view.checkpoints.find(page => page.year === missing).status, 'unknown');
  assert.equal(view.checkpoints.find(page => page.year === missing).reason, 'missing-page');
  assert.ok(!view.snapshots.some(page => page.year === missing));
  assert.deepEqual(view.comparisons.map(c => [c.fromYear, c.toYear]), [[0, 10], [10, 20]]);
  for (const comparison of view.comparisons.filter(c => c.fromYear === missing || c.toYear === missing)) {
    for (const channel of comparison.channels) { assert.equal(channel.delta, null); assert.equal(channel.deltaText, '未知'); }
  }
  if (missing >= 10) assert.equal(view.latestComparison.status, 'unknown', 'latest does not fall back to a deceptively complete older interval');
  assert.equal(state.snapshots[missing], undefined);
  assert.deepEqual(state, before);
  assert.ok(untouched[missing]);
});

for (const corrupt of [undefined, null, {}, [], 'page', 0]) test(`corrupt snapshot page ${JSON.stringify(corrupt)} stays visible as unknown`, () => {
  const state = runTo(); state.snapshots[10] = corrupt;
  const view = getChannelHistory(state, 'D4');
  assert.equal(view.snapshots.find(page => page.year === 10).status, 'unknown');
  assert.equal(view.latestComparison.status, 'unknown');
  assert.equal(row(view.latestComparison).from, null);
  assert.equal(row(view.latestComparison).to, 39.0916);
});

for (const invalid of [undefined, null, '40.5012', NaN, Infinity, -1, 100.0001]) test(`invalid single-channel value ${String(invalid)} preserves other recorded channels`, () => {
  const state = runTo(); saved(state, 10).channels.science = invalid;
  const before = copy(state), view = getChannelHistory(state, 'D4');
  assert.equal(view.latestComparison.status, 'partial');
  assert.equal(row(view.latestComparison).delta, null);
  assert.equal(row(view.latestComparison).fromText, '未知');
  assert.equal(row(view.latestComparison, 'economy').status, 'recorded');
  assert.deepEqual(state, before);
});

test('missing or duplicate selected cells never choose an arbitrary historical value', () => {
  for (const duplicate of [false, true]) {
    const state = runTo(), original = saved(state, 10);
    state.snapshots[10] = state.snapshots[10].filter(cell => cell.id !== 'D4');
    if (duplicate) state.snapshots[10].push(copy(original), copy(original));
    const view = getChannelHistory(state, 'D4');
    assert.equal(view.checkpoints[1].reason, duplicate ? 'duplicate-cell' : 'missing-cell');
    assert.equal(view.latestComparison.status, 'unknown');
    assert.equal(getChannelHistory(state, 'F6').latestComparison.status, 'recorded', 'another region retains its own non-conflicting saved values');
  }
});

for (const alias of ['010', '10.0', '+10', ' 10', '1e1', '0xa']) test(`duplicate/ambiguous year key ${alias} cannot replace the canonical page`, () => {
  const state = runTo(); state.snapshots[alias] = copy(state.snapshots[10]);
  let view = getChannelHistory(state, 'D4');
  assert.equal(view.snapshots.filter(page => page.year === 10).length, 1);
  assert.equal(view.checkpoints[1].reason, 'duplicate-year');
  assert.equal(view.latestComparison.status, 'unknown');
  delete state.snapshots[10];
  view = getChannelHistory(state, 'D4');
  assert.equal(view.checkpoints[1].reason, 'invalid-year');
  assert.equal(view.latestComparison.status, 'unknown');
});

test('out-of-order pages and cell arrays are sorted only in the view', () => {
  const state = runTo(31), expected = getChannelHistory(state, 'D4');
  state.snapshots = Object.fromEntries(Object.entries(state.snapshots).reverse().map(([year, cells]) => [year, cells.reverse()]));
  const before = copy(state);
  assert.deepEqual(getChannelHistory(state, 'D4'), expected);
  assert.deepEqual(state, before);
});

test('future pages are not read, even when they contain throwing accessors', () => {
  const state = runTo(), expected = getChannelHistory(state, 'D4');
  for (const key of ['21', '30', '40', '41', '999']) Object.defineProperty(state.snapshots, key, {
    enumerable: true, get() { throw Error('future snapshot was read'); },
  });
  assert.deepEqual(getChannelHistory(state, 'D4'), expected);
});

test('negative, fractional and unrelated page keys do not become historical years', () => {
  const state = runTo(), expected = getChannelHistory(state, 'D4');
  for (const key of ['-1', '10.5', 'NaN', 'Infinity', 'null', '', ' ']) state.snapshots[key] = copy(state.snapshots[10]);
  assert.deepEqual(getChannelHistory(state, 'D4'), expected);
});

for (const [from, to, deltaText, delta] of [
  [40.5012, 39.0916, '−1.4096', -1.4096], [41.89, 50.0536, '+8.1636', 8.1636],
  [0.1, 0.2, '+0.1', 0.1], [0.0001, 0, '−0.0001', -0.0001], [0, 0.0001, '+0.0001', 0.0001],
  [0, 1e-7, '+0.0000001', 1e-7], [1e-7, 2e-7, '+0.0000001', 1e-7], [0.12345678, 0.12345679, '+0.00000001', 1e-8],
  [0, 100, '+100', 100], [100, 0, '−100', -100], [0, 0, '0', 0], [100, 100, '0', 0],
]) test(`stored precision: ${from}→${to} displays ${deltaText}`, () => {
  const state = runTo(); saved(state, 10).channels.science = from; saved(state, 20).channels.science = to;
  const result = row(getChannelHistory(state, 'D4').latestComparison);
  assert.equal(result.from, from); assert.equal(result.to, to);
  assert.equal(result.fromText, String(from)); assert.equal(result.toText, String(to));
  assert.equal(result.deltaText, deltaText); assert.equal(result.delta, delta);
});

test('missing snapshot container never invents history from current cells or baseline', () => {
  for (const container of [undefined, null, [], 'pages', 0, {}]) {
    const state = runTo(); state.snapshots = container;
    const view = getChannelHistory(state, 'D4');
    assert.equal(view.status, 'unknown'); assert.deepEqual(view.snapshots, []);
    assert.ok(view.checkpoints.every(page => page.status === 'unknown'));
    assert.ok(view.comparisons.every(comparison => comparison.channels.every(channel => channel.delta === null)));
  }
});

test('helper reads only reached year and saved pages, never randomness, current cells or contract effects', () => {
  const state = runTo(), expected = getChannelHistory(state, 'D4');
  for (const key of ['seed', 'phase', 'cells', 'baseline', 'events', 'history', 'drafts', 'institutions', 'actors', 'flags', 'investigations', 'committedWindows']) {
    Object.defineProperty(state, key, { get() { throw Error(`unrelated ${key} access`); } });
  }
  for (const page of Object.values(state.snapshots)) for (const cell of page) {
    Object.defineProperty(cell, 'roll', { get() { throw Error('random access'); } });
    Object.defineProperty(cell.channels, 'future', { get() { throw Error('future channel access'); } });
  }
  const oldRandom = Math.random;
  try { Math.random = () => { throw Error('random draw'); }; assert.deepEqual(getChannelHistory(state, 'D4'), expected); }
  finally { Math.random = oldRandom; }
});

test('frozen inputs, changed display output and JSON save restoration do not rewrite historical state', () => {
  const state = runTo(), before = copy(state), expected = getChannelHistory(state, 'D4');
  assert.deepEqual(getChannelHistory(restoreSave(JSON.parse(JSON.stringify({ state }))).state, 'D4'), expected);
  freeze(state);
  const result = getChannelHistory(state, 'D4');
  result.snapshots[10].channels[2].value = 99;
  result.checkpoints[0].summary = 'not saved';
  result.latestComparison.channels[2].delta = 999;
  result.notes.push('display only');
  assert.deepEqual(getChannelHistory(state, 'D4'), expected);
  assert.deepEqual(state, before);
});

test('invalid state year and region are rejected without reading arbitrary current data', () => {
  for (const state of [null, undefined, {}, { year: '20' }, { year: NaN }, { year: -1 }, { year: 41 }, { year: 1.5 }]) assert.equal(getChannelHistory(state, 'D4'), null);
  for (const id of [null, undefined, 'd4', 'I1', 'A0', 'A9', 'D4:science', '__proto__']) assert.equal(getChannelHistory({ year: 20 }, id), null);
});

// Each prior fixture is a frozen published engine. Its own natural generation,
// not deleting version tags from today's state, supplies the old snapshot data.
for (const [name, api] of Object.entries({ legacy, preTradeoffs, preHandoff, preAftermath, preRecruitment, preRecovery, prePortAccess })) {
  for (const seed of [0, 6]) test(`${name} seed${seed}: genuine original and imported continuations stay untouched by reading`, () => {
    const state = runTo(20, api, seed), before = copy(state), view = getChannelHistory(state, 'D4');
    assert.equal(api.validateState(state).valid, true);
    assert.equal(view.latestComparison.status, 'recorded');
    for (const page of view.snapshots) for (const channel of page.channels) assert.equal(channel.value, saved(state, page.year).channels[channel.key]);
    assert.deepEqual(state, before, 'reading an actual historical run does not migrate it');
    const loaded = restoreSave(JSON.parse(JSON.stringify({ state }))).state;
    assert.deepEqual(getChannelHistory(loaded, 'D4'), view);
    const originalControl = copy(state), importedControl = copy(loaded), frozenPast = copy(state.snapshots);
    while (state.year < 40) {
      if (state.phase === 'planning') {
        submit(api, state); submit(api, originalControl);
        submit(sim, loaded); submit(sim, importedControl);
      }
      api.advanceYear(state); api.advanceYear(originalControl);
      sim.advanceYear(loaded); sim.advanceYear(importedControl);
      // Each engine retains its own rules. This presentation feature does not
      // promise that different released engines produce identical future values.
      for (const run of [state, loaded]) {
        const history = getChannelHistory(run, 'D4');
        for (const page of history.snapshots) for (const channel of page.channels) assert.equal(channel.value, saved(run, page.year).channels[channel.key]);
        for (const [year, page] of Object.entries(frozenPast)) assert.deepEqual(run.snapshots[year], page, 'already saved history is never rewritten');
      }
      assert.deepEqual(state, originalControl, 'reading leaves the complete original run unchanged');
      assert.deepEqual(loaded, importedControl, 'reading leaves the complete imported run unchanged');
    }
    assert.equal(getChannelHistory(loaded, 'D4').latestComparison.toYear, 40);
  });
}
