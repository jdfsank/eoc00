import { FLOOD_REGIONS, PLANNING_RULES, getFutureCheckContracts, getArchiveUpgradeContracts } from './simulation.js';
import { getCrisisHistory } from './crisis-history.js';

const REVIEW_ACTIONS = ['independent_review', 'complete_review', 'establish_future_check', 'upgrade_archive_check'];
const coefficient = value => Number.isFinite(value) && value >= 0 && value <= 1;
const unique = (items, id) => {
  const found = items.filter(item => item?.id === id);
  return found.length === 1 ? found[0] : null;
};
const copy = value => structuredClone(value);

// A local review outcome and the shared year23 settlement are different facts.
// This view never edits a record, runs a settlement, or consults today's carriers.
// A record selector accepts an action, scheduled event or resolved record ID;
// omit it for a recap, or pass cellId to foreground one region's review.
export function getReviewHistory(state, recordId = null, cellId = null) {
  const history = Array.isArray(state?.history) ? state.history : [];
  const events = Array.isArray(state?.events) ? state.events : [];
  const actors = Array.isArray(state?.actors) ? state.actors : [];
  const all = [...history, ...events];
  if (!Number.isInteger(state?.year)) return null;
  const candidates = events.filter(event => REVIEW_ACTIONS.includes(event?.actionId));
  const historicalReviews = history.filter(item => REVIEW_ACTIONS.includes(item?.actionId)
    || (typeof item?.id === 'string' && /:(independent_review|complete_review|establish_future_check|upgrade_archive_check)$/.test(item.id)));
  const relates = event => [event.id, event.sourceActionId, `resolved:${event.id}`].includes(recordId);
  const selected = recordId === null ? candidates : candidates.filter(relates);
  const raw = recordId === null ? null : unique(all, recordId);
  const orphan = recordId !== null && historicalReviews.some(item => item.id === recordId);
  if ((recordId !== null && !selected.length && !orphan) || (recordId === null && !candidates.length && !historicalReviews.length)) return null;
  const localCell = cellId || (selected.length === 1 ? selected[0].cellId : raw?.cellId) || null;

  // Reuse the crisis account's saved settlement and response chains. Apply the
  // stricter namespace and place checks here, including in partial old exports.
  const crisisView = getCrisisHistory(state, 'crisis-impact') || getCrisisHistory(state, 'crisis-warning');
  const original = crisisView?.impact;
  const impact = original && unique(all, original.id) === unique(history, original.id)
    && unique(history, original.id) && original.cellId === 'D4'
    && original.parentId === 'crisis-warning' && original.sourceActionId === null
    && original.status === 'confirmed' && original.reality === 'R1' ? original : null;
  const crisis = state.flags?.crisis;
  const scope = impact && crisis?.warningYear === 14 && crisis?.irreversibleYear === 23
    && Array.isArray(crisis.affectedCells) && crisis.affectedCells.length === FLOOD_REGIONS.length
    && new Set(crisis.affectedCells).size === FLOOD_REGIONS.length
    && FLOOD_REGIONS.every(id => crisis.affectedCells.includes(id));
  const damage = scope && coefficient(crisis.damage) ? crisis.damage : null;
  const status = state.year < 23 ? 'pending' : damage === null ? 'unknown' : damage === 0 ? 'zero' : 'loss';
  const summary = status === 'zero'
    ? '第23年原始清点的整体损失系数为0。本地复核失败不等于全局已经受损；零损失也不等于没有洪水或以后不会受损。'
    : status === 'loss'
      ? `第23年原始清点记有实际损失，整体损失系数为${String(damage)}。后来的校验、恢复或停运都不会抹去这次已存结算。`
      : status === 'pending' ? '第23年尚未结算，整体损失未知；不能把复核的成功或失败提前写成清点结果。'
        : '第23年原始清点缺失或不一致，整体损失未知；不能从本地复核失败推定全局受损，也不能用成功复核补写缺失的清点。';

  function reviewSource(event) {
    if (!event || !REVIEW_ACTIONS.includes(event.actionId) || unique(all, event.id) !== event
      || event.kind !== 'event' || typeof event.sourceActionId !== 'string') return null;
    const [prefix, year, actorId, site, actionId, extra] = event.sourceActionId.split(':');
    const start = event.actionId === 'complete_review' ? 30 : 20;
    const modern = event.planningRulesVersion === PLANNING_RULES.version;
    const due = start + (event.actionId === 'complete_review' || modern ? 2 : 1);
    const source = unique(history, event.sourceActionId), actor = unique(actors, actorId);
    if (prefix !== 'action' || year !== String(start) || extra !== undefined || actionId !== event.actionId
      || !['B4', 'F6'].includes(site) || site !== event.cellId || start > state.year
      || (event.planningRulesVersion !== undefined && !modern)
      || !actor || !Number.isInteger(actor.availableFrom) || actor.availableFrom > start
      || event.id !== `event:${event.sourceActionId}` || event.parentId !== event.sourceActionId || event.year !== due
      || !source || unique(all, source.id) !== source || source.kind !== 'action' || source.status !== 'confirmed'
      || source.year !== start || source.cellId !== site || source.parentId !== null || source.sourceActionId !== source.id
      || source.reality !== 'R1' || !Array.isArray(source.evidence) || !source.evidence.includes('anomaly_records')
      || (modern && (!Array.isArray(event.evidence) || JSON.stringify(event.evidence) !== JSON.stringify(source.evidence)))
      || history.filter(item => item?.kind === 'action' && typeof item.id === 'string' && item.id.startsWith(`action:${start}:${actorId}:`)).length !== 1
      || history.some(item => item?.id === `pass:${start}:${actorId}`)) return null;
    const outcomeId = `resolved:${event.id}`, outcome = unique(history, outcomeId);
    const pending = event.status === 'pending' && due > state.year && event.resolvedYear === undefined
      && !all.some(item => item?.id === outcomeId);
    const kind = { success: 'outcome', failed: 'failure', cancelled: 'cancelled' }[event.status];
    if (!pending && (!kind || !outcome || unique(all, outcome.id) !== outcome || event.resolvedYear !== due || due > state.year
      || outcome.kind !== kind || outcome.status !== event.status || outcome.year !== due || outcome.cellId !== site
      || outcome.parentId !== event.id || outcome.sourceActionId !== source.id || outcome.reality !== 'R1')) return null;
    if ([source, event, ...(outcome ? [outcome] : [])].some(item =>
      (item.actorId !== undefined && item.actorId !== actorId) || (item.actionId !== undefined && item.actionId !== event.actionId)
      || (item.reality !== undefined && item.reality !== 'R1'))) return null;
    return { event, source, outcome };
  }
  const independent = candidates.filter(event => event.actionId === 'independent_review').map(reviewSource).filter(Boolean);
  const recoveries = candidates.filter(event => event.actionId === 'complete_review').map(reviewSource).filter(item => {
    if (!item || !['pending', 'success', 'cancelled'].includes(item.event.status)) return false;
    const { event, source } = item;
    const failed = independent.find(item => item.event.id === event.recoverySourceId
      && item.event.status === 'failed' && item.event.cellId === event.cellId);
    return failed && source.recoverySourceId === failed.event.id
      && event.recoveryInstitutionId === `institution:${failed.event.id}:${event.cellId}`
      && source.recoveryInstitutionId === event.recoveryInstitutionId;
  });
  let prospective = [];
  try { prospective = [...getFutureCheckContracts(state), ...getArchiveUpgradeContracts(state)].map(contract => ({
    event: unique(events, contract.eventId), source: unique(history, contract.sourceActionId),
    outcome: contract.recordId ? unique(history, contract.recordId) : null, contract,
  })).filter(item => item.event && unique(all,item.event.id) === item.event
    && item.source && unique(all,item.source.id) === item.source && item.source.reality === 'R1'
    && (!item.outcome || unique(all,item.outcome.id) === item.outcome && item.outcome.reality === 'R1')
    && (!item.contract.archiveSourceRecordId || unique(all,item.contract.archiveSourceRecordId) === unique(history,item.contract.archiveSourceRecordId))); } catch { /* Partial exports retain unknown sources. */ }
  const responses = [...independent, ...recoveries, ...prospective].sort((a, b) => a.event.year - b.event.year || a.event.id.localeCompare(b.event.id)).map(item => {
    const { event, source, outcome } = item;
    const previous = crisisView?.responses.find(response => response.eventId === event.id);
    const late = event.actionId === 'complete_review';
    const upgrade = event.actionId === 'upgrade_archive_check', future = event.actionId === 'establish_future_check';
    const reason = {'archive-unavailable':'原保档未能继续运转','workforce-unavailable':'没有实际测量或教学人手','archive-and-workforce-unavailable':'原保档未能继续运转，也没有实际测量或教学人手'}[item.contract?.cancellationReason];
    const prospectiveNote = upgrade || future ? (event.status === 'success' ? `${upgrade?'地方保档升级':'从零新建的未来校验席'}已在第${event.year}年完成，只新增面向未来的指令校验；不是冲击前复核，也不是失败底稿补做。` : event.status === 'cancelled' ? `第${event.year}年${upgrade?reason:'没有实际测量或教学人手'}，新校验席取消，已付成本不退。` : `新校验席仍待第${event.year}年核对${upgrade?'原保档与':''}实际人手，尚未完成。`) + (upgrade?'原保档原页保留，升级不增加交班地域。':'不补写此前复核成功或失败。') + '第23年原始清点不改写，也不附送授权、信任或交班方针。' : null;
    const note = prospectiveNote || (late ? event.status === 'success'
      ? '后续校验已记为成功，只面向今后的核查；原复核失败与第23年清点各自保留。'
      : event.status === 'cancelled' ? '后续校验已经取消，已付成本与取消记录保留；它没有改变原复核结果或第23年清点。'
        : '后续校验仍待第32年核对原记录与实际人手，不能提前记为完成，也不改写第23年清点。'
      : previous?.note || (event.status === 'success' ? '复核成功，已在冲击前修正共同标准；实际损失仍须另读第23年清点。'
        : event.status === 'failed' ? '复核失败，未形成可靠结论；这条本地记录不能单独证明全局损失。'
          : event.status === 'pending' ? '复核仍待兑现，不能提前记为成功或失败。' : '复核已经取消，没有形成已兑现的保护。'));
    return { eventId: event.id, recordId: outcome?.id || source.id, sourceActionId: source.id,
      actionId: event.actionId, cellId: event.cellId, year: event.year, status: event.status,
      label: upgrade ? '地方保档升级' : future ? '从零未来校验' : late ? '后续遗留校验' : '冲击前异源复核', note, chain: copy([...(item.contract?.archiveSourceRecordId ? [unique(history,item.contract.archiveSourceRecordId)] : []),source,...(outcome ? [outcome] : [])]) };
  });
  const localReviews = responses.filter(response => response.actionId === 'independent_review' && (!localCell || response.cellId === localCell));
  const detail = responses.map(response => `第${response.year}年 · ${response.cellId}：${response.note}`);
  if (candidates.some(event => !responses.some(response => response.eventId === event.id))
    || historicalReviews.some(item => !responses.some(response => [response.sourceActionId, response.recordId].includes(item.id)))) detail.push('部分复核来源或兑现记录缺失、不唯一或不一致，其经过未知；不从当前机构、便捷标记或原始模板补写。');
  if (localCell && !localReviews.length) detail.unshift(`${localCell}没有可核实的本地复核结果，原失败或成功均不能凭空补写。`);
  if (status !== 'pending') detail.push('复核的成败与全局灾损分开记录。第23年只读已存原始清点；后来的成功、产出回升或载体变化不会重算过去。');
  if (impact && FLOOD_REGIONS.some(id => !coefficient(crisis?.damageByCell?.[id]))) detail.push('逐地损失明细未完整保存，缺项未知；整体系数不补作任何一地的损失或覆盖。');
  detail.push('损失系数是原型结算，不是人口或伤亡统计，也不证明具体建筑毁损。');
  const sourceIds = [...new Set([...(impact ? [impact.id] : []), ...responses.flatMap(response => response.chain.map(record => record.id))])];
  const genericLossText = typeof raw?.text === 'string' && /第23年(?:已记录的|的)?损失|已经发生的损失|此前已发生的损失/.test(raw.text);
  return { title: '复核成败与第23年清点', status, damage, summary,
    explanation: genericLossText
      ? '原文关于已发生损失的措辞来自通用模板，不单独作为本局灾损事实；已核实的复核成败仍按原记录保留，灾损以下方只读清点说明为准。'
      : '原始复核记录和已核实的成败保留；本地复核结果与第23年全局清点分别核对，不能用其中一项代替另一项。',
    originalLabel: genericLossText ? '原始记录 · 损失措辞来自通用模板（保留原文，不作本局灾损断言）' : '原始复核记录（保留原文）',
    detail, impact: impact ? copy(impact) : null, responses, localReviews, sourceIds,
    original: raw ? copy(raw) : null };
}
