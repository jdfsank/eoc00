import { getActions, getInvestigation, investigate, lockTask, usesTradeoffs } from '../../src/simulation.js';

// Exercise the same authoritative investigation path as a player. Only collect
// required evidence, preserving optional investigations and opportunity costs.
export function investigateAndLock(state, actorId, cellId, actionId) {
  const action = getActions(state, cellId, actorId).find(candidate => candidate.id === actionId);
  if (!action) throw new Error(`Unavailable test action: ${actionId} at ${cellId}`);
  if (usesTradeoffs(state)) {
    for (const id of action.requireEvidence) {
      if (!getInvestigation(state, actorId, cellId).evidence.includes(id)) investigate(state, actorId, cellId, id);
    }
  }
  return lockTask(state, actorId, cellId, actionId, action.requireEvidence);
}
