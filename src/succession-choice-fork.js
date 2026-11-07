import {getActions, getRecruitmentRoles, getInstitutionStaffing, getInvestigation, RECRUITMENT_ACTIONS} from './simulation.js';
import {getSuccessionSceneContext} from './succession-scene-context.js';

const copy = value => JSON.parse(JSON.stringify(value));
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

// Supplementary comparison, not eligibility, draft selection or a forecast.
// The scene context owns the public provenance/window checks. Unsupported old
// saves retain their original action cards rather than acquiring inferred jobs.
export function getSuccessionChoiceFork(state, cellId = 'D4', actorId = 'protagonist') {
  if (!getSuccessionSceneContext(state, cellId, actorId)) return null;
  const roles = getRecruitmentRoles(state);
  const roleLabel = roles.length ? (roles[0].kind === 'station' ? '测站岗位' : '档案岗位') : '无现成岗位';
  const evidence = getInvestigation(state, actorId, cellId).evidence;
  const words = {
    renew_charter: ['不招募同伴', '林澈留下照料测站', '续约维护；本轮不能同时招募。'],
    recruit_successor: ['第20年可部署林澈', '苏岚接班（需先商量）', '继任不等于续约，长期经费仍需承担。'],
    recruit_risk: ['第20年可部署林澈', '岗位暂缺继任', '离岗后的责任仍在；缺岗后果按本局规则。'],
    recruit_volunteer: ['第20年可部署林澈', '无现成岗位需交接', '不补建机构，也不授予苏岚继任。'],
    restore_archive: ['不招募同伴', '另请维护小组重建测站', '不招募林澈，不追回原培训链。'],
  };
  const choices = getActions(state, cellId, actorId).map(action => {
    const recruitment = RECRUITMENT_ACTIONS.includes(action.id);
    const staffing = recruitment ? roles.map(role => ({
      institutionId: role.id, kind: role.kind,
      ...getInstitutionStaffing(state, role, {assumedRecruitmentActionId: action.id}),
    })) : [];
    let responsibility = words[action.id][2];
    if (action.id === 'recruit_risk') {
      const reduced = staffing.filter(row => row.sourceMultiplier === .5);
      const labels = [...new Set(reduced.map(row => row.kind === 'station' ? '测站' : '档案站'))];
      const years = [...new Set(reduced.map(row => row.shutdownIfUnchangedYear).filter(year => year !== null))];
      responsibility = reduced.length
        ? `若兑现，${labels.join('、')}年度来源减半${years.length ? `；若仍缺继任，第${years.join('、')}年停运。` : '。'}`
        : staffing.length && staffing.every(row => row.kind === 'archive' && row.sourceMultiplier === 1 && row.shutdownIfUnchangedYear === null)
          ? '本局档案站不因缺岗减产或停运。' : '当前岗位不因本合同减产；离岗责任仍在。';
    }
    return {
      actionId: action.id, title: action.title,
      travelling: words[action.id][0], local: words[action.id][1],
      people: `${words[action.id][0]}；${words[action.id][1]}`, responsibility,
      cost: {...action.cost}, dueYear: state.year + action.dueIn,
      probability: action.probability,
      requireEvidence: [...action.requireEvidence],
      missingEvidence: action.requireEvidence.filter(id => !evidence.includes(id)),
      // Full source conditions remain available for details, not rewritten as
      // a promise that a proposal is affordable, locked, or already fulfilled.
      description: action.description, risk: action.risk, reward: action.reward,
      modelNote: action.modelNote || '', staffingNote: action.staffingNote || '',
      staffing,
    };
  });
  return freeze(copy({
    title: '谁同行，谁留下',
    summary: '若所选合同兑现：以下分岔共用本轮一个名额；招募后，第20年才可部署同伴。',
    roleLabel, choices,
  }));
}
