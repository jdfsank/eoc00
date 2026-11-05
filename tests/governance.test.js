import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COVERAGE_RULES, FLOOD_REGIONS, EVIDENCE, createRun, getActors, lockTask,
  passTask, commitWindow, advanceYear, advanceToNextWindow, getWarningCoverage,
  getEnding, randomFor, validateState,
} from '../src/simulation.js';
import { restoreSave } from '../src/save.js';

const evidence = Object.keys(EVIDENCE);
const rounded = n => Math.round(n * 10000) / 10000;
function seedFor(kind, success = true) {
  const threshold = { merchant: .85, state: .8, joint: .7 }[kind];
  for (let seed = 0; seed < 1000; seed++) {
    if ((randomFor(seed, `event:action:0:protagonist:D4:build_${kind}`) < threshold) === success) return seed;
  }
  throw new Error('No matching deterministic seed');
}
function submit(s, action, location = 'D4', actor = 'protagonist') {
  if (action) lockTask(s, actor, location, action, evidence);
  for (const a of getActors(s)) if (!s.drafts[a.id]) passTask(s, a.id);
  commitWindow(s);
}
function decade(s, action, location = 'D4') {
  submit(s, action, location); advanceToNextWindow(s); return s;
}
function built(kind = 'joint', success = true) {
  return decade(createRun(seedFor(kind, success)), `build_${kind}`);
}
function noBuildAt20() { return decade(decade(createRun())); }
function toImpact(s, action, location = 'D4') {
  submit(s, action, location); while (s.year < 23) advanceYear(s); return s;
}
function assertValid(s) { assert.deepEqual(validateState(s), { valid: true, errors: [] }); }

test('public, paid and local teaching coverage come from actual current providers', () => {
  const merchant = built('merchant'), state = built('state'), joint = built('joint');
  assert.equal(getWarningCoverage(merchant).D4.coverage, COVERAGE_RULES.paidAccess);
  for (const s of [state, joint]) assert.equal(getWarningCoverage(s).D4.coverage, 1);
  for (const s of [merchant, state, joint]) {
    assert.equal(getWarningCoverage(s).E4.coverage, COVERAGE_RULES.localTeaching);
    assert.equal(getWarningCoverage(s).F6.coverage, 0);
    assert.equal(getWarningCoverage(s).A1.coverage, 0);
    assertValid(s);
  }
});

test('merchant public renewal opens D4 without silently changing the branch contract', () => {
  const s = built('merchant'); decade(s, 'renew_charter');
  const service = getWarningCoverage(s);
  assert.equal(service.D4.coverage, 1);
  assert.equal(service.D4.providers[0].open, true);
  assert.equal(service.F6.coverage, COVERAGE_RULES.paidAccess);
  assert.equal(service.F6.providers[0].governance, 'merchant');
});

test('maintenance and staffing scale service; halted and zero-maintenance carriers provide none', () => {
  const s = built('joint'); submit(s, 'recruit_risk'); advanceYear(s);
  assert.equal(getWarningCoverage(s).D4.coverage, .5);
  assert.equal(getWarningCoverage(s).D4.protection, .075);
  advanceToNextWindow(s);
  assert.equal(getWarningCoverage(s).D4.coverage, 0);
  assert.equal(getWarningCoverage(s).D4.protection, 0);
  // A direct boundary probe of a valid institution field, not a new authored path.
  const branch = s.institutions.find(i => i.kind === 'branch');
  branch.maintenance = 0;
  assert.equal(getWarningCoverage(s).F6.coverage, 0);
  assert.equal(getWarningCoverage(s).F6.protection, 0);
  assertValid(s);
  const lapsed = built('state'); decade(lapsed);
  assert.equal(getWarningCoverage(lapsed).D4.coverage, rounded(.45 * .7));
  assert.equal(getWarningCoverage(lapsed).D4.protection, .07);
});

test('branch retains its successful source provenance after D4 shuts down', () => {
  const s = built('joint'); decade(s, 'recruit_risk');
  const service = getWarningCoverage(s);
  assert.equal(service.D4.providers.length, 0);
  assert.equal(service.F6.coverage, 1);
  assert.equal(service.F6.protection, COVERAGE_RULES.jointRecords);
  assert.equal(service.F6.providers[0].governance, 'joint');
});

