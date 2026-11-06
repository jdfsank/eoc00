import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as prior from './fixtures/pre-decision-flow-producer/simulation.js';
import * as legacy from './fixtures/pre-tradeoffs-simulation.js';
import {getInvestigationComparison} from '../src/investigation-comparison.js';
import {renderInvestigationComparison} from '../src/investigation-comparison-view.js';
import {getComparisonGuidance, renderComparisonGuidance} from '../src/comparison-guidance.js';

const copy = structuredClone;
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function choose(kernel, state, actor, cell, id) {
  const action = kernel.getActions(state, cell, actor).find(action => action.id === id);
  assert.ok(action, id);
  if (kernel.usesTradeoffs?.(state)) for (const evidence of action.requireEvidence) kernel.investigate(state, actor, cell, evidence);
  kernel.lockTask(state, actor, cell, id, action.requireEvidence);
}
function decade(kernel, state) {
  for (const actor of kernel.getActors(state)) if (!state.drafts[actor.id]) kernel.passTask(state, actor.id);
  kernel.commitWindow(state); kernel.advanceToNextWindow(state);
}
function route(kernel = sim, build = false) {
  const state = kernel.createRun(0);
  if (build) choose(kernel, state, 'protagonist', 'D4', 'build_joint');
  decade(kernel, state);
  const actions = kernel.getActions(state, 'D4', 'protagonist');
  const recruit = ['recruit_successor', 'recruit_volunteer', 'recruit_risk'].find(id => actions.some(action => action.id === id));
  choose(kernel, state, 'protagonist', 'D4', recruit);
  decade(kernel, state); return state;
}
const panel = view => renderComparisonGuidance(getComparisonGuidance(view)) + renderInvestigationComparison(view);

test('actual pending B4/F6 comparisons name only the other actor before any investigation or own lock', () => {
  const state = route(), before = JSON.stringify(state);
  for (const cell of ['B4', 'F6']) for (const actorId of ['protagonist', 'linche']) {
    const view = getInvestigationComparison(state, cell, actorId), original = JSON.stringify(view);
    const guidance = getComparisonGuidance(freeze(view)), html = renderComparisonGuidance(guidance);
    assert.deepEqual(guidance.missingActors.map(actor => actor.actorId), [actorId === 'protagonist' ? 'linche' : 'protagonist']);
    assert.match(html, new RegExp(`${guidance.actorName}不必先取证或锁定`));
    assert.match(html, /当前无整轮数值不等于零损失/);
    assert.equal(JSON.stringify(view), original);
    assert.ok(view.options.every(option => !option.ready && option.outlook === null));
  }
  assert.equal(JSON.stringify(state), before);
});

