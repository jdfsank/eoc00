import {getActions, getActors, getRecruitmentRoles, getPublicPlanningStateIssues, usesTradeoffs, usesRecruitmentRules} from './simulation.js';

const buildIds = ['build_merchant', 'build_state', 'build_joint'];

// A present-tense job needs its already-resolved public source. An old title,
// an unfulfilled plan or a building without provenance cannot create a role.
function hasRoleSource(state, role) {
  const event = state.events.find(item => item.id === role.sourceEventId);
  const status = role.kind === 'station' ? 'success' : 'failed';
  if (!event || !buildIds.includes(event.actionId)
    || event.sourceActionId !== `action:0:protagonist:D4:${event.actionId}`
    || event.id !== `event:${event.sourceActionId}` || event.parentId !== event.sourceActionId
    || event.kind !== 'event' || event.cellId !== 'D4' || event.status !== status
    || event.resolvedYear !== event.year || event.year > state.year
    || role.sourceActionId !== event.sourceActionId || role.startYear !== event.year
    || role.id !== `institution:${event.id}:D4`) return false;
  const source = state.history.find(item => item.id === event.sourceActionId);
  const outcome = state.history.find(item => item.id === `resolved:${event.id}`);
  return source?.kind === 'action' && source.parentId === null && source.year === 0
    && source.cellId === 'D4' && source.sourceActionId === event.sourceActionId
    && outcome?.kind === (status === 'success' ? 'outcome' : 'failure')
    && outcome.status === status && outcome.parentId === event.id
    && outcome.sourceActionId === event.sourceActionId && outcome.cellId === 'D4'
    && outcome.year === event.year;
}

// Only the current, still-editable year-10 window. This is supplementary
// planning copy, never a rewrite of succession-window or a historical claim
// when an older decade is reread later. No evidence, seeds or rolls are read.
export function getSuccessionSceneContext(state, cellId = 'D4', actorId = 'protagonist') {
  try {
    if (!state || state.year !== 10 || state.phase !== 'planning'
      || cellId !== 'D4' || actorId !== 'protagonist'
      || !usesTradeoffs(state) || !usesRecruitmentRules(state)
      || getPublicPlanningStateIssues(state).length
      || !getActors(state).some(actor => actor.id === actorId && actor.name.trim())) return null;
    const roles = getRecruitmentRoles(state);
    if (roles.length > 1 || roles.some(role => !hasRoleSource(state, role))) return null;
    const actions = getActions(state, cellId, actorId);
    if (actions.some(action => action.probability !== 1
      || action.dueIn !== (action.id === 'restore_archive' ? 2 : 1))) return null;
    const matches = ids => actions.length === ids.length
      && ids.every(id => actions.filter(action => action.id === id).length === 1);
    let body;
    if (roles.length === 1 && roles[0].kind === 'archive'
      && matches(['recruit_successor', 'recruit_risk', 'restore_archive'])) {
      body = '眼下河港需要交接的是仍在运转的小型档案站，没有测站可续约。邀请林澈同行时，可商量继任或承担暂缺人手的责任；也可以把本轮名额用于重建地方测站。重建是另一项工作，不会随招募一并完成。';
    } else if (roles.length === 1 && roles[0].kind === 'station'
      && matches(['renew_charter', 'recruit_successor', 'recruit_risk'])) {
      body = '眼下河港的测站仍在运转。邀请林澈同行，需要另谈现有岗位的交接；留她照料测站，则可续约公开章程。招募与续约争用本轮同一个介入名额，安排继任不能代替维护续约。';
    } else if (!roles.length && matches(['recruit_volunteer', 'restore_archive'])) {
      body = '眼下河港没有运转中的测站或档案岗位需要交接。本地可谈自愿同行，或另用这个名额重建地方测站；招募不会自动补建机构或创造继任者。';
    } else return null;
    return {title: '第10年 · 当前可谈的工作', body: [body]};
  } catch {
    return null;
  }
}