test('failed build then local reconstruction does not inherit unsuccessful governance protection', () => {
  for (const kind of ['merchant', 'state', 'joint']) {
    const s = built(kind, false);
    assert.equal(getWarningCoverage(s).D4.coverage, 0);
    decade(s, 'restore_archive');
    const service = getWarningCoverage(s).D4;
    assert.equal(s.flags.governance, kind);
    assert.equal(service.protection, 0);
    assert.equal(service.providers[0].governance, 'local');
    assert.equal(s.institutions.some(i => i.kind === 'branch'), false);
    assertValid(s);
  }
});

test('joint protection requires original independent evidence, not the governance flag alone', () => {
  const s = built('joint');
  assert.equal(getWarningCoverage(s).D4.protection, COVERAGE_RULES.jointRecords);
  const oldSave = structuredClone(s);
  delete oldSave.history.find(e => e.kind === 'action').evidence;
  assertValid(oldSave);
  assert.equal(getWarningCoverage(oldSave).D4.protection, 0);
  const state = built('state');
  assert.equal(getWarningCoverage(state).D4.protection, COVERAGE_RULES.stateCoordination);
});

test('three successful governance paths yield distinct, formula-exact crisis harm', () => {
  const results = {};
  for (const kind of ['merchant', 'state', 'joint']) {
    const s = built(kind); decade(s); toImpact(s);
    const crisis = s.flags.crisis;
    assert.equal(crisis.model, COVERAGE_RULES.version);
    for (const id of FLOOD_REGIONS) {
      assert.equal(crisis.damageByCell[id], rounded((1 - .35 * crisis.coverageByCell[id]) * (1 - crisis.protectionByCell[id])));
    }
    assert.equal(crisis.damage, rounded(FLOOD_REGIONS.reduce((sum, id) => sum + crisis.damageByCell[id], 0) / 4));
    results[kind] = crisis.damage;
    assertValid(s);
  }
  assert.ok(results.joint < results.state);
  assert.ok(results.state < results.merchant);
});

test('south-bank aid reduces only D5 direct crisis loss and must have an active carrier', () => {
  const control = noBuildAt20(); toImpact(control);
  const aided = createRun(); decade(aided); decade(aided, 'mutual_aid', 'D5');
  const halted = structuredClone(aided);
  halted.institutions.find(i => i.kind === 'mutual').active = false;
  toImpact(aided); toImpact(halted);
  assert.equal(aided.flags.crisis.damageByCell.D5, .7);
  for (const id of ['D4', 'E4', 'F6']) assert.equal(aided.flags.crisis.damageByCell[id], control.flags.crisis.damageByCell[id]);
  assert.deepEqual(halted.flags.crisis.damageByCell, control.flags.crisis.damageByCell);
});

test('independent review still averts all modeled harm and veto retains strong mitigation', () => {
  for (const [action, expected, status] of [['independent_review', 0, 'averted'], ['local_veto', .3, 'contained']]) {
    const s = noBuildAt20(); toImpact(s, action, 'B4');
    assert.equal(s.flags.crisis.status, status);
    for (const id of FLOOD_REGIONS) assert.equal(s.flags.crisis.damageByCell[id], expected);
    assertValid(s);
  }
});

test('free warning repairs stopped station staffing and opens only D4 service', () => {
  const s = built('merchant'); decade(s, 'recruit_risk');
  assert.equal(getWarningCoverage(s).D4.coverage, 0);
  const beforeBranch = structuredClone(getWarningCoverage(s).F6);
  submit(s, 'free_warning'); advanceYear(s);
  assert.equal(s.flags.successor, true);
  assert.equal(getWarningCoverage(s).D4.coverage, 1);
  assert.deepEqual(getWarningCoverage(s).F6, beforeBranch);
  assert.equal(s.institutions.some(i => i.kind === 'warning'), false);
  assertValid(s);
});

