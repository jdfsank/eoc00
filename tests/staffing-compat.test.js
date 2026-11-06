import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as sim from '../src/simulation.js';
import * as original from './fixtures/legacy-simulation.js';
import * as coverage from './fixtures/pre-tradeoffs-simulation.js';
import * as handoff from './fixtures/pre-handoff-simulation.js';
import * as aftermath from './fixtures/pre-aftermath-simulation.js';
import * as recruitment from './fixtures/pre-recruitment-simulation.js';
import * as recovery from './fixtures/pre-recovery-simulation.js';
import * as port from './fixtures/pre-port-access-simulation.js';
import * as before from './fixtures/pre-staffing-simulation.js';
import { restoreSave } from '../src/save.js';

const copy = structuredClone;
const IMPORT_YEARS = [10, 11, 15, 16, 20, 30];
const ENGINES = [['0a64767', coverage], ['pre-handoff', handoff], ['pre-aftermath', aftermath], ['pre-recruitment', recruitment], ['pre-recovery', recovery], ['pre-port-access', port], ['pre-staffing', before]];
const at = (s, id = 'D4') => s.cells.find(c => c.id === id);
const reload = s => restoreSave(JSON.parse(JSON.stringify({ state: s }))).state;
function submit(api, s, id) {
  if (id) {
    const action = api.getActions(s, 'D4').find(a => a.id === id);
    assert.ok(action, `${id} must be available at ${s.year}`);
    if (api.usesTradeoffs?.(s)) for (const e of action.requireEvidence) {
      if (!api.getInvestigation(s, 'protagonist', 'D4').evidence.includes(e)) api.investigate(s, 'protagonist', 'D4', e);
    }
    api.lockTask(s, 'protagonist', 'D4', id, action.requireEvidence);
  }
  for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id);
  api.commitWindow(s);
}
function sourceAt(api, seed, year, recruitmentAction = 'recruit_risk') {
  const s = api.createRun(seed);
  submit(api, s, 'build_joint');
  while (s.year < year) {
    if (s.phase === 'planning') submit(api, s, s.year === 10 ? recruitmentAction : undefined);
    api.advanceYear(s);
  }
  return s;
}
function mechanics(s) {
  return { cells: s.cells, institutions: s.institutions, events: s.events, flags: s.flags, snapshots: s.snapshots,
    actors: s.actors, promises: s.promises, committedWindows: s.committedWindows, year: s.year, phase: s.phase, drafts: s.drafts };
}
function assertPast(s, past) {
  assert.deepEqual(s.history.slice(0, past.history.length), past.history);
  for (const [year, page] of Object.entries(past.snapshots)) assert.deepEqual(s.snapshots[year], page);
}
function continuePair(api, source, target, recruitmentAction = 'recruit_risk', fullState = false) {
  const past = copy(target);
  while (source.year < 40) {
    if (source.phase === 'planning') {
      submit(api, source, source.year === 10 ? recruitmentAction : undefined);
      submit(sim, target, target.year === 10 ? recruitmentAction : undefined);
    }
    api.advanceYear(source); sim.advanceYear(target);
    assert.deepEqual(mechanics(target), mechanics(source), `annual mechanics at ${source.year}`);
    if (fullState) assert.deepEqual(target, source, `complete pre-fix state at ${source.year}`);
  }
  assertPast(target, past);
}
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

test('pre-staffing fixture is the exact published 5921f150 blob, except its JSON import path', () => {
  const bytes = Buffer.from(readFileSync(new URL('./fixtures/pre-staffing-simulation.js', import.meta.url), 'utf8').replace("'../../src/data/board.json'", "'./data/board.json'"));
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), '5921f15000d48a8392c15b3911d5fbe237565d0c');
});

test('new runs explicitly pin current staffing; independent supported tags override identity without restore stamping', () => {
  const fresh = sim.createRun(6);
  assert.equal(fresh.staffingRulesVersion, 'river-carriers-v1');
  assert.deepEqual(reload(fresh), fresh);
  for (const api of [original, coverage, before]) {
    const s = sourceAt(api, 6, 20), saved = copy(s), loaded = reload(s);
    assert.deepEqual(loaded, saved);
    assert.equal(loaded.staffingRulesVersion, undefined);
    assert.equal(sim.getStaffingRulesVersion(loaded), api === original ? 'station-only-v1' : 'river-carriers-v1');
    for (const version of ['station-only-v1', 'river-carriers-v1']) {
      loaded.staffingRulesVersion = version;
      assert.equal(sim.getStaffingRulesVersion(loaded), version);
      assert.deepEqual(reload(loaded), loaded);
    }
  }
  const legacy = original.createRun(6); legacy.crisisRulesVersion = 'legacy-v1';
  assert.equal(sim.getStaffingRulesVersion(legacy), 'station-only-v1');
  assert.match(sim.getStaffingRulesDescription(legacy), /兼容默认.*不是对曾用引擎的鉴别/);
  assert.match(sim.getStaffingRulesDescription(legacy), /不重算.*不会因此复活.*不是完整回滚/);
});

