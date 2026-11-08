import {getActions} from './simulation.js';
import {getCrisisSceneContext} from './crisis-scene-context.js';

// Public current-contract reading only. The existing context owns the strict
// producer/window guard. Do not run a future, merge probabilities, or present
// a base loss coefficient as either a probability or a count of casualties.
export function getCrisisChoiceFork(state, cellId, actorId = 'protagonist') {
  if (!getCrisisSceneContext(state, cellId, actorId)) return null;
  const actions = getActions(state, cellId, actorId);
  const veto = actions.find(action => action.id === 'local_veto');
  const base = veto.reward === '确定把第23年四地共同失效损失基数降至0.20，再按当地保护结算。' ? '0.20'
    : veto.reward === '确定把第23年四地共同失效损失基数降至0.30，再按当地保护结算。' ? '0.30' : null;
  if (!base || actions.some(action => !['independent_review', 'local_veto'].includes(action.id))) return null;
  return {
    choices: actions.map(action => action.id === 'independent_review' ? {
      actionId: action.id,
      timing: `第${state.year + action.dueIn}年 · 完成概率 ${Math.round(action.probability * 100)}%`,
      effect: '若成功，纠正四地共同标准。',
      responsibility: action.probability === 1 ? '只判定一次；纠正标准不等于洪水消失。' : '只判定一次；未完成时危机仍在，费用不退。',
    } : {
      actionId: action.id,
      timing: `第${state.year + action.dueIn}年 · 确定生效`,
      effect: `第23年损失基数 ${base}，再按当地保护结算。`,
      responsibility: '先减损，不纠正共同标准；基数不是伤亡比例。',
    }),
  };
}
