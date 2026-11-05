import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import { investigateAndLock as lock } from '../tests/helpers/play.js';

// Run with: node scripts/handoff-balance-check.mjs [seed-count]
// JSON is written only to stdout so evidence can be saved explicitly by the caller.
const count = Number(process.argv[2] ?? 100);
assert.ok(Number.isInteger(count) && count > 0 && count <= 1000, 'Seed count must be an integer from 1 to 1000');
const policies = ['share_power', 'withdraw'];
const positive = { share_power: '许多人签署的历史', withdraw: '没有唯一守夜人' };

function next(state) {
  for (const actor of sim.getActors(state)) if (!state.drafts[actor.id]) sim.passTask(state, actor.id);
  sim.commitWindow(state);
  sim.advanceToNextWindow(state);
  assert.equal(sim.validateState(state).valid, true);
}
function take(state, cell, action) { lock(state, 'protagonist', cell, action); next(state); }
function result(name) {
  return {
    route: name, seedsConsidered: count, constructionFailed: 0, completedRuns: 0,
    successfulReviews: 0, failedReviews: 0, zeroDamage: 0,
    damageTotal: 0, worstDamage: 0,
    endings: Object.fromEntries(policies.map(policy => [policy, { positive: 0, negative: 0, titles: {} }])),
  };
}
function measure(row, at30) {
  assert.equal(at30.year, 30);
  const ready = sim.getHandoffReadiness(at30);
  const review = at30.events.find(event => event.actionId === 'independent_review');
  row.completedRuns++;
  if (review?.status === 'success') row.successfulReviews++;
  if (review?.status === 'failed') row.failedReviews++;
  const damage = at30.flags.crisis.damage;
  row.damageTotal += damage;
  row.worstDamage = Math.max(row.worstDamage, damage);
  if (damage === 0) row.zeroDamage++;
  for (const policy of policies) {
    const state = structuredClone(at30);
    const previousCrisis = structuredClone(state.flags.crisis);
    take(state, 'D4', policy);
    assert.deepEqual(state.flags.crisis, previousCrisis, 'Terminal policy cannot rewrite the crisis');
    const ending = sim.getEnding(state);
    const success = ending.title === positive[policy];
    assert.equal(success, policy === 'share_power' ? ready.canShare : ready.canWithdraw);
    const outcomes = row.endings[policy];
    outcomes[success ? 'positive' : 'negative']++;
    outcomes.titles[ending.title] = (outcomes.titles[ending.title] || 0) + 1;
  }
}

const results = [];
for (const build of ['build_joint', 'build_state', 'build_merchant']) {
  const reviewRoute = result(`${build} → renew_charter → independent_review`);
  const schoolRoute = result(`${build} → renew_charter → train_network`);
  for (let seed = 0; seed < count; seed++) {
    const base = sim.createRun(seed);
    take(base, 'D4', build);
    if (!base.flags.stationBuilt) {
      reviewRoute.constructionFailed++;
      schoolRoute.constructionFailed++;
      continue;
    }
    take(base, 'D4', 'renew_charter');
    const reviewed = structuredClone(base);
    take(reviewed, 'F6', 'independent_review');
    measure(reviewRoute, reviewed);
    const school = structuredClone(base);
    take(school, 'E4', 'train_network');
    assert.equal(sim.getHandoffReadiness(school).canWithdraw, false, 'Same-source teaching cannot substitute for a check');
    measure(schoolRoute, school);
  }
  assert.equal(reviewRoute.endings.share_power.positive, reviewRoute.successfulReviews);
  assert.equal(reviewRoute.endings.withdraw.positive, reviewRoute.successfulReviews);
  assert.equal(schoolRoute.endings.share_power.positive, 0);
  assert.equal(schoolRoute.endings.withdraw.positive, 0);
  results.push(reviewRoute, schoolRoute);
}

const independentRoute = result('preserve_records → fund_school → independent_review (no station)');
for (let seed = 0; seed < count; seed++) {
  const state = sim.createRun(seed);
  take(state, 'B4', 'preserve_records');
  take(state, 'E4', 'fund_school');
  take(state, 'B4', 'independent_review');
  assert.equal(state.institutions.some(i => i.kind === 'station'), false);
  assert.equal(sim.getHandoffReadiness(state).canWithdraw, true);
  assert.equal(sim.getHandoffReadiness(state).canShare, false);
  measure(independentRoute, state);
}
assert.equal(independentRoute.endings.withdraw.positive, count);
assert.equal(independentRoute.endings.share_power.positive, 0);
results.push(independentRoute);

console.log(JSON.stringify({
  rules: { planning: sim.PLANNING_RULES.version, handoff: sim.HANDOFF_RULES.version, coverage: sim.COVERAGE_RULES.version },
  seedRange: [0, count - 1],
  notes: [
    'Fixed deterministic samples are regression evidence, not proof of balance or estimated population probabilities.',
    'Construction-failure seeds are reported separately; they are excluded from renewal cohorts, not silently rescued or scored as a completed route.',
    'Each completed route is replayed with both terminal policies; prior actions and crisis damage are identical.',
    'The no-station route has local school authorization but no riverport cooperation, so withdrawal and sharing deliberately differ.',
  ],
  results: results.map(({ damageTotal, ...row }) => ({
    ...row, meanDamage: row.completedRuns ? Number((damageTotal / row.completedRuns).toFixed(4)) : null,
  })),
}, null, 2));
