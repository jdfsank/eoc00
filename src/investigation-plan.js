import {PLANNING_RULES,PORTABLE_EVIDENCE,evidenceCost,getActions,getEvidenceIds,getInvestigation,usesTradeoffs} from './simulation.js';
import {evidenceTitleFor} from './investigation-intent.js';

// Evidence reachability only. These public calculations do not run a future,
// manufacture an inventory/draft, or check payment and whole-window readiness.
// Actual evidence acquisition and locking remain exclusively in simulation.js.
export function getActionInvestigation(state,cellId,actorId,requiredEvidence=[]) {
  if(!state||state.phase!=='planning'||!usesTradeoffs(state))return null;
  const {evidence,budget}=getInvestigation(state,actorId,cellId);
  const missing=[...new Set(requiredEvidence)].filter(id=>!evidence.includes(id));
  const requiredRounds=missing.reduce((sum,id)=>sum+evidenceCost(state,id),0);
  return {budget,requiredRounds,budgetAfter:budget-requiredRounds,reachable:requiredRounds<=budget};
}

export function getInvestigationPlan(state,cellId,actorId='protagonist') {
  if(!state||state.phase!=='planning'||!usesTradeoffs(state))return null;
  const contracts=getActions(state,cellId,actorId);
  if(!contracts.length)return null;
  const {evidence,budget}=getInvestigation(state,actorId,cellId);
  const evidenceIds=getEvidenceIds(state,cellId,actorId);
  const describe=id=>({id,name:evidenceTitleFor(state,id,cellId,actorId),cost:evidenceCost(state,id),acquired:evidence.includes(id),portable:PORTABLE_EVIDENCE.includes(id)});
  const remaining=(ids,acquiredId=null)=>[...new Set(ids)].filter(id=>!evidence.includes(id)&&id!==acquiredId).reduce((sum,id)=>sum+evidenceCost(state,id),0);
  const actions=contracts.map(contract=>{
    const requiredEvidence=[...new Set(contract.requireEvidence||[])].map(describe);
    const status=getActionInvestigation(state,cellId,actorId,contract.requireEvidence||[]);
    // This is the one optional material that changes an existing public
    // contract. It is not a requirement for basic local veto and is not a
    // second action. No other benefit is inferred from a material's prose.
    const optionalEnhancements=state.year===20&&contract.id==='local_veto'&&evidenceIds.includes('evacuation_routes')
      ? [{id:'surveyed_veto',title:'核实撤离路线 · 强化停闸',evidenceId:'evacuation_routes',acquired:evidence.includes('evacuation_routes'),
        ...getActionInvestigation(state,cellId,actorId,[...(contract.requireEvidence||[]),'evacuation_routes'])}]
      : [];
    return {actionId:contract.id,title:contract.title,requiredEvidence,missingEvidenceIds:requiredEvidence.filter(item=>!item.acquired).map(item=>item.id),
      requiredRounds:status.requiredRounds,budgetAfter:status.budgetAfter,reachable:status.reachable,optionalEnhancements};
  });
  const materials=evidenceIds.map(id=>{
    const item=describe(id),canInvestigate=!item.acquired&&budget>=item.cost;
    const budgetAfter=item.acquired?budget:canInvestigate?budget-item.cost:null;
    const requiredBy=actions.filter(action=>action.requiredEvidence.some(required=>required.id===id)).map(action=>action.actionId);
    const enhances=actions.flatMap(action=>action.optionalEnhancements.filter(extra=>extra.evidenceId===id).map(extra=>({actionId:action.actionId,enhancementId:extra.id})));
    const blocksAfter=canInvestigate?actions.filter(action=>action.reachable&&remaining(action.requiredEvidence.map(required=>required.id),id)>budgetAfter).map(action=>action.actionId):[];
    const enhancementsLostAfter=canInvestigate?actions.flatMap(action=>action.optionalEnhancements.filter(extra=>extra.reachable&&remaining([...action.requiredEvidence.map(required=>required.id),extra.evidenceId],id)>budgetAfter).map(extra=>({actionId:action.actionId,enhancementId:extra.id}))):[];
    return {...item,canInvestigate,budgetAfter,requiredBy,enhances,blocksAfter,enhancementsLostAfter};
  });
  return {readOnly:true,actorId,cellId,budget,maxBudget:PLANNING_RULES.investigationBudget,spent:PLANNING_RULES.investigationBudget-budget,actions,materials};
}
