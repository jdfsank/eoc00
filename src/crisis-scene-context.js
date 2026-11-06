import {getActions, getActors, getPublicPlanningStateIssues, usesTradeoffs, usesLegacyCrisisRules} from './simulation.js';

// Present-tense AVG context only. Original scene bodies, speakers, titles and
// recorded history remain untouched. Unknown/older contracts keep that scene.
export function getCrisisSceneContext(state, cellId, actorId = 'protagonist') {
  try {
    if (!state || state.year !== 20 || state.phase !== 'planning'
      || !['B4', 'F6'].includes(cellId) || !usesTradeoffs(state)
      || usesLegacyCrisisRules(state) || getPublicPlanningStateIssues(state).length) return null;
    const actor = getActors(state).find(item => item.id === actorId);
    if (!actor || typeof actor.name !== 'string' || !actor.name.trim()) return null;
    const actions = getActions(state, cellId, actorId);
    const reviews = actions.filter(item => item.id === 'independent_review');
    const vetoes = actions.filter(item => item.id === 'local_veto');
    if (reviews.length !== 1 || vetoes.length !== 1) return null;
    const review = reviews[0], veto = vetoes[0];
    // Claims below belong to these known public contracts, not arbitrary
    // future versions. Never infer semantics from a title or unread evidence.
    if (![.55, .8, 1].includes(review.probability) || review.dueIn !== 2
      || veto.probability !== 1 || veto.dueIn !== 1
      || review.reward !== '成功则截断四地共同标准失效；预警覆盖和此前损失仍分别保留。'
      || veto.risk !== '不会消除错误标准，仍有可预见的剩余损失。可不取证直接采用基本停闸。') return null;
    const opening = cellId === 'B4'
      ? '旧刻度旁，两份方案指向不同的工作。'
      : '港口的记录旁，两份方案指向不同的工作。';
    return {
      body: [opening + '交叉复核若成功，纠正的是各地共用的错误标准；停闸与撤离先减少损失，却不改正标准。写进方案，不等于工作已经完成。'],
      question: `这一次，${actor.name}要把名额留给哪一种工作？`,
    };
  } catch {
    return null;
  }
}