test('the only added control is the existing arrangement navigation, never a world action', () => {
  const html = renderComparisonGuidance(getComparisonGuidance(getInvestigationComparison(route(), 'B4')));
  assert.deepEqual([...html.matchAll(/data-action="([^"]+)"/g)].map(match => match[1]), ['window']);
  assert.match(html, /前往本轮安排/);
  assert.doesNotMatch(html, /data-actor=|data-id=|data-cell=|data-action="(?:pass|lock|commit|evidence)"/);
});

test('actual lock or explicit pass removes guidance while existing comparisons and exact numbers remain unchanged', () => {
  for (const build of [false, true]) for (const assigned of ['passed', 'locked']) {
    const state = route(sim, build);
    if (assigned === 'passed') sim.passTask(state, 'linche'); else choose(sim, state, 'linche', 'D4', 'free_warning');
    const before = JSON.stringify(state), view = getInvestigationComparison(state, 'B4'), original = JSON.stringify(view), html = renderInvestigationComparison(view);
    assert.equal(getComparisonGuidance(view), null);
    assert.equal(panel(view), html);
    assert.equal(JSON.stringify(view), original);
    assert.equal(JSON.stringify(state), before);
    assert.ok(view.options.every(option => option.ready));
    const review = view.options[0];
    assert.equal(review.probability, build ? 1 : .55);
    if (!build && assigned === 'locked') assert.deepEqual(view.options.map(option => option.outlook.fallback.damage), [.9431, .1886, .283]);
  }
});

test('own locked draft does not replace the real missing other actor or consume more research', () => {
  const state = route(); sim.lockTask(state, 'protagonist', 'B4', 'local_veto');
  const before = JSON.stringify(state), guidance = getComparisonGuidance(getInvestigationComparison(state, 'B4'));
  assert.deepEqual(guidance.missingActors, [{actorId:'linche', actorName:'林澈'}]);
  assert.equal(JSON.stringify(state), before);
});

test('cost and research shortfalls remain complete original blockers alongside a real missing actor', () => {
  const state = route(); sim.investigate(state, 'protagonist', 'D4', 'anomaly_records');
  sim.investigate(state, 'protagonist', 'D4', 'old_reality_record');
  state.cells.find(cell => cell.id === 'B4').channels.politics = 0;
  const view = getInvestigationComparison(state, 'B4'), original = renderInvestigationComparison(view), html = panel(view);
  assert.ok(getComparisonGuidance(view));
  assert.ok(html.endsWith(original));
  assert.match(html, /政治能力不足/);
  assert.match(html, /尚需2轮调查，当前只余0轮/);
  assert.match(html, /请先为全部棋子锁定任务或明确放弃/);
  assert.ok(view.options.every(option => !option.ready && option.outlook === null));
});

test('acquired optional evidence retains a truthful missing-role guide without offering basic veto again', () => {
  const state = route(); sim.investigate(state, 'protagonist', 'B4', 'evacuation_routes');
  const view = getInvestigationComparison(state, 'B4');
  assert.equal(view.options[2].available, false);
  assert.ok(getComparisonGuidance(view));
  assert.match(panel(view), /本项当前不可采用/);
  assert.equal(view.options[2].outlook, null);
});

test('same-cell conflict is not mislabeled as a missing role and its original blocker survives', () => {
  const state = route(); sim.lockTask(state, 'linche', 'B4', 'local_veto');
  const view = getInvestigationComparison(state, 'B4');
  assert.equal(getComparisonGuidance(view), null);
  assert.match(panel(view), /同格任务冲突/);
  assert.ok(view.options.every(option => !option.ready));
});

test('unavailable or malformed drafts and public state get no precise missing-role instruction', () => {
  const mutations = [
    state => { state.drafts.linche = {actorId:'linche', window:20, status:'unknown'}; },
    state => { sim.lockTask(state, 'linche', 'F6', 'local_veto'); state.drafts.linche.actionId = 'unknown'; },
    state => { state.investigations = null; },
    state => { state.actors.push({...state.actors[0]}); },
    state => { state.cells[0].channels.science = NaN; },
    state => { state.drafts.protagonist = {actorId:'protagonist', window:20, status:'locked', cellId:'B4', actionId:'unknown', evidence:[]}; state.drafts.protagonist.actorId = 'wrong'; },
  ];
  for (const mutate of mutations) {
    const state = route(); mutate(state);
    const view = getInvestigationComparison(state, 'B4'), original = renderInvestigationComparison(view);
    assert.equal(getComparisonGuidance(view), null);
    assert.equal(panel(view), original);
  }
});

test('genuine supported historic producer retains guidance without a migration', () => {
  const state = route(prior), before = JSON.stringify(state), view = getInvestigationComparison(state, 'B4');
  assert.ok(getComparisonGuidance(view));
  assert.equal(JSON.stringify(state), before);
});

test('genuine old per-scene producer keeps its original path and never receives guidance', () => {
  const state = route(legacy), before = JSON.stringify(state);
  assert.equal(sim.usesTradeoffs(state), false);
  assert.equal(getInvestigationComparison(state, 'B4'), null);
  assert.equal(getComparisonGuidance(null), null);
  assert.equal(renderComparisonGuidance(null), '');
  assert.equal(JSON.stringify(state), before);
});

test('out-of-scope real states and unknown future comparison shapes return no guidance', () => {
  assert.equal(getComparisonGuidance(getInvestigationComparison(sim.createRun(0), 'B4')), null);
  const view = getInvestigationComparison(route(), 'B4');
  const mutations = [value => {value.budget = null;}, value => {value.issues = ['公开条件未知'];}, value => {value.options = [];},
    value => {value.retained[0].status = 'unknown';}, value => {value.retained.push(copy(value.retained[0]));},
    value => {value.options[0].ready = true;}, value => {value.options[0].outlook = {};}, value => {value.options[0].id = 'future_action';},
    value => {value.options[0].actionId = 'unknown';}, value => {value.options[0].dueYear = null;},
    value => {value.options[0].probability = NaN;}, value => {value.options[0].probability = 1.1;}];
  for (const mutate of mutations) { const changed = copy(view); mutate(changed); assert.equal(getComparisonGuidance(changed), null); }
  assert.equal(getComparisonGuidance({get hypothetical(){throw new Error('unavailable');}}), null);
});

test('guidance has no return aliases and renderer escapes names rather than creating controls', () => {
  const view = getInvestigationComparison(route(), 'B4'), before = JSON.stringify(view), guidance = getComparisonGuidance(view);
  guidance.missingActors[0].actorName = '<img src=x onerror=alert(1)>';
  const html = renderComparisonGuidance(guidance);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img/);
  assert.equal(JSON.stringify(view), before);
  assert.equal(renderComparisonGuidance({kind:'missing-other-actors', actorId:'a', actorName:'A', missingActors:[{actorId:'a',actorName:'A'}]}), '');
});
