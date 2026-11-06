import {getActions, getActors, getInvestigation, getLockedPlanningFacts, usesTradeoffs, PLANNING_RULES, PORTABLE_EVIDENCE, EVIDENCE} from './simulation.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function draftFacts(state, actorId) {
  if (!object(state.drafts)) return {draftStatus:'unknown'};
  if (!own(state.drafts, actorId)) return {draftStatus:'unassigned'};
  const draft = state.drafts[actorId];
  if (!object(draft) || draft.actorId !== actorId || draft.window !== state.year) return {draftStatus:'unknown'};
  if (draft.status === 'passed') return {draftStatus:'passed'};
  if (draft.status !== 'locked') return {draftStatus:'unknown'};
  try {
    const task = getLockedPlanningFacts(state, [actorId]).tasks.find(task => task.d.actorId === actorId);
    if (task) return {draftStatus:'locked', draft:{cellId:task.d.cellId, actionId:task.a.id, title:task.a.title}};
  } catch { /* A damaged draft is neither an assignment nor a pass. */ }
  return {draftStatus:'unknown'};
}

function budgetFacts(state, actorId, cellId) {
  if (!usesTradeoffs(state)) return {budget:null, budgetStatus:'per-scene'};
  if (!object(state.investigations)) return {budget:null, budgetStatus:'unknown'};
  const key = `${state.year}:${actorId}`;
  const entries = own(state.investigations, key) ? state.investigations[key] : [];
  if (!Array.isArray(entries) || !entries.every(entry => object(entry) && typeof entry.evidenceId === 'string' && own(EVIDENCE, entry.evidenceId) && state.cells.some(cell => cell.id === entry.cellId)) || new Set(entries.map(entry => `${PORTABLE_EVIDENCE.includes(entry.evidenceId) ? 'portable' : entry.cellId}:${entry.evidenceId}`)).size !== entries.length) return {budget:null, budgetStatus:'unknown'};
  try {
    const {budget} = getInvestigation(state, actorId, cellId);
    if (Number.isInteger(budget) && budget >= 0 && budget <= PLANNING_RULES.investigationBudget) return {budget, budgetStatus:'shared'};
  } catch { /* Never fill a missing budget with zero or a new allowance. */ }
  return {budget:null, budgetStatus:'unknown'};
}

// A read-only local entry model, not a recommendation, draft or lock permission.
// No seeds, future snapshots, outcome rolls or unread material prose are read.
export function getWorldPlanning(state, cellId, actorId) {
  if (!state || state.phase !== 'planning' || ![0,10,20,30].includes(state.year) || typeof cellId !== 'string' || typeof actorId !== 'string') return null;
  if (!Array.isArray(state.cells) || !state.cells.every(cell => object(cell) && typeof cell.id === 'string') || !state.cells.some(cell => cell.id === cellId) || !Array.isArray(state.actors)) return null;
  if (!state.actors.every(actor => object(actor) && typeof actor.id === 'string' && actor.id.length > 0 && typeof actor.name === 'string' && actor.name.length > 0 && typeof actor.alive === 'boolean' && Number.isFinite(actor.availableFrom)) || new Set(state.actors.map(actor => actor.id)).size !== state.actors.length) return null;
  const eligible = getActors(state);
  if (!eligible.some(actor => actor.id === actorId)) return null;
  const actors = eligible.map(actor => {
    const budget = budgetFacts(state, actor.id, cellId);
    let localContractCount = null;
    try {
      if (budget.budgetStatus !== 'unknown') {
        const actions = getActions(state, cellId, actor.id);
        if (Array.isArray(actions) && actions.every(action => typeof action.id === 'string')) localContractCount = actions.length;
      }
    } catch { /* Unknown local contracts must not imply no local actions. */ }
    return {id:actor.id, name:actor.name, localContractCount, ...draftFacts(state, actor.id), ...budget};
  });
  const selectedActor = actors.find(actor => actor.id === actorId);
  const otherActors = actors.filter(actor => actor.id !== actorId);
  const alternative = selectedActor.localContractCount === 0 ? otherActors.find(actor => actor.localContractCount > 0) : null;
  const primary = selectedActor.localContractCount > 0
    ? {kind:'scene', actorId, label:`进入 ${cellId} 现场`}
    : alternative ? {kind:'switch-scene', actorId:alternative.id, label:`以${alternative.name}查看 ${cellId} 方案`}
      : selectedActor.localContractCount === 0 && otherActors.every(actor => actor.localContractCount === 0)
        ? {kind:'history', actorId, label:`查看 ${cellId} 历史`}
        : {kind:'unknown', actorId, label:'当前合同待核对'};
  return {
    readOnly:true, year:state.year, cellId, actors, selectedActor, otherActors, primary,
    notice:'切换角色和阅读免费，不改已有草案，不退已用调查；合同数不代表现在能锁定。',
    budgetNotice:usesTradeoffs(state) ? '每角色每窗口共用3轮，换地点不补充。' : '本局沿用旧版每现场调查预算；世界入口不推算剩余轮数。',
  };
}
