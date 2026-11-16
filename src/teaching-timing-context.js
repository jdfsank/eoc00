import {getActions,getActors,getWarningCoverage,getPublicPlanningStateIssues,usesLegacyCrisisRules,COVERAGE_RULES} from './simulation.js';

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
  return {actorId,cellId,actionId,year,dueYear,crisisYear,model:legacy?'legacy-overall':'regional',
   currentCoverage:current,conditionalCoverage:legacy?null:Math.max(current,COVERAGE_RULES.localTeaching),
   schoolCoverage:legacy?null:COVERAGE_RULES.localTeaching,
   conditionalIncrease:legacy?null:Number((Math.max(current,COVERAGE_RULES.localTeaching)-current).toFixed(4)),
   timing:dueYear<crisisYear?`第${dueYear}年教学开始，早于第23年危机；不是提交当年立刻兑现。`:`第${dueYear}年教学开始，不能降低已经记下的第23年损失。`,
   events:[{year:dueYear,label:'合同兑现后教学开始'},{year:crisisYear,label:year>crisisYear?'危机已发生，旧损失不回写':'危机按当年实际运行结算'}].sort((a,b)=>a.year-b.year)};
 } catch { return null; }
}
