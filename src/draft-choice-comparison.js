import {EVIDENCE,getActions,getInvestigation,usesTradeoffs} from './simulation.js';
import {getDraftEditContext} from './draft-edit-context.js';
import {getActionPreview} from './action-preview.js';

const validEvidence = evidence => Array.isArray(evidence) && evidence.every(id => typeof id === 'string' && Object.hasOwn(EVIDENCE,id));
const sameEvidence = (left,right) => {
 const a=new Set(left),b=new Set(right);
 return a.size===b.size&&[...a].every(id=>b.has(id));
};

// Two public contracts, not two simulated outcomes. The original always uses
// its locked evidence snapshot; inspecting today's candidate cannot revise it.
export function getDraftChoiceComparison(state,options={}) {
 try {
  const {actorId,cellId,actionId,legacyEvidence=[]}=options;
  if(![actorId,cellId,actionId].every(id=>typeof id==='string'&&id.length))return null;
  const context=getDraftEditContext(state,actorId);
  if(!context||!state.cells.some(cell=>cell.id===cellId))return null;
  const draft=state.drafts[actorId],modern=usesTradeoffs(state);
  let originalAction=null,originalEvidence=[];
  if(context.status==='passed') {
   // A pass cannot also claim a contract or evidence snapshot.
   if(['cellId','actionId','evidence'].some(key=>Object.hasOwn(draft,key)))return null;
  } else {
   if(!validEvidence(draft.evidence))return null;
   originalEvidence=[...draft.evidence];
   originalAction=getActions(state,draft.cellId,actorId,originalEvidence).find(action=>action.id===draft.actionId);
   if(!originalAction||!originalAction.requireEvidence.every(id=>originalEvidence.includes(id)))return null;
   if(modern&&!originalEvidence.every(id=>getInvestigation(state,actorId,draft.cellId).evidence.includes(id)))return null;
  }
  const candidateEvidence=modern?getInvestigation(state,actorId,cellId).evidence:legacyEvidence;
  if(!validEvidence(candidateEvidence))return null;
  const preview=getActionPreview(state,cellId,actorId,actionId,legacyEvidence);
  if(!preview)return null;
  const sameAction=context.status==='locked'&&context.cellId===cellId&&originalAction.id===preview.action.id;
  return structuredClone({actorId,actorName:context.actorName,
   original:{status:context.status,title:context.title,cellId:context.cellId,action:originalAction,evidence:originalEvidence},
   candidate:{cellId,action:preview.action,missing:preview.missing},
   sameAction,evidenceChanged:sameAction&&!sameEvidence(originalEvidence,candidateEvidence)});
 } catch {return null;}
}
