import board from './data/board.json' with { type: 'json' };
import { BRANCH_ACCESS_RULES, getFutureBranchAccess, isBranchAccessRulesVersion } from './branch-access.js';

export const CHANNELS = ['politics', 'economy', 'science', 'religion'];
export const WINDOWS = [0, 10, 20, 30];
export const FLOOD_REGIONS = ['D4', 'E4', 'D5', 'F6'];
// Tunable prototype assumptions, not historical measurements or handoff specifications.
export const COVERAGE_RULES = Object.freeze({
  version: 'coverage-v1', paidAccess: .45, localTeaching: .55, communityWarning: .65,
  warningProtection: .35, stateCoordination: .1, jointRecords: .15, mutualAid: .3,
});
export const usesLegacyCrisisRules = s => s.crisisRulesVersion !== COVERAGE_RULES.version;
export const STAFFING_RULES = Object.freeze({ stationOnly: 'station-only-v1', riverCarriers: 'river-carriers-v1', version: 'river-carriers-v1' });
const validStaffingVersion = version => [STAFFING_RULES.stationOnly, STAFFING_RULES.riverCarriers].includes(version);
export function getStaffingRulesVersion(s) {
  if (s.staffingRulesVersion !== undefined) {
    if (!validStaffingVersion(s.staffingRulesVersion)) throw new Error('人手结算规则版本非法');
    return s.staffingRulesVersion;
  }
  // This is a prospective compatibility policy, not producer identification.
  // Unversioned originals may already contain results from a newer runtime.
  return usesLegacyCrisisRules(s) ? STAFFING_RULES.stationOnly : STAFFING_RULES.riverCarriers;
}
export function getStaffingRulesDescription(s) {
  const original = getStaffingRulesVersion(s) === STAFFING_RULES.stationOnly;
  const scope = original ? '原版人手结算：缺岗减产与第16年停运只作用于测站，不作用于档案站。' : '河港人手结算：缺岗减产与第16年停运适用于D4测站和档案站。';
  return scope + (s.staffingRulesVersion === undefined ? '未保存独立人手版本，按本局危机规则身份采用兼容默认；这不是对曾用引擎的鉴别。' : '本局已明确保存独立人手版本。') + '规则只用于之后的结算；已存产出、停运、危机与历史不重算，已停运机构不会因此复活。这不是完整回滚旧引擎。';
}
export const PLANNING_RULES = Object.freeze({ version: 'tradeoffs-v1', investigationBudget: 3, emergencyReview: .55, partialReview: .8, surveyedVeto: .2 });
export const usesTradeoffs = s => s.planningRulesVersion === PLANNING_RULES.version;
export const HANDOFF_RULES = Object.freeze({ version: 'handoff-v1' });
export const usesHandoffRules = s => s.handoffRulesVersion === HANDOFF_RULES.version;
export const AFTERMATH_RULES = Object.freeze({ version: 'aftermath-v1' });
export const usesAftermathRules = s => s.aftermathRulesVersion === AFTERMATH_RULES.version;
export const RECRUITMENT_RULES = Object.freeze({ version: 'recruitment-v1' });
export const usesRecruitmentRules = s => s.recruitmentRulesVersion === RECRUITMENT_RULES.version;
export const RECOVERY_RULES = Object.freeze({ version: 'recovery-v1' });
export const usesRecoveryRules = s => s.recoveryRulesVersion === RECOVERY_RULES.version;
export const FUTURE_CHECK_RULES = Object.freeze({ version: 'future-check-v1', actionId: 'establish_future_check', dueYear: 34 });
export const usesFutureCheckRules = s => s.futureCheckRulesVersion === FUTURE_CHECK_RULES.version;
// Tunable prototype assumptions: paid conversion of an existing method, not a
// retroactive successful review or a migration of released future-check-v1 runs.
export const ARCHIVE_UPGRADE_RULES = Object.freeze({ version: 'archive-upgrade-v1', actionId: 'upgrade_archive_check', dueYear: 33, cost: Object.freeze({economy:5,science:3}) });
export const usesArchiveUpgradeRules = s => s.archiveUpgradeRulesVersion === ARCHIVE_UPGRADE_RULES.version;
export const PORT_ACCESS_RULES = Object.freeze({version:'port-access-v1'});
export const usesPortAccessRules = s => s.portAccessRulesVersion === PORT_ACCESS_RULES.version;
export const RECRUITMENT_ACTIONS = ['recruit_successor', 'recruit_risk', 'recruit_volunteer'];
export const EVIDENCE = {
  independent_flood_records: '独立洪水记录', unfunded_maintenance: '维护经费缺口',
  successor_consent: '继任者的同意', anomaly_records: '异常水位记录',
  old_reality_record: '旧现实教师档案', resident_testimony: '居民的当前证词', evacuation_routes: '逐户核实撤离路线',
};
const copy = x => structuredClone(x);
const clamp = x => Math.round(Math.max(0, Math.min(100, x)) * 10000) / 10000;
const cell = (s, id) => s.cells.find(c => c.id === id);
const require = (condition, message) => { if (!condition) throw new Error(message); };
const active = (s, kind) => s.institutions.find(i => i.kind === kind && i.active);
// Stateless keyed PRNG: execution order, translated titles, UI navigation and reloads cannot reroll it.
export function randomFor(seed, key) {
  let h = 2166136261;
  for (const char of `${seed}/${key}/conditions-v1`) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const sources = { station: [0.1, 0.1, 1.6, 0.25], archive: [0, 0, .35, .15], training: [.1, .25, .7, .1], branch: [.15, .4, 1, .15], school: [.1, .25, .65, .2], mutual: [.1, .6, .1, .55], independent: [.2, .1, .65, .2], warning: [.05, .1, .2, .1] };
const coefficient = value => Math.round(Math.max(0, Math.min(1, value)) * 10000) / 10000;
export function getInstitutionStaffing(s, i, { assumedRecruitmentActionId } = {}) {
  const rulesVersion = getStaffingRulesVersion(s), original = rulesVersion === STAFFING_RULES.stationOnly;
  const hypothetical = assumedRecruitmentActionId !== undefined;
  if (hypothetical && !RECRUITMENT_ACTIONS.includes(assumedRecruitmentActionId)) throw new Error('招募人手推算的行动非法');
  const vacancy = hypothetical ? assumedRecruitmentActionId === 'recruit_risk'
    : original ? !!s.flags?.recruited && !s.flags?.successor : s.flags ? hasRecruitmentVacancy(s) : false;
  const eligible = original ? i.kind === 'station' : i.cellId === 'D4' && ['station', 'archive'].includes(i.kind);
  const sourceMultiplier = eligible && vacancy ? .5 : 1;
  // The original milestone stopped its first active station only. Production
  // applied to every station; do not accidentally merge those two scopes.
  const shutdownTarget = vacancy && eligible && i.active && (!original || active(s, 'station')?.id === i.id);
  return { rulesVersion, sourceMultiplier,
    outputReducedNow: !hypothetical && !!i.active && i.maintenance > 0 && sourceMultiplier < 1,
    shutdownIfUnchangedYear: s.year < 16 && vacancy && shutdownTarget ? 16 : null };
}
const staffingFor = (s, i) => getInstitutionStaffing(s, i).sourceMultiplier;

function recruitmentStaffingNote(s, actionId) {
  const original = getStaffingRulesVersion(s) === STAFFING_RULES.stationOnly;
  const rule = original ? '本局原版缺岗规则只作用于测站，档案站不因此减产或在第16年停运。' : '本局缺岗规则作用于D4测站和档案站。';
  if (actionId === 'recruit_volunteer') return '没有正在交接的岗位；自愿同行不制造减产或停运，也不补建机构或授予继任。';
  if (actionId === 'recruit_successor') return rule + (getRecruitmentRoles(s).length
    ? '安排继任针对现有岗位；接班有人不等于长期维护经费已足额，也不等于续约公开章程。'
    : '当前没有可交接的河港岗位；原继任合同保留，但不能据此补写任职、机构或已落实的人手。');
  const targets = s.institutions.filter(i => i.active && i.maintenance > 0 && getInstitutionStaffing(s, i, { assumedRecruitmentActionId: actionId }).sourceMultiplier < 1);
  return rule + (targets.length
    ? `若本合同兑现，当前有效载体${targets.map(i => `${i.cellId}${i.kind === 'station' ? '测站' : '档案站'}`).join('、')}的年度来源产出减半；若届时仍缺继任，第16年按本局规则停运。`
    : '当前没有有效载体会因本合同减少现有产出；不能把不存在或已停下的产出写成损失。') + '这只是合同条件说明，尚未兑现；真实离岗和原继任合同仍会保留。';
}

function governanceFor(s, i) {
  const origin = s.history.find(event => event.id === i.sourceActionId && event.kind === 'action');
  const actionId = i.sourceActionId?.split(':').at(-1);
  const succeeded = s.events.some(event => event.sourceActionId === i.sourceActionId && event.actionId === actionId && event.status === 'success');
  if (!origin || !actionId?.startsWith('build_') || !succeeded) return { kind: 'local', protection: 0 };
  const kind = actionId.slice(6);
  const protection = kind === 'state' ? COVERAGE_RULES.stateCoordination
    : kind === 'joint' && Array.isArray(origin.evidence) && origin.evidence.includes('independent_flood_records') ? COVERAGE_RULES.jointRecords : 0;
  return { kind, protection };
}

export function getWarningCoverage(s) {
  return Object.fromEntries(s.cells.map(c => {
    const providers = s.institutions.filter(i => i.cellId === c.id && i.active && ['station', 'branch', 'training', 'school', 'warning'].includes(i.kind)).map(i => {
      const governance = governanceFor(s, i);
      const reach = ['station', 'branch'].includes(i.kind) ? (i.open ? 1 : COVERAGE_RULES.paidAccess)
        : i.kind === 'warning' ? COVERAGE_RULES.communityWarning : COVERAGE_RULES.localTeaching;
      const upkeep = i.maintenance * staffingFor(s, i);
      return { institutionId: i.id, kind: i.kind, open: i.open, governance: governance.kind,
        coverage: coefficient(reach * upkeep), protection: coefficient(governance.protection * upkeep) };
    });
    return [c.id, { coverage: Math.max(0, ...providers.map(i => i.coverage)),
      protection: Math.max(0, ...providers.map(i => i.protection)), providers }];
  }));
}

// Public consequence arithmetic shared by settlement and read-only planning.
// Callers supply issued facts or explicitly conditional service assumptions;
// this function neither resolves contracts nor consults random outcomes.
export function getCrisisLosses(s, mitigation, affectedCells = FLOOD_REGIONS) {
  const coverage = getWarningCoverage(s), damageByCell = {}, coverageByCell = {}, protectionByCell = {};
  for (const id of affectedCells) {
    const service = coverage[id];
    const hasAid = s.institutions.some(i => i.cellId === id && i.kind === 'mutual' && i.active && (!usesAftermathRules(s) || i.maintenance > 0));
    coverageByCell[id] = service.coverage; protectionByCell[id] = service.protection;
    damageByCell[id] = coefficient(mitigation * (1 - COVERAGE_RULES.warningProtection * service.coverage) * (1 - service.protection) * (hasAid ? 1 - COVERAGE_RULES.mutualAid : 1));
  }
  return {damage: coefficient(Object.values(damageByCell).reduce((sum, value) => sum + value, 0) / affectedCells.length), damageByCell, coverageByCell, protectionByCell};
}

export function reviewPreparation(s) {
  const records = s.institutions.some(i => i.active && i.maintenance > 0 && (i.sourceActionId?.endsWith(':preserve_records') || (governanceFor(s, i).kind === 'joint' && governanceFor(s, i).protection > 0)));
  const workforce = s.institutions.some(i => i.active && i.maintenance > 0 && ['station', 'branch', 'training', 'school'].includes(i.kind));
  return { records, workforce, probability: records && workforce ? 1 : records || workforce ? PLANNING_RULES.partialReview : PLANNING_RULES.emergencyReview };
}
// Capability, source and permission are separate facts. A second building or
// a second copy of a standard is not a second independent correction method.
export function getHandoffReadiness(s) {
  const live = s.institutions.filter(i => i.active && i.maintenance > 0);
  const sourceEvent = i => s.events.find(e => e.id === i.sourceEventId && e.sourceActionId === i.sourceActionId && e.status === 'success');
  const describe = i => ({ id: i.id, cellId: i.cellId, kind: i.kind, name: i.name, sourceActionId: i.sourceActionId });
  const staff = live.filter(i => ['training', 'school'].includes(i.kind) && sourceEvent(i));
  const hasMandate = i => {
    const source = sourceEvent(i);
    if (i.kind === 'school') return ['fund_school', 'train_network'].includes(source?.actionId);
    const grant = i.handoffAuthorization;
    return !!grant && grant.sourceActionId === i.sourceActionId && s.events.some(e => e.id === grant.eventId && e.actionId === 'renew_charter' && e.status === 'success' && e.resolvedYear === grant.year && e.authorizedTrainingSources?.includes(grant.sourceActionId));
  };
  const authorizedStaff = staff.filter(hasMandate);
  const checks = live.filter(i => i.kind === 'independent' && (['preserve_records', 'independent_review'].includes(sourceEvent(i)?.actionId) || (usesRecoveryRules(s) && sourceEvent(i)?.actionId === 'complete_review' && isRecoveryCarrier(s,i)) || (usesFutureCheckRules(s) && isFutureCheckCarrier(s,i)) || (usesArchiveUpgradeRules(s) && isArchiveUpgradeCarrier(s,i))));
  const links = authorizedStaff.flatMap(person => checks.filter(check => check.cellId !== person.cellId).map(check => ({ staffId: person.id, staffCell: person.cellId, checkId: check.id, checkCell: check.cellId })));
  const trust = s.flags.trust ?? !!s.flags.renewed;
  const missing = [];
  if (!staff.length) missing.push('缺少运转中的培训或教学人手');
  else if (!authorizedStaff.length) missing.push('现有人手尚缺地方承接授权');
  if (!checks.length) missing.push('缺少成功工作的异源校验载体');
  if (authorizedStaff.length && checks.length && !links.length) missing.push('人手与校验仍在同一地域，缺少跨地承接关系');
  const shareMissing = [...missing, ...(!trust ? [s.flags.trust === false ? '河港明确拒绝当前安排' : '河港尚未作出合作承诺'] : [])];
  return { staff: staff.map(describe), authorizedStaff: authorizedStaff.map(describe), checks: checks.map(describe), links,
    staffCells: [...new Set(staff.map(i => i.cellId))], authorizedCells: [...new Set(authorizedStaff.map(i => i.cellId))], checkCells: [...new Set(checks.map(i => i.cellId))],
    trust, canWithdraw: links.length > 0, canShare: links.length > 0 && trust, missing, shareMissing };
}
export function handoffSummary(s, policy = 'withdraw') {
  const ready = getHandoffReadiness(s);
  const missing = policy === 'share_power' ? ready.shareMissing : ready.missing;
  return `当前承接人手：${ready.staffCells.join('、') || '无'}；已获地方授权：${ready.authorizedCells.join('、') || '无'}；异源校验：${ready.checkCells.join('、') || '无'}。${missing.length ? '仍需：' + missing.join('；') : '当前交班条件齐备'}。`;
}
export const PORTABLE_EVIDENCE = ['independent_flood_records', 'anomaly_records', 'evacuation_routes', 'old_reality_record'];
export const evidenceCost = (s, id) => usesTradeoffs(s) && ['anomaly_records', 'evacuation_routes'].includes(id) ? 2 : 1;
export function getEvidenceIds(s, cellId, actorId = 'protagonist') {
  const candidates = s.year === 0 ? ['independent_flood_records', 'unfunded_maintenance', 'resident_testimony']
    : s.year === 10 ? ['successor_consent', 'resident_testimony', 'unfunded_maintenance']
    : ['anomaly_records', ...(usesTradeoffs(s) && s.year === 20 ? ['evacuation_routes'] : []), 'old_reality_record', 'resident_testimony'];
  return [...new Set(getActions(s, cellId, actorId).flatMap(a => a.requireEvidence).concat(candidates))];
}
export function getInvestigation(s, actorId, cellId) {
  const entries = s.investigations?.[`${s.year}:${actorId}`] || [];
  return { evidence: entries.filter(e => e.cellId === cellId || PORTABLE_EVIDENCE.includes(e.evidenceId)).map(e => e.evidenceId), budget: PLANNING_RULES.investigationBudget - entries.reduce((sum, e) => sum + evidenceCost(s, e.evidenceId), 0) };
}
export function investigate(s, actorId, cellId, evidenceId) {
  assertPlanning(s, actorId); require(usesTradeoffs(s), '本局仍使用原场景调查规则');
  require(getActions(s, cellId, actorId).length && getEvidenceIds(s, cellId, actorId).includes(evidenceId), '当前现场没有这份材料');
  const current = getInvestigation(s, actorId, cellId);
  if (current.evidence.includes(evidenceId)) return s;
  require(current.budget >= evidenceCost(s, evidenceId), '本角色本窗口的调查轮次不足');
  (s.investigations[`${s.year}:${actorId}`] ||= []).push({ cellId, evidenceId });
  return s;
}

function institution(s, kind, location, event, name, source = sources[kind]) {
  const i = { id: `institution:${event.id}:${location}`, kind, cellId: location, name, active: true, sourceEventId: event.id, sourceActionId: event.sourceActionId, startYear: s.year, annualSource: Object.fromEntries(CHANNELS.map((k, n) => [k, source[n]])), maintenance: 1, open: true };
  s.institutions.push(i); return i;
}
function record(s, data) {
  const item = { id: data.id, year: s.year, cellId: 'D4', title: '', text: '', parentId: null, sourceActionId: null, kind: 'history', status: 'confirmed', reality: 'R1', ...data };
  require(!s.history.some(h => h.id === item.id), `重复历史记录：${item.id}`);
  s.history.push(item); return item;
}
function schedule(s, data) {
  require(data.year > s.year, '次生事件只能在未来年份兑现');
  if (!s.events.some(e => e.id === data.id)) s.events.push({ kind: 'event', status: 'pending', parentId: null, sourceActionId: null, probability: 1, conditionVersion: 1, ...data });
}
export function createRun(seed = 12) {
  const s = { version: 'afterwave.run.v1', crisisRulesVersion: COVERAGE_RULES.version, staffingRulesVersion: STAFFING_RULES.version, branchAccessRulesVersion: BRANCH_ACCESS_RULES.version, planningRulesVersion: PLANNING_RULES.version, handoffRulesVersion: HANDOFF_RULES.version, aftermathRulesVersion: AFTERMATH_RULES.version, recruitmentRulesVersion: RECRUITMENT_RULES.version, recoveryRulesVersion: RECOVERY_RULES.version, futureCheckRulesVersion: FUTURE_CHECK_RULES.version, archiveUpgradeRulesVersion: ARCHIVE_UPGRADE_RULES.version, portAccessRulesVersion: PORT_ACCESS_RULES.version, investigations: {}, seed: String(seed), year: 0, phase: 'planning', cells: copy(board.cells), actors: [{ id: 'protagonist', name: '主角', availableFrom: 0, anchored: true, alive: true }], drafts: {}, events: [], institutions: [], history: [], flags: {}, committedWindows: [], snapshots: {}, baseline: Object.fromEntries(board.cells.map(c => [c.id, copy(c.channels)])), promises: [], reality: 'R1' };
  s.cells.forEach(c => { c.deployable = ['D4', 'B4'].includes(c.id); if (c.name === '未命名地域') c.name = `${c.id}·${c.terrain === 'water' ? '水域' : '原野'}`; });
  record(s, { id: 'arrival', title: '第零年 · 借来的十年', text: '续史局只能在每十年的窗口介入一次。你是唯一的介入员。河港将迎来洪水，但居民并不只需要被拯救。', kind: 'arrival' });
  s.snapshots[0] = copy(s.cells); return s;
}
export function getRecruitmentRoles(s) {
  return s.institutions.filter(i => i.cellId === 'D4' && ['station', 'archive'].includes(i.kind) && i.active && i.maintenance > 0);
}
export function fulfilledEvent(s, actionIds) {
  const ids = Array.isArray(actionIds) ? actionIds : [actionIds];
  return s.events.filter(e => {
    if (typeof e.sourceActionId !== 'string') return false;
    const [prefix, year, actorId, cellId, actionId, extra] = e.sourceActionId.split(':');
    const sourceYear = Number(year);
    return prefix === 'action' && extra === undefined && WINDOWS.includes(sourceYear) && String(sourceYear) === year && cellId === e.cellId && actionId === e.actionId
      && s.actors.some(a => a.id === actorId && a.availableFrom <= sourceYear)
      && ids.includes(e.actionId) && e.status === 'success' && Number.isInteger(e.resolvedYear) && e.resolvedYear === e.year && e.year <= s.year && e.year > sourceYear
      && e.id === `event:${e.sourceActionId}` && e.parentId === e.sourceActionId
      && s.history.some(h => h.id === e.sourceActionId && h.sourceActionId === e.sourceActionId && h.kind === 'action' && h.cellId === e.cellId && h.year === sourceYear)
      && s.history.some(h => h.id === `resolved:${e.id}` && h.parentId === e.id && h.sourceActionId === e.sourceActionId && h.status === 'success' && h.kind === 'outcome' && h.cellId === e.cellId && h.year === e.resolvedYear);
  }).sort((a,b) => b.resolvedYear-a.resolvedYear)[0] || null;
}
export function recruitmentRolesAtDeparture(s, event) {
  if (!event) return [];
  if (Array.isArray(event.departureRoleIds)) return s.institutions.filter(i => event.departureRoleIds.includes(i.id));
  // Older authored routes create carriers before11 and record later shutdowns.
  // Do not infer a past job from today's flags or a later community warning team.
  return s.institutions.filter(i => i.cellId === 'D4' && ['station', 'archive'].includes(i.kind) && i.startYear < event.year
    && !s.history.some(h => h.kind === 'maintenance' && /-unattended$/.test(h.id) && h.parentId === i.sourceEventId && h.year < event.year));
}
export function hasRecruitmentVacancy(s) {
  if (!s.flags.recruited || s.flags.successor) return false;
  if (!usesRecruitmentRules(s)) return true;
  return s.events.some(e => e.actionId === 'recruit_risk' && e.status === 'success' && e.departureRoleIds?.length);
}
function validRecruitmentSource(s, event) {
  if (!RECRUITMENT_ACTIONS.includes(event.actionId)) return !event.actionId?.startsWith('recruit_');
  const source = `action:10:protagonist:D4:${event.actionId}`;
  const roles = event.departureRoleIds;
  const action = s.history.find(h => h.id === source && h.sourceActionId === source && h.kind === 'action' && h.cellId === 'D4' && h.year === 10);
  return event.id === `event:${source}` && event.sourceActionId === source && event.parentId === source && event.cellId === 'D4' && event.year === 11
    && Array.isArray(roles) && new Set(roles).size === roles.length && (event.actionId === 'recruit_volunteer' ? roles.length === 0 : roles.length > 0)
    && roles.every(id => s.institutions.some(i => i.id === id && i.cellId === 'D4' && ['station','archive'].includes(i.kind) && i.startYear <= 10))
    && !!action && JSON.stringify(action.departureRoleIds) === JSON.stringify(roles)
    && (s.year > 11 || JSON.stringify([...roles].sort()) === JSON.stringify(getRecruitmentRoles(s).map(i => i.id).sort()))
    && (event.status === 'pending' || s.history.some(h => h.id === `resolved:${event.id}` && h.parentId === event.id && h.sourceActionId === source && h.year === event.resolvedYear && h.status === event.status));
}
// Actor positions and aid promises are new-run contracts. Existing saves retain
// their issued tasks; presentation may clarify limits without rewriting history.
export function getActorRefusals(s, actorId, cellId) {
  if (!usesAftermathRules(s) || actorId !== 'linche' || cellId !== 'D4' || s.year !== 20 || s.phase !== 'planning') return [];
  const recruited = fulfilledEvent(s, RECRUITMENT_ACTIONS);
  const roles = recruitmentRolesAtDeparture(s, recruited);
  const reason = recruited && !roles.length
    ? `第${recruited.resolvedYear}年，林澈自愿入局时没有运转中的河港测站或档案岗位需要交接。“我的选择不是别人的调令；我可以陪她商量，不能替她同意。”`
    : recruited?.actionId === 'recruit_successor'
    ? `第${recruited.resolvedYear}年，林澈在苏岚同意接班后才入局。“我当年答应让她自己签名，不能现在拿调令替她决定去哪里。”`
    : recruited?.actionId === 'recruit_risk'
      ? `第${recruited.resolvedYear}年，林澈离开时没有安排继任。“我已经留下过一个岗位缺口，不能再把别人的旧履历当成调令。我可以帮她商量，不能替她同意。”`
      : '这份记录缺少可核实的林澈入局经过，不能补写她曾作过的承诺。她不亲自执行未经本人同意的迁任。';
  return [{ actionId: 'relocate_teacher', title: '林澈不亲自执行强制迁任', reason, sourceEventId: recruited?.id || null, sourceRecordId: recruited ? (s.history.find(h => h.id === `resolved:${recruited.id}`)?.id || recruited.id) : null }];
}
function validRelocationSource(s, event) {
  if (event.actionId !== 'relocate_teacher') return true;
  // Newly issued relocation is only a protagonist's year20 riverport task.
  // A nullable display/source field must not determine who executed it.
  const source = 'action:20:protagonist:D4:relocate_teacher';
  return event.id === `event:${source}` && event.parentId === source && event.sourceActionId === source
    && event.cellId === 'D4' && event.year === 21
    && s.history.some(h => h.id === source && h.sourceActionId === source && h.kind === 'action' && h.cellId === 'D4' && h.year === 20);
}
// Failed reviews keep their own identity. A later contract may use those records
// without changing the original failure or claiming the year23 loss was avoided.
export function getRecoverySource(s, cellId, {requireActive = true} = {}) {
  if (!usesRecoveryRules(s) || !['B4','F6'].includes(cellId)) return null;
  for (const e of s.events.filter(e=>e.actionId==='independent_review'&&e.cellId===cellId&&e.status==='failed')) {
    const [prefix,year,actorId,sourceCell,actionId,extra] = (e.sourceActionId||'').split(':');
    const source = s.history.find(h=>h.id===e.sourceActionId);
    const outcome = s.history.find(h=>h.id===`resolved:${e.id}`);
    const i = s.institutions.find(i=>i.kind==='independent'&&i.cellId===cellId&&i.sourceEventId===e.id&&i.sourceActionId===e.sourceActionId&&i.startYear===e.year);
    if(prefix!=='action'||year!=='20'||extra!==undefined||sourceCell!==cellId||actionId!=='independent_review'||!s.actors.some(a=>a.id===actorId&&a.availableFrom<=20))continue;
    if(e.id!==`event:${e.sourceActionId}`||e.parentId!==e.sourceActionId||e.kind!=='event'||e.year!==(e.planningRulesVersion===PLANNING_RULES.version?22:21)||e.resolvedYear!==e.year||e.year>s.year)continue;
    if(source?.kind!=='action'||source.parentId!==null||source.sourceActionId!==e.sourceActionId||source.year!==20||source.cellId!==cellId||!source.evidence?.includes('anomaly_records'))continue;
    if(e.planningRulesVersion===PLANNING_RULES.version&&(!Array.isArray(e.evidence)||JSON.stringify(e.evidence)!==JSON.stringify(source.evidence)))continue;
    if(outcome?.kind!=='failure'||outcome.status!=='failed'||outcome.parentId!==e.id||outcome.sourceActionId!==e.sourceActionId||outcome.year!==e.year||outcome.cellId!==cellId)continue;
    if(!i||i.id!==`institution:${e.id}:${cellId}`||(requireActive&&(!i.active||i.maintenance<=0)))continue;
    return {eventId:e.id,recordId:outcome.id,institutionId:i.id,cellId,sourceActionId:e.sourceActionId};
  }
  return null;
}
export function getRecoveryWorkforce(s, {requireActive = true} = {}) {
  const confirmed=e=>!!e&&e.kind==='event'&&e.status==='success'&&e.resolvedYear===e.year&&e.year<=s.year&&s.history.some(h=>h.id===`resolved:${e.id}`&&h.parentId===e.id&&h.kind==='outcome'&&h.status==='success'&&h.sourceActionId===e.sourceActionId&&h.cellId===e.cellId&&h.year===e.year);
  return s.institutions.filter(i=>{
    if(!['station','branch','training','school'].includes(i.kind)||(requireActive&&(!i.active||i.maintenance<=0)))return false;
    const e=s.events.find(e=>e.id===i.sourceEventId&&e.sourceActionId===i.sourceActionId);
    if(!confirmed(e)||i.startYear!==e.year||i.id!==`institution:${e.id}:${i.cellId}`)return false;
    const [prefix,year,actorId,sourceCell,actionId,extra]=(e.sourceActionId||'').split(':');
    const origin=s.history.find(h=>h.id===e.sourceActionId);
    if(prefix!=='action'||extra!==undefined||!WINDOWS.includes(Number(year))||String(Number(year))!==year||Number(year)>=e.year||!s.actors.some(a=>a.id===actorId&&a.availableFrom<=Number(year))||origin?.kind!=='action'||origin.parentId!==null||origin.year!==Number(year)||origin.cellId!==sourceCell||origin.sourceActionId!==e.sourceActionId)return false;
    const root=`event:${e.sourceActionId}`;
    if(i.kind==='station')return e.cellId===i.cellId&&e.id===root&&e.parentId===e.sourceActionId&&e.actionId===actionId&&(['build_joint','build_state','build_merchant','restore_archive'].includes(actionId));
    if(i.kind==='school') {
      const place=actionId==='relocate_teacher'?e.cellId==='D4'&&sourceCell==='D4'&&i.cellId==='E4':e.cellId==='E4'&&sourceCell==='E4'&&i.cellId==='E4';
      const time=actionId==='fund_school'?Number(year)===10:actionId==='train_network'?[20,30].includes(Number(year)):actionId==='relocate_teacher'&&Number(year)===20;
      return place&&time&&e.id===root&&e.parentId===e.sourceActionId&&e.actionId===actionId;
    }
    const build=s.events.find(x=>x.id===root&&x.sourceActionId===e.sourceActionId&&x.actionId===actionId&&x.parentId===e.sourceActionId);
    if(!['build_joint','build_state','build_merchant'].includes(actionId)||!confirmed(build))return false;
    if(i.kind==='training')return ['E4','D5'].includes(i.cellId)&&e.cellId==='E4'&&e.actionId==='training'&&e.id===`${root}:training`&&e.parentId===root&&build.year<e.year;
    const training=s.events.find(x=>x.id===`${root}:training`&&x.sourceActionId===e.sourceActionId&&x.actionId==='training'&&x.parentId===root);
    return i.cellId==='F6'&&e.cellId==='F6'&&e.actionId==='branch'&&e.id===`${root}:training:branch`&&e.parentId===`${root}:training`&&confirmed(training)&&build.year<training.year&&training.year<e.year;
  }).map(i=>({id:i.id,cellId:i.cellId,kind:i.kind,name:i.name,startYear:i.startYear}));
}
// Reuse the strict, existing branch provenance check. Opening a service
// never creates a new carrier or rewrites its original institutional source.
export function getPortWarningTargets(s, {requireActive=true,requireClosed=true}={}) {
  const proven=new Set(getRecoveryWorkforce(s,{requireActive}).filter(i=>i.kind==='branch'&&i.cellId==='F6').map(i=>i.id));
  return s.institutions.filter(i=>proven.has(i.id)&&(!requireClosed||i.open===false)).map(i=>({id:i.id,cellId:i.cellId,kind:i.kind,name:i.name,active:i.active,open:i.open,maintenance:i.maintenance,sourceEventId:i.sourceEventId,sourceActionId:i.sourceActionId}));
}
function validPortAccessSource(s,e) {
  if(e.actionId!=='open_port_warning')return !('portBranchIds' in e||e.sourceActionId?.endsWith(':open_port_warning')||e.id?.endsWith(':open_port_warning'));
  if(!usesPortAccessRules(s))return false;
  const [prefix,year,actorId,place,actionId,extra]=(e.sourceActionId||'').split(':');
  const source=s.history.find(h=>h.id===e.sourceActionId),targets=e.portBranchIds;
  if(prefix!=='action'||year!=='30'||place!=='F6'||actionId!=='open_port_warning'||extra!==undefined||!s.actors.some(a=>a.id===actorId&&a.availableFrom<=30))return false;
  if(e.kind!=='event'||e.cellId!=='F6'||e.id!==`event:${e.sourceActionId}`||e.parentId!==e.sourceActionId||e.year!==31||e.probability!==1)return false;
  if(source?.kind!=='action'||source.status!=='confirmed'||source.parentId!==null||source.year!==30||source.cellId!=='F6'||source.sourceActionId!==source.id)return false;
  if((source.actorId!==undefined&&source.actorId!==actorId)||(e.actorId!==undefined&&e.actorId!==actorId))return false;
  if(!Array.isArray(targets)||!targets.length||new Set(targets).size!==targets.length||JSON.stringify(source.portBranchIds)!==JSON.stringify(targets))return false;
  const validTargets=getPortWarningTargets(s,{requireActive:false,requireClosed:false});
  if(!targets.every(id=>validTargets.some(i=>i.id===id)))return false;
  if(e.planningRulesVersion!==PLANNING_RULES.version||!Array.isArray(e.evidence)||new Set(e.evidence).size!==e.evidence.length||!e.evidence.includes('resident_testimony')||JSON.stringify(e.evidence)!==JSON.stringify(source.evidence))return false;
  const inventory=s.investigations?.[`30:${actorId}`]||[];
  if(!e.evidence.every(id=>inventory.some(entry=>entry.evidenceId===id&&(entry.cellId==='F6'||PORTABLE_EVIDENCE.includes(id)))))return false;
  if(!s.investigations?.[`30:${actorId}`]?.some(entry=>entry.cellId==='F6'&&entry.evidenceId==='resident_testimony'))return false;
  if(source.cost?.economy!==4||source.cost?.politics!==2||Object.keys(source.cost).length!==2)return false;
  const outcome=s.history.find(h=>h.id===`resolved:${e.id}`);
  if(e.status==='pending')return e.resolvedYear===undefined&&!outcome;
  if(!['success','cancelled'].includes(e.status)||e.resolvedYear!==31||outcome?.year!==31||outcome.parentId!==e.id||outcome.sourceActionId!==source.id||outcome.cellId!=='F6'||outcome.status!==e.status||outcome.kind!==(e.status==='success'?'outcome':'cancelled')||JSON.stringify(outcome.portBranchIds)!==JSON.stringify(targets))return false;
  return e.status!=='success'||s.year!==31||targets.every(id=>s.institutions.find(i=>i.id===id)?.open===true);
}
function validRecoverySource(s, e) {
  if(e.actionId!=='complete_review')return !('recoverySourceId' in e || 'recoveryInstitutionId' in e || 'recoveryWorkforceIds' in e || e.sourceActionId?.endsWith(':complete_review') || e.id?.endsWith(':complete_review'));
  if(!usesRecoveryRules(s))return false;
  const [prefix,year,actorId,cellId,actionId,extra]=(e.sourceActionId||'').split(':');
  const source=s.history.find(h=>h.id===e.sourceActionId);
  const failed=getRecoverySource(s,e.cellId,{requireActive:false});
  if(prefix!=='action'||year!=='30'||extra!==undefined||cellId!==e.cellId||actionId!=='complete_review'||!s.actors.some(a=>a.id===actorId&&a.availableFrom<=30))return false;
  if(e.kind!=='event'||e.id!==`event:${e.sourceActionId}`||e.parentId!==e.sourceActionId||e.year!==32||e.probability!==1||!failed||e.recoverySourceId!==failed.eventId||e.recoveryInstitutionId!==failed.institutionId)return false;
  if(JSON.stringify(e.evidence)!==JSON.stringify(source?.evidence))return false;
  if(source?.kind!=='action'||source.parentId!==null||source.sourceActionId!==e.sourceActionId||source.cellId!==e.cellId||source.year!==30||source.recoverySourceId!==e.recoverySourceId||source.recoveryInstitutionId!==e.recoveryInstitutionId||!source.evidence?.includes('anomaly_records')||!e.evidence?.includes('anomaly_records'))return false;
  if(e.status==='pending')return e.recoveryWorkforceIds===undefined;
  const outcome=s.history.find(h=>h.id===`resolved:${e.id}`);
  if(e.resolvedYear!==32||outcome?.parentId!==e.id||outcome.sourceActionId!==e.sourceActionId||outcome.year!==32||outcome.cellId!==e.cellId||outcome.status!==e.status||outcome.kind!==(e.status==='success'?'outcome':'cancelled'))return false;
  if(e.status==='cancelled')return e.recoveryWorkforceIds===undefined;
  if(e.status!=='success'||!Array.isArray(e.recoveryWorkforceIds)||!e.recoveryWorkforceIds.length||new Set(e.recoveryWorkforceIds).size!==e.recoveryWorkforceIds.length)return false;
  const workforce=getRecoveryWorkforce(s,{requireActive:s.year<=32});
  return e.recoveryWorkforceIds.every(id=>workforce.some(i=>i.id===id&&i.startYear<=32))&&s.institutions.some(i=>i.kind==='independent'&&i.id===`institution:${e.id}:${e.cellId}`&&i.cellId===e.cellId&&i.startYear===32&&i.sourceEventId===e.id&&i.sourceActionId===e.sourceActionId);
}
function isRecoveryCarrier(s, i) {
  const e=s.events.find(e=>e.id===i.sourceEventId&&e.actionId==='complete_review');
  return !!e&&e.status==='success'&&i.kind==='independent'&&i.id===`institution:${e.id}:${e.cellId}`&&i.cellId===e.cellId&&i.sourceActionId===e.sourceActionId&&i.startYear===32&&validRecoverySource(s,e);
}
export function hasCompletedRecovery(s) {
  return usesRecoveryRules(s)&&s.institutions.some(i=>i.active&&i.maintenance>0&&isRecoveryCarrier(s,i));
}

// A new prospective contract, never a substitute for the failed-review contract.
// Evidence, paid materials, technicians, the outcome and the carrier must all
// point to the same real year30 action. Later shutdowns preserve historical work.
function validFutureCheckSource(s, e) {
  const actionId = FUTURE_CHECK_RULES.actionId;
  if(e.actionId!==actionId)return !('futureCheckRulesVersion' in e || 'futureCheckWorkforceIds' in e || e.sourceActionId?.endsWith(`:${actionId}`) || e.id?.endsWith(`:${actionId}`));
  if(!usesFutureCheckRules(s)||!usesTradeoffs(s))return false;
  const [prefix,year,actorId,place,kind,extra]=(e.sourceActionId||'').split(':');
  const source=s.history.find(h=>h.id===e.sourceActionId),outcome=s.history.find(h=>h.id===`resolved:${e.id}`);
  if(prefix!=='action'||year!=='30'||place!=='B4'||kind!==actionId||extra!==undefined||!s.actors.some(a=>a.id===actorId&&a.availableFrom<=30))return false;
  if(e.kind!=='event'||e.cellId!=='B4'||e.id!==`event:${e.sourceActionId}`||e.parentId!==e.sourceActionId||e.year!==34||e.probability!==1||e.futureCheckRulesVersion!==FUTURE_CHECK_RULES.version)return false;
  if(source?.kind!=='action'||source.status!=='confirmed'||source.parentId!==null||source.sourceActionId!==source.id||source.year!==30||source.cellId!=='B4'||source.futureCheckRulesVersion!==FUTURE_CHECK_RULES.version)return false;
  if((source.actorId!==undefined&&source.actorId!==actorId)||(e.actorId!==undefined&&e.actorId!==actorId))return false;
  if(source.cost?.economy!==6||source.cost?.science!==4||Object.keys(source.cost).length!==2)return false;
  if(e.planningRulesVersion!==PLANNING_RULES.version||!Array.isArray(e.evidence)||new Set(e.evidence).size!==e.evidence.length||e.evidence.length!==2||!['anomaly_records','resident_testimony'].every(id=>e.evidence.includes(id))||JSON.stringify(e.evidence)!==JSON.stringify(source.evidence))return false;
  const inventory=s.investigations?.[`30:${actorId}`]||[];
  if(!e.evidence.every(id=>inventory.some(entry=>entry.evidenceId===id&&(entry.cellId==='B4'||PORTABLE_EVIDENCE.includes(id)))))return false;
  if([source,e,...(outcome?[outcome]:[])].some(row=>(row.reality!==undefined&&row.reality!=='R1')||(row.actionId!==undefined&&row.actionId!==actionId)||(row.actorId!==undefined&&row.actorId!==actorId)))return false;
  if(s.history.filter(h=>h.kind==='action'&&h.id.startsWith(`action:30:${actorId}:`)).length!==1||s.history.some(h=>h.id===`pass:30:${actorId}`))return false;
  if(s.events.filter(row=>row.id===e.id).length!==1||s.history.filter(h=>h.id===source.id).length!==1||outcome&&s.history.filter(h=>h.id===outcome.id).length!==1)return false;
  const carriers=s.institutions.filter(i=>i.sourceEventId===e.id||i.sourceActionId===e.sourceActionId);
  if(e.status==='pending')return e.year>s.year&&e.resolvedYear===undefined&&!outcome&&e.futureCheckWorkforceIds===undefined&&!carriers.length;
  if(!['success','cancelled'].includes(e.status)||e.year>s.year||e.resolvedYear!==34||outcome?.year!==34||outcome.parentId!==e.id||outcome.sourceActionId!==source.id||outcome.cellId!=='B4'||outcome.status!==e.status||outcome.kind!==(e.status==='success'?'outcome':'cancelled')||outcome.futureCheckRulesVersion!==FUTURE_CHECK_RULES.version)return false;
  if(e.status==='cancelled')return e.futureCheckWorkforceIds===undefined&&outcome.futureCheckWorkforceIds===undefined&&!carriers.length;
  const workforce=e.futureCheckWorkforceIds;
  if(!Array.isArray(workforce)||!workforce.length||new Set(workforce).size!==workforce.length||JSON.stringify(workforce)!==JSON.stringify(outcome.futureCheckWorkforceIds))return false;
  const proven=getRecoveryWorkforce(s,{requireActive:s.year<=34});
  return workforce.every(id=>proven.some(i=>i.id===id&&i.startYear<34))&&carriers.length===1&&carriers.every(i=>i.kind==='independent'&&i.id===`institution:${e.id}:B4`&&i.cellId==='B4'&&i.startYear===34&&i.sourceEventId===e.id&&i.sourceActionId===e.sourceActionId);
}
function isFutureCheckCarrier(s, i) {
  const e=s.events.find(e=>e.id===i.sourceEventId&&e.actionId===FUTURE_CHECK_RULES.actionId);
  return !!e&&e.status==='success'&&i.kind==='independent'&&i.id===`institution:${e.id}:B4`&&i.cellId==='B4'&&i.startYear===34&&i.sourceActionId===e.sourceActionId&&validFutureCheckSource(s,e);
}
export function getFutureCheckSources(s, {requireActive=true}={}) {
  if(!usesFutureCheckRules(s))return [];
  return s.institutions.filter(i=>(!requireActive||(i.active&&i.maintenance>0))&&isFutureCheckCarrier(s,i)).map(i=>({institutionId:i.id,cellId:i.cellId,eventId:i.sourceEventId,recordId:`resolved:${i.sourceEventId}`,sourceActionId:i.sourceActionId,workforceIds:[...s.events.find(e=>e.id===i.sourceEventId).futureCheckWorkforceIds]}));
}
export function hasCompletedFutureCheck(s) { return getFutureCheckSources(s).length>0; }
export function getFutureCheckContracts(s) {
  if(!usesFutureCheckRules(s))return [];
  return s.events.filter(e=>e.actionId===FUTURE_CHECK_RULES.actionId&&validFutureCheckSource(s,e)).map(e=>({actionId:e.actionId,status:e.status,year:e.year,cellId:e.cellId,sourceActionId:e.sourceActionId,eventId:e.id,recordId:e.status==='pending'?null:`resolved:${e.id}`,institutionId:e.status==='success'?`institution:${e.id}:B4`:null,workforceIds:[...(e.futureCheckWorkforceIds||[])]}));
}
export function getFutureCheckPlan(s) {
  const enabled=usesFutureCheckRules(s)&&usesTradeoffs(s);
  const existing=enabled&&getHandoffReadiness(s).checkCells.includes('B4');
  const recovery=enabled&&getRecoverySource(s,'B4');
  return {enabled,available:enabled&&s.year===30&&!existing&&!recovery,reason:!enabled?'本局未启用从零未来校验合同。':s.year!==30?'新建未来校验只在第30年安排。':existing?'B4已有运转中的独立校验来源，无需另付从零建设成本。':recovery?'B4有可用失败底稿，可沿用成本更低、到位更早的遗留校验合同。':'B4尚无可用独立校验或失败底稿，可从零建立面向未来的新席；停运的旧载体仍原样保留。'};
}

// Upgrade-only provenance tightening: older recovery/future contracts keep
// their released workforce interpretation and saved histories unchanged.
export function getArchiveUpgradeWorkforce(s, options = {}) {
  return getRecoveryWorkforce(s, options).filter(person=>{
    const institution=s.institutions.find(i=>i.id===person.id);
    const source=institution.sourceActionId, [, ,actorId,,actionId]=source.split(':');
    const origin=s.history.find(h=>h.id===source);
    const consistent=(row,expectedAction)=>!!row&&(row.actorId===undefined||row.actorId===actorId)&&(row.actionId===undefined||row.actionId===expectedAction)&&(row.reality===undefined||row.reality==='R1');
    if(!consistent(origin,actionId)||origin.status!=='confirmed'||s.history.filter(h=>h.id===source).length!==1)return false;
    let event=s.events.find(e=>e.id===institution.sourceEventId);
    const seen=new Set();
    while(event) {
      if(seen.has(event.id)||event.sourceActionId!==source||!consistent(event,event.actionId)||s.events.filter(e=>e.id===event.id).length!==1)return false;
      seen.add(event.id);
      const outcome=s.history.find(h=>h.id===`resolved:${event.id}`);
      if(!consistent(outcome,event.actionId)||s.history.filter(h=>h.id===outcome.id).length!==1)return false;
      if(event.parentId===source)return event.id===`event:${source}`&&event.actionId===actionId;
      event=s.events.find(e=>e.id===event.parentId);
    }
    return false;
  });
}

// Preserve the original archive's complete identity. A generic independent
// carrier, a renamed building or a flag cannot stand in for this source chain.
function preservedArchiveSources(s, {requireActive=true}={}) {
  return s.institutions.flatMap(i=>{
    if(i.kind!=='independent'||i.cellId!=='B4'||(requireActive&&(!i.active||i.maintenance<=0)))return [];
    const e=s.events.find(e=>e.id===i.sourceEventId), h=s.history.find(h=>h.id===i.sourceActionId);
    const outcome=e&&s.history.find(h=>h.id===`resolved:${e.id}`);
    const [prefix,year,actorId,place,actionId,extra]=(i.sourceActionId||'').split(':');
    if(prefix!=='action'||!['0','10'].includes(year)||place!=='B4'||actionId!=='preserve_records'||extra!==undefined||!s.actors.some(a=>a.id===actorId&&a.availableFrom<=Number(year)))return [];
    if(e?.kind!=='event'||e.actionId!==actionId||e.status!=='success'||e.id!==`event:${i.sourceActionId}`||e.parentId!==i.sourceActionId||e.sourceActionId!==i.sourceActionId||e.cellId!=='B4'||e.year!==Number(year)+1||e.resolvedYear!==e.year||e.year>s.year||e.probability!==1)return [];
    if(h?.kind!=='action'||h.status!=='confirmed'||h.id!==i.sourceActionId||h.sourceActionId!==h.id||h.parentId!==null||h.year!==Number(year)||h.cellId!=='B4'||h.cost?.economy!==2||h.cost?.religion!==2||Object.keys(h.cost).length!==2)return [];
    if(outcome?.kind!=='outcome'||outcome.status!=='success'||outcome.parentId!==e.id||outcome.sourceActionId!==h.id||outcome.cellId!=='B4'||outcome.year!==e.year||i.id!==`institution:${e.id}:B4`||i.startYear!==e.year)return [];
    if([h,e,outcome].some(row=>(row.actorId!==undefined&&row.actorId!==actorId)||(row.actionId!==undefined&&row.actionId!==actionId)||(row.reality!==undefined&&row.reality!=='R1')))return [];
    if(s.institutions.filter(row=>row.sourceEventId===e.id||row.sourceActionId===h.id).length!==1||s.events.filter(row=>row.id===e.id).length!==1||s.history.filter(row=>row.id===h.id||row.id===outcome.id).length!==2)return [];
    return [{eventId:e.id,recordId:outcome.id,institutionId:i.id,sourceActionId:h.id,cellId:'B4'}];
  });
}
const archiveMetadata = e => ({archiveUpgradeRulesVersion:ARCHIVE_UPGRADE_RULES.version,archiveSourceEventId:e.archiveSourceEventId,archiveSourceRecordId:e.archiveSourceRecordId,archiveSourceInstitutionId:e.archiveSourceInstitutionId});
const archiveMarker = entry => ['archiveUpgradeRulesVersion','archiveSourceEventId','archiveSourceRecordId','archiveSourceInstitutionId','archiveUpgradeWorkforceIds','archiveUpgradeCancellationReason'].some(key=>key in entry)||entry.sourceActionId?.endsWith(`:${ARCHIVE_UPGRADE_RULES.actionId}`)||entry.id?.endsWith(`:${ARCHIVE_UPGRADE_RULES.actionId}`);
function validArchiveUpgradeSource(s,e) {
  const actionId=ARCHIVE_UPGRADE_RULES.actionId;
  if(e.actionId!==actionId)return !archiveMarker(e);
  if(!usesArchiveUpgradeRules(s)||!usesTradeoffs(s))return false;
  const [prefix,year,actorId,place,kind,extra]=(e.sourceActionId||'').split(':');
  const h=s.history.find(h=>h.id===e.sourceActionId),outcome=s.history.find(h=>h.id===`resolved:${e.id}`);
  const original=preservedArchiveSources(s,{requireActive:false}).find(source=>source.eventId===e.archiveSourceEventId&&source.recordId===e.archiveSourceRecordId&&source.institutionId===e.archiveSourceInstitutionId);
  if(prefix!=='action'||year!=='30'||place!=='B4'||kind!==actionId||extra!==undefined||!s.actors.some(a=>a.id===actorId&&a.availableFrom<=30)||!original)return false;
  if(e.kind!=='event'||e.cellId!=='B4'||e.id!==`event:${e.sourceActionId}`||e.parentId!==e.sourceActionId||e.year!==33||e.probability!==1)return false;
  if(h?.kind!=='action'||h.status!=='confirmed'||h.parentId!==null||h.sourceActionId!==h.id||h.year!==30||h.cellId!=='B4'||h.cost?.economy!==5||h.cost?.science!==3||Object.keys(h.cost).length!==2)return false;
  if(e.planningRulesVersion!==PLANNING_RULES.version||!Array.isArray(e.evidence)||e.evidence.length!==2||new Set(e.evidence).size!==2||!['anomaly_records','resident_testimony'].every(id=>e.evidence.includes(id))||JSON.stringify(e.evidence)!==JSON.stringify(h.evidence))return false;
  const inventory=s.investigations?.[`30:${actorId}`]||[];
  if(!e.evidence.every(id=>inventory.some(entry=>entry.evidenceId===id&&(entry.cellId==='B4'||PORTABLE_EVIDENCE.includes(id)))))return false;
  if([h,e,...(outcome?[outcome]:[])].some(row=>Object.entries(archiveMetadata(e)).some(([key,value])=>row[key]!==value)||(row.reality!==undefined&&row.reality!=='R1')||(row.actionId!==undefined&&row.actionId!==actionId)||(row.actorId!==undefined&&row.actorId!==actorId)))return false;
  if(s.history.filter(row=>row.kind==='action'&&row.id.startsWith(`action:30:${actorId}:`)).length!==1||s.history.some(row=>row.id===`pass:30:${actorId}`)||s.history.filter(row=>row.kind==='action'&&row.year===30&&row.cellId==='B4').length!==1)return false;
  if(s.events.filter(row=>row.actionId===actionId).length!==1||s.events.filter(row=>row.id===e.id).length!==1||s.history.filter(row=>row.id===h.id).length!==1||outcome&&s.history.filter(row=>row.id===outcome.id).length!==1)return false;
  const carriers=s.institutions.filter(i=>i.sourceEventId===e.id||i.sourceActionId===e.sourceActionId);
  if(h.archiveUpgradeWorkforceIds!==undefined||h.archiveUpgradeCancellationReason!==undefined)return false;
  if(e.status==='pending')return e.year>s.year&&e.resolvedYear===undefined&&!outcome&&e.archiveUpgradeWorkforceIds===undefined&&e.archiveUpgradeCancellationReason===undefined&&!carriers.length;
  if(!['success','cancelled'].includes(e.status)||e.year>s.year||e.resolvedYear!==33||outcome?.year!==33||outcome.parentId!==e.id||outcome.sourceActionId!==h.id||outcome.cellId!=='B4'||outcome.status!==e.status||outcome.kind!==(e.status==='success'?'outcome':'cancelled'))return false;
  if(e.status==='cancelled') {
    if(s.year===33) {
      const archiveAlive=preservedArchiveSources(s).some(source=>source.institutionId===original.institutionId);
      const workforceAlive=getArchiveUpgradeWorkforce(s).some(i=>i.startYear<33);
      const expectedReason=!archiveAlive?(workforceAlive?'archive-unavailable':'archive-and-workforce-unavailable'):!workforceAlive?'workforce-unavailable':null;
      if(e.archiveUpgradeCancellationReason!==expectedReason)return false;
    }
    return ['archive-unavailable','workforce-unavailable','archive-and-workforce-unavailable'].includes(e.archiveUpgradeCancellationReason)&&outcome.archiveUpgradeCancellationReason===e.archiveUpgradeCancellationReason&&e.archiveUpgradeWorkforceIds===undefined&&outcome.archiveUpgradeWorkforceIds===undefined&&!carriers.length;
  }
  if(e.archiveUpgradeCancellationReason!==undefined||outcome.archiveUpgradeCancellationReason!==undefined)return false;
  const workforce=e.archiveUpgradeWorkforceIds,proven=getArchiveUpgradeWorkforce(s,{requireActive:s.year<=33});
  if(!Array.isArray(workforce)||!workforce.length||new Set(workforce).size!==workforce.length||JSON.stringify(workforce)!==JSON.stringify(outcome.archiveUpgradeWorkforceIds)||!workforce.every(id=>proven.some(i=>i.id===id&&i.startYear<33)))return false;
  if(s.year<=33&&!preservedArchiveSources(s).some(source=>source.institutionId===original.institutionId))return false;
  return carriers.length===1&&carriers.every(i=>i.kind==='independent'&&i.id===`institution:${e.id}:B4`&&i.cellId==='B4'&&i.startYear===33&&i.sourceEventId===e.id&&i.sourceActionId===e.sourceActionId);
}
function isArchiveUpgradeCarrier(s,i) {
  const e=s.events.find(e=>e.id===i.sourceEventId&&e.actionId===ARCHIVE_UPGRADE_RULES.actionId);
  return !!e&&e.status==='success'&&i.kind==='independent'&&i.id===`institution:${e.id}:B4`&&i.cellId==='B4'&&i.startYear===33&&i.sourceActionId===e.sourceActionId&&validArchiveUpgradeSource(s,e);
}
export function getArchiveUpgradeContracts(s) {
  if(!usesArchiveUpgradeRules(s))return [];
  return s.events.filter(e=>e.actionId===ARCHIVE_UPGRADE_RULES.actionId&&validArchiveUpgradeSource(s,e)).map(e=>({actionId:e.actionId,status:e.status,year:e.year,cellId:e.cellId,sourceActionId:e.sourceActionId,eventId:e.id,recordId:e.status==='pending'?null:`resolved:${e.id}`,institutionId:e.status==='success'?`institution:${e.id}:B4`:null,workforceIds:[...(e.archiveUpgradeWorkforceIds||[])],archiveSourceEventId:e.archiveSourceEventId,archiveSourceRecordId:e.archiveSourceRecordId,archiveSourceInstitutionId:e.archiveSourceInstitutionId,cancellationReason:e.archiveUpgradeCancellationReason||null}));
}
export function getArchiveUpgradeSources(s,{requireActive=true}={}) {
  return getArchiveUpgradeContracts(s).filter(contract=>contract.status==='success'&&(!requireActive||s.institutions.some(i=>i.id===contract.institutionId&&i.active&&i.maintenance>0)));
}
export function hasCompletedArchiveUpgrade(s) { return getArchiveUpgradeSources(s).length>0; }
export function getArchiveUpgradePlan(s) {
  const enabled=usesArchiveUpgradeRules(s)&&usesTradeoffs(s),source=enabled?preservedArchiveSources(s)[0]||null:null;
  const recovery=enabled&&getRecoverySource(s,'B4');
  const completed=enabled&&(!!s.flags.review||hasCompletedRecovery(s)||hasCompletedFutureCheck(s)||hasCompletedArchiveUpgrade(s));
  return {enabled,available:!!(enabled&&s.year===30&&source&&!recovery&&!completed),actionId:ARCHIVE_UPGRADE_RULES.actionId,dueYear:33,cost:{...ARCHIVE_UPGRADE_RULES.cost},source,
    reason:!enabled?'本局未启用保档升级合同；原有未来校验规则不迁移。':s.year!==30?'保档升级只在第30年安排。':completed?'已有实际完成的指令校验，无需重复升级。':recovery?'B4有可用失败底稿，沿用经济4、科学3、第32年完成的遗留校验合同。':!source?'没有仍运转且来源完整的B4地方保档，不能凭档案名称升级或复活停运原档。':'地方保档保留异源方法，但还未完成指令校验。可用经济5、科学3及3轮取证另设比对席，第33年再核对原档与真实人手；原档和第23年保留。'};
}

export function getAidPlan(s) {
  const existing = s.institutions.filter(i => i.kind === 'mutual' && i.cellId === 'D5');
  const working = existing.filter(i => i.active && i.maintenance > 0);
  const mode = working.length ? 'expand' : existing.length ? 'restart' : 'first';
  const later = s.year >= 23;
  const title = ({first:'设立南岸互助仓',expand:'扩充南岸互助轮值',restart:'重启南岸互助轮值'})[mode] + (later ? ' · 后续生计' : '');
  const description = mode === 'expand' ? '现有互助仓继续运转，另组织一组居民轮值，增加物资调配人手；分配不只按缴费名单。'
    : mode === 'restart' ? '原互助轮值已经停下。为新一组居民筹措经费与物资，重新组织不只按缴费名单的分配。'
      : '筹措第一组互助仓经费与物资，由居民轮值分配，而不是只按缴费名单。';
  const outcome = !later ? '' : s.flags.crisis?.damage > 0 ? '第23年已有损失，后续扶助不能让伤害消失。'
    : s.flags.crisis?.damage === 0 ? '第23年记录中的损失已避免，后续互助仍支持日常生计。'
      : '第23年的历史不能由今天的互助补算，缺少明细时也不补造损失。';
  return { mode, later, title, description,
    risk: later ? outcome + '不增加教学人手、异源校验或地方授权。' : '不修复统一水文标准；扩充轮值不叠加同一次危机的减伤。',
    reward: later ? `第${s.year + 1}年起新增居民轮值，持续支持南岸生计；不会降低第23年已结算的损失。`
      : `第${s.year + 1}年起持续支持生计，并使南岸D5第23年剩余损失减少30%；同地互助不重复减伤。`,
    modelNote: `${mode === 'expand' ? '这是现有互助的产出扩容，不是第二层危机保护。' : mode === 'restart' ? '原址历史保留，新轮值实际兑现后才恢复支持。' : '首次设立实际互助载体，草案本身不提供服务。'}每组足额维护轮值的年度源项为政治+0.10、经济+0.60、科学+0.10、宗教+0.55，仍参与衰减与传播，不是通道净增预测。${later ? outcome + '不回写第23年损失，也不承诺尚未模拟的下一次灾害。' : '仅对南岸D5生效，保护最多一次30%，不与同地互助相乘。'}` };
}
export function getActors(s) { return s.actors.filter(a => a.alive && a.availableFrom <= s.year); }
function action(id, title, description, cost, probability = 1, dueIn = 1, requireEvidence = [], risk = '', reward = '') { return { id, title, description, cost, probability, dueIn, requireEvidence, risk, reward }; }
export function getActions(s, cellId, actorId = 'protagonist', evidence = null) {
  if (s.phase !== 'planning' || !getActors(s).some(a => a.id === actorId)) return [];
  const y = s.year, out = [];
  evidence ??= usesTradeoffs(s) ? getInvestigation(s, actorId, cellId).evidence : [];
  if (cellId === 'D4' && y === 0) out.push(
    action('build_merchant', '商会独资', '商会愿意先付运输费用，但收费港口享有优先预警。', { economy: 3 }, .85, 2, [], '收费门槛限制当地和后续分站的预警覆盖；依赖单一资助方。', '较快启用；每年持续创造测量与运输能力。'),
    action('build_state', '官署独办', '统一撤离指令覆盖河港，复核权暂留官署。', { politics: 3, economy: 4 }, .8, 3, [], '统一标准仍可能共同失效；公开覆盖与撤离协调只能减轻损失。', '公开预警，并保留较小的统一撤离保护。'),
    action('build_joint', '联合管理', '公开水文资料，由官署、商会和档案院共同维护。', { economy: 6 }, .7, 3, ['independent_flood_records', 'unfunded_maintenance'], '成本高；第10年需要续约，占用一次行动。失败仍保留小档案站。', '开放档案与培训连接；独立旧记录提供有限保护，不能替代完整复核。成功后第7年传播至东岸。'));
  if (cellId === 'B4' && [0, 10].includes(y)) out.push(action('preserve_records', '保留地方档案', '修会提供旧洪水刻度，保留不同于官署的校验方法。', { religion: 2, economy: 2 }, 1, 1, [], '放弃河港当期的另一项介入机会。', '建立独立知识源；增强将来的复核能力。'));
  if (cellId === 'D4' && y === 10) {
    if (active(s, 'station')) out.push(action('renew_charter', '续约公开章程', '补足维护基金并明确继任权。林澈留在河港照料测站。', { economy: 3 }, 1, 1, [], '消耗本轮主角名额，不能同时招募。', '防止第16年收费分化，维护教学网络。'));
    if (!s.flags.recruited && usesRecruitmentRules(s) && !getRecruitmentRoles(s).length) out.push(action('recruit_volunteer', '招募林澈 · 自愿同行', '林澈愿意加入续史局。河港没有正在运转的测站或档案岗位需要交接，入局不虚构一位继任者。', { economy: 1 }, 1, 1, [], '占用本轮介入名额；不会因此补建测站、培养学徒或取得苏岚的岗位同意。', '第11年完成入局，第20年起可部署第二名介入员；没有既有岗位，就不承诺减产或停运。'));
    else if (!s.flags.recruited) out.push(action('recruit_successor', '招募林澈 · 安排继任', '林澈同意加入续史局，先训练苏岚接班；下一窗口才能部署。', { economy: 5, science: 2 }, 1, 1, ['successor_consent'], '当地仍需补充长期经费；这不等于续约公开章程。', '第20年起获得第二名介入员；保留维护人手。'), action('recruit_risk', '招募林澈 · 暂缺继任', '林澈自愿锚定记忆，但河港没有准备好的接班人。', { economy: 1 }, 1, 1, [], '河港现有测站或档案站产出减半；第16年起停运，已经传播的知识仍保留。', '以较低成本获得第20年可部署的同伴。'));
    if (active(s, 'archive') || !active(s, 'station')) out.push(action('restore_archive', '重建地方测站', '把留下的零散记录交给新的维护小组。此次不重启最初培训链。', { economy: 5 }, 1, 2, [], '无法追回错过的十年与原分站链。', '可靠建立测站，恢复持续知识产出。'));
  }
  if (cellId === 'E4' && y === 10) out.push(action('fund_school', '资助东岸夜校', '居民自办的学校教授识字与独立读尺，承认未入站者的经验。', { economy: 4 }, 1, 1, [], '河港的继任争议无人处理。', '独立学校为未来共享纠错权提供人手。'));
  if (cellId === 'D5' && y >= 10) out.push(action('mutual_aid', '南岸互助仓', '把救援物资的分配权交给居民轮值，而不是只按缴费名单。', { economy: 3 }, 1, 1, [], '不修复统一水文标准。', '改善南岸生计，并在洪水时降低损失。'));
  if (cellId === 'D4' && y === 20) {
    const station = s.institutions.find(i => i.kind === 'station' && i.cellId === 'D4');
    const maintainedHere = s.institutions.some(i => i.cellId === 'D4' && i.active);
    out.push(
    action('free_warning', station ? (station.active ? '协商基本免费预警' : '恢复测站与免费预警') : '建立居民传讯队',
      station ? (station.active ? '苏岚愿意与维护者商量，把经费补给现有测站，让不缴费的家庭也先收到险情。' : '聘请新的维护者重开河港测站，并由居民共同制定基本免费预警的值班表。') : '这里还没有水文站。苏岚愿意与居民建立轮值钟报和传讯队，让地方观察能及时传给更多家庭。',
      { economy: 4 }, 1, 1, ['resident_testimony'], '只改善河港当地覆盖，不修正统一标准，也不会补出原培训链。',
      station ? '补足维护与接班人手，恢复或维持河港公开预警。' : '建立真实的居民传讯制度；覆盖有限，不能替代测站和独立复核。'),
    action('present_archive', '呈示旧档 · 尊重她的选择', '旧现实的苏岚是一名教师。她愿意读档，却不愿被替换成人生样本。', { politics: 2 }, 1, 1, ['old_reality_record'], '仅凭旧档不能修复危机或支付维护。', '形成当前现实的同意记录，支持有条件共享档案。'),
    action('relocate_teacher', '执行迁任方案', '按续史局指标把苏岚调往学校，短期补充标准教育岗位。', { politics: 3 }, 1, 1, [], maintainedHere ? '河港现有制度失去维护；苏岚反对被旧人生定义。' : '苏岚反对被旧人生定义；这不会替河港建成测站。', '增加教学能力，却损害地方信任。'));
  }
  if (y === 20 && (cellId === 'F6' || cellId === 'B4')) out.push(
    action('independent_review', '独立测站交叉复核', '以不同来源的洪水刻度校验统一标准，并保留异常报告。', { science: 3, economy: 4 }, 1, 1, ['anomaly_records'], '占用一次干预；此前已发生的损失不能撤销。', '在第23年冲击前消除共同失效风险。'),
    action('local_veto', '授予地方停闸权', '居民可以在异常水位时拒绝中央开闸令，先行撤离。', { politics: 4 }, 1, 1, [], '只能减轻损失，无法修正错误标准。', '第23年损失显著降低。'));
  if (cellId === 'E4' && y >= 20) out.push(action('train_network', '培育轮值维护者', '培养能够独立接班、公开记录的地方小组。', { economy: 4, science: 2 }, 1, 1, [], '人手需要时间成长，不会立即改变当年的危机。', '增加独立网络与退出独占控制的条件。'));
  if (y === 30 && getRecoverySource(s,cellId)) out.push(action('complete_review', '完成遗留校验 · 面向今后', '重新整理当年未完成的异源测量记录，把尚存的底稿与实际读尺工作接起来。', {economy:4,science:3}, 1, 2, ['anomaly_records'], '第32年仍需运转中的测量或教学人手；无人或原记录停运则取消，成本不退。不会改写第23年的损失。', '条件齐备后，新增面向未来的真实校验载体；不自动获得培训人手、授权、信任或交班方针。'));
  if (cellId==='B4'&&y===30&&getFutureCheckPlan(s).available) out.push(action(FUTURE_CHECK_RULES.actionId,'建立未来校验席','购置新刻水尺与对照抄本，结合修院居民重新指认的水痕，留出连续比对的工作席。',{economy:6,science:4},1,4,['anomaly_records','resident_testimony'],'第34年仍需真实运转的测量或教学人手；无人则取消，已付材料与场地成本不退。不补造早年的失败或改写第23年。','条件成立后新建B4未来异源校验载体；不附送培训、地方授权、信任或交班方针。'));
  if (cellId==='B4'&&y===30&&getArchiveUpgradePlan(s).available) out.push(action(ARCHIVE_UPGRADE_RULES.actionId,'把地方保档接成校验席','沿用修院保留的异源刻度，添置比对器具与工作席，并请居民重新指认水痕；旧档原页继续保留。',{economy:5,science:3},1,3,['anomaly_records','resident_testimony'],'第33年原保档与真实测量或教学人手都须仍在运转；任一缺失就取消，费用不退。不会改写原档或第23年。','成功后新增面向未来的指令校验，不赠人手、授权、信任或交班方针。'));
  if (cellId==='F6'&&y===30&&usesPortAccessRules(s)&&usesTradeoffs(s)&&getPortWarningTargets(s).length) out.push(action('open_port_warning','协商远港公开预警','听取远港居民证词，为既有分站的基本预警筹措本地经费，取消缴费名单的准入门槛。',{economy:4,politics:2},1,1,['resident_testimony'],'第31年目标分站须仍在有效运转且尚未开放，否则取消，费用不退。不会重开停运机构、补足维护或改写第23年。','第31年起只向未缴费家庭开放既有远港分站；不新增教学、异源校验、授权、河港信任或交班方针。'));
  if (cellId === 'D4' && y === 30 && actorId === 'protagonist') out.push(
    action('share_power', '共享档案与纠错权', '把历史干预的证据与否决权交给现实中的维护网络。', { politics: 3, economy: 3 }, 1, 1, [], '没有独立网络与地方信任，权利将停留在纸上。', '有准备的地区可自治并互相复核。'),
    action('central_review', '集中干预 · 强化复核', '续史局保留干预权，承诺让不同测站审查每一次指令。', { politics: 4, science: 2 }, 1, 1, [], '集中依赖仍然存在；缺少独立复核时结局脆弱。', '保留应急协调能力，承担持续维护责任。'),
    action('withdraw', '逐步退出独占控制', '不再垄断未来，把维护工作和档案移交给现存地方网络。', { economy: 2 }, 1, 1, [], '若人手不足，退出会造成服务空缺。', '已建立的学校与互助制度继续自行运作。'));
  const notes = {
    build_merchant: '正常维护时，收费测站覆盖系数为0.45；本源分站沿用收费规则。',
    build_state: '正常维护时，公开测站覆盖系数为1；统一撤离协调减少10%的剩余共同失效损失。',
    build_joint: '正常维护时，公开测站覆盖系数为1；成功建立并保留独立旧记录的载体减少15%的剩余共同失效损失。',
    recruit_volunteer: '无在岗交接的自愿招募，经济成本1、无额外取证前置。不会减产、制造停运、建立接班岗位或自动获得地方信任。',
    renew_charter: '河港测站改为公开、足额维护；不自动改写远港分站的准入规则。',
    free_warning: s.institutions.some(i => i.cellId === 'D4' && i.kind === 'station') ? '修复后的河港公开测站覆盖系数为1，补足接班人手；其他地区不自动改变。' : '居民传讯队在河港提供0.65的覆盖系数；它不是完整测站。',
    fund_school: '当地教学载体覆盖系数为0.55，不会凭空生成其他地区的制度。',
    train_network: '当地教学载体覆盖系数为0.55；多个同地载体不重复叠加覆盖。',
    mutual_aid: '互助仓使南岸D5的剩余共同失效损失减少30%；不自动覆盖其他三地。',
    independent_review: '完整交叉复核消除本次四地共同标准失效损失，不表示洪水本身没有上涨。',
    local_veto: '先行撤离与停闸规程适用于四地，把本次共同失效损失基数降至0.30，之后再按各地保护结算。',
  };
  if (usesLegacyCrisisRules(s)) {
    for (const key of Object.keys(notes)) notes[key] = '本局沿用旧版整体危机规则，不按新覆盖系数或来源保护重算已作出的承诺。';
    notes.free_warning += ' 免费预警使四地整体剩余损失乘以0.80。';
    notes.mutual_aid += ' 旧版互助使四地整体剩余损失乘以0.70。';
    notes.independent_review += ' 完整复核消除本次共同失效损失。';
    notes.local_veto += ' 四地停闸与先行撤离使损失基数降至0.30。';
  }
  if (usesTradeoffs(s)) {
    notes.share_power = notes.withdraw = '至少需要两个不同地域的自治支点，其中一处必须是学校或轮值维护网络。学校提供承接人手，并不天然代表异源方法；仍需另一个地区成功工作的异源校验支点。原建站培训链可提供复核人手，不自动等于独立自治来源；共享另需地方信任。';
    const review = out.find(a => a.id === 'independent_review');
    if (review) {
      const prep = reviewPreparation(s); review.probability = prep.probability; review.dueIn = 2;
      review.title = prep.probability === 1 ? '完整异源交叉复核' : '组织紧急交叉复核';
      review.description = '用独立旧刻度与当前测量交叉校验。既有档案和测量人手决定能否在冲击前完成。';
      review.risk = '未能及时完成时不消除第23年危机；费用不退，留下校验记录。可由另一角色在另一处安排停闸作后备。';
      review.reward = '成功则截断四地共同标准失效；预警覆盖和此前损失仍分别保留。';
      notes.independent_review = `准备快照：异源档案${prep.records ? '有' : '缺'}，活跃测量/教学人手${prep.workforce ? '有' : '缺'}。两项齐备100%，仅一项80%，全缺55%；第22年只判定一次，失败保留记录但不修正指令。新建复核机构不能充当前置准备，同窗口新办机构也不追溯提高已提交概率。`;
    }
    const veto = out.find(a => a.id === 'local_veto');
    if (veto) {
      const surveyed = evidence.includes('evacuation_routes');
      veto.reward = `确定把第23年四地共同失效损失基数降至${surveyed ? '0.20' : '0.30'}，再按当地保护结算。`;
      veto.risk = '不会消除错误标准，仍有可预见的剩余损失。可不取证直接采用基本停闸。';
      notes.local_veto = '基本停闸确定把四地损失基数降至0.30；花2轮核实撤离路线后降至0.20。与复核可由不同角色、不同地点协同，复核失败时停闸仍有效。';
    }
    const train = out.find(a => a.id === 'train_network');
    if (train) { train.reward = '增加当地维护产出；同一地域扩容只算一个自治支点，不能冒充不同地区的网络。'; notes.train_network += ' 结局按不同地域的现存载体计数。'; }
  }
  const completion = out.find(a=>a.id==='complete_review');
  if(completion) completion.conditional = true;
  const futureCheck=out.find(a=>a.id===FUTURE_CHECK_RULES.actionId);
  const archiveUpgrade=out.find(a=>a.id===ARCHIVE_UPGRADE_RULES.actionId);
  if(archiveUpgrade){archiveUpgrade.conditional=true;notes.upgrade_archive_check='地方保档只是异源方法，不等于已完成指令校验。经济5、科学3用于比对器具与新工作席；异常记录2轮加B4居民证词1轮，耗满执行者取证并占一个名额。第33年核对原档仍运转及真实测量/教学人手；第31年培训可以赶上，但培训加升级占满两名额，不能再签方针。相比失败底稿4/3/32，升级多付经济1、晚1年且多1轮本地取证；相比从零6/4/34，保档节省经济1、科学1并早1年，但此前已付保档成本与名额。以上为可调原型假设。';}
  if(futureCheck){futureCheck.conditional=true;notes.establish_future_check='经济6、科学4用于新刻水尺、对照抄本和比对工作席；异常记录2轮加B4本地居民证词1轮，耗满本角色取证，并占一个名额。第34年核对真实测量或教学人手，当前来源：'+([...new Set(getRecoveryWorkforce(s).map(i=>i.cellId))].join('、')||'无')+'。另一角色第31年培训可赶上期限，但两项占满两个名额，不能再签方针。新校验不改变第23年；同地重复不算跨地承接，共享仍需信任。经济6、科学4、3轮取证与第34年期限是本轮可调原型假设，尚未经过真人平衡验证。';}
  const port=out.find(a=>a.id==='open_port_warning');
  if(port){port.conditional=true;const targets=getPortWarningTargets(s);notes.open_port_warning=`经济4、政治2、远港本地居民证词1轮及本角色一个名额。足额维护的收费分站覆盖0.45，开放后为1；当前目标维护系数为${targets.map(i=>i.maintenance.toFixed(2)).join('、')}，实际覆盖仍乘维护系数，不承诺未来灾害减损。只改现有分站的开放规则，不改变年度产出和原机构来源；与培训、遗留校验或其他方针争夺本轮名额。第23年记录保持不变。`;}

  if(completion) notes.complete_review = `经济4、科学3及本角色一个名额；第32年核对真实人手。当前人手：${getRecoveryWorkforce(s).map(i=>i.cellId).filter((id,index,a)=>a.indexOf(id)===index).join('、')||'无'}。另一角色本轮新办培训可在第31年到位，但同一名额不能同时签署交班方针。历史失败与第23年损失保留；未来交班仍需不同地域的已获授权人手与校验，以及实际选择的方针。`;
  const aid = out.find(a => a.id === 'mutual_aid');
  if (aid && usesAftermathRules(s)) {
    const plan = getAidPlan(s); Object.assign(aid, { title: plan.title, description: plan.description, risk: plan.risk, reward: plan.reward }); notes.mutual_aid = plan.modelNote;
  } else if (aid && y >= 23) {
    // Read-only clarification for old contracts; title/description/cost and
    // resolution remain untouched so true old replay stays byte-equivalent.
    aid.risk = '第23年的损失已经结算；本合同不会改写过去，也不代替教学人手或异源校验。';
    aid.reward = `第${y + 1}年起新增互助载体，持续支持南岸生计；不降低过去的损失。`;
    notes.mutual_aid = '保留本局原合同与年度产出。其洪水减损条款只适用于危机结算前兑现的互助，晚期互助不追溯改变第23年。';
  }
  if (usesHandoffRules(s)) {
    notes.renew_charter = '维持河港公开、足额维护；把现存同源培训点纳入继任与地方复核授权，保留可追溯授权记录。不改变远港收费门槛，也不凭空增加异源校验。';
    for (const policy of out.filter(a=>['share_power','withdraw'].includes(a.id)).map(a=>a.id)) notes[policy] = handoffSummary(s, policy) + '交班需不同地域的已获授权人手与真实异源校验；原学徒可提供人手，同源人数不等于独立方法。学校提供技术人手，强制迁任本身不证明合作。共享另需河港信任。最终按第40年实际存续条件结算。';
  }
  const merchant = out.find(a => a.id === 'build_merchant');
  if (merchant) {
    const futureAccess = getFutureBranchAccess(s, merchant.id);
    if (futureAccess.open) {
      merchant.risk = 'D4商会测站设缴费门槛，依赖单一资助方；符合原教学链条件后生成的F6分站公开。';
      if (!usesLegacyCrisisRules(s)) notes.build_merchant = '正常维护时，D4收费测站覆盖系数为0.45；本局之后生成的公开F6分站覆盖系数为1。';
    }
    // Prospective display only: title/description and committed text stay put.
    notes.build_merchant += ' ' + futureAccess.description;
  }
  return out.filter(a => !getActorRefusals(s, actorId, cellId).some(r => r.actionId === a.id)).map(a => {
    const staffingNote = RECRUITMENT_ACTIONS.includes(a.id) ? recruitmentStaffingNote(s, a.id) : null;
    return { ...a, ...(notes[a.id] ? { modelNote: notes[a.id] } : {}), ...(staffingNote ? { staffingNote,
      ...(a.id === 'recruit_risk' && getStaffingRulesVersion(s) === STAFFING_RULES.stationOnly
        ? { risk: '本局原版缺岗规则只作用于测站；档案站不因此减产或在第16年停运。真实离岗与未安排继任的记录仍保留。' } : {}) } : {}) };
  });
}
function assertPlanning(s, actorId) { require(s.phase === 'planning', '当前不在介入窗口'); require(getActors(s).some(a => a.id === actorId), '该棋子本轮不可部署'); }
export function lockTask(s, actorId, cellId, actionId, evidence = []) {
  assertPlanning(s, actorId);
  const refusal = getActorRefusals(s, actorId, cellId).find(r => r.actionId === actionId);
  require(!refusal, refusal?.reason);
  if (usesTradeoffs(s)) evidence = getInvestigation(s, actorId, cellId).evidence;
  const a = getActions(s, cellId, actorId, evidence).find(a => a.id === actionId);
  require(a, '该行动当前不可用'); require(a.requireEvidence.every(e => evidence.includes(e)), '尚缺必要证据');
  s.drafts[actorId] = { actorId, cellId, actionId, evidence: [...new Set(evidence)], status: 'locked', window: s.year }; return s;
}
export function passTask(s, actorId) { assertPlanning(s, actorId); s.drafts[actorId] = { actorId, status: 'passed', window: s.year }; return s; }
export function unlockTask(s, actorId) { assertPlanning(s, actorId); delete s.drafts[actorId]; return s; }
// Read only actual locked snapshots. There is deliberately no assumed-evidence
// or skip-validation option: hypothetical contracts never enter this collector.
export function getLockedPlanningFacts(s, actorIds = getActors(s).map(a => a.id)) {
  const tasks = [], assignedActorIds = [], issues = [], warnings = [];
  for (const actor of getActors(s).filter(a => actorIds.includes(a.id))) {
    const d = s.drafts[actor.id];
    if (!d || d.actorId !== actor.id || d.window !== s.year || !['locked', 'passed'].includes(d.status)) continue;
    assignedActorIds.push(actor.id);
    if (d.status === 'passed') continue;
    if (!Array.isArray(d.evidence) || !s.cells.some(c => c.id === d.cellId)) { issues.push(`${actor.name}的草案条件已经失效，请修改安排。`); continue; }
    const a = getActions(s, d.cellId, actor.id, d.evidence).find(a => a.id === d.actionId);
    if (usesTradeoffs(s) && !d.evidence.every(id => getInvestigation(s, actor.id, d.cellId).evidence.includes(id))) { issues.push(`${actor.name}的草案取证记录缺失，请修改安排。`); continue; }
    const refusal = getActorRefusals(s, actor.id, d.cellId).find(r => r.actionId === d.actionId);
    if (refusal) { issues.push(refusal.reason); continue; }
    if (!a || !a.requireEvidence.every(e => d.evidence.includes(e))) { issues.push(`${actor.name}的草案条件已经失效，请修改安排。`); continue; }
    if (usesTradeoffs(s) && a.id === 'local_veto' && !d.evidence.includes('evacuation_routes') && getInvestigation(s, actor.id, d.cellId).evidence.includes('evacuation_routes')) warnings.push(`${actor.name}新调查的撤离路线尚未纳入已锁定草案：当前仍为基本停闸0.30。请修改并重新锁定，才会采用强化停闸0.20。调查不需要重复支付。`);
    tasks.push({d: {actorId:actor.id, cellId:d.cellId, actionId:d.actionId, evidence:[...d.evidence], status:d.status, window:d.window}, a});
  }
  return {tasks, assignedActorIds, issues, warnings};
}

// Shared public planning constraints, not a submission API. Contract facts have
// no locked/passed status, evidence grants or preparation side effects.
// Deliberately narrower than validateState: only public facts needed to plan.
// Private seed, rolls, prose, baseline, snapshots and future result fields are
// outside this contract. Full save integrity remains mandatory at real commit.
export function getPublicPlanningStateIssues(s) {
  const issues = [], object = v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  if (![s.cells,s.actors,s.events,s.history,s.institutions,s.committedWindows].every(Array.isArray) || !object(s.drafts) || !object(s.flags)) return ['公开规划资料缺失，暂不能给出整轮数值。'];
  const unique = rows=>rows.every(row=>object(row)&&typeof row.id==='string')&&new Set(rows.map(row=>row.id)).size===rows.length;
  if (![s.cells,s.actors,s.events,s.history,s.institutions].every(unique)) issues.push('公开规划资料有重复或缺失的身份，暂不能给出整轮数值。');
  const cells = new Set(s.cells.map(c=>c.id));
  if (s.cells.length!==64 || FLOOD_REGIONS.some(id=>!cells.has(id)) || s.cells.some(c=>!object(c.channels)||CHANNELS.some(k=>!Number.isFinite(c.channels[k])||c.channels[k]<0||c.channels[k]>100))) issues.push('地域能力资料缺失或非法，暂不能给出整轮数值。');
  if (s.actors.some(a=>typeof a.alive!=='boolean'||!Number.isInteger(a.availableFrom)||a.availableFrom<0||a.availableFrom>40||typeof a.name!=='string')) issues.push('棋子可用资料非法，暂不能给出整轮数值。');
  if (s.institutions.some(i=>!Object.hasOwn(sources,i.kind)||!cells.has(i.cellId)||typeof i.active!=='boolean'||typeof i.open!=='boolean'||!Number.isFinite(i.maintenance)||i.maintenance<0||i.maintenance>1)) issues.push('地方服务资料非法，暂不能给出整轮数值。');
  const publicId = value=>typeof value==='string'&&value.length>0;
  const chronology = (value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
  if (s.events.some(e=>!['pending','success','failed','cancelled'].includes(e.status)||!Number.isFinite(e.probability)||e.probability<0||e.probability>1||!chronology(e.year,1,40)||!cells.has(e.cellId)||!publicId(e.actionId)||(e.status==='pending'?e.year<=s.year:e.year>s.year))) issues.push('既有合同的公开状态、概率或到期年非法，暂不能给出整轮数值。');
  if (s.history.some(h=>!chronology(h.year,0,s.year)||!cells.has(h.cellId))) issues.push('历史记录的公开年代或坐标非法，暂不能给出整轮数值。');
  if ([...s.events,...s.history].some(h=>['parentId','sourceActionId'].some(key=>h[key]!=null&&!publicId(h[key]))||['kind','status'].some(key=>h[key]!==undefined&&typeof h[key]!=='string'))) issues.push('公开历史来源字段非法，暂不能给出整轮数值。');
  if (s.institutions.some(i=>!publicId(i.sourceActionId)||!publicId(i.sourceEventId)||!chronology(i.startYear,0,s.year))) issues.push('地方服务的公开来源或启用年非法，暂不能给出整轮数值。');
  const expectedWindows=WINDOWS.filter(year=>year<s.year||(year===s.year&&s.phase==='playback'));
  if(new Set(s.committedWindows).size!==s.committedWindows.length||expectedWindows.length!==s.committedWindows.length||expectedWindows.some(year=>!s.committedWindows.includes(year))) issues.push('已提交窗口与当前年代不一致，暂不能给出整轮数值。');
  if (['review','veto','aid','freeWarning','successor','recruited'].some(key=>Object.hasOwn(s.flags,key)&&typeof s.flags[key]!=='boolean')) issues.push('公开保护标记非法，暂不能给出整轮数值。');
  if (s.staffingRulesVersion!==undefined&&!validStaffingVersion(s.staffingRulesVersion)) issues.push('人手结算规则版本非法。');
  if (s.recruitmentRulesVersion!==undefined&&!usesRecruitmentRules(s)) issues.push('招募岗位规则版本非法。');
  if (s.aftermathRulesVersion!==undefined&&!usesAftermathRules(s)) issues.push('角色与后续互助规则版本非法。');
  if (s.flags.vetoMitigation!==undefined&&![.2,.3].includes(s.flags.vetoMitigation)) issues.push('停闸保护资料非法。');
  for(const [actorId,draft] of Object.entries(s.drafts)) {
    if(!object(draft)||draft.actorId!==actorId||!s.actors.some(a=>a.id===actorId&&a.alive&&a.availableFrom<=s.year)||draft.window!==s.year||!['passed','locked'].includes(draft.status)||draft.status==='locked'&&(!cells.has(draft.cellId)||typeof draft.actionId!=='string'||!Array.isArray(draft.evidence)||draft.evidence.some(id=>!Object.hasOwn(EVIDENCE,id))||new Set(draft.evidence).size!==draft.evidence.length)) issues.push('已存草案结构非法，暂不能给出整轮数值。');
  }
  if(usesTradeoffs(s)) {
    if(!object(s.investigations)) issues.push('取证记录缺失，暂不能给出整轮数值。');
    else for(const [key,entries] of Object.entries(s.investigations)) {
      const [year,actorId,extra]=key.split(':');
      if(extra!==undefined||!WINDOWS.some(y=>String(y)===year)||Number(year)>s.year||!s.actors.some(a=>a.id===actorId&&a.availableFrom<=Number(year))||!Array.isArray(entries)) {issues.push('取证会话非法，暂不能给出整轮数值。');continue;}
      if(entries.some(e=>!object(e)||!cells.has(e.cellId)||!Object.hasOwn(EVIDENCE,e.evidenceId))||new Set(entries.map(e=>`${PORTABLE_EVIDENCE.includes(e.evidenceId)?'portable':e.cellId}:${e.evidenceId}`)).size!==entries.length||entries.reduce((n,e)=>n+evidenceCost(s,e.evidenceId),0)>PLANNING_RULES.investigationBudget) issues.push('取证预算或材料非法，暂不能给出整轮数值。');
    }
  }
  return [...new Set(issues)];
}

export function getPublicPlanningChecks(s, contracts, assignedActorIds) {
  const actors = getActors(s), costs = {}, issues = getPublicPlanningStateIssues(s), occupied = new Map();
  if (s.phase !== 'planning' || !WINDOWS.includes(s.year) || s.committedWindows.includes(s.year)) issues.push('本轮已提交或不在介入窗口');
  for (const actor of actors) if (!assignedActorIds.includes(actor.id)) issues.push(`${actor.name}尚未安排。请先为全部棋子锁定任务或明确放弃。`);
  for (const contract of contracts) {
    const actor = actors.find(a => a.id === contract.actorId), location = cell(s, contract.cellId);
    if (!actor || !location) { issues.push('该棋子或地域本轮不可部署。'); continue; }
    if (occupied.has(contract.cellId)) issues.push(`${contract.cellId}同格任务冲突：${occupied.get(contract.cellId)}与${actor.name}不能使用未定义的联合行动。`);
    occupied.set(contract.cellId, actor.name);
    costs[contract.cellId] ||= {};
    for (const [k,v] of Object.entries(contract.cost)) costs[contract.cellId][k] = (costs[contract.cellId][k] || 0) + v;
  }
  const names = { politics:'政治', economy:'经济', science:'科学', religion:'宗教' };
  for (const [id,spend] of Object.entries(costs)) for (const [k,v] of Object.entries(spend)) {
    const balance = cell(s,id).channels[k];
    if (!Number.isFinite(balance) || !Number.isFinite(v) || v < 0) issues.push(`${id}的${names[k] || k}能力或成本未知，暂不能给出整轮数值。`);
    else if (balance < v) issues.push(`${id}的${names[k]}能力不足：现有${balance.toFixed(1)}，需支付${v}。整轮未提交。`);
  }
  return {ready:issues.length===0, issues, costs, assigned:actors.filter(a=>assignedActorIds.includes(a.id)).length, total:actors.length};
}

export function getWindowReview(s) {
  const actors = getActors(s), warnings = [];
  if (usesAftermathRules(s) || s.staffingRulesVersion !== undefined || s.branchAccessRulesVersion !== undefined || s.futureCheckRulesVersion !== undefined || s.archiveUpgradeRulesVersion !== undefined || s.events.some(archiveMarker) || s.history.some(archiveMarker)) {
    const integrity = validateState(s);
    if (!integrity.valid) return { ready: false, issues: integrity.errors, warnings, costs:{}, tasks:[], assigned: 0, total: actors.length };
  }
  if (s.phase !== 'planning' || !WINDOWS.includes(s.year) || s.committedWindows.includes(s.year)) {
    return { ready: false, issues: ['本轮已提交或不在介入窗口'], warnings, costs:{}, tasks:[], assigned: 0, total: actors.length };
  }
  const facts = getLockedPlanningFacts(s), tasks = facts.tasks;
  const checks = getPublicPlanningChecks(s, tasks.map(({d,a})=>({actorId:d.actorId,cellId:d.cellId,cost:a.cost})), facts.assignedActorIds);
  const {costs, assigned} = checks, issues = [...facts.issues, ...checks.issues];
  warnings.push(...facts.warnings);
  if(tasks.some(t=>t.a.id==='complete_review')) {
    const staff=getRecoveryWorkforce(s);
    warnings.push(staff.length ? '后续校验第32年核对实际人手与原记录；成功只增加未来校验能力。交班方针仍按第40年的授权、人手、跨地关系与信任核对。' : tasks.some(t=>t.a.id==='train_network') ? '本轮培训可在第31年提供人手，后续校验第32年再核对。两项各占一个名额，不能同时用这些名额签署交班方针；第23年的损失不变。' : '当前没有测量或教学人手，本轮也未锁定培训。第32年若仍无人到位，后续校验会取消且成本不退；可修改另一角色的安排。');
  }
  if(tasks.some(t=>t.a.id===FUTURE_CHECK_RULES.actionId))warnings.push(getRecoveryWorkforce(s).length?'新建未来校验席第34年仍核对真实测量或教学人手；成本经济6、科学4不退。校验不提供授权、信任或方针，第23年记录保留。':tasks.some(t=>t.a.id==='train_network')?'本轮培训第31年到位可支持第34年未来校验；两项占满两个名额，不能同时签署方针。材料成本不退，第23年不变。':'当前没有测量或教学人手，本轮也未锁定培训。第34年若仍无人到位，新建校验取消，经济6、科学4不退。');
  const reviewCount = tasks.filter(t => t.a.id === 'independent_review').length;
  if(tasks.some(t=>t.a.id===ARCHIVE_UPGRADE_RULES.actionId))warnings.push(getArchiveUpgradeWorkforce(s).length?'保档升级第33年仍核对原档与真实测量/教学人手；经济5、科学3不退。原档只是异源方法，成功升级才提供未来指令校验，第23年不变。':tasks.some(t=>t.a.id==='train_network')?'第31年培训可支持第33年保档升级，届时原档也须仍运转；两项占满两个名额，不能同时签方针。经济5、科学3不退。':'当前没有测量或教学人手，也未锁定培训。第33年原档或人手任一不到位，升级取消，经济5、科学3不退。');
  const vetoCount = tasks.filter(t => t.a.id === 'local_veto').length;
  if (reviewCount > 1) warnings.push(usesTradeoffs(s) && tasks.some(t => t.a.id === 'independent_review' && t.a.probability < 1) ? '双地紧急复核分别判定，任一成功即可纠正共同指令。成功后的危机保护不叠加，但两地机构仍各自产出，自治还需真实维护人手。' : '重复交叉复核：四地共同失效保护只生效一次。两个所在地的独立站仍各自产出知识，但不会获得两次危机减伤。');
  if (vetoCount > 1) warnings.push(usesTradeoffs(s) ? '双份停闸不叠加、不相乘，采用已兑现方案中较强的一份：已核实撤离路线为0.20，基本停闸为0.30。第二项仍消耗名额和成本；两份相同方案不再增加保护。' : '重复地方停闸权：同一四地规则不叠加。第二项仍消耗名额和成本，不会增加本次危机保护。');
  if (reviewCount && vetoCount) warnings.push(tasks.some(t => t.a.id === 'independent_review' && t.a.probability < 1) ? '复核与停闸形成后备：复核成功时消除共同失效，失败时停闸仍确定减伤。两项各消耗一个名额和对应成本。' : '复核与停闸同时安排：确定的完整复核将阻止本次共同失效。停闸仍会付费并记录承诺，但不再额外降低第23年损失。');
  if (assigned === actors.length && !tasks.length) warnings.push('所有棋子都明确放弃本窗口。不会支付介入成本；现存制度、维护缺口和危机仍会自然演化十年。');
  return { ready: issues.length === 0, issues, warnings, costs, tasks, assigned, total: actors.length };
}
export function commitWindow(s) {
  const review = getWindowReview(s);
  require(review.ready, review.issues.join(' '));
  const actors = getActors(s), tasks = review.tasks;
  // Every validation precedes writes. No event RNG is consumed during planning or submission.
  for (const { d, a } of tasks) {
    const sourceActionId = `action:${s.year}:${d.actorId}:${d.cellId}:${a.id}`;
    const port = a.id==='open_port_warning'?{portBranchIds:getPortWarningTargets(s).map(i=>i.id)}:{};
    const futureCheck = a.id===FUTURE_CHECK_RULES.actionId?{futureCheckRulesVersion:FUTURE_CHECK_RULES.version}:{};
    const archiveSource=a.id===ARCHIVE_UPGRADE_RULES.actionId?getArchiveUpgradePlan(s).source:null;
    const archiveUpgrade=archiveSource?archiveMetadata({archiveSourceEventId:archiveSource.eventId,archiveSourceRecordId:archiveSource.recordId,archiveSourceInstitutionId:archiveSource.institutionId}):{};
    const recovery = a.id === 'complete_review' ? {recoverySourceId:getRecoverySource(s,d.cellId).eventId,recoveryInstitutionId:getRecoverySource(s,d.cellId).institutionId} : {};
    const recruitment = usesRecruitmentRules(s) && RECRUITMENT_ACTIONS.includes(a.id) ? { departureRoleIds: getRecruitmentRoles(s).map(i => i.id) } : {};
    for (const [k, v] of Object.entries(a.cost)) cell(s, d.cellId).channels[k] = clamp(cell(s, d.cellId).channels[k] - v);
    record(s, { id: sourceActionId, title: a.title, text: a.id===ARCHIVE_UPGRADE_RULES.actionId?`${a.description} 经济5、科学3的器具与工作席成本已支付；第33年原档与真实人手都须仍运转，否则取消不退费。原档与第23年历史不变。`:a.id===FUTURE_CHECK_RULES.actionId?`${a.description} 经济6、科学4的材料与场地成本已支付；第34年核对真实测量或教学人手，无人则取消，费用不退。第23年历史不变。`:a.id==='open_port_warning'?`${a.description} 确定成本已支付；第31年核对原分站仍在有效运转且尚未开放，否则取消，费用不退。`:a.id==='complete_review' ? `${a.description} 确定成本已支付；第32年核对原记录与实际测量/教学人手，条件不符则取消，费用不退。` : `${a.description} 确定成本已支付；${a.probability === 1 ? '确定' : `${Math.round(a.probability * 100)}%概率`}在第${s.year + a.dueIn}年兑现。`, cellId: d.cellId, kind: 'action', sourceActionId, evidence: copy(d.evidence), cost: copy(a.cost), ...recruitment, ...recovery, ...futureCheck, ...archiveUpgrade, ...port });
    schedule(s, { id: `event:${sourceActionId}`, year: s.year + a.dueIn, cellId: d.cellId, title: a.title, text: a.description, actionId: a.id, parentId: sourceActionId, sourceActionId, probability: a.probability, ...recruitment, ...recovery, ...futureCheck, ...archiveUpgrade, ...port, ...(usesTradeoffs(s) ? { planningRulesVersion: PLANNING_RULES.version, evidence: copy(d.evidence), ...(a.id === 'independent_review' ? { preparation: reviewPreparation(s) } : {}) } : {}) });
    if (a.id.startsWith('build_')) s.promises.push({ id: `promise:${sourceActionId}`, sourceActionId, text: '第10年处理维护人与长期经费', dueYear: 10, status: 'pending' });
  }
  for (const actor of actors) if (s.drafts[actor.id].status === 'passed') record(s, { id: `pass:${s.year}:${actor.id}`, kind: 'pass', title: `${actor.name}保留沉默`, text: '本轮名额明确放弃。历史仍会继续。' });
  s.committedWindows.push(s.year); s.drafts = {}; s.phase = 'playback'; return s;
}
function resolve(s, e) {
  if(e.actionId===ARCHIVE_UPGRADE_RULES.actionId){
    const original=preservedArchiveSources(s).some(source=>source.eventId===e.archiveSourceEventId&&source.recordId===e.archiveSourceRecordId&&source.institutionId===e.archiveSourceInstitutionId);
    const workforce=getArchiveUpgradeWorkforce(s).filter(i=>i.startYear<33);
    if(!original||!workforce.length){
      e.status='cancelled';e.resolvedYear=s.year;e.archiveUpgradeCancellationReason=!original?(workforce.length?'archive-unavailable':'archive-and-workforce-unavailable'):'workforce-unavailable';
      const reason={'archive-unavailable':'原保档已不再运转','workforce-unavailable':'没有实际测量或教学人手','archive-and-workforce-unavailable':'原保档已不再运转，也没有实际测量或教学人手'}[e.archiveUpgradeCancellationReason];
      e.text=`第33年${reason}，旧刻度与比对器具没有组成持续校验席。升级合同取消，经济5、科学3的成本不退；原档与第23年记录不变。`;
      record(s,{id:`resolved:${e.id}`,title:'地方保档未能接成校验席',text:e.text,cellId:'B4',parentId:e.id,sourceActionId:e.sourceActionId,kind:'cancelled',status:'cancelled',...archiveMetadata(e),archiveUpgradeCancellationReason:e.archiveUpgradeCancellationReason});return;
    }
    e.archiveUpgradeWorkforceIds=workforce.map(i=>i.id);
  }
  if(e.actionId==='open_port_warning') {
    const eligible=getPortWarningTargets(s),valid=e.portBranchIds?.every(id=>eligible.some(i=>i.id===id));
    if(!valid){e.status='cancelled';e.resolvedYear=s.year;e.text='原远港分站已不满足运转且尚未开放的协商条件，公开预警合同取消，成本不退。没有重开或替换机构，第23年记录保留。';record(s,{id:`resolved:${e.id}`,title:'远港公开预警未落实',text:e.text,cellId:e.cellId,parentId:e.id,sourceActionId:e.sourceActionId,kind:'cancelled',status:'cancelled',portBranchIds:copy(e.portBranchIds)});return;}
  }

  if(e.actionId==='complete_review') {
    const source=getRecoverySource(s,e.cellId), workforce=getRecoveryWorkforce(s);
    if(!source||source.eventId!==e.recoverySourceId||source.institutionId!==e.recoveryInstitutionId||!workforce.length) {
      e.status='cancelled';e.resolvedYear=s.year;e.text=!source?'遗留记录已经停运，后续校验未能完成。已付成本保留，第23年历史没有被改写。':'第32年没有实际测量或教学人手，后续校验未能完成。已付成本不退，原失败记录与第23年损失保留。';
      record(s,{id:`resolved:${e.id}`,title:'后续校验未完成',text:e.text,cellId:e.cellId,parentId:e.id,sourceActionId:e.sourceActionId,kind:'cancelled',status:'cancelled'});return;
    }
    e.recoveryWorkforceIds=workforce.map(i=>i.id);
  }

  if(e.actionId===FUTURE_CHECK_RULES.actionId) {
    const workforce=getRecoveryWorkforce(s).filter(i=>i.startYear<34);
    if(!workforce.length){e.status='cancelled';e.resolvedYear=s.year;e.text='第34年没有实际测量或教学人手，新刻水尺与抄本没有组成持续校验席。合同取消，经济6、科学4的材料与场地成本不退；第23年记录不变。';record(s,{id:`resolved:${e.id}`,title:'未来校验席未能开席',text:e.text,cellId:e.cellId,parentId:e.id,sourceActionId:e.sourceActionId,kind:'cancelled',status:'cancelled',futureCheckRulesVersion:FUTURE_CHECK_RULES.version});return;}
    e.futureCheckWorkforceIds=workforce.map(i=>i.id);
  }

  if (e.requiresInstitution && !s.institutions.some(i => i.id === e.requiresInstitution && i.active)) {
    e.status = 'cancelled'; e.resolvedYear = s.year; e.text = '必要的来源机构已经停运。后续建设取消；已付成本与既有影响仍然保留。';
    record(s, { ...e, id: `resolved:${e.id}`, parentId: e.id, kind: 'cancelled' }); return;
  }
  e.roll = randomFor(s.seed, e.id); e.status = e.roll < e.probability ? 'success' : 'failed'; e.resolvedYear = s.year;
  let text = '', title = e.title; const a = e.actionId;
  if (a?.startsWith('build_')) {
    s.flags.governance = a.slice(6);
    if (e.status === 'failed') { institution(s, 'archive', e.cellId, e, '小型档案站'); text = '协议未能完成。小型档案站保留记录，每年仍产生少量知识；成本不退还，原培训链不启动。'; title = '建站未成，记录留下'; }
    else {
      const station = institution(s, 'station', 'D4', e, '河港水文站'); station.open = a !== 'build_merchant';
      if (a === 'build_merchant') { station.annualSource.economy = .8; station.annualSource.science = 1.2; }
      if (a === 'build_state') station.annualSource.politics = .5;
      s.flags.stationBuilt = true;
      text = '水文站启用。洪水有了可读的刻度，预警也有了谁先收到的问题。';
      schedule(s, { id: `${e.id}:training`, year: 7, cellId: 'E4', title: '学徒跨过东岸', actionId: 'training', parentId: e.id, sourceActionId: e.sourceActionId, requiresInstitution: station.id });
    }
  } else if (a === 'training') {
    const school = institution(s, 'training', 'E4', e, '东岸学徒培训点'); institution(s, 'training', 'D5', e, '南岸读尺班');
    text = '学徒带着河港的记录抵达东岸与南岸。当地船工也贡献了自己的经验。';
    schedule(s, { id: `${e.id}:branch`, year: 12, cellId: 'F6', title: '远港分站亮灯', actionId: 'branch', parentId: e.id, sourceActionId: e.sourceActionId, requiresInstitution: school.id });
  } else if (a === 'branch') { const branch = institution(s, 'branch', 'F6', e, '远港水文分站'); branch.open = getFutureBranchAccess(s, e.sourceActionId).open ?? !e.sourceActionId?.endsWith(':build_merchant'); text = '东岸学徒与远港船工共同建起分站。它来自河港，却不只是河港的功劳。'; }
  else if (a === 'renew_charter') {
    const stations = s.institutions.filter(i => i.cellId === 'D4' && i.kind === 'station');
    const origins = new Set(stations.filter(i => i.active).map(i => i.sourceActionId));
    for (const i of stations) { i.open = true; i.maintenance = 1; }
    s.flags.renewed = true; s.flags.successor = true; s.promises.forEach(p => p.status = 'fulfilled');
    text = '公开章程获得长期维护基金，林澈留下带教，地方复核权写入继任条款。';
    if (usesHandoffRules(s)) {
      e.authorizedTrainingSources = [...origins];
      const trainees = s.institutions.filter(i => i.kind === 'training' && i.active && origins.has(i.sourceActionId));
      for (const i of trainees) i.handoffAuthorization = { eventId: e.id, year: s.year, sourceActionId: i.sourceActionId };
      text += trainees.length ? ` ${[...new Set(trainees.map(i => i.cellId))].join('、')}现存学徒共同签署地方接班与复核授权；这不改变远港分站的收费规则，也不等于已经完成异源校验。` : ' 没有现存学徒被凭空补入授权名单。';
    }
  }
  else if (a === 'recruit_volunteer') { s.flags.recruited = true; s.actors.push({ id: 'linche', name: '林澈', availableFrom: 20, anchored: true, alive: true }); text = '林澈自愿入局。河港没有正在运转的测站或档案岗位需要交接，没有人因这份合同被指定接班，也没有不存在的产出被减半。第20年起林澈可部署；家人与身份仍受当前现实影响。'; }
  else if (a?.startsWith('recruit_')) { s.flags.recruited = true; s.flags.successor = a === 'recruit_successor'; s.actors.push({ id: 'linche', name: '林澈', availableFrom: 20, anchored: true, alive: true }); text = s.flags.successor ? '林澈自愿锚定，苏岚同意接班。第20年起林澈可部署；家人与身份仍受当前现实影响。' : '林澈自愿锚定。河港暂缺维护者：产出减半，第16年将停运。第20年起林澈可部署。'; }
  else if (a === 'restore_archive') { institution(s, 'station', 'D4', e, '重建水文站'); s.flags.successor = true; text = '新的维护小组重建测站。错过的旧培训链不会凭空补回。'; }
  else if (a === 'preserve_records') { institution(s, 'independent', 'B4', e, '修会校验档案'); s.flags.independentArchive = true; text = '不同来源的洪水刻度被保留，没有被统一标准覆盖。'; }
  else if (a === 'fund_school' || a === 'train_network') { institution(s, 'school', e.cellId, e, a === 'fund_school' ? '东岸夜校' : '轮值维护网络'); s.flags.networks = (s.flags.networks || 0) + 1; text = '新的维护者学会公开记录与独立校验。承接历史的人手来自多年积累。'; }
  else if (a === 'mutual_aid') {
    const name = usesAftermathRules(s) && e.title.startsWith('扩充') ? '南岸互助增设轮值' : usesAftermathRules(s) && e.title.startsWith('重启') ? '南岸互助重启轮值' : '南岸互助仓';
    institution(s, 'mutual', 'D5', e, name); s.flags.aid = true;
    text = '轮值居民把物资分给未缴费的家庭。预警之外，避难还需要粮食。';
    if (usesAftermathRules(s)) text = e.year > 23
      ? '新的互助轮值开始支持南岸的日常生计。它从现在增加持续产出，不降低第23年已经记录的损失，也不能代替教学人手或异源校验。'
      : '互助轮值开始分配物资并支持日常生计。它在第23年只为南岸D5减轻一次剩余损失；增设同地轮值不重复叠加保护。';
  }
  else if (a === 'free_warning') {
    s.flags.freeWarning = true; s.flags.trust = true;
    const stations = s.institutions.filter(i => i.cellId === 'D4' && i.kind === 'station');
    if (stations.length) {
      s.flags.successor = true;
      for (const i of stations) { i.open = true; i.active = true; i.maintenance = 1; }
      text = '河港测站的维护经费与接班人手得到补足，基本预警向不缴费者开放。这份协议只覆盖河港，不会自动修正远方的标准。';
    } else {
      institution(s, 'warning', 'D4', e, '河港居民传讯队');
      text = '居民轮值敲钟、整理地方观察并传递险情。河港有了有限的公开传讯能力，但没有凭空建成测站或补回旧培训链。';
    }
  }
  else if (a === 'present_archive') { s.flags.respected = true; s.flags.trust = true; text = '“那是你认识的我，不是我欠你的人生。”苏岚留下自己的证词，拒绝被旧现实替换。'; }
  else if (a === 'relocate_teacher') { const hadMaintenance = s.institutions.some(i => i.cellId === 'D4' && i.active); s.flags.forced = true; s.flags.trust = false; for (const i of s.institutions.filter(i => i.cellId === 'D4')) i.active = false; institution(s, 'school', 'E4', e, '迁任标准学校'); text = hadMaintenance ? '迁任完成，学校多了教师，河港现有制度失去维护。苏岚拒绝把这称为被拯救。' : '迁任完成，学校多了教师，河港仍没有测站。苏岚反对自己的意愿被一份旧履历替代。'; }
  else if (a === 'independent_review') { institution(s, 'independent', e.cellId, e, e.status === 'success' ? '独立交叉复核站' : '待核实的校验记录'); if (e.status === 'success') { s.flags.review = true; text = '交叉校验在冲击前确认了共同标准的偏差。第23年的水位冲击仍会到来，但错误不再同步传播。'; } else { text = '临时校验未能在冲击前形成可靠结论。已付费用不退，留下的记录仍可继续整理；本次共同指令没有被修正，另行安排的停闸仍可减伤。'; } }
  else if(a==='open_port_warning'){for(const i of s.institutions.filter(i=>e.portBranchIds.includes(i.id)))i.open=true;text='远港分站取消基本预警的缴费门槛，原测量者与记录仍在。此后覆盖仍依靠原来的维护水平；这项协商没有新增教学、校验或河港同意，第23年损失没有重算。';}
  else if (a === 'complete_review') { institution(s,'independent',e.cellId,e,'后续异源校验组'); text='遗留记录与实际测量人手完成后续校验，今后的共同指令有了新的核查来源。原来的复核失败仍记在原页，第23年的损失没有撤回；这项工作不代替承接人手、地方授权或交班方针。'; }
  else if (a === FUTURE_CHECK_RULES.actionId) { institution(s,'independent','B4',e,'修院未来校验席'); text='新刻水尺、对照抄本与真实测量人手完成连续比对，修院开出面向未来的独立校验席。这不是补写一次早年的失败，第23年损失保持原样；人手、地方授权、信任和交班方针仍各自核对。'; }
  else if (a === ARCHIVE_UPGRADE_RULES.actionId) { institution(s,'independent','B4',e,'修院保档比对席'); text='修院旧刻度与新器具经过实际测量人手连续比对，地方保档接成面向未来的指令校验席。原档留在原页，不把保档当作早已完成的复核，也不改写第23年损失；人手、授权、信任与方针仍分别核对。'; }
  else if (a === 'local_veto') { s.flags.veto = true; if (e.planningRulesVersion === PLANNING_RULES.version) s.flags.vetoMitigation = Math.min(s.flags.vetoMitigation ?? .3, e.evidence?.includes('evacuation_routes') ? PLANNING_RULES.surveyedVeto : .3); text = '地方停闸与先行撤离权生效。统一标准仍错，但居民不必盲从。'; }
  else if (['share_power', 'central_review', 'withdraw'].includes(a)) { s.flags.policy = a; text = '终局方针已经签署。它能否兑现，取决于此前积累的人手、信任与复核网络，而非这一句宣言。'; }
  record(s, { id: `resolved:${e.id}`, year: s.year, title, text: text || e.text, cellId: e.cellId, parentId: e.id, sourceActionId: e.sourceActionId, kind: e.status === 'failed' ? 'failure' : 'outcome', status: e.status, ...(a===FUTURE_CHECK_RULES.actionId?{futureCheckRulesVersion:FUTURE_CHECK_RULES.version,futureCheckWorkforceIds:copy(e.futureCheckWorkforceIds)}:{}), ...(a===ARCHIVE_UPGRADE_RULES.actionId?{...archiveMetadata(e),archiveUpgradeWorkforceIds:copy(e.archiveUpgradeWorkforceIds)}:{}), ...(a==='open_port_warning'?{portBranchIds:copy(e.portBranchIds)}:{}) });
}
function milestone(s) {
  if (s.year === 10) record(s, { id: 'succession-window', title: '谁来守住下一次洪水', text: usesRecruitmentRules(s) && !getRecruitmentRoles(s).length ? '林澈愿意入局，但河港没有运转中的测站或档案岗位需要交接。招募仍占一次介入；重建、保档与夜校是另外的选择，不会随她入局自动完成。' : '林澈愿意入局，但带走维护者也会改变河港。招募、继任与续约争夺同一名额。', kind: 'choice' });
  if (s.year === 14) {
    s.flags.crisis = { warningYear: 14, irreversibleYear: 23, status: 'warning', dependency: '统一水文标准', affectedCells: [...FLOOD_REGIONS] };
    record(s, { id: 'crisis-warning', title: '过于一致的水位', text: '四地报告出现同一偏差。第20年可以建立独立复核或地方停闸权；第23年才可能发生不可逆损失。改名与降温不会重置时钟。', kind: 'warning', parentId: s.events.find(e => e.actionId === 'branch')?.id || null });
  }
  if (s.year === 16) {
    const station = active(s, 'station');
    const originalStaffing = getStaffingRulesVersion(s) === STAFFING_RULES.stationOnly;
    if (originalStaffing ? station && s.flags.recruited && !s.flags.successor : hasRecruitmentVacancy(s)) {
      if (originalStaffing) {
        station.active = false;
        record(s, { id: 'station-unattended', title: '无人接班的测站', text: '林澈离开后无人维护，河港测站停运。东岸与远港已经学会的知识没有消失。', parentId: station.sourceEventId, kind: 'maintenance' });
      } else for (const institution of s.institutions.filter(i => i.cellId === 'D4' && ['station', 'archive'].includes(i.kind) && i.active)) {
        institution.active = false;
        const label = institution.kind === 'archive' ? '档案站' : '测站';
        record(s, { id: `${institution.kind}-unattended`, title: `无人接班的${label}`, text: `林澈离开后无人维护，河港${label}停运。已经保存或传播的知识没有消失。`, parentId: institution.sourceEventId, kind: 'maintenance' });
      }
    }
    else if (station && !s.flags.renewed) { station.open = false; station.maintenance = .7; record(s, { id: 'charter-lapsed', title: '免费刻度，收费门槛', text: '没有长期经费，继任者开始收费填补欠薪。测站仍运转，但并非所有人都收到预警。', parentId: station.sourceEventId, kind: 'maintenance' }); }
    if (!s.flags.renewed) s.promises.forEach(p => { if (p.status === 'pending') p.status = 'unfulfilled'; });
  }
  if (s.year === 20) {
    const station = s.institutions.find(i => i.kind === 'station' && i.cellId === 'D4');
    const present = station?.active ? 'R1中的河港测站仍在运转。' : station ? 'R1中的河港测站已经停运。' : 'R1中的河港没有建成水文站。';
    record(s, { id: 'old-reality-conflict', title: '她不是档案中的教师', text: `R0旧档中的苏岚在免费学校教书。${present}她要求先听取自己现在的意愿。旧档是证据，不是她欠你的命运。`, kind: 'reality' });
  }
  if (s.year === 23) {
    const mitigation = s.flags.review ? 0 : s.flags.veto ? (usesTradeoffs(s) ? s.flags.vetoMitigation ?? .3 : .3) : 1;
    if (usesLegacyCrisisRules(s)) {
      // Older saves lack carrier-based warning data. Honor their already-paid
      // commitments with the exact original formula instead of inventing detail.
      const damage = mitigation * (s.flags.aid ? .7 : 1) * (s.flags.freeWarning ? .8 : 1);
      s.flags.crisis.status = damage === 0 ? 'averted' : damage < .5 ? 'contained' : 'disaster'; s.flags.crisis.damage = damage;
      for (const id of s.flags.crisis.affectedCells) { const c = cell(s, id); c.channels.economy = clamp(c.channels.economy - 14 * damage); c.channels.politics = clamp(c.channels.politics - 7 * damage); }
      record(s, { id: 'crisis-impact', parentId: 'crisis-warning', title: damage === 0 ? '错误被拦在指令之前' : damage < .5 ? '停闸之后的清点' : '共同标准，共同失效', text: damage === 0 ? '独立记录揭穿偏差，预警及时改写。水位上涨，没有同步开错闸。' : '洪水留下不可逆的地方损失。已经失去的生活不能用通道回升抵消；人类并未灭绝。', kind: 'crisis' });
      return;
    }
    const {damage, damageByCell, coverageByCell, protectionByCell} = getCrisisLosses(s, mitigation, s.flags.crisis.affectedCells);
    for (const id of s.flags.crisis.affectedCells) {
      const loss = damageByCell[id], c = cell(s, id);
      c.channels.economy = clamp(c.channels.economy - 14 * loss); c.channels.politics = clamp(c.channels.politics - 7 * loss);
    }
    s.flags.crisis.status = damage === 0 ? 'averted' : damage < .5 ? 'contained' : 'disaster'; s.flags.crisis.damage = damage;
    Object.assign(s.flags.crisis, { model: COVERAGE_RULES.version, coverageByCell, protectionByCell, damageByCell });
    const impact = damage === 0 ? '独立记录揭穿偏差，预警及时改写。水位上涨，没有同步开错闸。' : '洪水留下不可逆的地方损失。已经失去的生活不能用通道回升抵消；人类并未灭绝。';
    const detail = s.flags.crisis.affectedCells.map(id => `${id}：覆盖系数${coverageByCell[id].toFixed(2)}，损失系数${damageByCell[id].toFixed(2)}`).join('；');
    record(s, { id: 'crisis-impact', parentId: 'crisis-warning', title: damage === 0 ? '错误被拦在指令之前' : damage < .5 ? '停闸之后的清点' : '共同标准，共同失效', text: `${impact} ${detail}。覆盖与损失系数是可调的原型假设，不是人口或伤亡统计。`, kind: 'crisis' });
  }
}
export function advanceYear(s, options = {}) {
  const check = validateState(s);
  require(check.valid, '存档结构损坏，年度结算未开始：' + check.errors.join('、'));
  require(s.phase === 'playback' && s.year < 40, '请先提交本轮；窗口中不能直接推进年份');
  s.year++;
  const due = s.events.filter(e => e.status === 'pending' && e.year === s.year).sort((a, b) => a.id.localeCompare(b.id));
  for (const e of due) resolve(s, e);
  // Maintenance decisions take effect before this year's production snapshot.
  milestone(s);
  const snapshot = Object.fromEntries(s.cells.map(c => [c.id, copy(c.channels)]));
  const ordered = options.reverse ? [...s.cells].reverse() : s.cells;
  const next = {};
  for (const c of ordered) {
    next[c.id] = {};
    const neighbors = s.cells.filter(n => Math.abs(n.row - c.row) + Math.abs(n.col - c.col) === 1).sort((a, b) => a.id.localeCompare(b.id));
    for (const k of CHANNELS) {
      const localDelta = snapshot[c.id][k] - s.baseline[c.id][k];
      const adjacent = neighbors.reduce((sum, n) => sum + (snapshot[n.id][k] - s.baseline[n.id][k]), 0) / neighbors.length;
      let source = 0;
      for (const i of [...s.institutions].sort((a, b) => a.id.localeCompare(b.id))) if (i.active && i.cellId === c.id) {
        const staffing = staffingFor(s, i);
        source += i.annualSource[k] * i.maintenance * staffing;
      }
      // Remote teaching only runs through an existing, active carrier; no arbitrary global science bonus.
      let remote = 0;
      if (c.id === 'F6' && active(s, 'branch') && s.institutions.some(i => i.cellId === 'E4' && i.active)) remote = .025 * (snapshot.E4[k] - s.baseline.E4[k]);
      const cross = k === 'economy' && s.institutions.some(i => i.cellId === c.id && ['station', 'branch'].includes(i.kind) && i.active) ? .015 * Math.max(0, snapshot[c.id].science - s.baseline[c.id].science) : 0;
      next[c.id][k] = clamp(s.baseline[c.id][k] + localDelta * .94 + adjacent * .035 + remote + source + cross);
    }
  }
  for (const c of s.cells) c.channels = next[c.id];
  s.snapshots[s.year] = copy(s.cells);
  if (WINDOWS.includes(s.year)) { s.phase = 'planning'; s.drafts = {}; }
  if (s.year === 40) { s.phase = 'ended'; const ending = getEnding(s); record(s, { id: 'ending', title: ending.title, text: ending.text, kind: 'ending', parentId: s.events.find(e => e.actionId === s.flags.policy)?.id || null }); }
  return s;
}
export function advanceToNextWindow(s) { require(s.phase === 'playback', '请先提交本轮任务'); do { advanceYear(s); } while (s.phase === 'playback'); return s; }
export function getEnding(s) {
  const handoff = usesHandoffRules(s) ? getHandoffReadiness(s) : null;
  const networkCells = new Set(s.institutions.filter(i => i.active && i.maintenance > 0 && i.kind === 'school').map(i => i.cellId));
  const autonomousCells = new Set([...networkCells, ...s.institutions.filter(i => i.active && i.maintenance > 0 && i.kind === 'independent' && s.events.some(e => e.id === i.sourceEventId && e.status === 'success')).map(i => i.cellId)]);
  const networks = handoff ? handoff.staffCells.length : usesTradeoffs(s) ? networkCells.size : s.flags.networks || 0;
  const autonomy = handoff ? new Set([...handoff.authorizedCells, ...handoff.checkCells]).size : usesTradeoffs(s) ? autonomousCells.size : networks + (s.flags.independentArchive ? 1 : 0) + (s.flags.review ? 1 : 0);
  const trust = s.flags.trust ?? !!s.flags.renewed;
  const legacy = usesLegacyCrisisRules(s);
  const coverage = getWarningCoverage(s), warningCoverage = coefficient(FLOOD_REGIONS.reduce((sum, id) => sum + coverage[id].coverage, 0) / FLOOD_REGIONS.length);
  const metrics = { institutions: s.institutions.filter(i => i.active).length, networks, autonomy, trust, crisis: s.flags.crisis?.status || '尚未发生', warningCoverage: legacy ? '旧版未记录' : warningCoverage, crisisDamage: s.flags.crisis?.damage ?? '尚未结算', anchoredSurvivors: s.actors.filter(a => a.alive && a.anchored).length, years: s.year };
  if (handoff) Object.assign(metrics, { delegatedStaff: handoff.authorizedCells.length, independentChecks: handoff.checkCells.length, handoffStatus: handoff.canWithdraw ? '条件齐备' : '尚有缺口' });
  let title = '未签署的下一页', text = '没有新的方针替地方补上责任。现存机构继续运作，也继续承担缺口。';
  if (s.flags.policy === 'share_power') { const ready = handoff ? handoff.canShare : autonomy >= 2 && (!usesTradeoffs(s) || networks >= 1) && trust; title = ready ? '许多人签署的历史' : '纸上的共同作者'; text = ready ? '独立记录、维护者与居民同意让共享纠错权有了现实支撑。没有人拥有全部未来，也没有人独自承担它。' : '档案已开放，但独立人手或地方信任仍不足。新的权利需要在现实中继续建立，宣言没有替你完成它。'; }
  if (s.flags.policy === 'central_review') { title = (s.flags.review || hasCompletedRecovery(s) || hasCompletedFutureCheck(s) || hasCompletedArchiveUpgrade(s)) ? '仍亮着灯的续史局' : '更安静的警报室'; text = s.flags.review ? '集中协调保留下来，独立复核可以否决错误指令。安全依赖持续维护，而非永远正确的计算。' : (hasCompletedRecovery(s)||hasCompletedFutureCheck(s)||hasCompletedArchiveUpgrade(s)) ? '集中协调保留下来。后来完成的校验开始审查未来指令；它没有赶上第23年的冲击，也不能把那次损失从记录中移除。' : '续史局仍能协调救援，却尚未打破共同标准的依赖。短期秩序没有消除下一次共同失效。'; }
  if (s.flags.policy === 'withdraw') { const ready = handoff ? handoff.canWithdraw : autonomy >= 2 && (!usesTradeoffs(s) || networks >= 1); title = ready ? '没有唯一守夜人' : '交班后的空椅子'; text = ready ? '地方网络接住了退出后的责任。你留下的不是控制，而是人们可以自己纠错的能力。' : '独占控制结束了，但接班能力没有同步长成。仍在运作的机构需要面对服务空缺。'; }
  if (s.flags.crisis?.status === 'disaster') text += ' 第23年的地方灾难无法撤销，它的名字留在结局里。';
  const unserved = FLOOD_REGIONS.filter(id => coverage[id].coverage === 0);
  const restricted = FLOOD_REGIONS.filter(id => coverage[id].providers.some(i => ['station', 'branch'].includes(i.kind) && !i.open));
  if (!legacy && unserved.length) text += ` ${unserved.join('、')}仍没有运转中的预警载体。`;
  if (!legacy && restricted.length) text += ` ${restricted.join('、')}仍有收费门槛，预警没有向所有家庭开放。`;
  if (!legacy && !unserved.length && !restricted.length) text += ' 四地都有公开的预警载体，但培训点与传讯队的覆盖能力仍不同于完整测站。';
  text += ' 历史内外仍有幸存者；这不是物种灭绝。';
  const paragraphs = [legacy ? '本局沿用旧版整体危机规则。已兑现的免费预警与互助承诺继续按原来的减损系数结算，不用新覆盖模型替换。' : `当前预警覆盖系数：${FLOOD_REGIONS.map(id => `${id} ${coverage[id].coverage.toFixed(2)}`).join(' · ')}。系数来自现存制度的开放、维护与人手，不是人口统计。`];
  if (s.flags.crisis?.damageByCell) paragraphs.push(`第23年已记录的损失系数：${FLOOD_REGIONS.map(id => `${id} ${s.flags.crisis.damageByCell[id].toFixed(2)}`).join(' · ')}。这份记录不会随后来的复苏或新制度改写。`);
  else if (s.year >= 23) paragraphs.push('这份旧版存档只记录了整体危机结果，没有逐地覆盖与损失明细；不根据今天的制度补造过去的数值。');
  if (handoff) {
    paragraphs.push(handoffSummary(s, s.flags.policy === 'share_power' ? 'share_power' : 'withdraw'));
    paragraphs.push('人手、异源校验与地方授权分别核对，不按机构总数给结局加分。原培训点是真实人手；续约授予的继任与复核权不会因母站后来停运被自动抹掉，但培训点自身停运就不能承接。失败复核与强制迁任本身不能证明独立纠错或居民同意。');
  } else if (usesTradeoffs(s)) paragraphs.push(`自治支点按不同地域的现存学校与已成功工作的异源校验载体计数：${[...autonomousCells].join('、') || '暂无'}。共享和退出还需至少一处学校或轮值维护网络来承接人手；原建站培训链可提供复核人手，但不自动等于独立自治来源。同地重复培训和保档加复核不重复计数；失败的临时复核不计为已具备的纠错能力。`);
  if (usesAftermathRules(s)) {
    const aid = s.institutions.filter(i => i.kind === 'mutual' && i.active && i.maintenance > 0);
    if (aid.length) paragraphs.push(`南岸当前有${aid.length}组运转中的互助轮值，其中${aid.filter(i => i.startYear > 23).length}组在第23年之后才开始。它们支持当前生计；后续产出不抵销历史损失，增设轮值不叠加已经结算的洪水保护，也不冒充教学或异源校验。`);
  }
  if(hasCompletedRecovery(s)) paragraphs.push('第32年完成的后续校验只提供今后的纠错能力。它没有把当年的失败改写成成功，也没有改动第23年的损失；承接仍分别需要实际人手、地方授权和方针。');
  if(hasCompletedFutureCheck(s)) paragraphs.push('第34年新建的未来校验席有独立取证、实物投入与真实测量人手的来源；它不冒称早年已有校验或失败，也不冲销第23年损失。它只是一处校验，不附送授权、信任或交班方针。');
  if(hasCompletedArchiveUpgrade(s)) paragraphs.push('第33年地方保档经新的本地取证、器具投入与真实测量人手接成未来指令校验席。保档本身不是已完成校验；原档原页和第23年损失仍在。新席不附送地方授权、信任或交班方针。');
  paragraphs.push('预警覆盖、制度保护与损失权重属于本轮可调的原型假设，尚未经过真人平衡验证。');
  return { title, text, paragraphs, metrics, ...(handoff ? { handoff } : {}), policy: s.flags.policy || null, provisional: s.year < 40 };
}
export function traceEvent(s, eventId) {
  const all = new Map([...s.history, ...s.events].map(e => [e.id, e])); const chain = [], seen = new Set();
  let current = all.get(eventId); while (current && !seen.has(current.id)) { chain.unshift(copy(current)); seen.add(current.id); current = all.get(current.parentId); } return chain;
}
export function validateState(s) {
  try { return inspectState(s); } catch { return { valid: false, errors: ['存档结构损坏'] }; }
}
function inspectState(s) {
  const errors = [];
  if(s?.archiveUpgradeRulesVersion!==undefined&&s.archiveUpgradeRulesVersion!==ARCHIVE_UPGRADE_RULES.version)errors.push('保档升级规则版本非法');
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const bounded = (value, min = 0, max = 100) => Number.isFinite(value) && value >= min && value <= max;
  const id = value => typeof value === 'string' && value.length > 0;
  if (!object(s) || s.version !== 'afterwave.run.v1') return { valid: false, errors: ['不兼容的存档版本'] };
  if (s.staffingRulesVersion !== undefined && !validStaffingVersion(s.staffingRulesVersion)) return { valid: false, errors: ['人手结算规则版本非法'] };
  if (s.branchAccessRulesVersion !== undefined && !isBranchAccessRulesVersion(s.branchAccessRulesVersion)) return { valid: false, errors: ['分站准入规则版本非法'] };
  if (s.futureCheckRulesVersion !== undefined && s.futureCheckRulesVersion !== FUTURE_CHECK_RULES.version) errors.push('未来校验规则版本非法');
  if (s.portAccessRulesVersion !== undefined && s.portAccessRulesVersion !== PORT_ACCESS_RULES.version) errors.push('远港准入规则版本非法');
  if (s.recoveryRulesVersion !== undefined && s.recoveryRulesVersion !== RECOVERY_RULES.version) errors.push('后续校验规则版本非法');
  if (s.recruitmentRulesVersion !== undefined && s.recruitmentRulesVersion !== RECRUITMENT_RULES.version) errors.push('招募岗位规则版本非法');
  if (s.aftermathRulesVersion !== undefined && s.aftermathRulesVersion !== AFTERMATH_RULES.version) errors.push('角色与后续互助规则版本非法');
  if (s.handoffRulesVersion !== undefined && s.handoffRulesVersion !== HANDOFF_RULES.version) errors.push('交班规则版本非法');
  if (s.planningRulesVersion !== undefined && s.planningRulesVersion !== PLANNING_RULES.version) errors.push('行动规则版本非法');
  if (usesTradeoffs(s) && !object(s.investigations)) return { valid: false, errors: [...errors, '取证记录缺失'] };
  if (s.crisisRulesVersion !== undefined && !['legacy-v1', COVERAGE_RULES.version].includes(s.crisisRulesVersion)) errors.push('危机规则版本非法');
  if (!Array.isArray(s.cells) || s.cells.length !== 64) return { valid: false, errors: ['棋盘必须有64格'] };
  const ids = new Set();
  for (const c of s.cells) {
    if (!object(c)) { errors.push('地域结构非法'); continue; }
    if (!integer(c.col, 0, 7) || !integer(c.row, 0, 7) || ids.has(c.id) || c.id !== `${String.fromCharCode(65 + c.col)}${c.row + 1}`) errors.push('坐标重复或非法');
    ids.add(c.id);
    if (typeof c.name !== 'string' || !['grass', 'water', 'paved'].includes(c.terrain) || (c.prop !== null && typeof c.prop !== 'string')) errors.push('地域显示数据非法');
    if (!object(c.channels) || CHANNELS.some(k => !bounded(c.channels[k]))) errors.push(`${c.id}通道非法`);
  }
  if (typeof s.seed !== 'string' || !integer(s.year, 0, 40)) errors.push('种子或年份非法');
  if (!['planning', 'playback', 'ended'].includes(s.phase) || (s.phase === 'planning' && !WINDOWS.includes(s.year)) || (s.phase === 'ended' && s.year !== 40) || (s.phase === 'playback' && s.year === 40)) errors.push('阶段非法');
  if (![s.events, s.history, s.institutions, s.actors, s.committedWindows, s.promises].every(Array.isArray) || ![s.flags, s.drafts, s.baseline, s.snapshots].every(object)) return { valid: false, errors: [...errors, '存档字段缺失或结构非法'] };
  for (const collection of [s.events, s.history, s.institutions, s.actors]) {
    if (collection.some(item => !object(item) || !id(item.id))) return { valid: false, errors: [...errors, '记录结构或稳定ID非法'] };
    if (new Set(collection.map(item => item.id)).size !== collection.length) errors.push('稳定ID重复');
  }
  if (new Set(s.committedWindows).size !== s.committedWindows.length || s.committedWindows.some(year => !WINDOWS.includes(year))) errors.push('窗口重复提交或非法');
  const expectedWindows = WINDOWS.filter(year => year < s.year || (year === s.year && s.phase === 'playback'));
  if (expectedWindows.length !== s.committedWindows.length || expectedWindows.some(year => !s.committedWindows.includes(year))) errors.push('已提交窗口与当前年代不一致');
  for (const e of s.events) {
    if(!validArchiveUpgradeSource(s,e))errors.push('保档升级合同的原档、取证、成本、人手或兑现来源不一致');
    if(!validFutureCheckSource(s,e))errors.push('未来校验合同的取证、成本、人手或兑现来源不一致');
    if(!validPortAccessSource(s,e))errors.push('远港公开预警合同的目标、证词或兑现来源不一致');
    if (!validRecoverySource(s,e)) errors.push('后续校验合同的失败来源、人手或兑现记录不一致');
    if (e.actionId === 'recruit_volunteer' && !usesRecruitmentRules(s)) errors.push('无在岗交接的招募需要对应规则版本');
    if (usesRecruitmentRules(s) && !validRecruitmentSource(s, e)) errors.push('招募事件的行动来源或离岗岗位快照不一致');
    if (usesAftermathRules(s) && !validRelocationSource(s, e)) errors.push('迁任事件的执行者、行动ID或历史来源不一致；林澈拒绝执行的迁任不能成为事件合同');
    if (usesAftermathRules(s) && RECRUITMENT_ACTIONS.includes(e.actionId) && e.status === 'success' && (!integer(e.resolvedYear, 1, s.year) || e.resolvedYear !== e.year)) errors.push('成功招募缺少一致的兑现年代');
    if (e.authorizedTrainingSources !== undefined && (e.actionId !== 'renew_charter' || e.status !== 'success' || !Array.isArray(e.authorizedTrainingSources) || e.authorizedTrainingSources.some(source => !id(source) || !s.institutions.some(i => i.kind === 'station' && i.sourceActionId === source)))) errors.push('继任授权来源非法');
    if (e.planningRulesVersion !== undefined && (e.planningRulesVersion !== PLANNING_RULES.version || !Array.isArray(e.evidence) || e.evidence.some(id => !Object.hasOwn(EVIDENCE, id)))) errors.push('事件行动合同非法');
    if (!['pending', 'success', 'failed', 'cancelled'].includes(e.status) || !bounded(e.probability, 0, 1) || !integer(e.year, 1, 40) || !ids.has(e.cellId) || !id(e.actionId) || (e.status === 'pending' && e.year <= s.year) || (e.status !== 'pending' && e.year > s.year)) errors.push('事件状态非法');
  }
  for (const entry of [...s.events, ...s.history]) {
    if (['title', 'text', 'description', 'reason', 'kind', 'status'].some(key => entry[key] !== undefined && typeof entry[key] !== 'string') || ['parentId', 'sourceActionId'].some(key => entry[key] != null && !id(entry[key]))) errors.push('历史记录字段非法');
  }
  for(const entry of s.history)if(archiveMarker(entry)&&!s.events.some(e=>e.actionId===ARCHIVE_UPGRADE_RULES.actionId&&e.sourceActionId===entry.sourceActionId&&[e.sourceActionId,`resolved:${e.id}`].includes(entry.id)&&validArchiveUpgradeSource(s,e)))errors.push('保档升级历史缺少对应的有效合同');
  for(const entry of s.history)if(('futureCheckRulesVersion' in entry||'futureCheckWorkforceIds' in entry||entry.sourceActionId?.endsWith(`:${FUTURE_CHECK_RULES.actionId}`)||entry.id?.endsWith(`:${FUTURE_CHECK_RULES.actionId}`))&&!s.events.some(e=>e.actionId===FUTURE_CHECK_RULES.actionId&&e.sourceActionId===entry.sourceActionId&&validFutureCheckSource(s,e)))errors.push('未来校验历史缺少对应的有效合同');
  for(const entry of s.history)if(('portBranchIds' in entry||entry.sourceActionId?.endsWith(':open_port_warning')||entry.id?.endsWith(':open_port_warning'))&&!s.events.some(e=>e.actionId==='open_port_warning'&&e.sourceActionId===entry.sourceActionId&&validPortAccessSource(s,e)))errors.push('远港公开预警历史缺少对应的有效合同');
  for (const entry of s.history) if (!integer(entry.year, 0, s.year) || !ids.has(entry.cellId)) errors.push('历史记录年代或坐标非法');
  for (const i of s.institutions) {
    if(['archiveUpgradeRulesVersion','archiveSourceEventId','archiveSourceRecordId','archiveSourceInstitutionId','archiveUpgradeWorkforceIds','archiveUpgradeCancellationReason'].some(key=>key in i))errors.push('保档升级元数据只能属于合同或兑现记录');
    if((archiveMarker(i)||s.events.some(e=>e.id===i.sourceEventId&&e.actionId===ARCHIVE_UPGRADE_RULES.actionId))&&!isArchiveUpgradeCarrier(s,i))errors.push('保档升级载体与真实兑现来源不一致');
    if((i.sourceActionId?.endsWith(`:${FUTURE_CHECK_RULES.actionId}`)||s.events.some(e=>e.id===i.sourceEventId&&e.actionId===FUTURE_CHECK_RULES.actionId))&&!isFutureCheckCarrier(s,i))errors.push('未来校验载体与真实兑现来源不一致');
    if(usesRecoveryRules(s)&&(i.sourceActionId?.endsWith(':complete_review')||s.events.some(e=>e.id===i.sourceEventId&&e.actionId==='complete_review'))&&!isRecoveryCarrier(s,i)) errors.push('后续校验载体与真实兑现来源不一致');
    if (i.handoffAuthorization !== undefined) { const grant = i.handoffAuthorization; if (i.kind !== 'training' || !object(grant) || !id(grant.eventId) || grant.sourceActionId !== i.sourceActionId || !integer(grant.year, i.startYear, s.year) || !s.events.some(e => e.id === grant.eventId && e.actionId === 'renew_charter' && e.status === 'success' && e.resolvedYear === grant.year && e.authorizedTrainingSources?.includes(grant.sourceActionId))) errors.push('继任授权记录非法'); }
    if (!Object.hasOwn(sources, i.kind) || !ids.has(i.cellId) || !id(i.sourceActionId) || !id(i.sourceEventId) || typeof i.name !== 'string' || typeof i.active !== 'boolean' || typeof i.open !== 'boolean' || !bounded(i.maintenance, 0, 1) || !integer(i.startYear, 0, s.year) || !object(i.annualSource) || CHANNELS.some(k => !bounded(i.annualSource[k], 0, Number.MAX_VALUE))) errors.push('制度结构或年度产出非法');
  }
  for (const c of s.cells) if (!object(s.baseline[c.id]) || CHANNELS.some(k => !bounded(s.baseline[c.id][k]))) errors.push('基线缺失或非法');
  if (!s.actors.some(a => a.id === 'protagonist' && a.alive && a.availableFrom === 0)) errors.push('缺少可用主角');
  for (const a of s.actors) if (!integer(a.availableFrom, 0, 40) || typeof a.alive !== 'boolean' || typeof a.anchored !== 'boolean' || typeof a.name !== 'string') errors.push('棋子结构或可用窗口非法');
  if (usesTradeoffs(s)) for (const [key, entries] of Object.entries(s.investigations)) {
    const [year, actorId, extra] = key.split(':');
    if (extra !== undefined || !WINDOWS.some(y => String(y) === year) || Number(year) > s.year || !s.actors.some(a => a.id === actorId && a.availableFrom <= Number(year)) || !Array.isArray(entries)) { errors.push('取证会话非法'); continue; }
    if (entries.some(e => !object(e) || !ids.has(e.cellId) || !Object.hasOwn(EVIDENCE, e.evidenceId)) || new Set(entries.map(e => `${PORTABLE_EVIDENCE.includes(e.evidenceId) ? 'portable' : e.cellId}:${e.evidenceId}`)).size !== entries.length || entries.reduce((sum, e) => sum + evidenceCost(s, e.evidenceId), 0) > PLANNING_RULES.investigationBudget) errors.push('取证预算或材料非法');
  }
  if (s.flags.vetoMitigation !== undefined && ![.2, .3].includes(s.flags.vetoMitigation)) errors.push('停闸保护非法');
  for (const [actorId, draft] of Object.entries(s.drafts)) {
    if (!object(draft) || draft.actorId !== actorId || !s.actors.some(a => a.id === actorId && a.alive && a.availableFrom <= s.year) || draft.window !== s.year || s.phase !== 'planning' || !['passed', 'locked'].includes(draft.status)) { errors.push('任务草稿非法'); continue; }
    if(draft.status==='locked'&&draft.actionId===ARCHIVE_UPGRADE_RULES.actionId&&!getActions(s,draft.cellId,actorId,draft.evidence).some(a=>a.id===ARCHIVE_UPGRADE_RULES.actionId))errors.push('保档升级草稿缺少对应规则或真实可用原档');
    if(draft.status==='locked'&&draft.actionId===FUTURE_CHECK_RULES.actionId&&!getActions(s,draft.cellId,actorId,draft.evidence).some(a=>a.id===FUTURE_CHECK_RULES.actionId))errors.push('未来校验草稿缺少对应规则或地点');
    if (draft.status==='locked' && draft.actionId==='complete_review' && !getActions(s,draft.cellId,actorId,draft.evidence).some(a=>a.id==='complete_review')) errors.push('后续校验草稿缺少真实可用的失败记录');
    if (usesRecruitmentRules(s) && draft.status === 'locked' && RECRUITMENT_ACTIONS.includes(draft.actionId) && !getActions(s, draft.cellId, actorId, draft.evidence).some(a => a.id === draft.actionId)) errors.push('招募草稿与实际可交接岗位不一致');
    if (draft.status === 'locked') { const refusal = getActorRefusals(s, actorId, draft.cellId).find(r => r.actionId === draft.actionId); if (refusal) errors.push('林澈拒绝执行的迁任不能成为锁定任务。' + refusal.reason); }
    if (draft.status === 'locked' && (!ids.has(draft.cellId) || !id(draft.actionId) || !Array.isArray(draft.evidence) || draft.evidence.some(e => !Object.hasOwn(EVIDENCE, e)))) errors.push('任务草稿证据或目标非法');
  }
  for (const promise of s.promises) if (!object(promise) || !id(promise.id) || !integer(promise.dueYear, 0, 40) || !['pending', 'fulfilled', 'unfulfilled'].includes(promise.status)) errors.push('承诺记录非法');
  for (const key of ['stationBuilt', 'renewed', 'successor', 'recruited', 'independentArchive', 'aid', 'freeWarning', 'trust', 'respected', 'forced', 'review', 'veto']) if (Object.hasOwn(s.flags, key) && typeof s.flags[key] !== 'boolean') errors.push('世界标记非法');
  if (Object.hasOwn(s.flags, 'networks') && !integer(s.flags.networks, 0, 100)) errors.push('维护网络数量非法');
  if (Object.hasOwn(s.flags, 'governance') && !['merchant', 'state', 'joint'].includes(s.flags.governance)) errors.push('治理方式非法');
  if (Object.hasOwn(s.flags, 'policy') && !['share_power', 'central_review', 'withdraw'].includes(s.flags.policy)) errors.push('终局方针非法');
  const crisis = s.flags.crisis;
  if (s.year >= 14 || crisis !== undefined) {
    if (!object(crisis) || crisis.warningYear !== 14 || crisis.irreversibleYear !== 23 || !['warning', 'averted', 'contained', 'disaster'].includes(crisis.status) || !Array.isArray(crisis.affectedCells) || crisis.affectedCells.length !== FLOOD_REGIONS.length || new Set(crisis.affectedCells).size !== FLOOD_REGIONS.length || crisis.affectedCells.some(cellId => !FLOOD_REGIONS.includes(cellId)) || (crisis.damage !== undefined && !bounded(crisis.damage, 0, 1))) errors.push('危机记录非法');
    if (crisis?.model !== undefined && crisis.model !== COVERAGE_RULES.version) errors.push('危机规则版本非法');
    for (const key of ['damageByCell', 'coverageByCell', 'protectionByCell']) if (crisis?.[key] !== undefined && (!object(crisis[key]) || Object.keys(crisis[key]).length !== FLOOD_REGIONS.length || FLOOD_REGIONS.some(id => !bounded(crisis[key][id], 0, 1)))) errors.push('逐地危机记录非法');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
