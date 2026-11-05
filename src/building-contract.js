import { CHANNELS, COVERAGE_RULES, usesLegacyCrisisRules } from './simulation.js';
import { getActionPreview } from './action-preview.js';
import { getFutureBranchAccess, getBranchAccessRulesDescription } from './branch-access.js';

export const BUILDING_ACTION_IDS = Object.freeze(['build_merchant', 'build_state', 'build_joint']);
const channelNames = { politics: '政治', economy: '经济', science: '科学', religion: '宗教' };
const sourceText = source => CHANNELS.map(key => `${channelNames[key]}+${source[key].toFixed(2)}`).join('、');
const costText = cost => Object.entries(cost).map(([key, value]) => `${channelNames[key]}${value}`).join('、');

/**
 * Public, prospective terms shared by the free preview and locked-task card.
 * Only currently available year-zero contracts are described. This is neither
 * a forecast nor a historical-source reconstruction: it never opens evidence,
 * reads a seed/roll, simulates a branch, or changes a draft/investigation.
 * Cost, probability, timing and evidence eligibility come from the actual
 * runtime contract; source/chain assumptions are checked against real engines
 * in building-contract.test.js. Each call returns detached presentation data.
 *
 * Legacy scene evidence must be passed by its owner, just as in action-preview.
 * canLock describes evidence readiness only, not whole-window affordability.
 */
