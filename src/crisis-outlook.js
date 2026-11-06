import {PLANNING_RULES,FLOOD_REGIONS,getWindowReview,getWarningCoverage,getCrisisLosses,usesLegacyCrisisRules,usesTradeoffs,usesAftermathRules} from './simulation.js';

// A small public contract fact is descriptive, not a draft that can be submitted.
export function crisisContractFact(state, {d,a}) {
  return {actorId:d.actorId,cellId:d.cellId,actionId:a.id,probability:a.probability,dueYear:state.year+a.dueIn,
    ...(a.id==='local_veto'?{vetoMitigation:usesTradeoffs(state)&&d.evidence.includes('evacuation_routes')?PLANNING_RULES.surveyedVeto:.3}:{})};
}

// Shared conditional projection for issued contracts and explicitly hypothetical
// choices. No state clone, validation of private save fields, RNG, or settlement.
export function projectCrisisContracts(state, contracts, planningIssues = []) {
  const legacy = usesLegacyCrisisRules(state);
  const current = legacy ? null : getWarningCoverage(state);
  const currentCoverage = legacy ? null : Object.fromEntries(FLOOD_REGIONS.map(id => [id, current[id].coverage]));
  const attempts = contracts.filter(a=>a.actionId==='independent_review').map(a=>({actorId:a.actorId,cellId:a.cellId,probability:a.probability,dueYear:a.dueYear}));
  const issues = [...planningIssues];
  if (state.events.some(e => e.status === 'pending' && e.year <= 23)) issues.push('仍有尚未兑现的既有合同，本轮暂不把它们猜成既成保护。请按年度记录核对。');
  if (contracts.some(a=>a.actionId!=='independent_review'&&a.probability!==1)) issues.push('存在未确定的地方服务合同，暂不能给出单一的兑现后覆盖。');
  if (issues.length) return {ready:false,legacy,issues,attempts,currentCoverage};
  // Explicit allowlist: descriptions, evidence bodies, random rolls, future
  // results and unrelated flags are not copied or even read.
  const view = {
    institutions:state.institutions.map(i=>({id:i.id,kind:i.kind,cellId:i.cellId,active:i.active,open:i.open,maintenance:i.maintenance,sourceActionId:i.sourceActionId})),
    flags:{review:state.flags.review,veto:state.flags.veto,vetoMitigation:state.flags.vetoMitigation,aid:state.flags.aid,freeWarning:state.flags.freeWarning,successor:state.flags.successor,recruited:state.flags.recruited},
    year:state.year,cells:state.cells,history:state.history,events:state.events,
    recruitmentRulesVersion:state.recruitmentRulesVersion,staffingRulesVersion:state.staffingRulesVersion,crisisRulesVersion:state.crisisRulesVersion,aftermathRulesVersion:state.aftermathRulesVersion,
  };
  const pending = contracts.map(a=>({actorId:a.actorId,cellId:a.cellId,actionId:a.actionId,dueYear:a.dueYear}));
  const add = (kind,cellId,d) => view.institutions.push({id:`outlook:${d.actorId}:${kind}:${cellId}`,kind,cellId,active:true,open:true,maintenance:1,sourceActionId:null});
  // Preparation probabilities above were fixed before these conditional effects.
  for (const contract of contracts) {
    if (contract.actionId === 'free_warning') {
      view.flags.freeWarning = true;
      const stations = view.institutions.filter(i => i.cellId === 'D4' && i.kind === 'station');
      if (stations.length) { view.flags.successor = true; for (const i of stations) { i.active=true;i.open=true;i.maintenance=1; } }
      else add('warning','D4',contract);
    } else if (contract.actionId === 'train_network') add('school',contract.cellId,contract);
    else if (contract.actionId === 'mutual_aid') { add('mutual','D5',contract);view.flags.aid=true; }
    else if (contract.actionId === 'relocate_teacher') { for(const i of view.institutions.filter(i=>i.cellId==='D4'))i.active=false;add('school','E4',contract); }
  }
  const plannedVeto = contracts.filter(a=>a.actionId==='local_veto').map(a=>a.vetoMitigation);
  const existingVeto = state.flags.veto ? (usesTradeoffs(state)?state.flags.vetoMitigation??.3:.3) : 1;
  const vetoBase = Math.min(existingVeto,...plannedVeto);
  const guaranteedReview = !!state.flags.review || attempts.some(a=>a.probability===1);
  const losses = legacy ? null : getCrisisLosses(view,vetoBase);
  const regions = legacy ? [] : FLOOD_REGIONS.map(cellId=>({cellId,currentCoverage:current[cellId].coverage,coverage:losses.coverageByCell[cellId],protection:losses.protectionByCell[cellId],aid:view.institutions.some(i=>i.cellId===cellId&&i.kind==='mutual'&&i.active&&(!usesAftermathRules(state)||i.maintenance>0))}));
  const damageByCell = legacy ? null : losses.damageByCell;
  const damage = legacy ? vetoBase*(view.flags.aid?.7:1)*(view.flags.freeWarning?.8:1) : losses.damage;
  return {ready:true,legacy,issues:[],attempts,currentCoverage,pending,vetoBase,guaranteedReview,regions,
    success:{available:!!state.flags.review||attempts.length>0,damageByCell:legacy?null:Object.fromEntries(FLOOD_REGIONS.map(id=>[id,0])),damage:0},
    fallback:{possible:!guaranteedReview,base:vetoBase,damageByCell,damage},
    notes:[
      '只按指定合同列出条件分支，不使用种子推算未来随机结果，也不预先兑现合同。系数是原型假设，不是人口、伤亡或现实概率预测。',
      '复核准备取提交前的现有档案与人手。同轮新办培训、传讯或互助不会反过来提高这份复核概率。',
      '多份复核逐项判定，任一成功即可纠正共同指令；不把各次概率合并成一个未经验证的整轮概率。停闸采用较强的一份，不重复相乘。',
      legacy?'旧档沿用整体公式：停闸基数 × 已兑现互助0.70 × 已兑现免费预警0.80。不补造逐地损失。':'兑现后覆盖仅纳入指定的确定服务合同。第23年按当地覆盖、来源保护与互助分别结算；成功复核消除的是共同标准失效，不是洪水本身。'
    ]};
}

export function getCrisisOutlook(state) {
  if (state.year !== 20 || state.phase !== 'planning') return null;
  const review = getWindowReview(state);
  const outlook = projectCrisisContracts(state,review.tasks.map(task=>crisisContractFact(state,task)),review.issues);
  if(outlook.ready) outlook.notes[0] = '只按已锁定方案列出条件分支，不使用种子推算未来随机结果，也不预先兑现合同。系数是原型假设，不是人口、伤亡或现实概率预测。';
  return outlook;
}