test('no-build free warning creates a real community institution and survives reload through year40', () => {
  const s = noBuildAt20(); submit(s, 'free_warning'); advanceYear(s);
  assert.equal(s.institutions.filter(i => i.kind === 'warning').length, 1);
  assert.equal(s.institutions.some(i => ['station', 'training', 'branch'].includes(i.kind)), false);
  assert.equal(getWarningCoverage(s).D4.coverage, COVERAGE_RULES.communityWarning);
  const reloaded = restoreSave(JSON.parse(JSON.stringify({ state: s }))).state;
  advanceToNextWindow(s); advanceToNextWindow(reloaded);
  decade(s, 'withdraw'); decade(reloaded, 'withdraw');
  assert.deepEqual(reloaded, s);
  assert.equal(s.year, 40);
  assertValid(s);
  assert.equal(getEnding(s).metrics.warningCoverage, rounded(.65 / 4));
  assert.equal(s.flags.crisis.damageByCell.D4, rounded(1 - .35 * .65));
});

test('impact details remain frozen while later schools change present ending coverage', () => {
  const s = noBuildAt20(); toImpact(s);
  const impact = structuredClone(s.flags.crisis);
  advanceToNextWindow(s); decade(s, 'train_network', 'E4');
  assert.deepEqual(s.flags.crisis, impact);
  assert.equal(getWarningCoverage(s).E4.coverage, .55);
  assert.equal(s.flags.crisis.coverageByCell.E4, 0);
  assert.equal(getEnding(s).metrics.crisisDamage, 1);
  assert.match(getEnding(s).paragraphs.join(''), /不会随后来的复苏或新制度改写/);
});

test('legacy post-impact saves retain absent detail rather than inventing past coverage', () => {
  const s = noBuildAt20(); toImpact(s);
  for (const key of ['model', 'coverageByCell', 'protectionByCell', 'damageByCell']) delete s.flags.crisis[key];
  const legacy = restoreSave(JSON.parse(JSON.stringify({ state: s }))).state;
  const crisis = structuredClone(legacy.flags.crisis);
  advanceToNextWindow(legacy); decade(legacy, 'train_network', 'E4');
  assert.deepEqual(legacy.flags.crisis, crisis);
  assert.match(getEnding(legacy).paragraphs.join(''), /旧版存档.*没有逐地覆盖与损失明细/);
  assertValid(legacy);
});

test('new crisis details and annual state are deterministic under reverse traversal and reload', () => {
  const a = built('joint'); decade(a, 'recruit_successor');
  lockTask(a, 'linche', 'D5', 'mutual_aid', evidence); submit(a, 'free_warning');
  const b = restoreSave(JSON.parse(JSON.stringify({ state: a }))).state;
  b.cells.reverse();
  while (a.year < 30) { advanceYear(a); advanceYear(b, { reverse: true }); }
  b.cells.sort((x, y) => x.row - y.row || x.col - y.col);
  const canonicalCells = s => s.cells.map(c => [c.id, c.channels]).sort((x, y) => x[0].localeCompare(y[0]));
  assert.deepEqual(canonicalCells(a), canonicalCells(b));
  assert.deepEqual(a.flags.crisis, b.flags.crisis);
  assert.deepEqual(a.history, b.history);
  assertValid(a); assertValid(b);
});

test('malformed new impact fields fail import and annual validation before any mutation', () => {
  const s = noBuildAt20(); toImpact(s);
  const corruptions = [
    candidate => { candidate.flags.crisis.model = 'unknown-future-model'; },
    candidate => { candidate.flags.crisis.affectedCells = ['D4', 'D4', 'D5', 'F6']; },
    candidate => { candidate.flags.crisis.coverageByCell = {}; },
    candidate => { candidate.flags.crisis.damageByCell.D4 = NaN; },
    candidate => { candidate.flags.crisis.protectionByCell.E4 = 1.01; },
    candidate => { candidate.flags.crisis.damageByCell.A1 = 0; },
    candidate => { candidate.institutions.push({ id: 'bad-warning', kind: 'warning' }); },
  ];
  for (const corrupt of corruptions) {
    const candidate = structuredClone(s); corrupt(candidate);
    const before = structuredClone(candidate);
    assert.equal(validateState(candidate).valid, false);
    assert.throws(() => restoreSave({ state: candidate }), /存档/);
    assert.throws(() => advanceYear(candidate), /年度结算未开始/);
    assert.deepEqual(candidate, before);
  }
});
