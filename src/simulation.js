import board from './data/board.json' with { type: 'json' };

export const CHANNELS = ['politics', 'economy', 'science', 'religion'];
export const WINDOWS = [0, 10, 20, 30];
export const FLOOD_REGIONS = ['D4', 'E4', 'D5', 'F6'];
// Tunable prototype assumptions, not historical measurements or handoff specifications.
export const COVERAGE_RULES = Object.freeze({
  version: 'coverage-v1', paidAccess: .45, localTeaching: .55, communityWarning: .65,
  warningProtection: .35, stateCoordination: .1, jointRecords: .15, mutualAid: .3,
});
export const usesLegacyCrisisRules = s => s.crisisRulesVersion !== COVERAGE_RULES.version;
export const PLANNING_RULES = Object.freeze({ version: 'tradeoffs-v1', investigationBudget: 3, emergencyReview: .55, partialReview: .8, surveyedVeto: .2 });
export const usesTradeoffs = s => s.planningRulesVersion === PLANNING_RULES.version;
export const HANDOFF_RULES = Object.freeze({ version: 'handoff-v1' });
export const usesHandoffRules = s => s.handoffRulesVersion === HANDOFF_RULES.version;
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
const staffingFor = (s, i) => i.cellId === 'D4' && ['station', 'archive'].includes(i.kind) && s.flags.recruited && !s.flags.successor ? .5 : 1;

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
  const checks = live.filter(i => i.kind === 'independent' && ['preserve_records', 'independent_review'].includes(sourceEvent(i)?.actionId));
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
  const s = { version: 'afterwave.run.v1', crisisRulesVersion: COVERAGE_RULES.version, planningRulesVersion: PLANNING_RULES.version, handoffRulesVersion: HANDOFF_RULES.version, investigations: {}, seed: String(seed), year: 0, phase: 'planning', cells: copy(board.cells), actors: [{ id: 'protagonist', name: '主角', availableFrom: 0, anchored: true, alive: true }], drafts: {}, events: [], institutions: [], history: [], flags: {}, committedWindows: [], snapshots: {}, baseline: Object.fromEntries(board.cells.map(c => [c.id, copy(c.channels)])), promises: [], reality: 'R1' };
  s.cells.forEach(c => { c.deployable = ['D4', 'B4'].includes(c.id); if (c.name === '未命名地域') c.name = `${c.id}·${c.terrain === 'water' ? '水域' : '原野'}`; });
  record(s, { id: 'arrival', title: '第零年 · 借来的十年', text: '续史局只能在每十年的窗口介入一次。你是唯一的介入员。河港将迎来洪水，但居民并不只需要被拯救。', kind: 'arrival' });
  s.snapshots[0] = copy(s.cells); return s;
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
    if (!s.flags.recruited) out.push(action('recruit_successor', '招募林澈 · 安排继任', '林澈同意加入续史局，先训练苏岚接班；下一窗口才能部署。', { economy: 5, science: 2 }, 1, 1, ['successor_consent'], '当地仍需补充长期经费；这不等于续约公开章程。', '第20年起获得第二名介入员；保留维护人手。'), action('recruit_risk', '招募林澈 · 暂缺继任', '林澈自愿锚定记忆，但河港没有准备好的接班人。', { economy: 1 }, 1, 1, [], '河港现有测站或档案站产出减半；第16年起停运，已经传播的知识仍保留。', '以较低成本获得第20年可部署的同伴。'));
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
  if (cellId === 'D4' && y === 30 && actorId === 'protagonist') out.push(
    action('share_power', '共享档案与纠错权', '把历史干预的证据与否决权交给现实中的维护网络。', { politics: 3, economy: 3 }, 1, 1, [], '没有独立网络与地方信任，权利将停留在纸上。', '有准备的地区可自治并互相复核。'),
    action('central_review', '集中干预 · 强化复核', '续史局保留干预权，承诺让不同测站审查每一次指令。', { politics: 4, science: 2 }, 1, 1, [], '集中依赖仍然存在；缺少独立复核时结局脆弱。', '保留应急协调能力，承担持续维护责任。'),
    action('withdraw', '逐步退出独占控制', '不再垄断未来，把维护工作和档案移交给现存地方网络。', { economy: 2 }, 1, 1, [], '若人手不足，退出会造成服务空缺。', '已建立的学校与互助制度继续自行运作。'));
  const notes = {
    build_merchant: '正常维护时，收费测站覆盖系数为0.45；本源分站沿用收费规则。',
    build_state: '正常维护时，公开测站覆盖系数为1；统一撤离协调减少10%的剩余共同失效损失。',
    build_joint: '正常维护时，公开测站覆盖系数为1；成功建立并保留独立旧记录的载体减少15%的剩余共同失效损失。',
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
  if (usesHandoffRules(s)) {
    notes.renew_charter = '维持河港公开、足额维护；把现存同源培训点纳入继任与地方复核授权，保留可追溯授权记录。不改变远港收费门槛，也不凭空增加异源校验。';
    for (const policy of ['share_power', 'withdraw']) notes[policy] = handoffSummary(s, policy) + '交班需不同地域的已获授权人手与真实异源校验；原学徒可提供人手，同源人数不等于独立方法。学校提供技术人手，强制迁任本身不证明合作。共享另需河港信任。最终按第40年实际存续条件结算。';
  }
  return out.map(a => ({ ...a, ...(notes[a.id] ? { modelNote: notes[a.id] } : {}) }));
}
function assertPlanning(s, actorId) { require(s.phase === 'planning', '当前不在介入窗口'); require(getActors(s).some(a => a.id === actorId), '该棋子本轮不可部署'); }
export function lockTask(s, actorId, cellId, actionId, evidence = []) {
  assertPlanning(s, actorId);
  if (usesTradeoffs(s)) evidence = getInvestigation(s, actorId, cellId).evidence;
  const a = getActions(s, cellId, actorId, evidence).find(a => a.id === actionId);
  require(a, '该行动当前不可用'); require(a.requireEvidence.every(e => evidence.includes(e)), '尚缺必要证据');
  s.drafts[actorId] = { actorId, cellId, actionId, evidence: [...new Set(evidence)], status: 'locked', window: s.year }; return s;
}
export function passTask(s, actorId) { assertPlanning(s, actorId); s.drafts[actorId] = { actorId, status: 'passed', window: s.year }; return s; }
export function unlockTask(s, actorId) { assertPlanning(s, actorId); delete s.drafts[actorId]; return s; }
export function getWindowReview(s) {
  const actors = getActors(s), tasks = [], costs = {}, issues = [], warnings = [], occupied = new Map();
  if (s.phase !== 'planning' || !WINDOWS.includes(s.year) || s.committedWindows.includes(s.year)) {
    return { ready: false, issues: ['本轮已提交或不在介入窗口'], warnings, costs, tasks, assigned: 0, total: actors.length };
  }
  let assigned = 0;
  for (const actor of actors) {
    const d = s.drafts[actor.id];
    if (!d || d.window !== s.year || !['locked', 'passed'].includes(d.status)) {
      issues.push(`${actor.name}尚未安排。请先为全部棋子锁定任务或明确放弃。`); continue;
    }
    assigned++;
    if (d.status === 'passed') continue;
    const a = getActions(s, d.cellId, actor.id, d.evidence).find(a => a.id === d.actionId);
    if (usesTradeoffs(s) && !d.evidence.every(id => getInvestigation(s, actor.id, d.cellId).evidence.includes(id))) { issues.push(`${actor.name}的草案取证记录缺失，请修改安排。`); continue; }
    if (!a || !a.requireEvidence.every(e => d.evidence.includes(e))) { issues.push(`${actor.name}的草案条件已经失效，请修改安排。`); continue; }
    if (occupied.has(d.cellId)) issues.push(`${d.cellId}同格任务冲突：${occupied.get(d.cellId)}与${actor.name}不能使用未定义的联合行动。`);
    occupied.set(d.cellId, actor.name);
    if (usesTradeoffs(s) && a.id === 'local_veto' && !d.evidence.includes('evacuation_routes') && getInvestigation(s, actor.id, d.cellId).evidence.includes('evacuation_routes')) warnings.push(`${actor.name}新调查的撤离路线尚未纳入已锁定草案：当前仍为基本停闸0.30。请修改并重新锁定，才会采用强化停闸0.20。调查不需要重复支付。`);
    tasks.push({ d: copy(d), a: copy(a) }); costs[d.cellId] ||= {};
    for (const [k, v] of Object.entries(a.cost)) costs[d.cellId][k] = (costs[d.cellId][k] || 0) + v;
  }
  const names = { politics: '政治', economy: '经济', science: '科学', religion: '宗教' };
  for (const [id, spend] of Object.entries(costs)) for (const [k, v] of Object.entries(spend)) {
    if (cell(s, id).channels[k] < v) issues.push(`${id}的${names[k]}能力不足：现有${cell(s, id).channels[k].toFixed(1)}，需支付${v}。整轮未提交。`);
  }
  const reviewCount = tasks.filter(t => t.a.id === 'independent_review').length;
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
    for (const [k, v] of Object.entries(a.cost)) cell(s, d.cellId).channels[k] = clamp(cell(s, d.cellId).channels[k] - v);
    record(s, { id: sourceActionId, title: a.title, text: `${a.description} 确定成本已支付；${a.probability === 1 ? '确定' : `${Math.round(a.probability * 100)}%概率`}在第${s.year + a.dueIn}年兑现。`, cellId: d.cellId, kind: 'action', sourceActionId, evidence: copy(d.evidence), cost: copy(a.cost) });
    schedule(s, { id: `event:${sourceActionId}`, year: s.year + a.dueIn, cellId: d.cellId, title: a.title, text: a.description, actionId: a.id, parentId: sourceActionId, sourceActionId, probability: a.probability, ...(usesTradeoffs(s) ? { planningRulesVersion: PLANNING_RULES.version, evidence: copy(d.evidence), ...(a.id === 'independent_review' ? { preparation: reviewPreparation(s) } : {}) } : {}) });
    if (a.id.startsWith('build_')) s.promises.push({ id: `promise:${sourceActionId}`, sourceActionId, text: '第10年处理维护人与长期经费', dueYear: 10, status: 'pending' });
  }
  for (const actor of actors) if (s.drafts[actor.id].status === 'passed') record(s, { id: `pass:${s.year}:${actor.id}`, kind: 'pass', title: `${actor.name}保留沉默`, text: '本轮名额明确放弃。历史仍会继续。' });
  s.committedWindows.push(s.year); s.drafts = {}; s.phase = 'playback'; return s;
}
function resolve(s, e) {
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
  } else if (a === 'branch') { const branch = institution(s, 'branch', 'F6', e, '远港水文分站'); branch.open = !e.sourceActionId?.endsWith(':build_merchant'); text = '东岸学徒与远港船工共同建起分站。它来自河港，却不只是河港的功劳。'; }
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
  else if (a?.startsWith('recruit_')) { s.flags.recruited = true; s.flags.successor = a === 'recruit_successor'; s.actors.push({ id: 'linche', name: '林澈', availableFrom: 20, anchored: true, alive: true }); text = s.flags.successor ? '林澈自愿锚定，苏岚同意接班。第20年起林澈可部署；家人与身份仍受当前现实影响。' : '林澈自愿锚定。河港暂缺维护者：产出减半，第16年将停运。第20年起林澈可部署。'; }
  else if (a === 'restore_archive') { institution(s, 'station', 'D4', e, '重建水文站'); s.flags.successor = true; text = '新的维护小组重建测站。错过的旧培训链不会凭空补回。'; }
  else if (a === 'preserve_records') { institution(s, 'independent', 'B4', e, '修会校验档案'); s.flags.independentArchive = true; text = '不同来源的洪水刻度被保留，没有被统一标准覆盖。'; }
  else if (a === 'fund_school' || a === 'train_network') { institution(s, 'school', e.cellId, e, a === 'fund_school' ? '东岸夜校' : '轮值维护网络'); s.flags.networks = (s.flags.networks || 0) + 1; text = '新的维护者学会公开记录与独立校验。承接历史的人手来自多年积累。'; }
  else if (a === 'mutual_aid') { institution(s, 'mutual', 'D5', e, '南岸互助仓'); s.flags.aid = true; text = '轮值居民把物资分给未缴费的家庭。预警之外，避难还需要粮食。'; }
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
  else if (a === 'local_veto') { s.flags.veto = true; if (e.planningRulesVersion === PLANNING_RULES.version) s.flags.vetoMitigation = Math.min(s.flags.vetoMitigation ?? .3, e.evidence?.includes('evacuation_routes') ? PLANNING_RULES.surveyedVeto : .3); text = '地方停闸与先行撤离权生效。统一标准仍错，但居民不必盲从。'; }
  else if (['share_power', 'central_review', 'withdraw'].includes(a)) { s.flags.policy = a; text = '终局方针已经签署。它能否兑现，取决于此前积累的人手、信任与复核网络，而非这一句宣言。'; }
  record(s, { id: `resolved:${e.id}`, year: s.year, title, text: text || e.text, cellId: e.cellId, parentId: e.id, sourceActionId: e.sourceActionId, kind: e.status === 'failed' ? 'failure' : 'outcome', status: e.status });
}
function milestone(s) {
  if (s.year === 10) record(s, { id: 'succession-window', title: '谁来守住下一次洪水', text: '林澈愿意入局，但带走维护者也会改变河港。招募、继任与续约争夺同一名额。', kind: 'choice' });
  if (s.year === 14) {
    s.flags.crisis = { warningYear: 14, irreversibleYear: 23, status: 'warning', dependency: '统一水文标准', affectedCells: [...FLOOD_REGIONS] };
    record(s, { id: 'crisis-warning', title: '过于一致的水位', text: '四地报告出现同一偏差。第20年可以建立独立复核或地方停闸权；第23年才可能发生不可逆损失。改名与降温不会重置时钟。', kind: 'warning', parentId: s.events.find(e => e.actionId === 'branch')?.id || null });
  }
  if (s.year === 16) {
    const station = active(s, 'station');
    if (s.flags.recruited && !s.flags.successor) {
      for (const institution of s.institutions.filter(i => i.cellId === 'D4' && ['station', 'archive'].includes(i.kind) && i.active)) {
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
    const coverage = getWarningCoverage(s), damageByCell = {}, coverageByCell = {}, protectionByCell = {};
    for (const id of s.flags.crisis.affectedCells) {
      const service = coverage[id];
      const hasAid = s.institutions.some(i => i.cellId === id && i.kind === 'mutual' && i.active);
      coverageByCell[id] = service.coverage; protectionByCell[id] = service.protection;
      const loss = coefficient(mitigation * (1 - COVERAGE_RULES.warningProtection * service.coverage) * (1 - service.protection) * (hasAid ? 1 - COVERAGE_RULES.mutualAid : 1));
      damageByCell[id] = loss;
      const c = cell(s, id); c.channels.economy = clamp(c.channels.economy - 14 * loss); c.channels.politics = clamp(c.channels.politics - 7 * loss);
    }
    const damage = coefficient(Object.values(damageByCell).reduce((sum, value) => sum + value, 0) / s.flags.crisis.affectedCells.length);
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
  if (s.flags.policy === 'central_review') { title = s.flags.review ? '仍亮着灯的续史局' : '更安静的警报室'; text = s.flags.review ? '集中协调保留下来，独立复核可以否决错误指令。安全依赖持续维护，而非永远正确的计算。' : '续史局仍能协调救援，却尚未打破共同标准的依赖。短期秩序没有消除下一次共同失效。'; }
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
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const bounded = (value, min = 0, max = 100) => Number.isFinite(value) && value >= min && value <= max;
  const id = value => typeof value === 'string' && value.length > 0;
  if (!object(s) || s.version !== 'afterwave.run.v1') return { valid: false, errors: ['不兼容的存档版本'] };
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
    if (e.authorizedTrainingSources !== undefined && (e.actionId !== 'renew_charter' || e.status !== 'success' || !Array.isArray(e.authorizedTrainingSources) || e.authorizedTrainingSources.some(source => !id(source) || !s.institutions.some(i => i.kind === 'station' && i.sourceActionId === source)))) errors.push('继任授权来源非法');
    if (e.planningRulesVersion !== undefined && (e.planningRulesVersion !== PLANNING_RULES.version || !Array.isArray(e.evidence) || e.evidence.some(id => !Object.hasOwn(EVIDENCE, id)))) errors.push('事件行动合同非法');
    if (!['pending', 'success', 'failed', 'cancelled'].includes(e.status) || !bounded(e.probability, 0, 1) || !integer(e.year, 1, 40) || !ids.has(e.cellId) || !id(e.actionId) || (e.status === 'pending' && e.year <= s.year) || (e.status !== 'pending' && e.year > s.year)) errors.push('事件状态非法');
  }
  for (const entry of [...s.events, ...s.history]) {
    if (['title', 'text', 'description', 'reason', 'kind', 'status'].some(key => entry[key] !== undefined && typeof entry[key] !== 'string') || ['parentId', 'sourceActionId'].some(key => entry[key] != null && !id(entry[key]))) errors.push('历史记录字段非法');
  }
  for (const entry of s.history) if (!integer(entry.year, 0, s.year) || !ids.has(entry.cellId)) errors.push('历史记录年代或坐标非法');
  for (const i of s.institutions) {
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
