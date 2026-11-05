import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import * as old from './fixtures/pre-tradeoffs-simulation.js';
import { restoreSave } from '../src/save.js';
import { investigateAndLock as lock } from './helpers/play.js';
const submit = (s, api = sim) => { for (const a of api.getActors(s)) if (!s.drafts[a.id]) api.passTask(s, a.id); api.commitWindow(s); };
const decade = s => { submit(s); sim.advanceToNextWindow(s); };
function twoActors(seed = 12, records = false) {
  const s = sim.createRun(seed); if (records) lock(s, 'protagonist', 'B4', 'preserve_records'); decade(s);
  lock(s, 'protagonist', 'D4', 'recruit_risk'); decade(s); return s;
}
function route(seed, action, records = false) {
  const s = twoActors(seed, records); lock(s, 'protagonist', 'F6', action); lock(s, 'linche', 'D4', 'free_warning'); decade(s);
  lock(s, 'protagonist', 'D4', 'share_power'); lock(s, 'linche', 'E4', 'train_network'); decade(s); return s;
}
test('no-build emergency review trades possible prevention against guaranteed veto relief over 100 fixed seeds', () => {
  const reviews = [], vetoes = [], prepared = [];
  for (let seed = 0; seed < 100; seed++) { reviews.push(route(seed, 'independent_review')); vetoes.push(route(seed, 'local_veto')); prepared.push(route(seed, 'independent_review', true)); }
  const successful = reviews.filter(s => s.flags.crisis.damage === 0).length;
  const archival = prepared.filter(s => s.flags.crisis.damage === 0).length;
  assert.ok(successful > 0 && successful < 100); assert.ok(archival > successful && archival < 100);
  assert.ok(vetoes.every(s => s.flags.crisis.damage > 0 && s.flags.crisis.damage < .3));
  assert.ok(reviews.some(s => s.flags.crisis.damage > vetoes[0].flags.crisis.damage));
  assert.ok(reviews.some(s => sim.getEnding(s).title === '纸上的共同作者'));
  for (const s of [...reviews, ...vetoes, ...prepared]) assert.equal(sim.validateState(s).valid, true);
});
test('archive plus night school supports certain full review without ever building a station', () => {
  const s = sim.createRun(6); lock(s, 'protagonist', 'B4', 'preserve_records'); decade(s); lock(s, 'protagonist', 'E4', 'fund_school'); decade(s);
  assert.deepEqual(sim.reviewPreparation(s), { records: true, workforce: true, probability: 1 });
  lock(s, 'protagonist', 'B4', 'independent_review'); decade(s); assert.equal(s.flags.crisis.damage, 0);
  lock(s, 'protagonist', 'D4', 'withdraw'); decade(s); assert.equal(sim.getEnding(s).title, '没有唯一守夜人');
  assert.ok(!s.institutions.some(i => i.kind === 'station')); assert.equal(sim.getActors(s).length, 1);
});
test('review contract freezes preparation and probability before same-window schools appear', () => {
  const s = twoActors(6); lock(s, 'protagonist', 'F6', 'independent_review'); lock(s, 'linche', 'E4', 'train_network'); submit(s);
  const event = s.events.find(e => e.actionId === 'independent_review'); assert.equal(event.probability, .55); assert.equal(event.year, 22);
  const checkpoint = restoreSave({ state: structuredClone(s) }).state;
  sim.advanceYear(s); assert.equal(sim.reviewPreparation(s).workforce, true); assert.equal(event.probability, .55);
  sim.advanceToNextWindow(s); sim.advanceToNextWindow(checkpoint); assert.deepEqual(s, checkpoint);
  assert.equal(s.history.filter(e => e.id === `resolved:${event.id}`).length, 1);
});
test('risky review plus veto is a real fallback, surveyed evacuation improves it, and copies do not stack', () => {
  let failed;
  for (let seed = 0; !failed; seed++) { const s = twoActors(seed); lock(s, 'protagonist', 'F6', 'independent_review'); sim.investigate(s, 'linche', 'B4', 'evacuation_routes'); lock(s, 'linche', 'B4', 'local_veto'); assert.match(sim.getWindowReview(s).warnings.join(), /后备/); decade(s); if (!s.flags.review) failed = s; }
  assert.equal(failed.flags.crisis.damage, .2); assert.equal(failed.flags.vetoMitigation, .2);
  const s = twoActors(); lock(s, 'protagonist', 'F6', 'local_veto'); sim.investigate(s, 'linche', 'B4', 'evacuation_routes'); lock(s, 'linche', 'B4', 'local_veto'); decade(s); assert.equal(s.flags.crisis.damage, .2);
});
test('portable documents travel with their investigator while local testimony and total budget retain source', () => {
  const s = twoActors(); sim.investigate(s, 'protagonist', 'D4', 'anomaly_records');
  assert.equal(sim.getInvestigation(s, 'protagonist', 'F6').budget, 1); assert.ok(sim.getInvestigation(s, 'protagonist', 'F6').evidence.includes('anomaly_records'));
  sim.investigate(s, 'protagonist', 'F6', 'anomaly_records'); assert.equal(s.investigations['20:protagonist'].length, 1);
  sim.investigate(s, 'protagonist', 'D4', 'resident_testimony'); assert.ok(!sim.getInvestigation(s, 'protagonist', 'F6').evidence.includes('resident_testimony'));
  assert.throws(() => sim.investigate(s, 'protagonist', 'B4', 'evacuation_routes'), /不足/);
  sim.lockTask(s, 'protagonist', 'F6', 'independent_review'); assert.equal(sim.getInvestigation(s, 'linche', 'B4').budget, 3);
  const restored = restoreSave({ state: structuredClone(s), ui: {} }); assert.equal(sim.getInvestigation(restored.state, 'protagonist', 'B4').budget, 0);
});
test('new lock and window review reject fabricated evidence without recorded investigation', () => {
  const s = twoActors(); assert.throws(() => sim.lockTask(s, 'protagonist', 'B4', 'independent_review', ['anomaly_records']), /尚缺/);
  lock(s, 'protagonist', 'B4', 'independent_review'); sim.passTask(s, 'linche'); s.investigations = {};
  assert.equal(sim.getWindowReview(s).ready, false); assert.throws(() => sim.commitWindow(s), /取证记录缺失/);
});
test('same-place training expands output without multiplying autonomy, and same-place archive/review is one support', () => {
  const s = twoActors(); lock(s, 'protagonist', 'E4', 'train_network'); decade(s); lock(s, 'protagonist', 'E4', 'train_network'); decade(s);
  assert.equal(s.institutions.filter(i => i.kind === 'school').length, 2); assert.equal(sim.getEnding(s).metrics.networks, 1); assert.equal(sim.getEnding(s).metrics.autonomy, 1);
  let archived; for (let seed = 0; !archived; seed++) { const c = twoActors(seed, true); lock(c, 'protagonist', 'B4', 'independent_review'); decade(c); if (c.flags.review) archived = c; }
  assert.equal(sim.getEnding(archived).metrics.autonomy, 1);
});
test('genuine prior kernel saves retain old unprepared review, locked drafts and submitted contracts', () => {
  // Frozen from commit 0a64767, only JSON fixture import path changed.
  const s = old.createRun(6); submit(s, old); old.advanceToNextWindow(s); old.lockTask(s, 'protagonist', 'D4', 'recruit_risk'); submit(s, old); old.advanceToNextWindow(s);
  for (const stage of ['planning', 'locked', 'submitted', 'resolved']) {
    const source = structuredClone(s);
    if (stage !== 'planning') old.lockTask(source, 'protagonist', 'F6', 'independent_review', ['anomaly_records']);
    if (['submitted', 'resolved'].includes(stage)) submit(source, old);
    if (stage === 'resolved') old.advanceToNextWindow(source);
    const loaded = restoreSave({ state: structuredClone(source) }).state;
    assert.equal(loaded.planningRulesVersion, undefined);
    if (stage === 'planning') { sim.lockTask(loaded, 'protagonist', 'F6', 'independent_review', ['anomaly_records']); old.lockTask(source, 'protagonist', 'F6', 'independent_review', ['anomaly_records']); }
    if (loaded.phase === 'planning' && loaded.year === 20) { submit(loaded); submit(source, old); }
    if (loaded.phase === 'playback') { sim.advanceToNextWindow(loaded); old.advanceToNextWindow(source); }
    assert.deepEqual(loaded.flags.crisis, source.flags.crisis); assert.deepEqual(loaded.cells, source.cells); assert.equal(loaded.flags.crisis.damage, 0);
  }
});
test('invalid rule versions and investigation records fail before annual mutation', () => {
  for (const mutate of [s => delete s.investigations, s => {s.planningRulesVersion='future';}, s => {s.investigations['0:protagonist']=[{cellId:'D4',evidenceId:'anomaly_records'},{cellId:'B4',evidenceId:'anomaly_records'}];}]) {
    const s = sim.createRun(); mutate(s); assert.equal(sim.validateState(s).valid, false); assert.throws(() => restoreSave({ state: s }), /不兼容或损坏/);
  }
});
