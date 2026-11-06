import {
  CHANNELS, COVERAGE_RULES, getActions, getActors, getHandoffReadiness,
  getInstitutionAnnualSource, getInstitutionEffectiveAnnualSource, getTrainingAuthorizationPlan, getWarningCoverage, evidenceCost,
} from './simulation.js';
import {getWorkloadComparison} from './training-workload.js';
import {evidenceTitleFor} from './investigation-intent.js';

const IDS = ['authorize_training', 'train_network'];
const unique = values => [...new Set(values)];
const round = value => Math.round(value * 10000) / 10000;

// Compare two public contracts, not two simulated saves. In particular the
// explicit empty evidence argument reads their minimum requirements without
// consulting investigation sessions, acquiring evidence or replacing a draft.
export function getTrainingChoiceComparison(state, cellId, actorId = 'protagonist') {
  if (!state || state.year !== 30 || state.phase !== 'planning' || cellId !== 'E4') return null;
  try {
    const actor = getActors(state).find(candidate => candidate.id === actorId);
    if (!actor) return null;
    const contracts = getActions(state, cellId, actorId, []);
    if (!IDS.every(id => contracts.some(contract => contract.id === id))) return null;
    const plan = getTrainingAuthorizationPlan(state, cellId);
    if (!plan.available || !plan.target) return null;
    const original = state.institutions.find(item => item.id === plan.target.id);
    const originalSource = getInstitutionEffectiveAnnualSource(state, original);
    if (!originalSource) return null;
    const readiness = getHandoffReadiness(state), coverage = getWarningCoverage(state)[cellId]?.coverage;
    const channels = state.cells.find(cell => cell.id === cellId)?.channels;
    if (!Number.isFinite(coverage) || !channels || CHANNELS.some(key => !Number.isFinite(channels[key]))) return null;

    const staffCells = unique([...readiness.staffCells, cellId]);
    const authorizedCells = unique([...readiness.authorizedCells, cellId]);
    const checkCells = [...readiness.checkCells];
    const hasLink = authorizedCells.some(staffCell => checkCells.some(checkCell => checkCell !== staffCell));
    const missing = !checkCells.length ? ['缺少成功工作的异源校验载体']
      : !hasLink ? ['人手与校验仍在同一地域，缺少跨地承接关系'] : [];
    const trustStatus = readiness.trust ? 'agreed' : state.flags.trust === false ? 'refused' : 'uncommitted';
    const shareMissing = [...missing, ...(!readiness.trust ? [trustStatus === 'refused' ? '河港明确拒绝当前安排' : '河港尚未作出合作承诺'] : [])];
    const conditional = {
      assumption: '仅假设所选合同兑现，当前其他载体、授权与信任保持原状；不是已发生的结果或第40年预测。',
      staffCells, authorizedCells, checkCells,
      addedStaffRegions: staffCells.length - readiness.staffCells.length,
      addedAuthorizedRegions: authorizedCells.length - readiness.authorizedCells.length,
      canWithdraw: hasLink, canShare: hasLink && !!readiness.trust, missing, shareMissing,
    };
    const options = IDS.map(actionId => {
      const contract = contracts.find(candidate => candidate.id === actionId), authorization = actionId === 'authorize_training';
      const requiredEvidence = contract.requireEvidence.map(id => ({id, title: evidenceTitleFor(state, id, cellId, actorId), rounds: evidenceCost(state, id), local: id === 'resident_testimony'}));
      const cost = {...contract.cost};
      const ifFulfilled = authorization ? coverage : Math.max(coverage, COVERAGE_RULES.localTeaching);
      const annualSourceAdded = authorization ? Object.fromEntries(CHANNELS.map(key => [key, 0])) : getInstitutionAnnualSource('school');
      const workload = getWorkloadComparison(originalSource, authorization && plan.workload ? plan.workload.after : originalSource, original.maintenance,
        {version:plan.workload?.version ?? null, mode:authorization ? (plan.workload ? 'reassign' : 'authorize-only') : 'expand', targetId:original.id});
      const annualSourceChange = Object.fromEntries(CHANNELS.map(key => [key, round(workload.scaledDelta[key] + annualSourceAdded[key])]));
      return {
        actionId, title: contract.title, cost,
        affordable: Object.entries(cost).every(([key, amount]) => channels[key] >= amount),
        requiredEvidence, investigationRounds: requiredEvidence.reduce((sum, item) => sum + item.rounds, 0),
        dueYear: state.year + contract.dueIn,
        target: authorization ? {...plan.target} : null,
        newInstitutionKind: authorization ? null : 'school', newInstitutions: authorization ? 0 : 1,
        annualSourceAdded, workload, annualSourceChange,
        coverage: {current: coverage, ifFulfilled, increase: round(ifFulfilled - coverage)},
        conditions: authorization
          ? ['第31年只核对提交时指定的原第7年E4培训点：仍运转、来源有效且尚未获授权。', '目标失效或已有授权则取消，费用不退；听取证词不等于已经签署。', ...(plan.workload ? ['签署后重排这一原点的轮值工作，大部分深入带教转入议事与生计协调；不改变原年度基底记录。实际来源仍按该原点维护缩放，停运不产生贡献。'] : [])]
          : ['若提交本合同，第31年新增一处轮值维护学校；该学校取得承接职责，原学徒培训点不因此补签授权。'],
      };
    });
    return {
      readOnly: true, cellId, actorId, actorName: actor.name, workloadRulesVersion:plan.workload?.version ?? null, title: '承接原学徒，还是新增培训？',
      current: {
        staffCells: [...readiness.staffCells], authorizedCells: [...readiness.authorizedCells],
        checkCells: [...readiness.checkCells], trust: !!readiness.trust, trustStatus,
        canShare: readiness.canShare, canWithdraw: readiness.canWithdraw, coverage,
      },
      conditional, options,
      notes: [
        '各占本角色一个介入名额，由E4支付。这里列合同最低取证要求；已得材料、剩余调查和实际锁定条件见行动卡。余额足够也不代表整轮可提交。',
        plan.workload ? '原学徒的年度来源重排不是免费加成：政治、经济提高，以科学带教来源减少为代价。这里显示当前维护条件下的来源变化，不是未来通道净增；实际通道还受基线回归、传播与其他来源影响。' : '新增年度来源不是未来通道净增；实际通道还受基线回归、相邻传播、维护与其他来源影响。此处不计算第40年数值，也不评最优方案。',
        '两项都不新增一个人手地域，不附送异源校验、河港信任或交班方针。最终交班仍按第40年的实际存续条件核对。',
        '同地覆盖取现存载体的最高值，不叠加。下列覆盖只假设本项兑现、其他载体维持当前状态，不预测未来灾害。第23年损失不变。',
        '第30年是最后一次介入，节省的即时通道成本不等于还有下一次行动可供投资。阅读不取证、不锁定、不付款、不改变现有草案。',
      ],
    };
  } catch {
    // Missing or inconsistent public facts cannot become a fabricated offer.
    return null;
  }
}