for (const year of IMPORT_YEARS) for (const seed of [6, 0]) test(`true ef841e8 ${seed === 6 ? 'archive' : 'station'} risk imported at ${year}: original yearly mechanics, preserved past`, () => {
  const source = sourceAt(original, seed, year), loaded = reload(source);
  assert.deepEqual(loaded, source);
  continuePair(original, source, loaded);
  if (seed === 6) {
    assert.equal(loaded.institutions[0].active, true);
    assert.equal(loaded.history.some(h => h.id === 'archive-unattended'), false);
  }
});

for (const [name, api] of ENGINES) for (const seed of [0, 6]) for (const choice of ['recruit_risk', 'recruit_successor']) for (const year of IMPORT_YEARS) {
  test(`newer control ${name}/${seed}/${choice}/import${year}: unchanged through40`, () => {
    const source = sourceAt(api, seed, year, choice), loaded = reload(source);
    assert.deepEqual(loaded, source);
    continuePair(api, source, loaded, choice, api === before);
  });
}

for (const seed of [0, 6]) for (const choice of ['recruit_risk', 'recruit_successor']) test(`new explicit run ${seed}/${choice}: only explicit rule versions differ from the frozen factory`, () => {
  const expected = before.createRun(seed), actual = sim.createRun(seed);
  expected.staffingRulesVersion = 'river-carriers-v1';
  expected.branchAccessRulesVersion = 'source-branch-v1';
  expected.futureCheckRulesVersion = sim.FUTURE_CHECK_RULES.version;
  expected.archiveUpgradeRulesVersion = sim.ARCHIVE_UPGRADE_RULES.version;
  expected.trainingAuthorizationRulesVersion = sim.TRAINING_AUTHORIZATION_RULES.version;
  assert.deepEqual(actual, expected);
  submit(before, expected, 'build_joint'); submit(sim, actual, 'build_joint');
  continuePair(before, expected, actual, choice, true);
});

test('original year20 archive reproduces the exact year21 science and religion regression', () => {
  const source = sourceAt(original, 6, 20), loaded = reload(source), defective = copy(source);
  submit(original, source); submit(sim, loaded); submit(before, defective);
  original.advanceYear(source); sim.advanceYear(loaded); before.advanceYear(defective);
  assert.equal(at(loaded).channels.science, 34.0841);
  assert.equal(at(loaded).channels.religion, 45.7504);
  assert.equal(at(defective).channels.science, 33.9091);
  assert.equal(at(defective).channels.religion, 45.6754);
  assert.deepEqual(mechanics(loaded), mechanics(source));
});

for (const mode of ['migrated15', 'halted20', 'old20-current21']) test(`${mode}: change only future original-identity rules, never repair the past`, () => {
  const source = sourceAt(original, 6, mode === 'old20-current21' ? 20 : 10);
  submit(before, source, source.year === 10 ? 'recruit_risk' : undefined);
  const targetYear = mode === 'migrated15' ? 15 : mode === 'halted20' ? 20 : 21;
  while (source.year < targetYear) before.advanceYear(source);
  const past = copy(source), loaded = reload(source), originalFuture = copy(source);
  assert.deepEqual(loaded, past);
  if (source.phase === 'planning') { submit(sim, loaded); submit(original, originalFuture); }
  sim.advanceYear(loaded); original.advanceYear(originalFuture);
  assert.deepEqual(mechanics(loaded), mechanics(originalFuture));
  assertPast(loaded, past);
  assert.equal(loaded.institutions[0].active, mode !== 'halted20');
  assert.equal(loaded.history.some(h => h.id === 'archive-unattended'), mode === 'halted20');
  assert.equal(loaded.staffingRulesVersion, undefined);
  assert.deepEqual(loaded.flags, originalFuture.flags);
});

