import {EVIDENCE,PLANNING_RULES,getActors,getActions,getInvestigation,evidenceCost,getLockedPlanningFacts,getPublicPlanningChecks,getPublicPlanningStateIssues,usesTradeoffs,usesLegacyCrisisRules} from './simulation.js';
import {crisisContractFact,projectCrisisContracts} from './crisis-outlook.js';

const variants = [
  {id:'review',title:'独立交叉复核',actionId:'independent_review',evidenceId:'anomaly_records'},
  {id:'surveyed_veto',title:'强化停闸 · 核实撤离路线',actionId:'local_veto',evidenceId:'evacuation_routes'},
  {id:'basic_veto',title:'基本停闸 · 不追加调查',actionId:'local_veto',evidenceId:null},
];

// Public, read-only comparison. An assumption is never inserted into drafts,
// investigations or state; it cannot be passed to lockTask or commitWindow.
export function getInvestigationComparison(state, cellId, actorId = 'protagonist') {
  if(state.year!==20||state.phase!=='planning'||!usesTradeoffs(state)||usesLegacyCrisisRules(state)||!['B4','F6'].includes(cellId)) return null;
  const result = {hypothetical:true,actorId,actorName:actorId,cellId,budget:null,title:'调查前条件比较 · 只读假设',issues:[],retained:[],options:[],notes:[
    '条件推算，不代替取证。只比较当前角色在此处改选的方案；其他角色保留实际已锁定安排或明确放弃，不替任何人补签。',
    '调查已经花掉的轮次不退。只列材料名称与公开合同，不提前展示未读正文，不取得材料、不锁定、不付款、不提交。',
    '每项均占当前角色一次干预；成本和到期年不同，损失系数不是整个游戏的最优解、人口或伤亡预测。',
    '复核准备只取现有档案与人手，同轮新办培训不回升此概率。双复核逐项列概率，不合成整轮概率；双停闸取较强一份，不相乘。',
    '成功复核纠正共同指令，不表示洪水消失。逐地先四舍五入至四位再求平均；100%复核不显示不可能的失败后果。',
  ]};
  try {
    const integrity = getPublicPlanningStateIssues(state);
    if(integrity.length) {result.issues=integrity;return result;}
    const actors = getActors(state), actor = actors.find(a=>a.id===actorId);
    if(!actor) {result.issues=['该棋子本轮不可部署。'];return result;}
    result.actorName=actor.name;
    const investigation=getInvestigation(state,actorId,cellId);
    result.budget=investigation.budget;
    const others=actors.filter(a=>a.id!==actorId), facts=getLockedPlanningFacts(state,others.map(a=>a.id));
    const retainedContracts=facts.tasks.map(task=>crisisContractFact(state,task));
    const retainedCosts=facts.tasks.map(({d,a})=>({actorId:d.actorId,cellId:d.cellId,cost:a.cost}));
    result.retained=others.map(other=>{
      const draft=state.drafts[other.id], task=facts.tasks.find(t=>t.d.actorId===other.id);
      return {actorId:other.id,actorName:other.name,status:!draft?'missing':draft.status,...(draft?.status==='locked'?{cellId:draft.cellId,actionId:draft.actionId,title:task?.a.title||'当前行动不可用'}:{})};
    });
    result.issues=[...facts.issues];
    result.options=variants.map(variant=>{
      const needed=variant.evidenceId?[variant.evidenceId]:[];
      const evidence=needed.map(id=>({id,name:EVIDENCE[id],acquired:investigation.evidence.includes(id),cost:evidenceCost(state,id)}));
      const investigationCost=evidence.filter(e=>!e.acquired).reduce((n,e)=>n+e.cost,0);
      // Contract descriptions accept named evidence assumptions; actual research
      // and lock validation stay untouched. No fake draft or save is constructed.
      const contract=getActions(state,cellId,actorId,needed).find(a=>a.id===variant.actionId);
      const available=!!contract&&!(variant.id==='basic_veto'&&investigation.evidence.includes('evacuation_routes'));
      const reachable=investigationCost<=investigation.budget;
      const issues=[...facts.issues];
      if(!contract) issues.push('该行动当前不可用。');
      if(variant.id==='basic_veto'&&!available&&contract) issues.push('已取得撤离路线，重新锁定会自动采用强化停闸；基本停闸只保留在尚未重锁的旧草案中。');
      if(!reachable) issues.push(`尚需${investigationCost}轮调查，当前只余${investigation.budget}轮；已花轮次不退，本方案本窗口不可达。`);
      const option={id:variant.id,title:variant.title,actionId:variant.actionId,cost:contract?{...contract.cost}:{},dueYear:contract?state.year+contract.dueIn:null,probability:contract?.probability??null,evidence,investigationCost,budgetAfter:investigation.budget-investigationCost,reachable,available,ready:false,issues,outlook:null};
      const checks=getPublicPlanningChecks(state,[...retainedCosts,...(contract?[{actorId,cellId,cost:contract.cost}]:[])],[...facts.assignedActorIds,actorId]);
      issues.push(...checks.issues);
      if(issues.length||!contract) return option;
      const candidate={actorId,cellId,actionId:contract.id,probability:contract.probability,dueYear:option.dueYear,...(variant.actionId==='local_veto'?{vetoMitigation:variant.id==='surveyed_veto'?PLANNING_RULES.surveyedVeto:.3}:{})};
      // Preserve actor order because real simultaneous contracts resolve in that
      // order, even if this comparison belongs to a non-protagonist actor.
      const contracts=[...retainedContracts,candidate].sort((a,b)=>actors.findIndex(actor=>actor.id===a.actorId)-actors.findIndex(actor=>actor.id===b.actorId));
      const outlook=projectCrisisContracts(state,contracts);
      if(!outlook.ready) {issues.push(...outlook.issues);return option;}
      option.ready=true;option.outlook=outlook;
      return option;
    });
    return result;
  } catch {
    // Unknown public facts stay unknown. Do not use a simplified fallback model
    // or private save validation to manufacture a seemingly complete number.
    result.issues=['当前公开规划资料无法核对，暂不能给出整轮数值。'];
    result.options=[];
    return result;
  }
}
