import {getWindowReview,getHandoffReadiness,getRecoveryWorkforce,getArchiveUpgradeWorkforce,hasCompletedRecovery,hasCompletedFutureCheck,hasCompletedArchiveUpgrade,FUTURE_CHECK_RULES,ARCHIVE_UPGRADE_RULES,usesHandoffRules,usesTradeoffs} from './simulation.js';

const unique = values => [...new Set(values)];
const POLICIES = ['share_power','withdraw','central_review'];
// A descriptive comparison, not a simulated future. No RNG, annual ticks,
// fabricated outcomes, or writes to the player's world are used here.
export function getHandoffOutlook(state) {
  if (state.year !== 30 || state.phase !== 'planning') return null;
  const review = getWindowReview(state), model = usesHandoffRules(state) ? 'mandate' : usesTradeoffs(state) ? 'regional' : 'legacy';
  const selected = review.tasks.find(t => POLICIES.includes(t.a.id));
  const policy = selected ? {actionId:selected.a.id,actorId:selected.d.actorId,dueYear:30+selected.a.dueIn} : null;
  const live = state.institutions.filter(i=>i.active&&i.maintenance>0);
  const readiness = model==='mandate' ? getHandoffReadiness(state) : null;
  const currentStaff = readiness ? readiness.staffCells : unique(live.filter(i=>i.kind==='school').map(i=>i.cellId));
  const currentChecks = readiness ? readiness.checkCells : unique(live.filter(i=>i.kind==='independent'&&state.events.some(e=>e.id===i.sourceEventId&&e.status==='success')).map(i=>i.cellId));
  const trust = state.flags.trust ?? !!state.flags.renewed;
  const currentCommandCheck = !!state.flags.review || hasCompletedRecovery(state) || hasCompletedFutureCheck(state) || hasCompletedArchiveUpgrade(state);
  const capability = (staff, authorized, checks, extraNetworks=0, commandCheck=currentCommandCheck) => {
    const staffCells=unique(staff), checkCells=unique(checks), authorizedCells=model==='mandate'?unique(authorized):null;
    const links=model==='mandate'?authorizedCells.flatMap(staffCell=>checkCells.filter(checkCell=>checkCell!==staffCell).map(checkCell=>({staffCell,checkCell}))):null;
    const networks=model==='legacy'?(state.flags.networks||0)+extraNetworks:staffCells.length;
    const autonomy=model==='legacy'?networks+(state.flags.independentArchive?1:0)+(state.flags.review?1:0):unique([...(authorizedCells||staffCells),...checkCells]).length;
    const canWithdraw=model==='mandate'?links.length>0:autonomy>=2&&(model==='legacy'||networks>=1);
    const canShare=canWithdraw&&trust, missing=[];
    if(model==='mandate') {
      if(!staffCells.length)missing.push('缺少运转中的培训或教学人手');
      else if(!authorizedCells.length)missing.push('现有人手尚缺地方承接授权');
      if(!checkCells.length)missing.push('缺少成功工作的异源校验载体');
      if(authorizedCells.length&&checkCells.length&&!links.length)missing.push('人手与校验仍在同一地域，缺少跨地承接关系');
    } else {
      if(model==='regional'&&!networks)missing.push('旧规则仍需至少一处现存学校或轮值网络');
      if(autonomy<2)missing.push(model==='regional'?'旧规则自治支点尚不足两个不同地域':'旧规则独立能力合计尚不足2');
    }
    const shareMissing=[...missing,...(!trust?[state.flags.trust===false?'河港明确拒绝当前安排':'河港尚未作出合作承诺']:[])];
    const policyStatus=!policy?'no-policy':policy.actionId==='central_review'?'central':policy.actionId==='share_power'?(canShare?'share-ready':'incomplete'):(canWithdraw?'withdraw-ready':'incomplete');
    return {staffCells,authorizedCells,checkCells,links,trust,canWithdraw,canShare,networks,autonomy,missing,shareMissing,policyStatus,commandCheck};
  };
  const current=capability(currentStaff,readiness?.authorizedCells||[],currentChecks);
  const issues=[...review.issues];
  if(state.events.some(e=>e.status==='pending'&&e.year<=40))issues.push('仍有尚未兑现的既有合同，暂不猜测它们对交班的影响。请核对年度记录。');
  if(review.tasks.some(t=>!['train_network','mutual_aid','complete_review',FUTURE_CHECK_RULES.actionId,ARCHIVE_UPGRADE_RULES.actionId,'open_port_warning',...POLICIES].includes(t.a.id)||t.a.probability!==1))issues.push('存在本对照尚未定义的合同，暂不承诺兑现后的交班能力。');
  if(issues.length)return {ready:false,issues,model,policy,current};
  const training=review.tasks.filter(t=>t.a.id==='train_network');
  const staff=[...currentStaff,...training.map(t=>t.d.cellId)], authorized=[...(readiness?.authorizedCells||[]),...training.map(t=>t.d.cellId)];
  const workforce=getRecoveryWorkforce(state).length>0;
  const conditional=review.tasks.filter(t=>['complete_review',FUTURE_CHECK_RULES.actionId,ARCHIVE_UPGRADE_RULES.actionId].includes(t.a.id)).map(t=>({actorId:t.d.actorId,cellId:t.d.cellId,dueYear:30+t.a.dueIn,supported:(t.a.id===ARCHIVE_UPGRADE_RULES.actionId?getArchiveUpgradeWorkforce(state).length>0:workforce)||training.some(plan=>30+plan.a.dueIn<30+t.a.dueIn),...([FUTURE_CHECK_RULES.actionId,ARCHIVE_UPGRADE_RULES.actionId].includes(t.a.id)?{actionId:t.a.id}:{})}));
  const withoutRecovery=capability(staff,authorized,currentChecks,training.length);
  const projected=capability(staff,authorized,[...currentChecks,...conditional.filter(c=>c.supported).map(c=>c.cellId)],training.length,currentCommandCheck||conditional.some(c=>c.supported));
  const contracts=review.tasks.map(({d,a})=>({actorId:d.actorId,cellId:d.cellId,actionId:a.id,title:a.title,dueYear:30+a.dueIn,conditional:!!a.conditional}));
  const serviceConditional=contracts.filter(c=>c.actionId==='open_port_warning');
  return {ready:true,issues:[],model,policy,current,projected,withoutRecovery,withoutConditionalChecks:withoutRecovery,contracts,conditional,serviceConditional,
    notes:[
      '这只是已锁定合同的条件对照，不提前兑现、不抽随机，也不预告结局标题。最终按第40年的真实存续状态核对。',
      '假设当前载体继续运行，确定合同按时落实。新增培训第31年提供本地人手；互助改善生计，不替代教学、异源校验或交班方针。',
      '远港公开预警第31年仍须原分站有效运转且尚未开放；条件失效则取消不退费。它只改变当地准入，不改变本表的人手、授权、校验、信任或方针。',
      ...(conditional.some(c=>c.actionId===FUTURE_CHECK_RULES.actionId)?['从零建设未来校验席第34年仍须实际测量或教学人手有效，31年新培训可赶上期限；条件不符则取消且材料成本不退。它不需要也不补造旧失败底稿，下方同时保留未建成分支。']:[]),
      ...(conditional.some(c=>c.actionId===ARCHIVE_UPGRADE_RULES.actionId)?['保档升级第33年仍须原B4保档与实际测量或教学人手有效；31年培训可赶上，任一条件失效则取消不退费。已有保档本就提供B4交班方法，升级不新增地域、授权或信任，只让它接成未来指令校验。']:[]),
      ...(!conditional.length||conditional.some(c=>!c.actionId)?['后续校验第32年仍须原失败记录与实际测量或教学人手有效。若条件不符，会取消且费用不退；下方同时保留未完成校验的分支。']:[]),
      model==='mandate'?'人手、地方授权、跨地异源校验与河港信任分别核对。同源培训人数不能冒充独立方法；共享另需信任，退出不以同意代替实际承接能力。':model==='regional'?'本局保留旧版地域规则：学校与成功校验按不同地域计数，至少两地且有学校；不追补新版本的授权要求。':'本局保留旧版累计规则：网络次数加保档、成功复核标记。不把旧承诺改算为新版本的地域或授权要求。',
      '集中协调是一种方针，不表示已完成交班；保档支点也不等于完成指令复核。培训和后续校验若用完两个名额，本轮就没有另外签署方针。第23年结果与原失败记录不会改变。'
    ]};
}
