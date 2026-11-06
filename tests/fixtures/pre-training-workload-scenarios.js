// Shared QA route builder. It uses the supplied real producer API and never
// deletes a rule version or invents an institution to fabricate compatibility.
import assert from 'node:assert/strict';

export const copy = structuredClone;
export const bytes = JSON.stringify;
export function lock(state, actor, cell, id, api) {
  const action = api.getActions(state, cell, actor).find(row => row.id === id);
  assert.ok(action, `Available ${actor}/${cell}/${id} at ${state.year}`);
  for (const evidence of action.requireEvidence) {
    if (!api.getInvestigation(state, actor, cell).evidence.includes(evidence)) api.investigate(state, actor, cell, evidence);
  }
  api.lockTask(state, actor, cell, id, action.requireEvidence);
}
export function commit(state, api) {
  for (const actor of api.getActors(state)) if (!state.drafts[actor.id]) api.passTask(state, actor.id);
  api.commitWindow(state);
}
export function next(state, api) {
  commit(state, api); api.advanceToNextWindow(state); return state;
}
export function ready(api, {seed = 0, build = 'build_joint', review = true, warning = true} = {}) {
  const state = api.createRun(seed);
  lock(state, 'protagonist', 'D4', build, api); next(state, api);
  lock(state, 'protagonist', 'D4', 'recruit_successor', api); next(state, api);
  if (review) lock(state, 'protagonist', 'B4', 'independent_review', api);
  if (warning) lock(state, 'linche', 'D4', 'free_warning', api);
  return next(state, api);
}
export function finalLocks(state, api, {support = 'authorize_training', actor = 'linche', policy = 'share_power'} = {}) {
  const partner = actor === 'linche' ? 'protagonist' : 'linche';
  if (policy) lock(state, partner, 'D4', policy, api);
  if (support) lock(state, actor, 'E4', support, api);
  return state;
}
export function checkpoints(api, options = {}) {
  const state = ready(api, options), result = {planning: copy(state)};
  finalLocks(state, api, options); result.locked = copy(state);
  commit(state, api); result.committed = copy(state);
  api.advanceYear(state); result.settled = copy(state);
  while (state.year < 35) api.advanceYear(state);
  result.year35 = copy(state);
  while (state.year < 40) api.advanceYear(state);
  result.ended = copy(state);
  return result;
}
