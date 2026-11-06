import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as prior from './fixtures/pre-training-authorization-simulation.js';
import {getTrainingChoiceComparison} from '../src/training-choice-comparison.js';
import {renderTrainingChoiceComparison} from '../src/training-choice-comparison-view.js';
import {investigateAndLock as lock} from './helpers/play.js';

const copy = structuredClone;
function choose(s, actor, cell, id, api = sim) {
  const action = api.getActions(s, cell, actor).find(item => item.id === id);
  for (const evidence of action.requireEvidence) api.investigate(s, actor, cell, evidence);
  api.lockTask(s, actor, cell, id);
}
function next(s, api = sim) {
  for (const actor of api.getActors(s)) if (!s.drafts[actor.id]) api.passTask(s, actor.id);
  api.commitWindow(s); api.advanceToNextWindow(s); return s;
}
function ready({api = sim, seed = 0, build = 'build_joint', review = true, warning = true, school = false, refused = false} = {}) {
  const s = api.createRun(seed); choose(s, 'protagonist', 'D4', build, api); next(s, api);
  choose(s, 'protagonist', 'D4', 'recruit_successor', api); next(s, api);
  if (refused) {
    choose(s, 'protagonist', 'D4', 'relocate_teacher', api);
    if (review) choose(s, 'linche', 'B4', 'independent_review', api);
  } else {
    if (school) choose(s, 'protagonist', 'E4', 'train_network', api);
    else if (review) choose(s, 'protagonist', 'B4', 'independent_review', api);
    if (warning) choose(s, 'linche', 'D4', 'free_warning', api);
  }
  return next(s, api);
}
const view = s => getTrainingChoiceComparison(s, 'E4', 'linche');
const option = (s, id) => view(s).options.find(item => item.actionId === id);
const original = s => s.institutions.find(item => item.cellId === 'E4' && item.kind === 'training');
function freeze(value) { if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value);} return value; }
function refs(value, seen = new Set()) { if (value && typeof value === 'object' && !seen.has(value)) {seen.add(value); Object.values(value).forEach(item => refs(item, seen));} return seen; }

test('source export shares the actual creation rule without exposing a mutable source', () => {
  assert.deepEqual(sim.getInstitutionAnnualSource('school'), {politics:.1,economy:.25,science:.65,religion:.2});
  for (const id of ['missing', '__proto__', 'constructor', null, undefined]) assert.equal(sim.getInstitutionAnnualSource(id), null);
  const returned = sim.getInstitutionAnnualSource('school'); returned.economy = 900;
  assert.equal(sim.getInstitutionAnnualSource('school').economy, .25);
});

test('two real contracts disclose distinct cost, evidence, recipient and annual source', () => {
  const s = ready(), comparison = view(s), [authorization, training] = comparison.options;
  assert.equal(comparison.readOnly, true);
  assert.deepEqual(authorization.cost, {politics:3,economy:2});
  assert.deepEqual(training.cost, {economy:4,science:2});
  assert.equal(authorization.investigationRounds, 1); assert.equal(training.investigationRounds, 0);
  assert.deepEqual(authorization.requiredEvidence, [{id:'resident_testimony',title:'听取原学徒的承接条件',rounds:1,local:true}]);
  assert.equal(authorization.target.id, original(s).id); assert.equal(training.target, null);
  assert.deepEqual(authorization.annualSourceAdded, {politics:0,economy:0,science:0,religion:0});
  assert.deepEqual(training.annualSourceAdded, sim.getInstitutionAnnualSource('school'));
  assert.equal(authorization.newInstitutions, 0); assert.equal(training.newInstitutions, 1);
  assert.equal(authorization.dueYear, 31); assert.equal(training.dueYear, 31);
  assert.deepEqual(comparison.current.authorizedCells, []); assert.deepEqual(comparison.conditional.authorizedCells, ['E4']);
  assert.equal(comparison.conditional.addedStaffRegions, 0); assert.equal(comparison.conditional.addedAuthorizedRegions, 1);
  assert.equal(comparison.current.canShare, false); assert.equal(comparison.conditional.canShare, true);
});

