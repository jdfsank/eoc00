import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as previous from './fixtures/pre-decision-flow-producer/simulation.js';
import * as legacy from './fixtures/legacy-simulation.js';
import { getPlaybackJournal, getPlaybackRecordIds, hasNewPlaybackRecord } from '../src/playback-journal.js';

const copy = value => structuredClone(value);
const row = (id, year, kind, status = 'confirmed', extra = {}) => ({ id, year, kind, status, reality: 'R1', title: id, text: `原文：${id}`, ...extra });
const state = (year, history, phase = 'playback') => ({ year, phase, history });
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); for (const item of Object.values(value)) freeze(item); } return value; }
function lock(s, actor, cell, id, api = sim) {
  const a = api.getActions(s, cell, actor).find(a => a.id === id); assert.ok(a, `${s.year}/${id}`);
  if (typeof api.usesTradeoffs === 'function' && api.usesTradeoffs(s)) {
    for (const evidence of a.requireEvidence) if (!api.getInvestigation(s, actor, cell).evidence.includes(evidence)) api.investigate(s, actor, cell, evidence);
  }
  api.lockTask(s, actor, cell, id, a.requireEvidence);
}
function commit(s, api = sim) { for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id); api.commitWindow(s); }
function observe(s) {
  const before = JSON.stringify(s);
  const journal = getPlaybackJournal(s), ids = getPlaybackRecordIds(s);
  assert.equal(JSON.stringify(s), before, 'reading the journal must not change the world');
  assert.equal(hasNewPlaybackRecord(ids, s), false, 'existing records must not pause again');
  for (const item of journal?.turns || []) {
    assert.deepEqual(item.sourceIds, [item.id]);
    assert.equal(s.history.filter(record => record.id === item.id).length, 1);
    assert.ok(item.year <= s.year);
    for (const [key, value] of Object.entries(item.record)) assert.deepEqual(value, s.history.find(record => record.id === item.id)[key]);
  }
  return journal;
}

test('journal only exists during real playback and reached review boundaries', () => {
  for (const value of [null, {}, state(0, [], 'planning'), state(9, [], 'planning'), state(40, [], 'playback'), state(30, [], 'ended'), state(-1, []), state(14.5, []), state('14', [])]) assert.equal(getPlaybackJournal(value), null);
  for (const year of [0, 1, 10, 14, 20, 39]) {
    const j = getPlaybackJournal(state(year, []));
    assert.equal(j.start, Math.floor(year / 10) * 10); assert.equal(j.nextWindow, j.start + 10); assert.equal(j.isBoundary, false);
  }
  for (const year of [10, 20, 30, 40]) {
    const j = getPlaybackJournal(state(year, [], year === 40 ? 'ended' : 'planning'));
    assert.equal(j.start, year - 10); assert.equal(j.nextWindow, year === 40 ? null : year); assert.equal(j.isBoundary, true);
  }
});

test('published categories distinguish warning, tally, failure, cancellation, maintenance and actual outcome', () => {
  const history = [row('warning', 14, 'warning'), row('maintenance', 16, 'maintenance'), row('failed', 22, 'failure', 'failed'), row('cancelled', 22, 'cancelled', 'cancelled'), row('tally', 23, 'crisis'), row('success', 24, 'outcome', 'success')];
  const j = getPlaybackJournal(state(24, history));
  assert.deepEqual(j.turns.map(item => item.category), ['failure', 'cancelled', 'crisis', 'outcome']);
  assert.deepEqual(getPlaybackJournal(state(16, history)).turns.map(item => item.category), ['warning', 'maintenance']);
  assert.match(j.turns.find(item => item.category === 'crisis').summary, /以这份记录为准/);
  assert.doesNotMatch(j.turns.find(item => item.category === 'crisis').summary, /已经造成损失|零损失|伤亡|苏岚同意/);
  assert.equal(j.latestTurn.id, 'success'); assert.deepEqual(j.pastTurns.map(item => item.id), ['failed', 'cancelled', 'tally']);
  assert.deepEqual(j.currentRecords, [history.at(-1)]);
});

test('generic confirmed is never promoted to successful fulfillment and unknown records stay visible', () => {
  const j = getPlaybackJournal(state(8, [row('not-success', 3, 'outcome'), row('conflicting', 4, 'warning', 'success'), row('old-custom', 5, 'custom', undefined, { title: '', type: '旧有记载' }), row('fallback', 6, 'custom', undefined, { title: null })]));
  assert.deepEqual(j.turns.map(item => item.category), ['unknown', 'unknown', 'unknown', 'unknown']);
  assert.equal(j.turns[2].title, '旧有记载'); assert.equal(j.turns[3].title, '已存记录');
  assert.ok(j.turns.every(item => item.label === '记录待核'));
});

