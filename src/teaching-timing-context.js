import {getPlanningOpportunity} from './planning-opportunity.js';
import {getActions,getActors,getWarningCoverage,getPublicPlanningStateIssues,usesLegacyCrisisRules,usesHandoffRules,getHandoffReadiness,COVERAGE_RULES} from './simulation.js';

// Iteration49 rebuild: public current facts and an explicitly conditional ceiling,
// never a forecast, new settlement, or reconstruction of the lost implementation.
export function getTeachingTimingContext(state, {actorId,cellId,actionId} = {}) {
 try {
  if (!state || state.phase !== 'planning' || cellId !== 'E4'
   || ![10,20,30].includes(state.year)
   || actionId !== (state.year === 10 ? 'fund_school' : 'train_network')
   || getPublicPlanningStateIssues(state).length
   || !getActors(state).some(actor => actor.id === actorId)) return null;
  const action=getActions(state,cellId,actorId).find(a=>a.id===actionId);
  if (!action || action.dueIn !== 1) return null;
  const year=state.year,dueYear=year+action.dueIn,crisisYear=23,legacy=usesLegacyCrisisRules(state);
  const current=legacy?null:getWarningCoverage(state)[cellId]?.coverage;
  if (!legacy && (!Number.isFinite(current)||current<0||current>1)) return null;
  // Presentation-only snapshot. Never change contracts, costs or old-save rules.
  const opportunity=year===30?getPlanningOpportunity(state,{actorId,cellId,actionId}):null;
  const roleCost=opportunity?{summary:opportunity.contextText,detail:opportunity.roleText}:null;
  const readiness=actionId==='train_network'&&usesHandoffRules(state)?getHandoffReadiness(state):null;
  const handoffGap=readiness?.authorizedCells.length&&!readiness.checkCells.length
   ?{authorizedCells:[...readiness.authorizedCells],
     summary:'已有获授权的承接人手，当前仍缺异源校验；继续培训不能补上这项交班缺口。',
     detail:`当前已获地方授权的人手位于${readiness.authorizedCells.join('、')}。培训仍可增加当地维护产出，但不新增异源校验。它占用本角色本轮一个名额，不能同时用于${year===20?'交叉复核':actorId==='protagonist'?'未来校验或签署交班方针':'本角色其他工作'}；这里仅列已兑现能力，不把本轮安排当作已完成校验。其他角色是否能补足，须看各自可用行动和名额。最终交班仍按实际存续条件核对。`}
   :null;
  return {actorId,cellId,actionId,year,dueYear,crisisYear,handoffGap,roleCost,model:legacy?'legacy-overall':'regional',
   currentCoverage:current,conditionalCoverage:legacy?null:Math.max(current,COVERAGE_RULES.localTeaching),
   schoolCoverage:legacy?null:COVERAGE_RULES.localTeaching,
   conditionalIncrease:legacy?null:Number((Math.max(current,COVERAGE_RULES.localTeaching)-current).toFixed(4)),
   timing:dueYear<crisisYear?`第${dueYear}年教学开始，早于第23年危机；不是提交当年立刻兑现。`:`第${dueYear}年教学开始，不能降低已经记下的第23年损失。`,
   events:[{year:dueYear,label:'合同兑现后教学开始'},{year:crisisYear,label:year>crisisYear?'危机已发生，旧损失不回写':'危机按当年实际运行结算'}].sort((a,b)=>a.year-b.year)};
 } catch { return null; }
}
