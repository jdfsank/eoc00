import test from 'node:test';
import assert from 'node:assert/strict';
// Fixture provenance: exact src/simulation.js from ef841e89f06fb221f4a4fc95b65636ce434c5cc5.
// Its only modification is the board JSON import path, needed at tests/fixtures/.
// Generate saves by executing that original engine, not by deleting fields from a current run.
import * as legacy from './fixtures/legacy-simulation.js';
import { advanceYear, advanceToNextWindow, getEnding, validateState } from '../src/simulation.js';
import { restoreSave } from '../src/save.js';

const evidence = Object.keys(legacy.EVIDENCE);
function oldSubmit(s, action, cellId = 'D4') {
  if (action) legacy.lockTask(s, 'protagonist', cellId, action, evidence);
  for (const actor of legacy.getActors(s)) if (!s.drafts[actor.id]) legacy.passTask(s, actor.id);
  legacy.commitWindow(s);
}
function oldDecade(s, action, cellId = 'D4') {
  oldSubmit(s, action, cellId); legacy.advanceToNextWindow(s); return s;
}
function oldWarningAt21({ built = false, risky = false } = {}) {
  const s = legacy.createRun(12);
  oldDecade(s, built ? 'build_joint' : undefined);
  oldDecade(s, risky ? 'recruit_risk' : undefined);
  oldSubmit(s, 'free_warning'); legacy.advanceYear(s);
  assert.equal(s.year, 21);
  assert.equal(s.crisisRulesVersion, undefined);
  assert.equal(s.flags.freeWarning, true);
  return s;
}
function restore(s) { return restoreSave(JSON.parse(JSON.stringify({ state: s }))).state; }
function assertNoInventedDetail(s) {
  for (const key of ['model', 'damageByCell', 'coverageByCell', 'protectionByCell']) {
    assert.equal(Object.hasOwn(s.flags.crisis, key), false, `Legacy crisis unexpectedly contains ${key}`);
  }
}

test('genuine legacy no-build free warning keeps its global .8 protection at23', () => {
  const old = oldWarningAt21();
  assert.equal(old.institutions.length, 0);
  const loaded = restore(old);
  const expected = structuredClone(old);
  while (loaded.year < 23) { advanceYear(loaded); legacy.advanceYear(expected); }
  assert.equal(loaded.flags.crisis.damage, .8);
  assert.deepEqual(loaded.flags.crisis, expected.flags.crisis);
  assertNoInventedDetail(loaded);
  assert.equal(loaded.institutions.length, 0);
  assert.deepEqual(loaded.cells, expected.cells);
  assert.equal(validateState(loaded).valid, true);
});

test('genuine legacy risky recruitment and completed free warning repairs active station staffing', () => {
  const old = oldWarningAt21({ built: true, risky: true });
  assert.equal(old.flags.successor, false);
  assert.equal(old.institutions.find(i => i.kind === 'station').active, true);
  const loaded = restore(old);
  assert.equal(loaded.flags.successor, true);
  assert.deepEqual(loaded.history, old.history);
  assert.deepEqual(loaded.events, old.events);
  while (loaded.year < 23) advanceYear(loaded);
  assert.equal(loaded.flags.crisis.damage, .8);
  assertNoInventedDetail(loaded);
  assert.equal(validateState(loaded).valid, true);
  const reloaded = restore(loaded);
  assert.deepEqual(reloaded, loaded);
});

test('legacy staffing repair requires successful free-warning evidence and an active D4 station', () => {
  const old = oldWarningAt21({ built: true, risky: true });
  const withoutSuccess = structuredClone(old);
  withoutSuccess.events.find(e => e.actionId === 'free_warning').status = 'failed';
  assert.equal(restore(withoutSuccess).flags.successor, false);
  const withoutStation = structuredClone(old);
  withoutStation.institutions.find(i => i.kind === 'station').active = false;
  assert.equal(restore(withoutStation).flags.successor, false);
});

test('genuine legacy post23 results remain unchanged on import and continued playback', () => {
  const old = oldWarningAt21();
  while (old.year < 23) legacy.advanceYear(old);
  const originalCrisis = structuredClone(old.flags.crisis);
  const originalImpact = structuredClone(old.history.find(e => e.id === 'crisis-impact'));
  const loaded = restore(old);
  advanceToNextWindow(loaded);
  assert.deepEqual(loaded.flags.crisis, originalCrisis);
  assert.deepEqual(loaded.history.find(e => e.id === 'crisis-impact'), originalImpact);
  assertNoInventedDetail(loaded);
  assert.match(getEnding(loaded).paragraphs.join(''), /旧版存档/);
});

test('genuine legacy renewal cannot override later forced-relocation loss of trust', () => {
  const old = legacy.createRun(12);
  oldDecade(old, 'build_joint'); oldDecade(old, 'renew_charter');
  oldDecade(old, 'relocate_teacher');
  assert.equal(old.flags.renewed, true);
  assert.equal(old.flags.trust, false);
  const loaded = restore(old);
  assert.equal(getEnding(loaded).metrics.trust, false);
  assert.equal(validateState(loaded).valid, true);
});

test('explicit legacy-v1 marker preserves the old formula without adding impact detail', () => {
  const old = oldWarningAt21();
  old.crisisRulesVersion = 'legacy-v1';
  const loaded = restore(old);
  while (loaded.year < 23) advanceYear(loaded);
  assert.equal(loaded.flags.crisis.damage, .8);
  assertNoInventedDetail(loaded);
});

test('legacy mutual aid and veto retain their original global combination', () => {
  const old = legacy.createRun(12);
  oldDecade(old); oldDecade(old, 'mutual_aid', 'D5');
  oldSubmit(old, 'local_veto', 'B4'); legacy.advanceYear(old);
  const loaded = restore(old);
  while (loaded.year < 23) { advanceYear(loaded); legacy.advanceYear(old); }
  assert.equal(loaded.flags.crisis.damage, .3 * .7);
  assert.deepEqual(loaded.flags.crisis, old.flags.crisis);
  assert.deepEqual(loaded.cells, old.cells);
  assertNoInventedDetail(loaded);
});
