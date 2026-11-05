import {COVERAGE_RULES,PLANNING_RULES,FLOOD_REGIONS,getWindowReview,getWarningCoverage,usesLegacyCrisisRules,usesTradeoffs,usesAftermathRules} from './simulation.js';

const rounded = n => Math.round(Math.max(0, Math.min(1, n)) * 10000) / 10000;
// A conditional explanation of issued planning facts, never a trial run. This
// module intentionally does not import randomFor, resolve, or advanceYear.
export function getCrisisOutlook(state) {
  if (state.year !== 20 || state.phase !== 'planning') return null;
  const review = getWindowReview(state), legacy = usesLegacyCrisisRules(state);
  const current = legacy ? null : getWarningCoverage(state);
  const currentCoverage = legacy ? null : Object.fromEntries(FLOOD_REGIONS.map(id => [id, current[id].coverage]));
  const attempts = review.tasks.filter(t => t.a.id === 'independent_review').map(({d,a}) => ({actorId:d.actorId,cellId:d.cellId,probability:a.probability,dueYear:state.year+a.dueIn}));
  const issues = [...review.issues];
  // Ordinary year20 runs have no unresolved earlier contracts. Do not guess
  // about imported exceptional schedules or silently omit their effects.
  if (state.events.some(e => e.status === 'pending' && e.year <= 23)) issues.push('仍有尚未兑现的既有合同，本轮暂不把它们猜成既成保护。请按年度记录核对。');
  if (review.tasks.some(t => t.a.id !== 'independent_review' && t.a.probability !== 1)) issues.push('存在未确定的地方服务合同，暂不能给出单一的兑现后覆盖。');
  if (issues.length) return {ready:false,legacy,issues,attempts,currentCoverage};
  const view = {institutions:structuredClone(state.institutions),flags:structuredClone(state.flags),cells:state.cells,history:state.history,events:state.events,recruitmentRulesVersion:state.recruitmentRulesVersion};
  const pending = review.tasks.map(({d,a}) => ({actorId:d.actorId,cellId:d.cellId,actionId:a.id,dueYear:state.year+a.dueIn}));
  const add = (kind,cellId,d) => view.institutions.push({id:`outlook:${d.actorId}:${kind}:${cellId}`,kind,cellId,active:true,open:true,maintenance:1,startYear:21,sourceActionId:null});
  // Only certain regional contracts are applied to an isolated descriptive
  // snapshot. Preparation/probabilities above were read BEFORE these effects.
  for (const {d,a} of review.tasks) {
    if (a.id === 'free_warning') {
      view.flags.freeWarning = true;
      const stations = view.institutions.filter(i => i.cellId === 'D4' && i.kind === 'station');
      if (stations.length) { view.flags.successor = true; for (const i of stations) { i.active=true;i.open=true;i.maintenance=1; } }
      else add('warning','D4',d);
    } else if (a.id === 'train_network') add('school',d.cellId,d);
    else if (a.id === 'mutual_aid') { add('mutual','D5',d);view.flags.aid=true; }
    else if (a.id === 'relocate_teacher') { for(const i of view.institutions.filter(i=>i.cellId==='D4'))i.active=false;add('school','E4',d); }
  }
  const plannedVeto = review.tasks.filter(t=>t.a.id==='local_veto').map(t=>usesTradeoffs(state)&&t.d.evidence.includes('evacuation_routes')?PLANNING_RULES.surveyedVeto:.3);
  const existingVeto = state.flags.veto ? (usesTradeoffs(state)?state.flags.vetoMitigation??.3:.3) : 1;
  const vetoBase = Math.min(existingVeto,...plannedVeto);
  const guaranteedReview = !!state.flags.review || attempts.some(a=>a.probability===1);
  const service = legacy ? null : getWarningCoverage(view);
  const regions = legacy ? [] : FLOOD_REGIONS.map(cellId=>({cellId,currentCoverage:current[cellId].coverage,coverage:service[cellId].coverage,protection:service[cellId].protection,aid:view.institutions.some(i=>i.cellId===cellId&&i.kind==='mutual'&&i.active&&(!usesAftermathRules(state)||i.maintenance>0))}));
  const damageByCell = legacy ? null : Object.fromEntries(regions.map(r=>[r.cellId,rounded(vetoBase*(1-COVERAGE_RULES.warningProtection*r.coverage)*(1-r.protection)*(r.aid?1-COVERAGE_RULES.mutualAid:1))]));
  const damage = legacy ? vetoBase*(view.flags.aid?.7:1)*(view.flags.freeWarning?.8:1) : rounded(Object.values(damageByCell).reduce((sum,n)=>sum+n,0)/FLOOD_REGIONS.length);
  return {ready:true,legacy,issues:[],attempts,currentCoverage,pending,vetoBase,guaranteedReview,regions,
    success:{available:!!state.flags.review||attempts.length>0,damageByCell:legacy?null:Object.fromEntries(FLOOD_REGIONS.map(id=>[id,0])),damage:0},
    fallback:{possible:!guaranteedReview,base:vetoBase,damageByCell,damage},
    notes:[
      '只按已锁定方案列出条件分支，不使用种子推算未来随机结果，也不预先兑现合同。系数是原型假设，不是人口、伤亡或现实概率预测。',
      '复核准备取提交前的现有档案与人手。同轮新办培训、传讯或互助不会反过来提高这份复核概率。',
      '多份复核逐项判定，任一成功即可纠正共同指令；不把各次概率合并成一个未经验证的整轮概率。停闸采用较强的一份，不重复相乘。',
      legacy?'旧档沿用整体公式：停闸基数 × 已兑现互助0.70 × 已兑现免费预警0.80。不补造逐地损失。':'兑现后覆盖仅纳入本轮已锁定的确定服务合同。第23年按当地覆盖、来源保护与互助分别结算；成功复核消除的是共同标准失效，不是洪水本身。'
    ]};
}
