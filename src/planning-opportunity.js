import {getActions, getActors, getLockedPlanningFacts} from './simulation.js';

const POLICY_IDS = ['share_power', 'central_review', 'withdraw'];
const isPolicy = id => POLICY_IDS.includes(id);

// Public role and draft facts only. This does not simulate a future, consume
// evidence, inspect material prose or random results, or change a saved world.
export function getPlanningOpportunity(state, options = {}) {
  if (!state || state.phase !== 'planning' || state.year !== 30) return null;
  const actors = getActors(state), protagonist = actors.find(actor => actor.id === 'protagonist');
  if (!protagonist) return null;
  const policies = getActions(state, 'D4', protagonist.id).filter(action => isPolicy(action.id));
  if (!policies.length) return null;
  const {actorId, cellId, actionId} = options;
  const contextual = actorId !== undefined || cellId !== undefined || actionId !== undefined;
  let actor = null, actions = [], action = null;
  if (contextual) {
    actor = actors.find(item => item.id === actorId);
    if (!actor || typeof cellId !== 'string') return null;
    actions = getActions(state, cellId, actorId);
    if (!actions.length) return null;
    if (actionId !== undefined) {
      action = actions.find(item => item.id === actionId);
      if (!action) return null;
    }
  }

  const draft = state.drafts?.[protagonist.id];
  let status = 'unassigned', locked = null;
  if (draft) {
    if (draft.actorId !== protagonist.id || draft.window !== 30) status = 'unknown';
    else if (draft.status === 'passed') status = 'passed';
    else if (draft.status === 'locked') {
      locked = getLockedPlanningFacts(state, [protagonist.id]).tasks
        .find(task => task.d.actorId === protagonist.id)?.a || null;
      status = locked ? isPolicy(locked.id) ? 'policy-locked' : 'other-locked' : 'unknown';
    } else status = 'unknown';
  }
  const policyActor = {
    id: protagonist.id, name: protagonist.name, status,
    ...(locked ? {actionId: locked.id, title: locked.title, cellId: draft.cellId} : {}),
  };
  const statusText = {
    unassigned: '尚未安排，未决定是否签方针。',
    'policy-locked': `已锁「${locked?.title}」· ${draft?.cellId}（未提交）。`,
    'other-locked': `已锁「${locked?.title}」· ${draft?.cellId}（未提交）。`,
    passed: '已明确放弃本窗口。',
    unknown: '草案待核对；未知不等于已锁方针或明确放弃。',
  }[status];
  const companion = actors.find(item => item.id === 'linche');
  const roleText = `方针仅${protagonist.name}可在D4签署${companion ? `，${companion.name}不能代签` : ''}。`;
  let contextText;
  if (!contextual) {
    contextText = status === 'policy-locked'
      ? '签署不保证第40年的承接条件齐备；其他工作仍须兑现。'
      : ['other-locked', 'passed'].includes(status)
        ? '照此提交不签方针；其他工作仍按合同结算，可保留。'
        : status === 'unassigned'
          ? '未安排不等于放弃，承接能力不等于已签方针。'
          : '先核对整轮安排，不从缺页推断后果。';
  } else if (actorId !== protagonist.id) {
    contextText = `${action ? '本项' : '此地行动'}用${actor.name}名额，不占${protagonist.name}名额，也不代签。`;
  } else if (action ? isPolicy(action.id) : actions.every(item => isPolicy(item.id))) {
    contextText = '本项占主角唯一名额；签署不保证第40年承接条件齐备。';
  } else {
    const replace = status === 'policy-locked' ? '改锁会替换已拟方针。' : '';
    contextText = `${replace}${protagonist.name}提交${action ? '本项' : '此地工作'}就不签方针；工作仍按合同结算。`;
  }
  return {
    readOnly: true, year: 30, context: action ? 'action' : contextual ? 'scene' : 'window',
    ...(actor ? {actorId: actor.id, actorName: actor.name, cellId} : {}),
    ...(action ? {actionId: action.id, actionTitle: action.title} : {}),
    heading: `${protagonist.name}的最后一个名额`, policyActor, roleText, statusText, contextText,
    notice: '查看不取证、不锁定、不扣费。锁定可修改，已用调查轮次不退；整轮提交后，本窗口不能重选。',
  };
}
