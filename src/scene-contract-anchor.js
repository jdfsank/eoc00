import {getActions, getActors} from './simulation.js';

// A destination in the current contract, never evidence of a past scroll or
// disclosure state. No new save fields, remembered DOM indexes or world writes.
export function getSceneContractAnchor(state, context) {
  try {
    if (!state || state.phase !== 'planning' || !['choice', 'confirm'].includes(context?.screen)
      || !getActors(state).some(actor => actor.id === context.actorId)) return null;
    const action = getActions(state, context.cellId, context.actorId).find(item => item.id === context.actionId);
    if (!action || typeof action.title !== 'string' || !action.title.trim()) return null;
    return {actionId: action.id, actorId: context.actorId, cellId: context.cellId, title: action.title};
  } catch {
    return null;
  }
}