test('an explicitly pinned migrated original retains the pre-fix river-carrier continuation', () => {
  const source = sourceAt(original, 6, 10);
  source.staffingRulesVersion = 'river-carriers-v1';
  continuePair(before, copy(source), reload(source), 'recruit_risk', true);
});

test('current staffing has exact source factors, while inactive and zero-maintenance carriers show no current lost output', () => {
  for (const api of [original, before]) for (const seed of [0, 6]) {
    const s = sourceAt(api, seed, 11), i = s.institutions[0];
    const limited = seed === 0 || api === before;
    assert.equal(sim.getInstitutionStaffing(s, i).sourceMultiplier, limited ? .5 : 1);
    assert.equal(sim.getInstitutionStaffing(s, i).outputReducedNow, limited);
    assert.equal(sim.getInstitutionStaffing(s, i).shutdownIfUnchangedYear, limited ? 16 : null);
    i.maintenance = 0;
    assert.equal(sim.getInstitutionStaffing(s, i).outputReducedNow, false);
    i.active = false;
    assert.equal(sim.getInstitutionStaffing(s, i).shutdownIfUnchangedYear, null);
    i.active = true; s.year = 16;
    assert.equal(sim.getInstitutionStaffing(s, i).shutdownIfUnchangedYear, null);
  }
});

for (const [name, api] of [['original', original], ['pre-fix', before]]) for (const seed of [0, 6]) for (const condition of ['inactive', 'zero upkeep']) {
  test(`${name}/${seed}/${condition}: annual continuation preserves saved downtime and upkeep`, () => {
    const source = sourceAt(api, seed, 15);
    if (condition === 'inactive') source.institutions[0].active = false;
    else source.institutions[0].maintenance = 0;
    const loaded = reload(source);
    assert.deepEqual(loaded, source);
    continuePair(api, source, loaded, 'recruit_risk', api === before);
    if (condition === 'inactive') assert.equal(loaded.institutions[0].active, false);
    else assert.equal(loaded.institutions[0].maintenance, 0);
  });
}

test('original production affects all stations, but year16 shuts only its first active station; archive is untouched', () => {
  const s = sourceAt(original, 0, 15), first = s.institutions.find(i => i.kind === 'station');
  const second = { ...copy(first), id: 'extra-station', cellId: 'B4' };
  const archive = { ...copy(first), id: 'extra-archive', kind: 'archive', cellId: 'D4' };
  s.institutions.unshift(second); s.institutions.push(archive);
  assert.equal(sim.getInstitutionStaffing(s, first).sourceMultiplier, .5);
  assert.equal(sim.getInstitutionStaffing(s, second).sourceMultiplier, .5);
  assert.equal(sim.getInstitutionStaffing(s, first).shutdownIfUnchangedYear, null);
  assert.equal(sim.getInstitutionStaffing(s, second).shutdownIfUnchangedYear, 16);
  assert.equal(sim.getInstitutionStaffing(s, archive).sourceMultiplier, 1);
  const expected = copy(s), loaded = reload(s);
  original.advanceYear(expected); sim.advanceYear(loaded);
  assert.deepEqual(mechanics(loaded), mechanics(expected));
  assert.deepEqual(loaded.history.at(-1), expected.history.at(-1));
});

for (const value of [null, '', 'unknown-v2', 1, {}, []]) test(`unknown staffing tag ${JSON.stringify(value)} rejects before restore, annual or commit writes`, () => {
  for (const api of [original, before]) for (const stage of ['passed', 'locked', 'playback']) {
    const s = sourceAt(api, 6, 10);
    if (stage === 'playback') submit(api, s, 'recruit_risk');
    else if (stage === 'locked') api.lockTask(s, 'protagonist', 'D4', 'recruit_risk');
    else api.passTask(s, 'protagonist');
    s.staffingRulesVersion = value;
    const snapshot = copy(s);
    assert.equal(sim.validateState(s).valid, false);
    assert.throws(() => reload(s), /人手结算规则版本非法/);
    if (stage === 'playback') assert.throws(() => sim.advanceYear(s), /人手结算规则版本非法/);
    else { assert.equal(sim.getWindowReview(s).ready, false); assert.throws(() => sim.commitWindow(s), /人手结算规则版本非法/); }
    assert.deepEqual(s, snapshot);
  }
});

