import {usesTradeoffs,STAFFING_RULES} from './simulation.js';
import {getFeeHistory} from './fee-history.js';
const one=(rows,id)=>{const all=rows.filter(x=>x?.id===id);return all.length===1?all[0]:null;};
// NEW reconstruction, not the lost candidate. Read-only conservative provenance.
export function renewalDisplay(s,a,cellId){
 if(!a||a.id!=='renew_charter'||cellId!=='D4'||s?.year!==10||s.phase!=='planning'||!usesTradeoffs(s)||s.planningRulesVersion!=='tradeoffs-v1')return a;
 const h=s.history||[],e=s.events||[],inst=s.institutions||[],all=[...h,...e];
 const stations=inst.filter(x=>x.kind==='station'&&x.cellId==='D4');if(stations.length!==1)return a;
 const st=stations[0],event=one(e,st.sourceEventId),kind=event?.actionId;
 if(!['build_merchant','build_state','build_joint'].includes(kind))return a;
 const source=`action:0:protagonist:D4:${kind}`,year=kind==='build_merchant'?2:3,act=one(h,source),out=one(h,`resolved:event:${source}`),actor=one(s.actors||[],'protagonist');
 if(!actor||actor.availableFrom!==0||!st.active||typeof st.open!=='boolean'||st.open!==(kind!=='build_merchant')||st.startYear!==year||st.sourceActionId!==source||st.id!==`institution:event:${source}:D4`||one(inst,st.id)!==st
 ||!event||one(all,event.id)!==event||event.id!==`event:${source}`||event.kind!=='event'||event.cellId!=='D4'||event.status!=='success'||event.year!==year||event.resolvedYear!==year||event.sourceActionId!==source||event.parentId!==source
 ||!act||one(all,source)!==act||act.kind!=='action'||act.status!=='confirmed'||act.year!==0||act.cellId!=='D4'||act.parentId!==null||act.sourceActionId!==source||act.reality!=='R1'
 ||!out||one(all,out.id)!==out||out.kind!=='outcome'||out.status!=='success'||out.year!==year||out.cellId!=='D4'||out.parentId!==event.id||out.sourceActionId!==source||out.reality!=='R1'
 ||h.some(x=>x.id==='pass:0:protagonist')||h.filter(x=>x.kind==='action'&&x.id?.startsWith('action:0:protagonist:')).length!==1
 ||[act,event,out].some(x=>(x.actorId!==undefined&&x.actorId!=='protagonist')||(x.actionId!==undefined&&x.actionId!==kind)||(x.reality!==undefined&&x.reality!=='R1'))
 ||!Array.isArray(act.evidence)||(kind==='build_joint'&&!['independent_flood_records','unfunded_maintenance'].every(id=>act.evidence.includes(id)&&(!event.evidence||event.evidence.includes(id))))
 ||e.some(x=>x.actionId==='renew_charter')||h.some(x=>x.id==='charter-lapsed'))return a;
 const change=st.open?'D4原公开测站保持公开并足额维护':'D4原收费测站取消预警缴费门槛，改为公开并足额维护';
 return {...a,description:`若第11年兑现，${change}。仅调整D4，不自动开放F6；费用与本轮主角名额不变。`,reward:`若第11年兑现，${change}。不自动改变F6准入；未来分站仍按本局规则和原链条件生成。地方复核授权不等于完成异源校验。`,modelNote:`第11年核对兑现后，${change}。${(a.modelNote||'').replace('维持河港公开、足额维护；','')}`};
}
export function feeRecordDisplay(s,record){
 if(record?.id!=='charter-lapsed'||!usesTradeoffs(s)||s?.planningRulesVersion!=='tradeoffs-v1'||s.staffingRulesVersion!==STAFFING_RULES.version)return null;
 const f=getFeeHistory(s,record.id);
 if(f?.status!=='merchant-retained'||!f.original||!['id','year','cellId','title','text','kind','status','parentId','sourceActionId','reality'].every(k=>f.original[k]===record[k]))return null;
 return {title:'商会测站：长期经费与维护缺口',text:f.summary,originalTitle:record.title,originalText:record.text};
}
