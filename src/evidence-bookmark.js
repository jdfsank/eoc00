import {getActionPreview} from './action-preview.js';

// Ephemeral navigation only. A persisted choice is not evidence of an origin.
export function createEvidenceBookmark(state, context, materialId, legacyEvidence=[]) {
  if (!['choice','confirm'].includes(context.screen) || state.phase!=='planning') return null;
  const preview=getActionPreview(state,context.cellId,context.actorId,context.actionId,legacyEvidence);
  if (!preview?.missing.includes(materialId)) return null;
  return {state,year:state.year,actorId:context.actorId,cellId:context.cellId,actionId:context.actionId,materialId};
}
export function readEvidenceBookmark(bookmark,state,context,legacyEvidence=[]) {
  if (!bookmark || bookmark.state!==state || bookmark.year!==state.year || state.phase!=='planning'
    || context.screen!=='avg' || bookmark.actorId!==context.actorId || bookmark.cellId!==context.cellId) return null;
  const preview=getActionPreview(state,context.cellId,context.actorId,bookmark.actionId,legacyEvidence);
  if (!preview || !preview.action.requireEvidence.includes(bookmark.materialId)) return null;
  return {actionId:bookmark.actionId,materialId:bookmark.materialId,title:preview.action.title,missing:preview.missing};
}