test('future, other-reality, pending, malformed and every duplicate identity are excluded conservatively', () => {
  const history = [row('valid', 3, 'outcome', 'success'), row('old', 4, 'maintenance', undefined, { reality: undefined }), row('future', 12, 'outcome', 'success'), row('r0', 5, 'crisis', 'confirmed', { reality: 'R0' }), row('pending', 6, 'outcome', 'pending'), row('duplicate', 7, 'outcome', 'success'), row('duplicate', 7, 'outcome', 'success'), row('bad-year', '8', 'warning'), row('', 8, 'warning'), row('unknown-status', 8, 'warning', 'invented')];
  const s = state(9, history), j = getPlaybackJournal(s);
  assert.deepEqual(j.turns.map(item => item.id), ['valid', 'old']);
  assert.deepEqual(getPlaybackRecordIds(s), ['valid', 'old']);
  assert.equal(j.notes.length, 1);
  assert.equal(getPlaybackJournal(state(9, undefined)).notes.length, 1);
  assert.deepEqual(getPlaybackJournal(state(9, [history[2], history[3], history[4]])).notes, [], 'excluded future/other reality rows must not leak their presence');
});

test('same-year chronology is preserved and no six-record cap can discard a real result', () => {
  const history = Array.from({ length: 9 }, (_, n) => row(`result-${n}`, 21, 'outcome', 'success'));
  const j = getPlaybackJournal(state(21, history));
  assert.equal(j.currentRecords.length, 9); assert.equal(j.turns.length, 9);
  assert.deepEqual(j.currentRecords.map(item => item.id), history.map(item => item.id));
  assert.equal(j.latestTurn.id, 'result-8');
});

test('no flags, seed, roll, future events or snapshots are read; dates do not invent crises or consent', () => {
  for (const year of [14, 16, 21, 23, 31, 39]) {
    const s = state(year, []);
    for (const key of ['flags', 'seed', 'roll', 'events', 'institutions', 'actors', 'snapshots', 'drafts']) Object.defineProperty(s, key, { get() { throw Error(`Forbidden read: ${key}`); } });
    const j = getPlaybackJournal(s); assert.deepEqual(j.turns, []); assert.equal(j.latestTurn, null); assert.deepEqual(j.currentRecords, []);
    assert.deepEqual(getPlaybackRecordIds(s), []); assert.equal(hasNewPlaybackRecord([], s), false);
  }
});

test('new-turn detection responds only to newly produced current-year visible key records', () => {
  const s = state(20, [row('old', 14, 'warning'), row('act', 20, 'action')]);
  const before = getPlaybackRecordIds(s);
  assert.equal(hasNewPlaybackRecord(before, s), false);
  s.history.push(row('pass', 20, 'pass')); assert.equal(hasNewPlaybackRecord(before, s), false);
  s.year = 21; s.history.push(row('new', 21, 'outcome', 'success'));
  assert.equal(hasNewPlaybackRecord(before, s), true);
  const after = getPlaybackRecordIds(s); assert.equal(hasNewPlaybackRecord(after, s), false);
  s.history.at(-1).title = 'Changed text, same event'; assert.equal(hasNewPlaybackRecord(after, s), false);
  s.year = 22; assert.equal(hasNewPlaybackRecord(before, s), false, 'previous-year unread event does not falsely pause again');
  s.history.push(row('future', 23, 'crisis')); assert.equal(hasNewPlaybackRecord(before, s), false);
  s.history.push(row('duplicate', 22, 'warning'), row('duplicate', 22, 'warning')); assert.equal(hasNewPlaybackRecord(before, s), false);
  assert.equal(hasNewPlaybackRecord(null, s), false);
});

test('journal returns detached objects and works on deeply frozen genuine state', () => {
  const s = sim.createRun(0); lock(s, 'protagonist', 'D4', 'build_joint'); commit(s); while (s.year < 7) sim.advanceYear(s);
  const original = JSON.stringify(s), j = getPlaybackJournal(freeze(s));
  j.turns[0].record.text = 'changed'; j.latestTurn.record.title = 'changed'; j.pastTurns[0].sourceIds.push('wrong'); j.currentRecords[0].text = 'changed';
  assert.equal(JSON.stringify(s), original);
  assert.notEqual(j.turns.at(-1).record.title, 'changed');
});

