import {southBankVisual} from './south-bank-visuals.js';
import {getCrisisHistory} from './crisis-history.js';

// This stricter link boundary belongs only to the new D5 visit. It does not
// rewrite old saves, alter current institutions, or change the global tracer.
export function southBankHistory(state,art){
 const rows=[...state.history,...state.events],visual=southBankVisual(state);
 const unique=id=>typeof id==='string'&&rows.filter(r=>r.id===id).length===1?rows.find(r=>r.id===id):null;
 function safeTrace(id){
  const seen=new Set();let row=unique(id),childYear=Infinity;
  if(!row)return false;
  while(row){
   if(seen.has(row.id)||!Number.isInteger(row.year)||row.year<0||row.year>state.year||row.year>childYear)return false;
   if(state.history.includes(row)?row.reality!=='R1':row.reality!==undefined&&row.reality!=='R1')return false;
   if(state.events.includes(row)&&(row.kind!=='event'||!['success','failed','cancelled'].includes(row.status)||row.resolvedYear!==row.year))return false;
   if(row.kind==='action'&&row.status!=='confirmed')return false;
   if(row.sourceActionId){const a=unique(row.sourceActionId),actor=row.sourceActionId.split(':')[2];
    if(!a||a.kind!=='action'||a.status!=='confirmed'||row.actorId!==undefined&&row.actorId!==actor)return false;
   }
   if(row.id==='crisis-warning'&&(row.kind!=='warning'||row.year!==14||row.cellId!=='D4'||row.status!=='confirmed'||row.sourceActionId!==null))return false;
   seen.add(row.id);childYear=row.year;
   if(row.parentId===null)return true;
   row=unique(row.parentId);if(!row)return false;
  }
  return false;
 }
 function sourceFor(e,actions,cell,years){
  if(!e||!state.events.includes(e)||unique(e.id)!==e||e.kind!=='event'||e.cellId!==cell||!actions.includes(e.actionId)
    ||e.reality!==undefined&&e.reality!=='R1')return null;
  const a=unique(e.sourceActionId),[prefix,y,actor,place,action,extra]=(e.sourceActionId||'').split(':'),year=Number(y);
  if(prefix!=='action'||extra!==undefined||String(year)!==y||!years.includes(year)||place!==cell||action!==e.actionId
    ||!state.actors?.some(p=>p.id===actor&&p.availableFrom<=year)||e.id!==`event:${e.sourceActionId}`||e.parentId!==e.sourceActionId
    ||!a||!state.history.includes(a)||a.kind!=='action'||a.status!=='confirmed'||a.reality!=='R1'||a.year!==year||a.cellId!==cell
    ||a.parentId!==null||a.sourceActionId!==a.id||!safeTrace(a.id))return null;
  if([a,e].some(r=>r.actorId!==undefined&&r.actorId!==actor||r.actionId!==undefined&&r.actionId!==action))return null;
  return a;
 }
 function outcome(e){
  const r=e&&unique(`resolved:${e.id}`);
  return e&&e.status==='success'&&e.resolvedYear===e.year&&e.year<=state.year
   &&r&&state.history.includes(r)&&r.kind==='outcome'&&r.status==='success'&&r.reality==='R1'
   &&r.cellId===e.cellId&&r.year===e.year&&r.parentId===e.id&&r.sourceActionId===e.sourceActionId
   &&(r.actionId===undefined||r.actionId===e.actionId)&&(r.actorId===undefined||r.actorId===e.sourceActionId?.split(':')[2])&&safeTrace(r.id)?r:null;
 }
 function sameInstitution(i,e){return state.institutions.filter(r=>r.id===i.id).length===1&&i.id===`institution:${e.id}:D5`
  &&i.startYear===e.year&&i.sourceEventId===e.id&&i.sourceActionId===e.sourceActionId;}
 const local=state.institutions.filter(i=>i.cellId==='D5'&&['mutual','training','school'].includes(i.kind));
 const proven=[];
 for(const i of local){
  const e=unique(i.sourceEventId);if(!e||!state.events.includes(e))continue;
  if(i.kind==='mutual'){
   const a=sourceFor(e,['mutual_aid'],'D5',[10,20,30]),r=outcome(e);
   if(a&&r&&e.year===a.year+1&&sameInstitution(i,e))proven.push({i,ids:[a.id,r.id],year:e.year});
  }else if(i.kind==='training'){
   const b=unique(e.parentId),a=sourceFor(b,['build_joint','build_state','build_merchant'],'D4',[0]),br=outcome(b),r=outcome(e);
   if(a&&br&&r&&e.actionId==='training'&&e.cellId==='E4'&&e.year===7&&b.year<e.year
    &&b.year===(b.actionId==='build_merchant'?2:3)
    &&e.id===`${b.id}:training`&&e.sourceActionId===b.sourceActionId
    &&(e.actorId===undefined||e.actorId===a.id.split(':')[2])&&(e.reality===undefined||e.reality==='R1')&&sameInstitution(i,e))
    proven.push({i,ids:[a.id,br.id,r.id],year:e.year});
  }
 }
 const pending=state.events.filter(e=>{
  const a=sourceFor(e,['mutual_aid'],'D5',[10,20,30]);
  return a&&e.status==='pending'&&e.year===a.year+1&&e.year>state.year&&e.resolvedYear===undefined
   &&!state.history.some(r=>r.id===`resolved:${e.id}`);
 });
 const summary=[];
 const describe=(group,name)=>`${name}${group.active?'运行中':'停运，原址保留'}${group.maintenanceGap?'，维护不足':''}`;
 if(visual.teaching.exists)summary.push(describe(visual.teaching,'南岸读尺班'));
 if(visual.aid.exists)summary.push(describe(visual.aid,'南岸互助仓'));
 if(!visual.teaching.exists&&!visual.aid.exists)summary.push('南岸仍是开放河岸，尚无已存的读尺班或互助仓；待办与草案不会在这里提前变成建筑。');
 if(pending.length)summary.push(`互助合同已提交，待第${pending.map(e=>e.year).join('、')}年兑现；目前没有由这份待办产生的新互助仓。`);
 if(proven.some(p=>p.i.kind==='training'))summary.push('读尺班沿用D4建站后、E4第7年培训带来的教学安排；原始来源保留D4与E4归属，不补造南岸的独立培训结果。');
 const late=proven.filter(p=>p.i.kind==='mutual'&&p.year>23);
 if(late.length)summary.push(`第${[...new Set(late.map(p=>p.year))].join('、')}年兑现的互助服务面向后续生计，不改写第23年清点，也不替代读尺班或校验机构。`);
 if(local.length>proven.length)summary.push('部分现有载体的原始来源缺失或不一致：保留已存的当前形态与运行状态，来源经过未知，不补写成功经过，也不提供不可靠跳转。');
 const sourceIds=[...new Set([...proven.flatMap(p=>p.ids),...pending.map(e=>e.sourceActionId)])];
 let history=art.history;
 if(history?.recordId){
  const crisis=getCrisisHistory(state,history.recordId);
  const destinations=[history.recordId,...(crisis?.discovery||[]).map(r=>r.id),...(crisis?.responses||[]).flatMap(r=>[r.eventId,r.recordId,...r.chain.map(x=>x.id)])];
  if(!crisis||!unique('crisis-warning')||!destinations.every(safeTrace))history={...history,recordId:null,
   detail:[...history.detail,'原始来源链缺失、不唯一或现实标记不一致，暂不提供跳转；这里只保留已存清点数值。']};
 }
 return {summary,sourceIds,art:{...art,...(history?{history}:{})}};
}