for (const actor of ['protagonist', 'linche']) for (const action of ['authorize_training', 'train_network']) test(`${actor} ${action}: conditional facts equal real year31 settlement`, () => {
  const s = ready(), comparison = getTrainingChoiceComparison(s, 'E4', actor), row = comparison.options.find(item => item.actionId === action);
  const before = copy(s.institutions), crisis = copy(s.flags.crisis);
  lock(s, actor, 'E4', action);
  for (const other of sim.getActors(s)) if (!s.drafts[other.id]) sim.passTask(s, other.id);
  sim.commitWindow(s); sim.advanceYear(s);
  const actual = sim.getHandoffReadiness(s);
  for (const key of ['staffCells','authorizedCells','checkCells','canShare','canWithdraw']) assert.deepEqual(actual[key], comparison.conditional[key], key);
  assert.equal(sim.getWarningCoverage(s).E4.coverage, row.coverage.ifFulfilled);
  assert.equal(s.institutions.length - before.length, row.newInstitutions);
  if (action === 'train_network') assert.deepEqual(s.institutions.find(item => item.sourceActionId.endsWith(':train_network')).annualSource, row.annualSourceAdded);
  else for (const [index, institution] of s.institutions.entries()) {const detached = copy(institution); delete detached.localHandoffAuthorization; assert.deepEqual(detached, before[index]);}
  assert.deepEqual(s.flags.crisis, crisis); assert.equal(sim.validateState(s).valid, true);
});

test('current maintenance controls coverage: a new school fills a gap, mandates do not', () => {
  for (const maintenance of [.1, .5, 1]) {
    const s = ready(); original(s).maintenance = maintenance;
    const [authorization, training] = view(s).options;
    assert.equal(authorization.coverage.current, Math.round(.55 * maintenance * 1e4) / 1e4);
    assert.equal(authorization.coverage.ifFulfilled, authorization.coverage.current);
    assert.equal(training.coverage.ifFulfilled, .55);
    assert.equal(training.coverage.increase, Math.round((.55 - authorization.coverage.current) * 1e4) / 1e4);
    for (const row of [authorization, training]) {
      const real = copy(s); lock(real, 'linche', 'E4', row.actionId); sim.passTask(real, 'protagonist'); sim.commitWindow(real); sim.advanceYear(real);
      assert.equal(sim.getWarningCoverage(real).E4.coverage, row.coverage.ifFulfilled);
    }
  }
});

test('lack of checks, lack of cooperation and recorded refusal remain separate', () => {
  const noCheck = view(ready({review:false}));
  assert.equal(noCheck.conditional.canWithdraw, false); assert.equal(noCheck.conditional.canShare, false);
  assert.match(noCheck.conditional.missing.join(''), /异源校验/);
  const uncommitted = view(ready({warning:false}));
  assert.equal(uncommitted.current.trustStatus, 'uncommitted'); assert.equal(uncommitted.conditional.canWithdraw, true); assert.equal(uncommitted.conditional.canShare, false);
  assert.match(uncommitted.conditional.shareMissing.join(''), /尚未作出/);
  const refused = view(ready({refused:true}));
  assert.equal(refused.current.trustStatus, 'refused'); assert.equal(refused.conditional.canShare, false);
  assert.match(refused.conditional.shareMissing.join(''), /明确拒绝/);
});

test('natural failed review is not promoted to a successful cross-place check', () => {
  const s = ready({seed:2,build:'build_merchant'});
  assert.equal(s.events.find(event => event.actionId === 'independent_review').status, 'failed');
  assert.deepEqual(view(s).conditional.checkCells, []); assert.equal(view(s).conditional.canShare, false);
});

test('scope excludes other windows, scenes, actors, completed stages and old producer contracts', () => {
  const s = ready();
  for (const cell of ['D4','D5','B4','F6','A1']) assert.equal(getTrainingChoiceComparison(s, cell, 'linche'), null);
  for (const actor of ['unknown', '']) assert.equal(getTrainingChoiceComparison(s, 'E4', actor), null);
  for (const year of [0,10,20,31,40]) {const t = copy(s); t.year = year; assert.equal(view(t), null);}
  for (const phase of ['playback','ended']) {const t = copy(s); t.phase = phase; assert.equal(view(t), null);}
  assert.equal(view(ready({api:prior})), null); assert.equal(view(ready({school:true})), null);
  const failed = ready({build:'build_merchant',seed:0}); assert.equal(original(failed), undefined); assert.equal(view(failed), null);
  assert.equal(getTrainingChoiceComparison(null, 'E4'), null);
});

