import {getActions,getInvestigation,usesTradeoffs} from './simulation.js';
import {getActionInvestigation} from './investigation-plan.js';

// A contract is public information. Reading it never acquires evidence, locks
// a task, pays a cost or consults a random result. Legacy evidence remains the
// current scene's UI record; new rules always use the actor's real investigation.
export function getActionPreview(state,cellId,actorId,actionId,legacyEvidence=[]) {
 const evidence=usesTradeoffs(state)?getInvestigation(state,actorId,cellId).evidence:[...legacyEvidence];
 const action=getActions(state,cellId,actorId,evidence).find(a=>a.id===actionId);
 if(!action)return null;
 const missing=(action.requireEvidence||[]).filter(id=>!evidence.includes(id));
 const investigation=getActionInvestigation(state,cellId,actorId,action.requireEvidence||[]);
 return {action:structuredClone(action),missing,canLock:missing.length===0,...(investigation?{investigation}:{})};
}