test('staffing display and contract helpers are read-only, detached, conditional, and keep real archive roles', () => {
  for (const api of [original, before]) {
    const s = sourceAt(api, 6, 10), saved = copy(s), i = s.institutions[0];
    const projected = sim.getInstitutionStaffing(s, i, { assumedRecruitmentActionId: 'recruit_risk' });
    assert.equal(projected.outputReducedNow, false);
    assert.equal(projected.sourceMultiplier, api === original ? 1 : .5);
    assert.equal(sim.getInstitutionStaffing(s, i).sourceMultiplier, 1);
    assert.equal(sim.getRecruitmentRoles(s)[0].id, i.id);
    sim.lockTask(s, 'protagonist', 'D4', 'recruit_risk');
    const locked = copy(s); freeze(s);
    const action = sim.getActions(s, 'D4').find(a => a.id === 'recruit_risk');
    const review = sim.getWindowReview(s);
    assert.equal(action.staffingNote, review.tasks[0].a.staffingNote);
    assert.match(action.staffingNote, /尚未兑现.*真实离岗/);
    if (api === original) assert.match(action.risk, /档案站不因此减产或在第16年停运/);
    const sourceAction = api.getActions(saved, 'D4').find(a => a.id === 'recruit_risk');
    for (const key of ['id', 'title', 'description', 'cost', 'probability', 'dueIn', 'requireEvidence', 'reward']) assert.deepEqual(action[key], sourceAction[key]);
    const result = sim.getInstitutionStaffing(s, s.institutions[0]); result.sourceMultiplier = 99;
    assert.notEqual(sim.getInstitutionStaffing(s, s.institutions[0]).sourceMultiplier, 99);
    sim.getStaffingRulesDescription(s);
    assert.deepEqual(s, locked);
  }
});

test('staffing helpers do not consult seeds or hidden random rolls to infer people or a producer', () => {
  for (const api of [original, before]) {
    const s = sourceAt(api, 6, 11), i = s.institutions[0];
    Object.defineProperty(s, 'seed', { get() { throw new Error('seed must not be read'); } });
    for (const e of s.events) Object.defineProperty(e, 'roll', { get() { throw new Error('hidden roll must not be read'); } });
    assert.doesNotThrow(() => sim.getStaffingRulesVersion(s));
    assert.doesNotThrow(() => sim.getStaffingRulesDescription(s));
    assert.doesNotThrow(() => sim.getInstitutionStaffing(s, i));
    assert.doesNotThrow(() => sim.getInstitutionStaffing(s, i, { assumedRecruitmentActionId: 'recruit_risk' }));
  }
});

test('old no-job successor contract remains available but its note cannot invent a filled position', () => {
  const s = original.createRun(6); submit(original, s); original.advanceToNextWindow(s);
  const action = sim.getActions(s, 'D4').find(a => a.id === 'recruit_successor');
  assert.ok(action);
  assert.match(action.staffingNote, /当前没有可交接的河港岗位.*原继任合同保留.*不能据此补写/);
  assert.deepEqual(action.cost, { economy: 5, science: 2 });
  assert.deepEqual(sim.getRecruitmentRoles(s), []);
});

test('minimal display states without flags conservatively show no staffing loss without weakening save validation', () => {
  const institution = { id: 'display-only', kind: 'station', cellId: 'D4', active: true, maintenance: 1 };
  for (const crisisRulesVersion of [undefined, 'coverage-v1']) {
    const display = { year: 11, institutions: [institution], crisisRulesVersion };
    assert.equal(sim.getInstitutionStaffing(display, institution).sourceMultiplier, 1);
    assert.equal(sim.getInstitutionStaffing(display, institution).outputReducedNow, false);
    assert.equal(sim.getInstitutionStaffing(display, institution).shutdownIfUnchangedYear, null);
  }
  const invalid = sim.createRun(); delete invalid.flags;
  assert.equal(sim.validateState(invalid).valid, false);
  assert.throws(() => reload(invalid), /存档/);
});

test('explicit original staffing leaves the genuine pending recruitment text and IDs untouched on resolution', () => {
  const source = sourceAt(original, 6, 10); submit(original, source, 'recruit_risk');
  source.staffingRulesVersion = 'station-only-v1';
  const loaded = reload(source);
  original.advanceYear(source); sim.advanceYear(loaded);
  assert.deepEqual(loaded.events, source.events);
  assert.deepEqual(loaded.history, source.history);
  assert.match(loaded.history.at(-1).text, /产出减半，第16年将停运/);
  assert.equal(sim.getInstitutionStaffing(loaded, loaded.institutions[0]).sourceMultiplier, 1);
});
