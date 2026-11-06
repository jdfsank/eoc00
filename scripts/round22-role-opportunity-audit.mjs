// Natural player-API routes only. This samples role opportunity cost, not
// universal strategy balance, real players, affordability or a preferred ending.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as sim from '../src/simulation.js';
import {ready, lock, next, commit} from '../tests/fixtures/pre-training-workload-scenarios.js';
import {getPlanningOpportunity} from '../src/planning-opportunity.js';
import {renderPlanningOpportunity} from '../src/planning-opportunity-view.js';

const copy = structuredClone, bytes = JSON.stringify;
const seeds = [0, 1, 2, 3, 12], pairs = [];
function finish(s, supportId) {
  const review = sim.getWindowReview(s), frozen = bytes(s);
  const opportunity = getPlanningOpportunity(s);
  renderPlanningOpportunity(opportunity);
  assert.equal(bytes(s), frozen, 'reading planning consequences must not change the natural route');
  const at30 = {ready:review.ready, warnings:review.warnings, roleStatus:opportunity.policyActor.status,
    assignments:copy(s.drafts), mainBudget:sim.getInvestigation(s,'protagonist','E4').budget,
    companionBudget:sim.getInvestigation(s,'linche','E4').budget};
  commit(s, sim); sim.advanceToNextWindow(s);
  const ending = sim.getEnding(s), action = s.events.find(event=>event.actionId===supportId&&event.sourceActionId.startsWith('action:30:'));
  assert.equal(sim.validateState(s).valid, true);
  return {at30, final:{title:ending.title,policy:ending.policy,canShare:ending.handoff.canShare,
    canWithdraw:ending.handoff.canWithdraw,staffCells:ending.handoff.staffCells,
    authorizedCells:ending.handoff.authorizedCells,checkCells:ending.handoff.checkCells,
    trust:ending.handoff.trust,workStatus:action?.status,valid:true}};
}
for (const seed of seeds) for (const support of ['authorize_training','train_network']) {
  const original = ready(sim, {seed});
  const mainDoesWork = copy(original), companionDoesWork = copy(original);
  lock(mainDoesWork,'protagonist','E4',support,sim);sim.passTask(mainDoesWork,'linche');
  assert.equal(sim.getActions(mainDoesWork,'D4','linche').length,0);
  lock(companionDoesWork,'linche','E4',support,sim);lock(companionDoesWork,'protagonist','D4','share_power',sim);
  const main = finish(mainDoesWork,support), companion = finish(companionDoesWork,support);
  assert.equal(main.final.policy,null);assert.equal(main.final.title,'未签署的下一页');
  assert.equal(main.final.canShare,true);assert.equal(companion.final.policy,'share_power');
  assert.equal(companion.final.title,'许多人签署的历史');
  assert.equal(main.final.workStatus,'success');assert.equal(companion.final.workStatus,'success');
  const capability = ({title,policy,...rest})=>rest;
  assert.deepEqual(capability(main.final),capability(companion.final));
  pairs.push({seed,support,mainDoesWork:main,companionDoesWork:companion});
}

// No institution, resource or probability is edited: pass0, voluntary recruit10,
// pass20 naturally reaches an empty-workforce30. Preparation remains legal.
const empty = sim.createRun(0);next(empty,sim);
lock(empty,'protagonist','D4','recruit_volunteer',sim);next(empty,sim);next(empty,sim);
assert.equal(empty.institutions.length,0);
const futureChecks = [];
for (const preparation of [false,true]) {
  const s = copy(empty);
  lock(s,'protagonist','B4','establish_future_check',sim);
  if(preparation)lock(s,'linche','E4','train_network',sim);else sim.passTask(s,'linche');
  const before = copy(s.cells.find(cell=>cell.id==='B4').channels), review = sim.getWindowReview(s);
  const opportunity = getPlanningOpportunity(s), frozen=bytes(s);renderPlanningOpportunity(opportunity);assert.equal(bytes(s),frozen);
  commit(s,sim);
  const after = s.cells.find(cell=>cell.id==='B4').channels;
  assert.equal(before.economy-after.economy,6);assert.equal(before.science-after.science,4);
  sim.advanceToNextWindow(s);
  const event = s.events.find(event=>event.actionId==='establish_future_check');
  assert.equal(event.status,preparation?'success':'cancelled');assert.equal(sim.getEnding(s).policy,null);
  assert.equal(sim.validateState(s).valid,true);
  futureChecks.push({natural:true,preparation,ready:review.ready,warnings:review.warnings,
    paid:{economy:6,science:4},outcome:event.status,resolvedYear:event.resolvedYear,
    policy:sim.getEnding(s).policy,title:sim.getEnding(s).title,valid:true});
}
const summary = {
  scope:'Ten natural role-allocation pairs plus two natural preparation branches. Not universal balance or human-playtest certification.',
  balanced:false, seeds, pairs:pairs.length,
  rolePairsWithSameCompletedWorkAndCapability:pairs.length,
  noPolicyDespiteReadyToShare:pairs.filter(pair=>pair.mainDoesWork.final.canShare&&pair.mainDoesWork.final.policy===null).length,
  ordinaryTrainingWithoutEngineWarning:pairs.filter(pair=>pair.support==='train_network'&&pair.mainDoesWork.at30.warnings.length===0).length,
  allStatesValid:pairs.every(pair=>pair.mainDoesWork.final.valid&&pair.companionDoesWork.final.valid)&&futureChecks.every(row=>row.valid),
  preparationCanCompleteWithoutPolicy:futureChecks.find(row=>row.preparation).outcome==='success',
  interpretation:'Work is not invalid or pointless. The protagonist alone owns the policy action. Choosing construction, training or a check instead can be deliberate, but needs to be explicit before investigation and submission.',
};
const output=new URL('../playtest-output/round22-role-opportunity-audit.json',import.meta.url);
await fs.mkdir(new URL('../playtest-output/',import.meta.url),{recursive:true});
await fs.writeFile(output,JSON.stringify({summary,pairs,futureChecks},null,2));
console.log(JSON.stringify({...summary,output:output.pathname},null,2));
