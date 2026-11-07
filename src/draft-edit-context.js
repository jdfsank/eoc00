import {getActors,getActions} from './simulation.js';

// Read the frozen arrangement, never the current investigation or a projected result.
export function getDraftEditContext(state,actorId) {
 try {
  if(state?.phase!=='planning'||![0,10,20,30].includes(state.year))return null;
  const actor=getActors(state).find(a=>a.id===actorId),draft=state.drafts?.[actorId];
  if(!actor||!draft||draft.actorId!==actorId||draft.window!==state.year)return null;
  if(draft.status==='passed')return {actorId,actorName:actor.name,cellId:null,title:'本窗口明确放弃',status:'passed'};
  if(draft.status!=='locked'||!Array.isArray(draft.evidence)||!state.cells.some(c=>c.id===draft.cellId))return null;
  const action=getActions(state,draft.cellId,actorId,draft.evidence).find(a=>a.id===draft.actionId);
  if(!action)return null;
  return {actorId,actorName:actor.name,cellId:draft.cellId,title:action.title,status:'locked'};
 } catch {return null;}
}
