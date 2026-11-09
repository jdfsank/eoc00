import {getActions, getActors, getLockedPlanningFacts, getInvestigation, evidenceCost, usesTradeoffs, getPublicPlanningStateIssues} from './simulation.js';

// New cross-role reading only. The existing planning-opportunity readers stay
// unchanged; no action is locked, evidence transferred, or future simulated.
export function getRoleReadingChoice(state, options = {}) {
  try {
    const {actorId, cellId, actionId} = options;
    if (!state || state.phase !== 'planning' || state.year !== 30 || actorId !== 'protagonist'
      || cellId !== 'E4' || !['authorize_training', 'train_network'].includes(actionId)
      || !usesTradeoffs(state) || getPublicPlanningStateIssues(state).length) return null;
    const actors = getActors(state), protagonist = actors.find(actor => actor.id === 'protagonist');
    const companion = actors.find(actor => actor.id === 'linche');
    if (!protagonist || !companion || !getActions(state, 'D4', protagonist.id)
      .some(action => ['share_power', 'central_review', 'withdraw'].includes(action.id))) return null;
    const action = getActions(state, cellId, protagonist.id).find(item => item.id === actionId);
    const alternate = getActions(state, cellId, companion.id).find(item => item.id === actionId);
    if (!action || !alternate) return null;
      const facts = getLockedPlanningFacts(state);
      const roles = [protagonist, companion].map(person => {
        const current = state.drafts?.[person.id], task = facts.tasks.find(item => item.d.actorId === person.id);
        const validDraft = current?.actorId === person.id && current?.window === 30;
        const status = !current ? 'unassigned' : validDraft && current.status === 'passed' ? 'passed'
          : validDraft && current.status === 'locked' && task ? 'locked' : 'unknown';
        const research = getInvestigation(state, person.id, cellId);
        const contract = person.id === protagonist.id ? action : alternate;
        const remaining = contract.requireEvidence.filter(id => !research.evidence.includes(id))
          .reduce((sum, id) => sum + evidenceCost(state, id), 0);
        return {actorId:person.id, name:person.name, status, budget:research.budget, requiredRounds:remaining,
          duty:person.id === protagonist.id ? 'D4方针只能由这位角色签署' : '可承担此项东岸工作，不能代签方针',
          arrangement:status === 'locked' ? `已锁「${task.a.title}」· ${task.d.cellId}（未提交）`
            : status === 'passed' ? '已明确放弃本窗口' : status === 'unknown' ? '现有安排待核对' : '尚未安排'};
      });
      return {
        roles,
        explanation:'谁承担东岸的工作，谁签下方针，需要分别安排。这里只换人读合同，不替任何人作出承诺。',
        boundary:'查看保留两人的原安排。调查轮次不退、材料不转给另一角色；重新锁定才替换该角色安排。费用、同格冲突与整轮条件仍须核对。',
        links:[
          {id:'companion', actorId:companion.id, cellId, actionId:action.id, label:`查看${companion.name}执行本项的合同`},
          {id:'policies', actorId:protagonist.id, cellId:'D4', actionId:null, label:`查看${protagonist.name}的D4方针`},
        ],
      };
  } catch {
    // Missing public facts cannot become an offer to act as another person.
    return null;
  }
}
