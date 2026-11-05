import { FLOOD_REGIONS, PLANNING_RULES, WINDOWS, usesLegacyCrisisRules } from './simulation.js';

const RESPONSE_ACTIONS = {
  independent_review: '异源交叉复核',
  local_veto: '地方停闸与先行撤离',
  free_warning: '基本免费预警',
  mutual_aid: '南岸互助',
};
const copy = value => structuredClone(value);
const coefficient = value => Number.isFinite(value) && value >= 0 && value <= 1;
const sameAction = (record, event) => record.actionId === undefined || record.actionId === event.actionId;

// This is a read-only account of the evidence already in a save. In particular,
// current institutions and convenience flags cannot establish past protection.
export function getCrisisHistory(s, eventId) {
  const history = Array.isArray(s.history) ? s.history : [];
  const events = Array.isArray(s.events) ? s.events : [];
  const all = new Map([...history, ...events].map(item => [item.id, item]));
  const seen = new Set();
  let requested = all.get(eventId), relevant = false;
  while (requested && !seen.has(requested.id)) {
    if (['crisis-warning', 'crisis-impact'].includes(requested.id)) relevant = true;
    seen.add(requested.id);
    requested = all.get(requested.parentId);
  }
  if (!relevant) return null;

  // Duplicate identifiers are not unambiguous proof, even in a partial old save.
  const uniqueHistory = id => {
    const matches = history.filter(item => item.id === id);
    return matches.length === 1 ? matches[0] : null;
  };
  const uniqueEvent = id => {
    const matches = events.filter(item => item.id === id);
    return matches.length === 1 ? matches[0] : null;
  };
  const milestone = (id, kind, year) => {
    const item = uniqueHistory(id);
    return item?.kind === kind && item.year === year && item.year <= s.year ? item : null;
  };
  const warning = milestone('crisis-warning', 'warning', 14);
  const impact = milestone('crisis-impact', 'crisis', 23);

  // Mirrors fulfilledEvent's provenance checks, but retains every response and
  // also distinguishes documented failures and still-pending paid commitments.
  const sourceFor = event => {
    if (event.kind !== 'event' || typeof event.sourceActionId !== 'string' || uniqueEvent(event.id) !== event) return null;
    const [prefix, year, actorId, cellId, actionId, extra] = event.sourceActionId.split(':');
    const sourceYear = Number(year), source = uniqueHistory(event.sourceActionId);
    if (prefix !== 'action' || extra !== undefined || !WINDOWS.includes(sourceYear) || String(sourceYear) !== year
      || actionId !== event.actionId || cellId !== event.cellId
      || !s.actors?.some(actor => actor.id === actorId && actor.availableFrom <= sourceYear)
      || event.id !== `event:${event.sourceActionId}` || event.parentId !== event.sourceActionId
      || !Number.isInteger(event.year) || event.year <= sourceYear || sourceYear > s.year
      || source?.kind !== 'action' || source.parentId !== null || source.sourceActionId !== event.sourceActionId
      || source.cellId !== cellId || source.year !== sourceYear || !sameAction(source, event)) return null;
    return source;
  };
  const outcomeFor = event => {
    const kinds = { success: 'outcome', failed: 'failure', cancelled: 'cancelled' };
    const outcome = uniqueHistory(`resolved:${event.id}`);
    return kinds[event.status] && Number.isInteger(event.resolvedYear) && event.resolvedYear === event.year && event.year <= s.year
      && outcome?.parentId === event.id && outcome.sourceActionId === event.sourceActionId
      && outcome.cellId === event.cellId && outcome.year === event.year && outcome.status === event.status
      && outcome.kind === kinds[event.status] && sameAction(outcome, event) ? outcome : null;
  };

  const discovery = [];
  const detail = [];
  const branch = warning && uniqueEvent(warning.parentId);
  const training = branch && uniqueEvent(branch.parentId);
  const build = training && uniqueEvent(training.parentId);
  const buildSource = build && sourceFor(build);
  const buildOutcome = build && outcomeFor(build);
  const trainingOutcome = training && outcomeFor(training);
  const branchOutcome = branch && outcomeFor(branch);
  const successfulDiscovery = buildSource && ['build_joint', 'build_state', 'build_merchant'].includes(build.actionId)
    && build.status === 'success' && buildOutcome && build.cellId === 'D4'
    && training?.actionId === 'training' && training.status === 'success' && trainingOutcome && training.cellId === 'E4'
    && training.id === `${build.id}:training` && training.sourceActionId === build.sourceActionId
    && branch?.actionId === 'branch' && branch.status === 'success' && branchOutcome && branch.cellId === 'F6'
    && branch.id === `${training.id}:branch` && branch.sourceActionId === build.sourceActionId
    && build.year < training.year && training.year < branch.year && branch.year < warning.year;
  if (successfulDiscovery) {
    discovery.push(buildSource, buildOutcome, trainingOutcome, branchOutcome);
    detail.push('已核实的建站、培训与分站记录构成发现异常的资料渠道；它们不是洪水或共同标准偏差的起因。');
  } else {
    detail.push(warning?.parentId
      ? '预警的旧父项不足以证明发现渠道：分站或其来源缺少一致的成功记录。不能把失败、取消或缺失的分站写成已建成渠道。'
      : '没有可核实的分站发现渠道。第14年的共同标准预警仍是独立世界事件，不以玩家建站为前提。');
  }
  if (warning) discovery.push(warning);
  else detail.push('第14年预警原始记录缺失或不一致，发现经过未知。');

  const proven = [];
  let incompleteResponses = false;
  for (const event of events) {
    if (!Object.hasOwn(RESPONSE_ACTIONS, event.actionId) || event.year > 23) continue;
    const source = sourceFor(event), outcome = outcomeFor(event);
    const pending = event.status === 'pending' && event.year > s.year && event.resolvedYear === undefined
      && !history.some(item => item.id === `resolved:${event.id}`);
    if (!source || (!outcome && !pending)) { incompleteResponses = true; continue; }
    proven.push({ event, source, outcome });
  }
  proven.sort((a, b) => a.event.year - b.event.year || a.event.id.localeCompare(b.event.id));
  const success = actionId => proven.filter(item => item.event.actionId === actionId && item.event.status === 'success');
  const reviewed = success('independent_review').length > 0;
  const vetoBase = item => {
    if (item.event.planningRulesVersion !== PLANNING_RULES.version) return .3;
    const issued = item.event.evidence, recorded = item.source.evidence;
    if (!Array.isArray(issued) || !Array.isArray(recorded)
      || issued.includes('evacuation_routes') !== recorded.includes('evacuation_routes')) return null;
    return issued.includes('evacuation_routes') ? .2 : .3;
  };
  const vetoes = success('local_veto');
  const vetoBases = vetoes.map(vetoBase);
  const strongestVeto = vetoes.length && vetoBases.every(coefficient) ? Math.min(...vetoBases) : null;
  const legacy = usesLegacyCrisisRules(s);
  const responses = proven.map(item => {
    const { event, source, outcome } = item;
    let note;
    if (event.status === 'pending') note = `已提交，约定第${event.year}年兑现；尚未产生结果，不能记作危机保护。`;
    else if (event.status === 'failed') note = event.actionId === 'independent_review'
      ? '复核失败，未形成可靠结论，没有修正共同指令，也不提供本次危机保护；已付成本和失败记录保留。'
      : '行动失败，不能记作已兑现的危机保护。';
    else if (event.status === 'cancelled') note = '行动已取消，没有兑现，不能记作危机保护。';
    else if (event.actionId === 'independent_review') note = '已在冲击前成功识别并修正共同标准偏差，截断本次共同失效；洪水本身仍会到来，重复成功复核不叠加保护。';
    else if (event.actionId === 'local_veto') note = (vetoBase(item) === null
      ? '停闸已兑现，但方案证据缺失或不一致，具体损失基数未知。'
      : `已兑现${vetoBase(item) === .2 ? '核实撤离路线的强化' : '基本'}停闸方案，损失基数为${vetoBase(item).toFixed(2)}。`)
      + (reviewed ? '成功复核已截断共同失效，停闸不再额外减损。'
        : strongestVeto === null ? '最强方案系数未知；多份停闸不叠加、不相乘，也不修正错误标准。'
          : `多份停闸只采用最强的一份${strongestVeto.toFixed(2)}，不叠加、不相乘；它不修正错误标准。`);
    else if (event.actionId === 'free_warning') note = legacy
      ? '免费预警已兑现；旧版合同使四地整体剩余损失乘以0.80，不补造逐地覆盖，也不替代异源复核。'
      : '免费预警已兑现，为河港D4开放基本预警服务，不自动覆盖其他三地或修正共同标准。实际历史覆盖只读取第23年保存的明细。';
    else note = legacy
      ? '互助已在第23年之前兑现；旧版合同使四地整体剩余损失乘以0.70，重复互助不叠加。'
      : '互助已在第23年之前兑现；按合同仅在南岸D5当时有运转载体时减少一次30%的剩余损失，同地轮值不叠加。实际损失以第23年保存的明细为准。';
    return { label: RESPONSE_ACTIONS[event.actionId], note, eventId: event.id,
      recordId: outcome?.id || source.id, status: event.status, chain: copy(outcome ? [source, outcome] : [source]) };
  });

  if (!responses.length) detail.push('没有可核实的第23年前危机应对记录；这不等于缺失的旧档能够证明没有行动。');
  if (incompleteResponses) detail.push('部分应对缺少一致的行动来源或兑现记录，效果未知，未计作成功保护。');
  if (events.some(event => event.actionId === 'mutual_aid' && event.year > 23)) {
    detail.push('第23年后才兑现或约定兑现的互助属于后续生计，不列入本次危机保护，也不改写已发生的损失。');
  }
  if (impact) {
    const crisis = s.flags?.crisis;
    if (coefficient(crisis?.damage)) detail.push(`第23年已存整体损失系数：${crisis.damage.toFixed(2)}。`);
    let incomplete = false;
    for (const id of FLOOD_REGIONS) {
      const coverage = crisis?.coverageByCell?.[id], damage = crisis?.damageByCell?.[id];
      if (!coefficient(coverage) || !coefficient(damage)) incomplete = true;
      if (coefficient(coverage) || coefficient(damage)) detail.push(`第23年 ${id}：已存覆盖系数${coefficient(coverage) ? coverage.toFixed(2) : '未知'}；已存损失系数${coefficient(damage) ? damage.toFixed(2) : '未知'}。`);
    }
    if (incomplete) detail.push('旧档未完整保存第23年的逐地覆盖与损失明细，缺项未知；不从当前机构、状态标记或后来的互助重算，也不据此补写危机已避免。');
    detail.push('以上系数是第23年已保存的原型结算，不是人口或伤亡统计；后来的机构兴衰不会改写这些历史明细。');
  } else {
    detail.push(s.year < 23 ? '第23年冲击尚未结算，损失结果未知。此处不展示未来结果。' : '第23年冲击原始记录缺失或不一致，历史结果未知；不从状态标记补写胜利或损失。');
  }
  return {
    title: '共同失效：发现、应对与结果',
    explanation: '洪水与统一水文标准的共同偏差是独立于玩家建站的世界风险。不建站也会出现第14年预警与第23年冲击。建站、培训和分站可以留下记录、帮助发现异常；发现渠道、后续应对与实际结果须分开查看，不能串成“建站导致灾难”。',
    discovery: copy(discovery), responses, impact: impact ? copy(impact) : null, detail,
  };
}
