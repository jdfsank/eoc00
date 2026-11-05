// Read-only presentation of existing F6 carriers and their recorded outcomes.
// This never predicts a roll or upgrades an old failure into a later success.
export const FAR_PORT_STAGES=['none','failed','failed_closed','pending','verified','recovered','closed'];
export const FAR_PORT_ASSETS=['shore','branch','branch_closed'].flatMap(place=>FAR_PORT_STAGES.filter(stage=>place!=='shore'||stage!=='none').map(stage=>`far_port_${place}_${stage}`));
export function farPortVisual(state){
 const local=state.institutions.filter(i=>i.cellId==='F6'),events=state.events||[],history=state.history||[];
 const live=i=>i.active!==false&&i.maintenance>0;
 const branches=local.filter(i=>i.kind==='branch'),operating=branches.filter(live);
 const branch={exists:branches.length>0,active:operating.length>0,maintenanceGap:operating.some(i=>i.maintenance<1),restricted:operating.some(i=>i.open===false)};
 const source=e=>history.find(h=>h.id===e.sourceActionId&&h.kind==='action'&&h.sourceActionId===e.sourceActionId&&h.cellId==='F6'&&h.year<e.year);
 const proven=i=>{
  const e=events.find(e=>e.id===i.sourceEventId&&e.sourceActionId===i.sourceActionId&&e.cellId==='F6');
  if(!e||!['independent_review','complete_review'].includes(e.actionId)||!['success','failed'].includes(e.status)||e.resolvedYear!==e.year||e.year>state.year||i.startYear!==e.year||i.id!==`institution:${e.id}:F6`||!source(e))return null;
  const [prefix,year,actor,place,action,extra]=(e.sourceActionId||'').split(':');
  if(prefix!=='action'||extra!==undefined||place!=='F6'||action!==e.actionId||year!==(action==='complete_review'?'30':'20')||e.id!==`event:${e.sourceActionId}`||e.parentId!==e.sourceActionId||e.kind!=='event'||source(e).year!==Number(year)||source(e).parentId!==null)return null;
  if(action==='complete_review'&&(e.year!==32||source(e).recoverySourceId!==e.recoverySourceId||source(e).recoveryInstitutionId!==e.recoveryInstitutionId))return null;
  const outcome=history.find(h=>h.id===`resolved:${e.id}`&&h.parentId===e.id&&h.sourceActionId===e.sourceActionId&&h.cellId==='F6'&&h.year===e.year&&h.status===e.status&&h.kind===(e.status==='failed'?'failure':'outcome'));
  if(!outcome)return null;
  return {institution:i,event:e};
 };
 const recorded=local.filter(i=>i.kind==='independent').map(proven).filter(Boolean);
 const failures=recorded.filter(r=>r.event.actionId==='independent_review'&&r.event.status==='failed');
 const failed={exists:failures.length>0,active:failures.some(r=>live(r.institution)),year:failures[0]?.event.year};
 const linked=e=>failures.some(r=>r.event.id===e.recoverySourceId&&r.institution.id===e.recoveryInstitutionId);
 const checks=recorded.filter(r=>r.event.status==='success'&&(r.event.actionId!=='complete_review'||linked(r.event)&&r.event.recoveryWorkforceIds?.length));
 const working=checks.filter(r=>live(r.institution)),chosen=[...(working.length?working:checks)].sort((a,b)=>b.event.year-a.event.year)[0];
 const check={exists:checks.length>0,active:working.length>0,maintenanceGap:working.some(r=>r.institution.maintenance<1),late:chosen?.event.actionId==='complete_review',year:chosen?.event.year};
 const pending=events.find(e=>e.cellId==='F6'&&e.actionId==='complete_review'&&e.status==='pending'&&e.year===32&&e.year>state.year&&e.id===`event:${e.sourceActionId}`&&e.parentId===e.sourceActionId&&source(e)?.year===30&&source(e).recoverySourceId===e.recoverySourceId&&source(e).recoveryInstitutionId===e.recoveryInstitutionId&&linked(e))||null;
 if(!branch.exists&&!failed.exists&&!check.exists)return null;
 const stage=check.exists?(check.active?(check.late?'recovered':'verified'):'closed'):pending?'pending':failed.exists?(failed.active?'failed':'failed_closed'):'none';
 const place=branch.exists?(branch.active?'branch':'branch_closed'):'shore';
 const prop=`far_port_${place}_${stage}`,parts=[];
 if(branch.exists)parts.push(`远港分站${branch.active?'运行中':'停运，原址保留'}${branch.maintenanceGap?'，维护不足':''}${branch.restricted?'，收费门槛':''}`);
 if(failed.exists)parts.push(`第${failed.year}年复核失败记录保留${failed.active?'':'（已停管）'}`);
 if(pending)parts.push(`后续校验待第${pending.year}年核定，尚未形成新校验组`);
 if(check.exists)parts.push(`${check.late?'后续':'异源'}校验组${check.active?'运行中':'已停运'}（第${check.year}年兑现${check.late?'，只面向今后':''}）${check.maintenanceGap?'，维护不足':''}`);
 const branchAlt=branch.exists?`原远港分站、短码头和水尺仍在，${branch.active?'窗口保持在用':'窗门封板，分站已停运'}。`:'这里没有分站建筑，只有船工的河岸记录平台。';
 const stageAlt={none:'没有凭空出现独立校验机构。',failed:'单册未完成底稿被收进留有断线纹样的纸夹；这是失败后保留的记录，不是成功校验。',failed_closed:'失败底稿仍在，保管台已用木条封起；这里没有运行中的校验组。',pending:'原失败纸夹旁挂起空白工单与沙漏标记，只表示合同已提交、尚待核定；没有新增校验组或完成印记。',verified:'独立校验桌上展开两册对照记录，表示已有实际成功结果，不表示未来永不出错。',recovered:'新对照桌展开两册记录，旁边仍保留原来的失败纸夹；后续校验已真实兑现，不曾改写原失败或第23年的损失。',closed:'曾投入工作的校验桌已被木条封起，历史纸夹与账册仍在；这不表示现在仍有校验服务。'}[stage];
 return {branch,failed,check,pending:pending?{id:pending.id,year:pending.year}:null,stage,prop,file:`${prop.replaceAll('_','-')}.svg`,label:parts.join(' · '),alt:`F6远港支流码头。${branchAlt}${stageAlt}`};
}
