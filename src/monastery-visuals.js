import {getFutureCheckContracts,getFutureCheckSources,getArchiveUpgradeContracts,getArchiveUpgradeSources} from './simulation.js';
import {getReviewHistory} from './review-history.js';
// B4's library is an existing landmark. Preservation and review are separate
// recorded services inside it, never upgrades inferred from global flags.
export const MONASTERY_ARCHIVES=['none','kept','closed'];
export const MONASTERY_REVIEWS=['none','pending','failed','failed_closed','renewing','verified','recovered','closed','closed_recovered'];
export const MONASTERY_ASSET_STATES=MONASTERY_ARCHIVES.flatMap(archive=>MONASTERY_REVIEWS.map(review=>({archive,review,name:`monastery_${archive}_${review}`})));
export const MONASTERY_ASSETS=MONASTERY_ASSET_STATES.map(a=>a.name);
export function monasteryVisual(state){
 if(!state||!Number.isInteger(state.year)||state.year<0||!Array.isArray(state.cells)||!state.cells.some(c=>c.id==='B4'))return null;
 const history=state.history||[],events=state.events||[],institutions=state.institutions||[],rows=[...history,...events];
 const unique=(id,list)=>typeof id==='string'&&rows.filter(r=>r.id===id).length===1?list.find(r=>r.id===id):null;
 const verifiedReviews=getReviewHistory(state,null,'B4')?.responses||[];
 const local=institutions.filter(i=>i.cellId==='B4'&&i.kind==='independent'),live=i=>i.active===true&&i.maintenance>0;
 function contract(e){
  if(!e||e.cellId!=='B4'||e.kind!=='event'||!['preserve_records','independent_review','complete_review'].includes(e.actionId)||unique(e.id,events)!==e)return null;
  if(e.actionId!=='preserve_records'&&!verifiedReviews.some(r=>r.eventId===e.id&&r.cellId==='B4'&&r.status===e.status))return null;
  const source=unique(e.sourceActionId,history),[prefix,window,actor,cell,action,extra]=(e.sourceActionId||'').split(':');
  const year=Number(window),due=action==='preserve_records'?year+1:action==='independent_review'?(e.planningRulesVersion==='tradeoffs-v1'?22:21):32;
  if(prefix!=='action'||extra!==undefined||cell!=='B4'||action!==e.actionId||!state.actors?.some(a=>a.id===actor&&a.availableFrom<=year)||e.id!==`event:${e.sourceActionId}`||e.parentId!==e.sourceActionId||e.year!==due||year>state.year)return null;
  if(action==='preserve_records'?![0,10].includes(year):year!==(action==='independent_review'?20:30))return null;
  if(!source||source.kind!=='action'||source.status!=='confirmed'||source.reality!=='R1'||source.cellId!=='B4'||source.year!==year||source.parentId!==null||source.sourceActionId!==source.id)return null;
  if([source,e].some(row=>(row.reality!==undefined&&row.reality!=='R1')||(row.actorId!==undefined&&row.actorId!==actor)||(row.actionId!==undefined&&row.actionId!==action)))return null;
  if(action==='complete_review'&&(source.recoverySourceId!==e.recoverySourceId||source.recoveryInstitutionId!==e.recoveryInstitutionId))return null;
  return source;
 }
 function proof(i){
  if(institutions.filter(other=>other.id===i.id).length!==1)return null;
  const e=unique(i.sourceEventId,events),source=contract(e);
  if(!source||!['success','failed'].includes(e.status)||e.resolvedYear!==e.year||e.year>state.year||i.startYear!==e.year||i.sourceActionId!==e.sourceActionId||i.id!==`institution:${e.id}:B4`)return null;
  if(e.actionId!=='independent_review'&&e.status!=='success')return null;
  const result=unique(`resolved:${e.id}`,history);
  if(!result||result.reality!=='R1'||(result.actionId!==undefined&&result.actionId!==e.actionId)||(result.actorId!==undefined&&result.actorId!==e.sourceActionId.split(':')[2])||result.kind!==(e.status==='failed'?'failure':'outcome')||result.status!==e.status||result.cellId!=='B4'||result.year!==e.year||result.parentId!==e.id||result.sourceActionId!==e.sourceActionId)return null;
  return {i,e,source,result};
 }
 const futureContracts=[...getFutureCheckContracts(state),...getArchiveUpgradeContracts(state)].filter(c=>unique(c.eventId,events)&&unique(c.sourceActionId,history)?.reality==='R1'
  &&(!c.recordId||unique(c.recordId,history)?.reality==='R1'));
 const futureSources=[...getFutureCheckSources(state,{requireActive:false}),...getArchiveUpgradeSources(state,{requireActive:false})];
 const futureProven=futureContracts.filter(c=>c.status==='success'&&futureSources.some(p=>p.institutionId===c.institutionId)).map(c=>({
  i:institutions.find(i=>i.id===c.institutionId),e:unique(c.eventId,events),source:unique(c.sourceActionId,history),result:unique(c.recordId,history)}));
 const proven=[...local.map(proof).filter(Boolean),...futureProven],preserved=proven.filter(p=>p.e.actionId==='preserve_records');
 const failures=proven.filter(p=>p.e.actionId==='independent_review'&&p.e.status==='failed');
 const linked=e=>failures.some(p=>p.e.id===e.recoverySourceId&&p.i.id===e.recoveryInstitutionId);
 const checks=proven.filter(p=>p.e.status==='success'&&(p.e.actionId==='upgrade_archive_check'||p.e.actionId==='establish_future_check'||p.e.actionId==='independent_review'||p.e.actionId==='complete_review'&&linked(p.e)&&p.e.recoveryWorkforceIds?.length));
 const pending=events.filter(e=>e.status==='pending'&&e.year>state.year&&contract(e));
 const pendingPreserve=pending.filter(e=>e.actionId==='preserve_records');
 const awaiting=pending.find(e=>e.actionId==='complete_review'&&linked(e))||pending.find(e=>e.actionId==='independent_review')
  ||futureContracts.filter(c=>c.status==='pending').map(c=>unique(c.eventId,events))[0];
 const activeChecks=checks.filter(p=>live(p.i)),chosen=[...(activeChecks.length?activeChecks:checks)].sort((a,b)=>b.e.year-a.e.year)[0];
 const archive={exists:preserved.length>0,active:preserved.some(p=>live(p.i)),maintenanceGap:preserved.some(p=>live(p.i)&&p.i.maintenance<1),years:preserved.map(p=>p.e.year)};
 const review={exists:checks.length>0,active:activeChecks.length>0,late:chosen?.e.actionId==='complete_review',future:chosen?.e.actionId==='establish_future_check',upgrade:chosen?.e.actionId==='upgrade_archive_check',year:chosen?.e.year,maintenanceGap:activeChecks.some(p=>p.i.maintenance<1)};
 const failed={exists:failures.length>0,active:failures.some(p=>live(p.i)),year:failures[0]?.e.year,maintenanceGap:failures.some(p=>live(p.i)&&p.i.maintenance<1)};
 const archiveState=archive.exists?(archive.active?'kept':'closed'):'none';
 const stage=review.exists?(review.active?(review.late||review.future&&failed.exists?'recovered':'verified'):(review.late||review.future&&failed.exists?'closed_recovered':'closed')):awaiting?(awaiting.actionId==='complete_review'||awaiting.actionId==='establish_future_check'&&failed.exists?'renewing':'pending'):failed.exists?(failed.active?'failed':'failed_closed'):'none';
 const known=[...preserved,...failures,...checks];
 const name=`monastery_${archiveState}_${stage}`,parts=['修会藏书院原址保留'];
 if(archive.exists)parts.push(`第${archive.years.join('、')}年保档项目${archive.active?'仍在维护':'已停管，旧柜保留'}${archive.maintenanceGap?'，维护不足':''}（保档不等于本次复核成功）`);
 if(pendingPreserve.length)parts.push(`保档合同待第${pendingPreserve.map(e=>e.year).join('、')}年兑现，尚未形成新的保档载体`);
 if(failed.exists)parts.push(`第${failed.year}年复核失败底稿保留${failed.active?'':'（已停管）'}`);
 if(awaiting)parts.push(`${awaiting.actionId==='upgrade_archive_check'?'地方保档升级的新校验席':awaiting.actionId==='establish_future_check'?'从零新建的未来校验席':awaiting.actionId==='complete_review'?'后续校验':'交叉复核'}待第${awaiting.year}年核定，尚未形成新成果`);
 if(review.exists)parts.push(`${review.upgrade?'地方保档升级的未来指令校验席':review.future?'未来校验席':`${review.late?'后续':'交叉'}校验`}${review.active?'运行中':'已停运'}（第${review.year}年兑现${review.late||review.future||review.upgrade?'，只面向今后':''}）${review.maintenanceGap?'，维护不足':''}`);
 if(review.future)parts.push('从新水尺与抄本开始，不补写早年的失败，也不改写第23年清点');
 if(review.upgrade)parts.push('原保档原页保留，不是旧失败复核补做，不增加交班地域，也不改写第23年清点');
 for(const c of futureContracts.filter(c=>c.actionId==='upgrade_archive_check'&&c.status==='cancelled'))parts.push(`第${c.year}年保档升级取消，没有新校验席；已付成本不退，原档原页保留`);
 if(futureContracts.some(c=>c.actionId==='establish_future_check'&&c.status==='cancelled'))parts.push('第34年未来校验合同取消，没有建成新的校验席；已付成本与原记录保留');
 if(!archive.exists&&!failed.exists&&!review.exists&&!awaiting&&!pendingPreserve.length)parts.push('尚无新增的已核实保档或复核载体');
 if(events.some(e=>['upgrade_archive_check','establish_future_check'].includes(e.actionId)&&!futureContracts.some(c=>c.eventId===e.id)))parts.push('另有未来校验合同来源缺失或不一致，结果未知，不补作成功或取消');
 if(local.length>known.length)parts.push('另有来源不完整的载体，不补作成功结论');
 const archiveAlt={none:'左侧没有新增的保档柜；既有藏书与建筑不表示玩家已经完成保档项目。',kept:'左侧保档柜保存不同来源的旧洪水刻度与分册记录，不等于一次交叉复核已经成功。',closed:'左侧既有保档柜被绑起封存，旧记录保留，不表示项目仍在维护。'}[archiveState];
 let reviewAlt={none:'右侧尚无新增的复核台。',pending:'右侧挂起空白工单，只表示已提交待核；没有双册对照或完成标记。',failed:'右侧留下捆好的断线底稿，表示复核失败，不是成功的校验台。',failed_closed:'右侧失败底稿仍保留，保管处封起，没有正在整理的人员。',renewing:'原失败底稿旁挂起空白工单，等待后续核定；没有提前出现成功对照。',verified:'右侧双册对照台来自真实成功的交叉复核，与左侧保档项目是不同载体。',recovered:'右侧新的双册对照台与旧失败底稿并存，后续成功不改写原失败或第23年清点。',closed:'右侧曾经成功工作的对照台已经封起，不表示仍在提供校验。',closed_recovered:'右侧后续对照台已经封起，原失败底稿仍在，两段历史没有被抹去。'}[stage];
 if(review.upgrade)reviewAlt=`右侧${review.active?'双册对照台来自第33年真实完成的保档升级':'第33年完成的保档升级对照台已经封起'}，左侧原保档柜另行保留；不是冲击前成功复核，也不是失败底稿补做。`;
 else if(awaiting?.actionId==='upgrade_archive_check')reviewAlt='右侧空白工单表示地方保档升级待第33年核对原档与真实人手，尚无新对照台或成功标记；左侧保档柜不是已经完成的新校验。';
 else if(review.future)reviewAlt=`右侧${review.active?'新的双册对照台来自第34年真实建成的未来校验席':'第34年建成的未来校验席已经封起，不表示仍在工作'}，不是第22年的复核或第32年的失败补做。${failed.exists?'旧失败底稿另行保留，新席没有改写旧记录。':'这里没有凭空添加旧失败底稿。'}`;
 else if(awaiting?.actionId==='establish_future_check')reviewAlt=`右侧空白工单表示从零新建的未来校验席待第34年兑现，尚无新对照台或成功标记。${failed.exists?'既有失败底稿单独保留，不是这份新建合同的来源。':''}`;
 const sourceIds=[...new Set([...known.flatMap(p=>[p.source.id,p.result.id]),...pending.filter(e=>e.actionId!=='complete_review'||linked(e)).map(e=>e.sourceActionId),...futureContracts.flatMap(c=>[c.sourceActionId,...(c.recordId?[c.recordId]:[]),...(c.archiveSourceRecordId?[c.archiveSourceRecordId]:[])])])];
 return {archive,review,failed,pending:awaiting?{id:awaiting.id,year:awaiting.year}:null,archiveState,stage,prop:name,file:`${name.replaceAll('_','-')}.svg`,label:parts.join(' · '),alt:`B4修会藏书院的阶梯屋檐、尖顶与小旗仍在。${archiveAlt}${reviewAlt}这些项目的停管不等于整座藏书院被关闭。`,sourceIds};
}