test('inactive, empty, duplicate or broken original sources do not get a comparative offer', () => {
  for (const change of [s=>original(s).active=false,s=>original(s).maintenance=0,s=>s.institutions.push(copy(original(s))),s=>original(s).sourceEventId='unknown',s=>s.institutions=s.institutions.filter(item=>item!==original(s))]) {
    const s = ready(); change(s); assert.equal(view(s), null);
  }
});

test('local affordability is disclosed independently from evidence and whole-window readiness', () => {
  for (const [balances, expected] of [[{economy:2,science:2,politics:3},[true,false]],[{economy:4,science:1,politics:3},[true,false]],[{economy:4,science:2,politics:2},[false,true]]]) {
    const s = ready(); Object.assign(s.cells.find(cell=>cell.id==='E4').channels, balances);
    assert.deepEqual(view(s).options.map(row=>row.affordable), expected);
  }
});

test('frozen state, detached output and locked evidence retain exact bytes', () => {
  const s = ready(); lock(s, 'linche', 'E4', 'authorize_training'); lock(s, 'protagonist', 'D4', 'share_power');
  const before = JSON.stringify(s), input = freeze(copy(s)), expected = view(s), comparison = view(input), references = refs(input);
  assert.deepEqual(comparison, expected); for (const ref of refs(comparison)) assert.equal(references.has(ref), false);
  comparison.options[0].cost.politics=999; comparison.options[0].target.id='fake'; comparison.conditional.authorizedCells.push('F6');
  assert.deepEqual(view(s), expected); assert.equal(JSON.stringify(s), before);
  sim.investigate(s, 'linche', 'E4', 'old_reality_record'); const locked = copy(s.drafts);
  view(s); assert.deepEqual(s.drafts, locked); assert.deepEqual(s.drafts.linche.evidence, ['resident_testimony']);
});

test('seed, draws, future snapshots, draft plans, investigation sessions and unread prose are not read', () => {
  const s = ready(), expected = view(s);
  const denied = (object, key) => Object.defineProperty(object, key, {get(){throw Error(`private ${key}`);},configurable:true});
  for (const key of ['seed','baseline','snapshots','investigations','drafts']) denied(s,key);
  for (const row of [...s.events,...s.history]) for (const key of ['roll','probability','text','description','title']) denied(row,key);
  assert.deepEqual(view(s), expected);
});

test('comparison lists the contract minimum, never an acquired or refunded investigation round', () => {
  const s = ready(), expected = view(s);
  sim.investigate(s, 'linche', 'E4', 'anomaly_records'); sim.investigate(s, 'linche', 'E4', 'old_reality_record');
  assert.equal(sim.getInvestigation(s, 'linche', 'E4').budget, 0);
  assert.deepEqual(view(s), expected);
  assert.throws(()=>sim.investigate(s,'linche','E4','resident_testimony'),/不足/);
});

test('compact renderer has native disclosure and no mutating controls or unescaped source data', () => {
  const comparison = view(ready()), html = renderTrainingChoiceComparison(comparison);
  assert.match(html, /^<details class="training-choice-comparison"/); assert.doesNotMatch(html, /<details[^>]*\sopen(?:\s|>)/);
  assert.match(html, /原学徒：政治3 · 经济2/); assert.match(html, /新培训：经济4 · 科学2/);
  assert.match(html, /data-training-choice="authorize_training"/); assert.match(html, /data-training-choice="train_network"/);
  assert.match(html, /年度来源不是未来通道净增/); assert.match(html, /最后一次介入/); assert.match(html, /方针仍须另行安排/);
  assert.doesNotMatch(html, /<button|data-action=|<input|<form/);
  comparison.title = '<img src=x onerror=alert(1)>'; comparison.options[0].title = '<script>boom</script>';
  const hostile = renderTrainingChoiceComparison(comparison); assert.doesNotMatch(hostile, /<img|<script/); assert.match(hostile, /&lt;img/);
  assert.equal(renderTrainingChoiceComparison(null), ''); assert.equal(renderTrainingChoiceComparison({}), '');
});
