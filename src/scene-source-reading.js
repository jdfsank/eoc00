import {getActors} from './simulation.js';
import {getSceneVisit} from './scene-visit.js';

// Presentation only: a source heading is not a new investigation, authorization,
// historical producer or persisted navigation bookmark.
export function getSceneSourceReading(state,{screen,cellId,actorId,sourceId}={}) {
 try {
  if(!state||!['avg','visit'].includes(screen)||!['planning','playback','ended'].includes(state.phase)
   ||!Number.isInteger(state.year)||state.year<0||state.year>40
   ||!Array.isArray(state.cells)||!state.cells.some(cell=>cell.id===cellId)
   ||!Array.isArray(state.history)||!Array.isArray(state.events)
   ||typeof sourceId!=='string'||!sourceId)return null;
  if(screen==='avg'&&(state.phase!=='planning'||!getActors(state).some(actor=>actor.id===actorId)))return null;
  if(screen==='visit'&&!getSceneVisit(state,cellId)?.available)return null;
  const matches=[...state.history,...state.events].filter(record=>record.id===sourceId);
  if(matches.length!==1)return null;
  const record=matches[0];
  if(!Number.isInteger(record.year)||record.year<0||record.year>state.year
   ||record.status==='pending'||(record.reality!==undefined&&record.reality!=='R1')
   ||typeof record.title!=='string'||!record.title.trim()
   ||(record.resolvedYear!==undefined&&(!Number.isInteger(record.resolvedYear)||record.resolvedYear>state.year)))return null;
  return {sourceId,sourceYear:record.year,sourceTitle:record.title,
   contextLabel:`${cellId} · 第${state.year}年${screen==='avg'?'现场':'只读回访'}`,
   notice:'正在阅读已存来源，不消耗调查轮数，也不构成新的同意或承诺。'};
 } catch {return null;}
}
