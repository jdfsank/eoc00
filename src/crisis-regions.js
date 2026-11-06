import {FLOOD_REGIONS} from './simulation.js';
import {getCrisisHistory} from './crisis-history.js';

export const CRISIS_REGION_LEGEND=Object.freeze([
 {status:'warning',shape:'triangle',symbol:'△ !',label:'已预警，尚未清点'},
 {status:'loss',shape:'page-diamond',symbol:'▱ ◆',label:'第23年清点：记有损失'},
 {status:'zero',shape:'page-circle',symbol:'▱ ○',label:'第23年清点：已存零值'},
 {status:'unknown',shape:'dashed-question',symbol:'□ ?',label:'记录或本地域明细未知'},
]);
export const CRISIS_MARKER_OFFSET=Object.freeze({x:-21,y:-15});
const coefficient=v=>Number.isFinite(v)&&v>=0&&v<=1;

// A record annotation, not a simulated flood, a service-coverage map, or an
// instruction to take an action. No year alone can invent the affected places.
export function getCrisisRegions(state){
 const none={phase:'none',filterLabel:'危机地域',summary:'尚无可定位的危机地域记录。',regions:[],legend:[]};
 if(!Number.isInteger(state?.year)||state.year<14||state.year>40)return none;
 const history=Array.isArray(state.history)?state.history:[],events=Array.isArray(state.events)?state.events:[],rows=[...history,...events];
 const unique=id=>typeof id==='string'&&rows.filter(r=>r.id===id).length===1?rows.find(r=>r.id===id):null;
 const milestone=(id,kind,year)=>{const row=unique(id);return row&&history.includes(row)&&row.kind===kind&&row.year===year&&year<=state.year
  &&row.cellId==='D4'&&row.status==='confirmed'&&row.reality==='R1'&&row.sourceActionId===null?row:null;};
 const warning=milestone('crisis-warning','warning',14),impactCandidate=milestone('crisis-impact','crisis',23);
 const impact=impactCandidate?.parentId==='crisis-warning'?impactCandidate:null;
 const crisis=state.flags?.crisis,scope=crisis?.warningYear===14&&crisis?.irreversibleYear===23
  &&Array.isArray(crisis.affectedCells)&&crisis.affectedCells.length===FLOOD_REGIONS.length
  &&new Set(crisis.affectedCells).size===FLOOD_REGIONS.length&&FLOOD_REGIONS.every(id=>crisis.affectedCells.includes(id));
 if(!scope)return warning||impact?{...none,phase:'unknown',filterLabel:'危机记录待核',summary:'原始危机记录存在，但没有可核实的地域范围；不凭年份补画地域。'}:none;
 function safeTrace(id){
  const seen=new Set();let row=unique(id),childYear=Infinity;
  if(!row)return false;
  while(row){
   if(seen.has(row.id)||!Number.isInteger(row.year)||row.year<0||row.year>state.year||row.year>childYear)return false;
   if(history.includes(row)?row.reality!=='R1':row.reality!==undefined&&row.reality!=='R1')return false;
   if(events.includes(row)&&(row.kind!=='event'||!['success','failed','cancelled'].includes(row.status)||row.resolvedYear!==row.year))return false;
   if(row.kind==='action'&&row.status!=='confirmed')return false;
   if(row.sourceActionId){const a=unique(row.sourceActionId),actor=row.sourceActionId.split(':')[2];if(!a||a.kind!=='action'||a.status!=='confirmed'||row.actorId!==undefined&&row.actorId!==actor)return false;}
   if(row.id==='crisis-warning'&&row!==warning)return false;
   seen.add(row.id);childYear=row.year;
   if(row.parentId===null)return true;
   row=unique(row.parentId);if(!row)return false;
  }
  return false;
 }
 const phase=state.year<23?(warning?'warning':'unknown'):(impact?'settled':'unknown');
 const source=phase==='warning'?warning:phase==='settled'?impact:null;
 // The shared source screen also exposes response buttons. Validate those
 // destinations before offering it, not merely the selected milestone's ID.
 let recordId=null;
 if(source){const view=getCrisisHistory(state,source.id),destinations=[source.id,...(view?.discovery||[]).map(r=>r.id),
  ...(view?.responses||[]).flatMap(r=>[r.recordId,...r.chain.map(x=>x.id),...(r.status==='pending'?[]:[r.eventId])])];
  if(view&&destinations.every(safeTrace))recordId=source.id;
 }
 const regions=FLOOD_REGIONS.filter(id=>state.cells?.some(c=>c.id===id)).map(cellId=>{
  const damage=phase==='settled'&&coefficient(crisis.damageByCell?.[cellId])?crisis.damageByCell[cellId]:null;
  const coverage=phase==='settled'&&coefficient(crisis.coverageByCell?.[cellId])?crisis.coverageByCell[cellId]:null;
  const status=phase==='warning'?'warning':phase==='settled'&&damage!==null?(damage===0?'zero':'loss'):'unknown';
  const label=status==='warning'?'已预警 · 第23年尚未清点':status==='loss'?'第23年已清点 · 记有损失':status==='zero'?'第23年已清点 · 已存损失零值':phase==='settled'?'第23年已清点 · 本地域明细未知':state.year<23?'预警记录待核 · 不判定结果':'清点记录待核 · 结果未知';
  const detail=phase==='warning'?['第14年原始预警已列明这些地域；尚在应对与等待清点阶段，不显示未来损失。']
   :phase==='settled'?[`第23年已存损失系数：${damage===null?'未知':String(damage)}；当年覆盖系数：${coverage===null?'未知':String(coverage)}。`,...(damage===null||coverage===null?['缺项保留为未知，不从整体数值、现存机构或后来行动倒推。']:[])]
    :['已存地域范围仍保留，但对应原始记录缺失或不一致；未知不表示零损失，也不证明发生了灾害。'];
  detail.push('地图徽记表示记录阶段，不表示建筑毁损、人数或当前服务覆盖。');
  if(source&&!recordId)detail.push('原始记录的可跳转来源链缺失或不一致，保留已存事实，暂不提供来源跳转。');
  return {cellId,status,label,detail,recordId,shape:CRISIS_REGION_LEGEND.find(l=>l.status===status).shape,damage,coverage};
 });
 return {phase,filterLabel:phase==='warning'?'预警地域':phase==='settled'?'第23年清点':'危机记录待核',
  summary:phase==='warning'?'四地已列入第14年预警；应对与清点尚未结束，不预告第23年结果。':phase==='settled'?'以下是第23年已存清点，不是新的预警；后来的服务变化不改写历史。':'已存地域范围的危机记录待核；不把未知写成胜利或灾害。',
  regions,legend:CRISIS_REGION_LEGEND.filter(l=>regions.some(r=>r.status===l.status))};
}