export function getBuildingContract(state, actionId, { cellId = 'D4', actorId = 'protagonist', legacyEvidence = [] } = {}) {
  if (!state || state.year !== 0 || cellId !== 'D4' || !BUILDING_ACTION_IDS.includes(actionId)) return null;
  const preview = getActionPreview(state, cellId, actorId, actionId, legacyEvidence);
  if (!preview) return null;
  const { action, missing, canLock } = preview;
  const merchant = actionId === 'build_merchant', government = actionId === 'build_state';
  const legacy = usesLegacyCrisisRules(state), dueYear = state.year + action.dueIn;
  const futureBranchAccess = getFutureBranchAccess(state, actionId);
  const annualSources = {
    station: { politics: government ? .5 : .1, economy: merchant ? .8 : .1, science: merchant ? 1.2 : 1.6, religion: .25 },
    archive: { politics: 0, economy: 0, science: .35, religion: .15 },
    training: { politics: .1, economy: .25, science: .7, religion: .1 },
    branch: { politics: .15, economy: .4, science: 1, religion: .15 },
  };
  const coverage = legacy ? null : {
    model: COVERAGE_RULES.version,
    station: merchant ? COVERAGE_RULES.paidAccess : 1,
    training: COVERAGE_RULES.localTeaching,
    branch: futureBranchAccess.open ? 1 : COVERAGE_RULES.paidAccess,
    sourceProtection: government ? COVERAGE_RULES.stateCoordination : merchant ? 0 : COVERAGE_RULES.jointRecords,
    condition: '建站实际成功、来源可追溯、载体仍运转；联合来源还须原行动确有独立洪水记录。覆盖与来源保护均乘实际维护和人手系数，同地取最高值，不叠加。',
  };
  const failure = {
    probability: Math.round((1 - action.probability) * 100) / 100,
    year: dueYear, cellId, kind: 'archive', name: '小型档案站', refund: false, startsOriginalChain: false,
  };
  const success = {
    probability: action.probability, year: dueYear, cellId, kind: 'station', open: !merchant,
  };
  const chain = [
    { year: 7, kind: 'training', cellIds: ['E4', 'D5'], condition: '原建站成功，且来源D4测站在第7年仍运转。' },
    { year: 12, kind: 'branch', cellIds: ['F6'], condition: '第7年原教学事件已兑现，且来源E4培训点在第12年仍运转。' },
  ];
  const maintenance = {
    decisionYear: 10, renewalCost: { economy: 3 }, renewalDueYear: 11, renewalActionSlots: 1,
    lapseYear: 16, lapseMultiplier: .7, openAfterLapse: false,
    condition: '到第16年未续约、测站仍在运转，且未先因缺继任停运。失败档案站不适用这项测站经费衰退。',
    merchantAlreadyPaid: merchant,
  };
  const commonTerms = [
    '三种方案到期都只判定一次。若失败，仍在D4留下小型档案站，已付成本不退，原教学与分站链不启动；足额维护时档案站年度源项为科学+0.35、宗教+0.15。',
    '若建站成功，且各步所需来源机构到期仍在运转，第7年建立E4东岸培训点和D5南岸读尺班，第12年再建F6远港分站。这是三种方案共有的预设链，不是联合管理独有，也不是已经兑现。',
    '若测站建成并仍在运转，第10年可另用一次介入、经济3续约，第11年兑现。若未续约，到第16年仍运转且未先因缺继任停运的测站，维护系数降为0.70并收费。商会站从启用时就收费，第16年不是首次收费。',
    '接班人手与长期经费是两件事：安排继任不等于续约，暂缺继任可能先减产并在第16年停运。后来的停运不会抹去已经建立的教学与分站，未来仍须核对各自的运转条件。',
  ];
  const differenceTerms = [
    `统一提交成本：${costText(action.cost)}，占本角色本窗口1次介入；${Math.round(action.probability * 100)}%概率在第${dueYear}年建成测站，否则同年留下小型档案站。`,
    `若建成且足额维护、人手齐备，D4测站的年度源项为${sourceText(annualSources.station)}。这是源项，不是四通道每年的净增预测。`,
    merchant
      ? `若成功，商会测站从第${dueYear}年启用起就有缴费门槛。${futureBranchAccess.description}`
      : `若成功，${government ? '官署' : '联合管理'}测站从第${dueYear}年启用起公开服务。${futureBranchAccess.description}`,
  ];
  if (coverage) differenceTerms.push(merchant
    ? `足额维护、人手齐备时，D4测站覆盖系数为${coverage.station}，按本局分站规则生成的F6覆盖系数为${coverage.branch}；不附加治理来源保护；缴费门槛不是人口比例。`
    : `足额维护、人手齐备时，测站与同源分站覆盖系数为1；${government ? '可追溯的官署协调' : '可追溯且原行动保留独立洪水记录的联合来源'}减少${Math.round(coverage.sourceProtection * 100)}%的剩余共同失效损失。不能替代完整复核。`);
  else differenceTerms.push('本局沿用旧版整体危机公式，不按新的预警覆盖系数或治理来源保护计减损；公开或收费仍是服务准入事实，不等于新模型的危机收益。');
  const annualSourceNote = `足额维护、人手齐备时，每个教学点年度源项为${sourceText(annualSources.training)}；F6分站为${sourceText(annualSources.branch)}。实际源项还乘维护、人手系数，并与衰减、邻地传播等共同结算，不能把它们相加当作净增。`;
  const compatibilityNote = (legacy
    ? '没有coverage-v1标记的本局保留旧整体危机口径，不附加新覆盖收益。'
    : '本局使用coverage-v1。来源保护须由真实成功事件和原行动证据支持，失败档案站不继承成功测站的覆盖或来源保护。') + getBranchAccessRulesDescription(state);
  const prototypeNote = '这些时点、年度源项和服务参数是当前可调原型假设，不是历史测量或已验证的政策效果。后续链有条件，成功与失败都保留；免费阅读不取证、不扣调查轮次、不锁定、不支付，也不揭示随机结果。';
  // Current getActions keeps shared build copy even for original-rule saves.
  // Clarify that copy for display only; never rewrite a contract or its history.
  const displayReward = legacy
    ? `若成功，第${dueYear}年启用${merchant ? '收费' : '公开'}测站；足额维护、人手齐备时年度源项为${sourceText(annualSources.station)}。若各步来源仍运转，第7年接续E4/D5教学、第12年接续F6分站。`
    : action.reward;
  const displayRisk = legacy
    ? `${merchant ? '启用即有缴费门槛，依赖单一资助方。' : government ? '复核权留在官署，统一标准仍可能共同失效。' : '成本较高，公开资料与共同维护不等于完成独立复核。'}失败成本不退，留下小型档案站，原教学链不启动。第10年续约另占一次行动；未续约且未先因缺继任停运的测站，第16年维护降至0.70，${merchant ? '继续收费' : '由公开转为收费'}。危机仍按旧版整体公式结算。`
    : action.risk;
  return {
    actionId, title: action.title, cellId, actorId, readOnly: true,
    displayReward, displayRisk,
    cost: { ...action.cost }, actionSlots: 1, probability: action.probability, dueIn: action.dueIn, dueYear,
    requiredEvidence: [...action.requireEvidence], missing: [...missing], canLock,
    model: legacy ? 'legacy-overall' : COVERAGE_RULES.version,
    success, failure, chain, maintenance, annualSources, coverage,
    // This is explicitly a future-runtime contract, never an assertion about
    // an old institution. Legacy branch differences stay visible above.
    futureBranchAccess: { engine: 'current-runtime', ...futureBranchAccess },
    commonTerms, differenceTerms, annualSourceNote, compatibilityNote, prototypeNote,
  };
}
