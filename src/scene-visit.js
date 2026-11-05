import {sceneArt} from './scene-art.js';
import {farPortVisual} from './far-port-visuals.js';

// A separate read-only view, not an AVG action or a new investigation session.
// The first supported site is F6. Its existing illustrations already distinguish
// a submitted order from a realised institution and retain earlier failures.
export function getSceneVisit(state,cellId){
 if(cellId!=='F6'||!Number.isInteger(state?.year)||state.year<0||state.year>40
  ||!Array.isArray(state.cells)||!state.cells.some(c=>c.id===cellId)||!Array.isArray(state.institutions)
  ||!Array.isArray(state.events)||!Array.isArray(state.history))return null;
 const port=farPortVisual(state),summary=[];
 if(port){
  summary.push(port.label);
  if(port.pending)summary.push('空白工单只表示已提交、尚待核定；现在没有新增校验组，也不预告核定结果。');
  if(port.check.late)summary.push('后续校验只面向今后；原来的失败记录与第23年清点没有被改写。');
 }else summary.push('远港河岸尚无可核实的分站或校验机构，画面只呈现当前的河岸场景。');
 // Link existing local records, never a future outcome in the event queue.
 // Ambiguous duplicate IDs cannot provide a reliable source destination.
 const sources=state.history.filter(h=>h.cellId===cellId&&Number.isInteger(h.year)&&h.year<=state.year
  &&['action','outcome','failure'].includes(h.kind)&&typeof h.id==='string'&&h.id
  &&[...state.history,...state.events].filter(other=>other.id===h.id).length===1);
 return {
  available:true,cellId,year:state.year,title:'F6 · 远港现场回访',
  notice:'只读现场回访。这里不取证、不锁定或提交任务，也不推进年份。',
  summary,art:sceneArt(state,cellId),sourceIds:sources.map(h=>h.id),
 };
}