test('two natural full routes keep independent producer state exact at every year and retain omitted decade turns', () => {
  for (const seed of [0, 6]) {
    const s = sim.createRun(seed), old = previous.createRun(seed);
    for (const year of [0, 10, 20, 30]) {
      const tasks = year === 0 ? [['protagonist', 'D4', 'build_joint']] : year === 10 ? [['protagonist', 'D4', 'recruit_successor']] : year === 20 ? [['protagonist', 'B4', 'independent_review'], ['linche', 'D4', 'free_warning']] : [['protagonist', 'D4', 'share_power'], ['linche', 'E4', 'train_network']];
      for (const t of tasks) { lock(s, ...t); lock(old, ...t, previous); }
      commit(s); commit(old, previous); assert.deepEqual(s, old); observe(s);
      while (s.phase === 'playback') {
        const before = getPlaybackRecordIds(s); sim.advanceYear(s); previous.advanceYear(old); assert.deepEqual(s, old);
        const j = observe(s);
        const newKey = s.history.some(record => record.year === s.year && !before.includes(record.id) && !['arrival', 'action', 'pass', 'simulation'].includes(record.kind));
        assert.equal(hasNewPlaybackRecord(before, s), newKey);
        if (s.year === 20) {
          assert.ok(j.turns.some(item => item.id === 'crisis-warning'));
          assert.ok(j.turns.some(item => item.id === 'old-reality-conflict'));
          if (seed === 0) { assert.ok(j.turns.some(item => item.record.title === '远港分站亮灯')); assert.ok(j.turns.some(item => item.id === 'charter-lapsed')); }
        }
        if (s.year === 22) assert.equal(j.latestTurn.category, seed === 0 ? 'outcome' : 'failure');
        if (s.year === 30) assert.ok(j.turns.some(item => item.id === 'crisis-impact'));
      }
    }
    assert.equal(s.events.find(event => event.actionId === 'build_joint').status, seed === 0 ? 'success' : 'failed');
    assert.equal(s.flags.crisis.damage, seed === 0 ? 0 : 0.9431);
  }
});

test('genuine original producer keeps original history, no migration or new loss interpretation', () => {
  const s = legacy.createRun(6);
  for (const year of [0, 10, 20, 30]) {
    const tasks = year === 0 ? [['protagonist', 'D4', 'build_joint']] : year === 10 ? [['protagonist', 'D4', 'recruit_successor']] : year === 20 ? [['protagonist', 'B4', 'independent_review'], ['linche', 'D4', 'free_warning']] : [['protagonist', 'D4', 'share_power'], ['linche', 'E4', 'train_network']];
    for (const t of tasks) lock(s, ...t, legacy);
    commit(s, legacy);
    while (s.phase === 'playback') { legacy.advanceYear(s); observe(s); }
  }
  const impact = s.history.find(record => record.id === 'crisis-impact');
  assert.ok(impact); assert.doesNotMatch(impact.text, /覆盖系数/);
  const reached30 = copy(s); reached30.year = 30; reached30.phase = 'planning';
  const card = getPlaybackJournal(reached30).turns.find(item => item.id === 'crisis-impact');
  for (const [key, value] of Object.entries(card.record)) assert.deepEqual(value, impact[key]); assert.doesNotMatch(card.summary, /0\.\d|伤亡人数|四地零损失/);
});

test('a natural conditional cancellation is a cancellation, not a successful future capability', () => {
  const s = sim.createRun(0);
  for (const year of [0, 10, 20]) { commit(s); sim.advanceToNextWindow(s); }
  lock(s, 'protagonist', 'B4', 'establish_future_check'); commit(s);
  while (s.year < 34) sim.advanceYear(s);
  const j = getPlaybackJournal(s), card = j.latestTurn;
  assert.equal(card.category, 'cancelled'); assert.equal(card.record.status, 'cancelled'); assert.match(card.record.title, /未能开席/);
  assert.doesNotMatch(card.summary, /已完成|已获授权|同意接班/);
});


test('future and other-reality duplicates cannot change the published view, and private row getters are never read', () => {
  const s = state(14, [row('published', 14, 'warning')]);
  const expected = getPlaybackJournal(s), ids = getPlaybackRecordIds(s);
  Object.defineProperty(s.history[0], 'roll', { get() { throw Error('Do not read private RNG'); }, enumerable: true });
  const future = { year: 23 };
  for (const key of ['id', 'reality', 'status', 'kind', 'title', 'text', 'roll']) Object.defineProperty(future, key, { get() { throw Error(`Do not read future ${key}`); }, enumerable: true });
  s.history.push(future, row('published', 13, 'warning', 'confirmed', { reality: 'R0' }), row('published', 23, 'warning'));
  assert.deepEqual(getPlaybackJournal(s), expected); assert.deepEqual(getPlaybackRecordIds(s), ids);
  assert.equal(hasNewPlaybackRecord(ids, s), false);
});

test('a recorded failure without its body retains the outcome but never fabricates missing details', () => {
  const s = state(22, [row('failure', 22, 'failure', 'failed', { text: undefined })]);
  const card = getPlaybackJournal(s).latestTurn;
  assert.equal(card.category, 'failure'); assert.equal(card.record.text, undefined);
  assert.doesNotMatch(card.summary, /费用不退|修正.*指令|人物同意|第23年.*损失/);
});
