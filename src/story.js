import {getDecadeReview} from './decade-review.js';
import {getReviewHistory} from './review-history.js';
import {getFeeHistory} from './fee-history.js';
import {getRelocationHistory, getRelocationDestination} from './relocation-history.js';
import {evidenceTitleFor} from './investigation-intent.js';
export {evidenceTitleFor} from './investigation-intent.js';
import { getWarningCoverage, usesLegacyCrisisRules, usesHandoffRules, handoffSummary, getActorRefusals, getRecruitmentRoles, usesRecruitmentRules, RECRUITMENT_ACTIONS, recruitmentRolesAtDeparture, usesRecoveryRules, getRecoverySource, getRecoveryWorkforce, usesPortAccessRules, getPortWarningTargets, getFutureCheckPlan, getFutureCheckContracts, getArchiveUpgradePlan, getArchiveUpgradeContracts, getTrainingAuthorizationPlan } from './simulation.js';

export const chapters = {
  0: {
    title: '谁拥有洪水预警？', subtitle: '第一卷 · 河港的水位线', speaker: '林澈 · 河港测量员',
    body: ['雨停了，旧档案室仍有一股潮湿的纸味。林澈把两本账册并排放下：一份记着商船的损失，另一份只有死者的姓名。', '“你们的报告说，修一座站就能救很多人。”她按住被水泡皱的页角，“可河水不会先问，谁付过钱。”', '这次介入会留下一套制度。先决定相信哪些证据，再决定把预警交给谁。'],
    question: '资金、指令与共同维护，没有一种选择不留下债务。',
  },
  10: {
    title: '留下来的人，离开的人', subtitle: '第二卷 · 继任者的姓名', speaker: '林澈 · 河港测量员',
    question: '这一回，你要带走一个人，还是让一套规则不再依赖一个人？',
  },
  20: {
    title: '她不是档案里的那个人', subtitle: '第三卷 · 未曾生活的另一生', speaker: '苏岚 · 河港居民',
    question: '旧现实能证明一段人生曾经存在，不能替现在的人同意。',
  },
  30: {
    title: '谁签署下一版历史？', subtitle: '第四卷 · 把钥匙交给谁', speaker: '续史局 · 最后一份阶段委托',
    question: '把成功写成你的功劳很容易。让下一代不需要你，困难得多。',
  },
};

export const evidenceText={
 evacuation_routes:{title:'逐户核实撤离路线',text:'居民把夜间无法通行的渡口、需要搀扶的邻居和备用高地标在同一张图上。这不能校正水位标准，却能让停闸后真正有人及时撤离。新规则下花2轮确认，把停闸损失基数从0.30降至0.20。'},
 independent_flood_records:{title:'比对修会的旧洪水记录',text:'修会保存的河岸刻线比官署记录早了四十年。它们提示：上游暴雨与河港最高水位并不同步。公开副本可以让不同的人独立复核。'},
 unfunded_maintenance:{title:'打开商会的经费账簿',text:'建站款足够，十年后的值班薪资却没有着落。商会愿意出钱，但希望优先向缴费港口发出预警。免费不是没有成本。'},
 successor_consent:{title:'商量培训与继任条件',text:'苏岚愿意商量培训与接班，条件是有正式薪资、公开记录和拒绝不安全指令的权利。“我不是她的替身，我要有自己的签名。”'},
 anomaly_records:{title:'交叉核对远港的异常曲线',text:'不同地方的水位报告同时漏掉一条支流。问题不是科学太强，而是它们采用了同一份未经独立复核的标准。地方停闸权与异源测量可以截断共同失效。'},
 old_reality_record:{title:'阅读 R0 的教师履历',text:'R0｜已归档现实：苏岚曾在免费学校任教。这份真实旧档保留了她的生活，却不包含她对今天的意见。出示它可能引发对话，也可能伤害她的信任。'},
 resident_testimony:{title:'听取岸边居民的证词',text:'居民希望第一声钟能传到最远的棚户。他们愿意商量值班与维护，但不接受无限的免费劳动。'}
};

// Personal identity is not a capability flag. Keep the submitted choice, its
// outcome and the actual job separate, including in genuine older archives.
const personalTimings = {
  build_merchant: [0, 2], build_state: [0, 3], build_joint: [0, 3],
  recruit_successor: [10, 1], recruit_risk: [10, 1], recruit_volunteer: [10, 1],
  renew_charter: [10, 1], restore_archive: [10, 2],
  present_archive: [20, 1], relocate_teacher: [20, 1], free_warning: [20, 1],
};
function personalEvent(state, actionIds, statuses = ['success'], eventId = null) {
  const ids = Array.isArray(actionIds) ? actionIds : [actionIds];
  return state.events.filter(event => {
    const timing = Object.hasOwn(personalTimings, event.actionId) ? personalTimings[event.actionId] : null;
    if ((eventId && event.id !== eventId) || !ids.includes(event.actionId) || !timing || typeof event.sourceActionId !== 'string') return false;
    const [year, delay] = timing, actorId = event.sourceActionId.split(':')[2];
    const sourceId = `action:${year}:${actorId}:D4:${event.actionId}`;
    const action = state.history.find(h => h.id === sourceId);
    const outcome = state.history.find(h => h.id === `resolved:${event.id}`);
    const required = { build_joint: ['independent_flood_records', 'unfunded_maintenance'], recruit_successor: ['successor_consent'], present_archive: ['old_reality_record'], free_warning: ['resident_testimony'] }[event.actionId] || [];
    const records = [...state.history, ...state.events];
    return event.sourceActionId === sourceId && event.id === `event:${sourceId}` && event.parentId === sourceId
      && event.kind === 'event' && event.cellId === 'D4' && statuses.includes(event.status)
      && event.year === year + delay && event.resolvedYear === event.year && event.year <= state.year
      && ['protagonist', 'linche'].includes(actorId) && (year >= 20 || actorId === 'protagonist')
      && state.actors.filter(a => a.id === actorId).length === 1
      && state.actors.some(a => a.id === actorId && Number.isInteger(a.availableFrom) && a.availableFrom <= year)
      && action?.kind === 'action' && action.year === year && action.cellId === 'D4'
      && action.sourceActionId === sourceId && action.parentId === null && action.status === 'confirmed'
      && action.reality === 'R1' && Array.isArray(action.evidence) && required.every(id => action.evidence.includes(id))
      && (event.evidence === undefined || (Array.isArray(event.evidence) && required.every(id => event.evidence.includes(id))))
      && outcome?.parentId === event.id && outcome.sourceActionId === sourceId && outcome.cellId === 'D4'
      && outcome.year === event.resolvedYear && outcome.status === event.status
      && outcome.kind === (event.status === 'failed' ? 'failure' : 'outcome') && outcome.reality === 'R1'
      && [event.id, sourceId, outcome.id].every(id => records.filter(record => record.id === id).length === 1)
      && state.history.filter(h => h.kind === 'action' && typeof h.id === 'string' && h.id.startsWith(`action:${year}:${actorId}:`)).length === 1
      && !state.history.some(h => h.id === `pass:${year}:${actorId}`)
      && [event, action, outcome].every(record => (record.actorId === undefined || record.actorId === actorId)
        && (record.actionId === undefined || record.actionId === event.actionId)
        && (record.reality === undefined || record.reality === 'R1'));
  }).sort((a, b) => b.resolvedYear - a.resolvedYear)[0] || null;
}
function verifiedRiverportRole(state, role) {
  if (!role || role.cellId !== 'D4' || !['station', 'archive'].includes(role.kind)) return false;
  const origin = personalEvent(state, ['build_merchant', 'build_state', 'build_joint', 'restore_archive'], ['success', 'failed'], role.sourceEventId);
  return !!origin && (origin.actionId !== 'restore_archive' || origin.status === 'success') && role.sourceEventId === origin.id && role.sourceActionId === origin.sourceActionId
    && role.id === `institution:${origin.id}:D4` && role.startYear === origin.resolvedYear
    && role.kind === (origin.status === 'failed' ? 'archive' : 'station')
    && state.institutions.filter(i => i.id === role.id).length === 1
    && state.institutions.filter(i => i.sourceEventId === origin.id && i.cellId === 'D4').length === 1;
}
function personalDeparture(state, recruit) {
  if (!recruit) return { roles: [], known: false };
  const action = state.history.find(h => h.id === recruit.sourceActionId);
  const hasSnapshot = recruit.departureRoleIds !== undefined || action.departureRoleIds !== undefined;
  if (usesRecruitmentRules(state) || hasSnapshot) {
    const ids = recruit.departureRoleIds;
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || JSON.stringify(ids) !== JSON.stringify(action.departureRoleIds)) return { roles: [], known: false };
    const roles = ids.map(id => state.institutions.find(i => i.id === id));
    const known = roles.every(i => verifiedRiverportRole(state, i) && i.startYear <= 10)
      && (recruit.actionId === 'recruit_volunteer' ? ids.length === 0 : ids.length > 0);
    return { roles: known ? roles : [], known };
  }
  const roles = recruitmentRolesAtDeparture(state, recruit);
  const earlierBuilds = state.events.filter(e => ['build_merchant', 'build_state', 'build_joint'].includes(e.actionId) && e.cellId === 'D4' && e.year < recruit.year);
  // An old archive without a role snapshot can establish absence only when it
  // has no unresolved or missing construction carrier to account for.
  const known = roles.every(i => verifiedRiverportRole(state, i))
    && earlierBuilds.every(e => roles.some(i => i.sourceEventId === e.id));
  return { roles: known ? roles : [], known };
}
function personalHistory(state) {
  const recruit = personalEvent(state, RECRUITMENT_ACTIONS);
  return {
    recruit, departure: personalDeparture(state, recruit),
    forced: personalEvent(state, 'relocate_teacher'), respect: personalEvent(state, 'present_archive'),
    warning: personalEvent(state, 'free_warning'), renewal: personalEvent(state, 'renew_charter'),
    rebuilding: personalEvent(state, 'restore_archive'),
  };
}
export function sulanIdentity(state) {
  const facts = personalHistory(state);
  if (facts.forced) return { kind: 'relocated', speaker: '苏岚 · 来自东岸的信', sources: [`resolved:${facts.forced.id}`] };
  const role = facts.recruit?.actionId === 'recruit_successor'
    ? facts.departure.roles.find(i => i.active && i.maintenance > 0) : null;
  if (role) return {
    kind: role.kind, speaker: role.kind === 'station' ? '苏岚 · 河港的维护者' : '苏岚 · 河港档案保管员',
    sources: [`resolved:${facts.recruit.id}`, `resolved:${role.sourceEventId}`],
  };
  return { kind: 'resident', speaker: '苏岚 · 河港居民', sources: [] };
}

// Read-only contract recollection: paid preparation is not an accomplished check.
export function futureCheckRecollection(state) {
  const ids = ['establish_future_check', 'upgrade_archive_check'];
  const events = Array.isArray(state.events) ? state.events : [];
  const history = Array.isArray(state.history) ? state.history : [];
  const mentioned = events.some(e => ids.includes(e.actionId)) || history.some(h => ids.some(id => h.id?.endsWith(`:${id}`)));
  if (!mentioned) return null;
  let contracts;
  try { contracts = [...getFutureCheckContracts(state), ...getArchiveUpgradeContracts(state)]; }
  catch { contracts = []; }
  const unknown = {status:'unknown', sources:[], paragraphs:['未来校验的行动、原始来源或兑现记录缺失或不一致，结果未知；不能从今天的机构补写成功，也不把缺页当成取消。']};
  if (contracts.length !== 1) return unknown;
  const c = contracts[0], upgrade = c.actionId === 'upgrade_archive_check';
  if (events.filter(e => ids.includes(e.actionId)).length !== 1) return unknown;
  const label = upgrade ? '地方保档升级' : '从零筹建未来校验席';
  const reason = {'archive-unavailable':'原保档未能继续运转','workforce-unavailable':'没有实际测量或教学人手','archive-and-workforce-unavailable':'原保档未能继续运转，也没有实际测量或教学人手'}[c.cancellationReason];
  const outcome = c.status === 'pending'
    ? `这次${label}已经付出成本，约定第${c.year}年核对${upgrade ? '原档与' : ''}实际测量或教学人手，目前仍待兑现；筹备不是已经完成校验。`
    : c.status === 'cancelled'
      ? `第${c.year}年，${upgrade ? reason : '没有实际测量或教学人手'}，${label}取消，没有完成新校验席；已付成本不退。`
      : `第${c.year}年，${label}在真实来源与人手支持下完成，新增的是面向未来的指令校验；当时完成不保证此后永远有人维护。`;
  return {status:c.status, sources:[c.sourceActionId,c.recordId,c.archiveSourceRecordId].filter(Boolean), paragraphs:[outcome,
    upgrade ? '原保档的异源方法本已存在，升级没有增加交班地域；原档原页继续保留，不把保存记录改称为当年已经完成指令校验。' : '这是一份另行付费的新合同，不补写此前成功或失败过一次复核。',
    '第23年的结算仍留在原页；这项工作不附送人手、地方授权、信任或交班方针，也不等于已经完成共享或退出。']};
}

export function evidenceFor(state, id, cellId = 'D4', actorId = 'protagonist') {
  const material = evidenceContentFor(state, id, cellId, actorId);
  return {...material, title:evidenceTitleFor(state, id, cellId, actorId)};
}

function evidenceContentFor(state, id, cellId = 'D4', actorId = 'protagonist') {
  const base = evidenceText[id];
  if (!base) return { title: id, text: '一份有关当地制度的材料。' };
  if(cellId==='E4'&&id==='resident_testimony'&&getTrainingAuthorizationPlan(state,cellId).available)return {
    ...base,title:'听取原学徒的承接条件',
    text:'第7年留下的东岸学徒把自己的条件列在轮值表旁：记录公开，可以拒绝不安全指令，值守责任必须有边界，不能成为无限的免费劳动。经费应用于协商会议、公开轮值与记录保管，不是购买他们的同意。这份证词只记录他们愿意讨论的条件；第31年须由仍在运转的原学徒留下承接签名，今天读过材料不等于已经授权，也不能由主角或林澈代签。',
  };
  if(cellId==='B4' && state.year===30 && getArchiveUpgradePlan(state).available && ['anomaly_records','resident_testimony'].includes(id)) {
    return {...base,title:id==='anomaly_records'?'重读保档中的异源刻度':'听取修院居民对保档升级的条件',text:id==='anomaly_records'?'原保档保存了不同来源的刻度，不等于曾完成指令校验。要添置比对器具、另设工作席，并核实这些刻度如何用于未来指令；原档原页不改写。':'居民重新指认本地水痕，要求把第33年仍在运转的原档与测量或教学人手分别列清。证词只为本次升级取证，不替任何人接受无限劳动，也不是交班授权。'};
  }
  if(cellId==='B4' && state.year===30 && getFutureCheckPlan(state).available && ['anomaly_records','resident_testimony'].includes(id)) {
    if(id==='anomaly_records')return {...base,title:'核对未来校验所需的新记录',text:'这里没有可直接沿用的有效校验或可用失败底稿。保管员把来自不同河段的刻度与新测量计划分开登记：新刻水尺、对照抄本和连续比对，都还需要投入。这是面向今后的筹备，不证明此前曾完成或失败过一次复核。 '+crisisRecollection(state)};
    return {...base,title:'听取修院居民对新校验席的条件',text:'修院居民重新指认岸边水痕，愿意讨论仪器、抄本和场地怎样长期维护。他们要求把负责读尺的人手另列清楚；这份当地筹备证词不能替任何人接受无限劳动，也不代替跨地交班授权。新计划仍需到第34年核对真实测量或教学人手。'};
  }
  if(id==='anomaly_records' && state.year>=30 && usesRecoveryRules(state) && getRecoverySource(state,cellId,{requireActive:false})) {
    const review=getReviewHistory(state,null,cellId), failed=review?.localReviews.some(item=>item.status==='failed');
    return {...base,title:'重读未完成的异源校验',text:(failed?'这份曲线曾在第23年冲击前被送来，却没有及时形成可靠结论。原失败仍保留，今天的核对只为今后的指令补上校验能力。':'遗留记录的来源仍需核对，不能把缺页补写成失败或成功。')+` ${review?.summary||'第23年的清点结果未知。'} 是否有人在第32年真正读尺、整理记录，要以届时运转的测量或教学岗位为准。`};
  }
  if (id === 'old_reality_record' && actorId !== 'protagonist') {
    return { ...base, text: base.text + '这份材料由主角从亲历的旧现实中保存；对你而言，它是可查阅的他人见证，不是入局锚定后凭空获得的记忆。' };
  }
  if (id === 'resident_testimony') {
    if (usesLegacyCrisisRules(state) && state.flags.freeWarning) return { ...base, text: '这份旧版历史已经兑现了免费预警协议，居民仍要求明确的值班与长期经费。协议的整体减损承诺继续生效，但旧记录没有提供逐地覆盖明细。' };
    const service = getWarningCoverage(state)[cellId];
    const opening = !service?.coverage ? '这里还没有持续运转的预警载体。居民讨论的是下一次险情该由谁传话，远处的家庭又该怎样听见。'
      : service.providers.some(i => ['station', 'branch'].includes(i.kind) && !i.open) ? '部分家庭能够收到预警，但收费门槛与维护缺口仍把其他人留在外面。'
      : service.coverage < 1 ? '居民已经能从当地的读尺或传讯人员那里获得消息，但覆盖仍有限，不能把有一口钟当成每个人都能及时听见。'
      : '居民能够使用现有的公开预警。他们愿意讨论怎样让值班与维护持续下去，而不是让服务永远依赖一个人。';
    return { ...base, text: opening + '“只要第一声钟能响到这里，之后我们愿意一起修。”当地合作并不等于无限负担。' };
  }
  if (id === 'successor_consent') {
    if (!getRecruitmentRoles(state).length) return { ...base, title: '确认是否有岗位需要交接', text: '河港没有正在运转的测站或档案岗位。苏岚没有因此被指定接班，林澈的同行意愿与当地未来的建设是两件事。若要另行建设或培训，需要另外作出安排。' };
    const trained = state.institutions.some(i => i.kind === 'training');
    return { ...base, title: '与苏岚商量培训与接班',
      text: (trained ? '现有培训点留下了读尺记录。苏岚愿意商量自己需要完成的培训和接班条件。' : '这里没有原培训链培养的接班人。苏岚愿意先接受培训，再承担明确的工作。') + '她要求正式薪资、公开记录和拒绝不安全指令的权利。“我不是她的替身，我要有自己的签名。”' };
  }
  if (id === 'unfunded_maintenance') {
    const station = state.institutions.find(i => i.kind === 'station' && i.cellId === 'D4');
    return { ...base, text: !station ? '账簿列着建站计划与运输报价，却没有一座已经运转的河港测站可供续约。若要开始服务，建设和长期人手都要有经费。商会愿意讨论资助条件，但没有承诺无限维护。'
      : state.flags.renewed ? '公开章程已有长期维护基金。眼前不是一笔凭空出现的欠薪，而是如何继续履行已经承诺的值班与公开记录。'
      : '河港曾建起测站，长期维护经费却未落实。现有经费、值班人手与服务门槛需要一起谈，免费不是没有成本。' };
  }
  return base;
}

export function crisisRecollection(state) {
  if (state.year < 23) return null;
  const crisis = state.flags.crisis;
  if (crisis?.status === 'averted' && crisis.damage === 0) return '第23年的共同失效被拦在错误指令发出之前。那份及时改写的水位报告仍留在桌上。避免了这次记录中的损失，不等于洪水不再上涨，也不等于下一次总会有人替地方纠错。';
  if (crisis?.status === 'contained') return `第23年的清点册还没有收起。${state.flags.veto ? '停闸与地方保护' : '地方保护'}减轻了冲击，但剩余损失已经发生。今天恢复的产出，不能把那一页改写成从未付出代价。`;
  if (crisis?.status === 'disaster') return '第23年的共同标准失效留下了不可逆的地方损失。报告里那一页没有被撕掉；即使后来新办学校、恢复产出或签署交班方案，也不能把已经发生的伤害抹去。';
  return '这份档案没有完整记录第23年的结算结果。你不能用今天的机构与产出，替过去补写一场没有证据的胜利或灾难。';
}
function currentConsent(state) {
  const { forced, respect, warning, renewal } = personalHistory(state);
  if (forced) return '苏岚从东岸寄来的信没有替迁任补上同意：“岗位可以写进命令，我的签名不能。谈下一次交班之前，先承认上一次是谁替我作了决定。”';
  if (respect) return '当年那份旧现实履历旁，留着苏岚自己写下的选择。她愿意继续核对证据，但要求你记住：合作来自现在的同意，不来自她在另一段人生里的职位。';
  if (warning) {
    const carriers = state.institutions.filter(i => i.cellId === 'D4' && ['warning', 'station'].includes(i.kind));
    const live = carriers.some(i => i.active && i.maintenance > 0);
    return live ? '居民传讯与值班协议仍有现存服务在执行。苏岚愿意讨论下一次交班：“把维护责任和拒绝错误指令的权利，一起写在我们能看见的地方。”' : carriers.length ? '当年的免费预警协议仍在，但当前载体已经停下。旧签名不能替空着的班次继续敲钟，交班前仍要核对现实中的服务。' : '旧档保留了免费预警协议，却缺少当前载体的明细。不从缺页推断它仍在运行或已经停运。';
  }
  if (renewal) return '公开章程保留了长期维护与地方复核的约定，也记着林澈留下带教。制度的继任条款不能代替苏岚个人的任职记录，更不能替下一次交班签名。';
  if (state.flags.trust === false) return '当前记录显示地方信任仍有缺口，但个人决定的来源不完整。现有机构与这项标记都不能替居民签名，也不能据此补写苏岚的去向或同意。';
  return '苏岚还没有承诺替你接过全部责任。听过报告不等于同意交班，现存的人手也不能替尚未作出的合作决定签名。';
}

function riverportScene(state, base, chapter, actorId) {
  const station = state.institutions.find(i => i.kind === 'station' && i.cellId === 'D4');
  const operatingStation = station?.active && station.maintenance > 0;
  const warnings=state.institutions.filter(i=>i.kind==='warning'&&i.cellId==='D4');
  const training = state.institutions.some(i => i.kind === 'training');
  const archive = state.institutions.find(i => i.kind === 'archive' && i.cellId === 'D4');
  const failedBuild = state.events.some(e => e.actionId?.startsWith('build_') && e.status === 'failed');
  if (chapter === 0) return base;
  if (chapter === 10) return {
    ...base,
    title: !station ? '没有建成的十年，也要有人接住' : base.title,
    question: usesRecruitmentRules(state) && !getRecruitmentRoles(state).length ? '邀请她同行，或把这一次介入留给地方建设？没有岗位，不等于没有机会成本。' : base.question,
    body: [
      training
        ? '第一批学徒已经会独自读水尺。林澈翻着东岸送回的练习记录，问下一轮该由谁带教。'
        : station
          ? '重建的测站已经开始工作，但最初的学徒培训链没有随之补回。新的维护小组仍要面对接班的问题。'
        : failedBuild
          ? '建站协议没能兑现，小型档案站保住了零散的记录。没有最初的测站，也没有随它出发的学徒。林澈把未完成的名单放回桌上。'
          : '过去十年，没有河港测站投入运转，也没有从这里出发的培训链。林澈仍在整理旧水尺和地方记录。',
      !getRecruitmentRoles(state).length ? '“我愿意去看看你说的那些年代。”林澈把入局条件读完，“这里没有一个现成岗位需要我交给苏岚。请把邀请我同行，和替地方建起什么，分别写清楚。”' : '“我愿意去看看你说的那些年代。”她停顿了一下，“但如果我的离开，只是把没有做完的工作留给下一个人，这不叫自由。”',
      operatingStation
        ? '续约会占用你的十年名额。去东岸资助学校，也许能培养更多维护者；请她入局，则必须面对原岗位的空缺。'
        : getRecruitmentRoles(state).length ? '小型档案站也是一份正在进行的工作。招募林澈仍要决定谁来接班；重建测站或资助夜校，则占用另一项本轮选择。' : '现在可以邀请林澈自愿同行，或把本轮名额用于重建测站、地方保档与东岸夜校。同行不会补出机构，也没有虚构的岗位需要减产停运。',
    ],
  };
  if (chapter === 20) {
    const facts = personalHistory(state), identity = sulanIdentity(state);
    const fees = getFeeHistory(state);
    const relocation = getRelocationHistory(state);
    const current = facts.forced
      ? `第${facts.forced.resolvedYear}年的迁任已经把苏岚带到东岸。桌上是她寄来的信，不是她重新回到河港任职的证明。`
      : !station
        ? archive
          ? identity.kind === 'archive'
            ? '今天，苏岚把小型档案站里的散页重新编号。她接过的是档案保管工作；建站未成留下的记录还在，河港却没有正在运转的水文站。'
            : `今天，苏岚以居民的身份来查看旧记录。建站未成留下的小型档案站${archive.active && archive.maintenance > 0 ? '仍在运转' : '已经停运'}，河港没有正在运转的水文站。档案仍在，不证明她曾接过保管岗位。`
          : '今天，苏岚以居民的身份来到河港。这里没有建成水文站，也没有属于她的测站管理岗位。'
        : !operatingStation
          ? '今天，河港测站的门关着。苏岚站在停运告示旁，问那些已经留下的记录要由谁保管。'
          : station.open
            ? '今天，河港的水位记录仍向居民开放。苏岚把一张公开的记录放在桌上。'
            : '今天，河港测站仍在运转，收费牌也还挂着。苏岚把一枚磨损的铜币放回孩子掌心。';
    const upkeep = operatingStation && station.maintenance < 1 ? ' 维护经费不足，值班与修缮都有缺口；它仍在运转，不能把失修写成从未建成。' : '';
    const roleHistory = facts.recruit?.actionId === 'recruit_successor'
      ? !facts.departure.known
        ? '继任合同仍保留着苏岚的同意，但对应岗位的来源缺失或不一致，不能把承诺写成已核实的任职。'
        : facts.departure.roles.length
          ? `第${facts.recruit.resolvedYear}年，苏岚同意接过${facts.departure.roles.some(i => i.kind === 'station') ? '测站维护' : '档案保管'}。${identity.kind === 'resident' || facts.forced ? '这段交接没有被抹去，但它不是今天仍在原岗位工作的证明。' : '接班有人，不等于长期经费已经足额。'}`
          : '旧合同记录过苏岚的继任安排，但当时没有运转中的河港岗位。承诺仍在，不能补写成已经发生的任职。'
      : facts.rebuilding
        ? '重建记录写的是新的维护小组，没有指定苏岚接班。测站的运转与她个人选择承担什么，是两件事。'
        : facts.renewal
          ? '公开章程记录了林澈留下带教，并没有记录苏岚接任测站。制度有了维护人手，不等于可以替她署名。'
          : station || archive ? '现存机构可以说明当地的工作，不能代替苏岚个人任职的来源；这份档案没有可核实的接班记录。' : null;
    return {
      ...base, speaker: identity.speaker,
      body: [
        (actorId === 'protagonist'
          ? '旧现实的档案里，苏岚是免费学校的教师。你记得她讲课时总开着窗。'
          : '你读到主角保存的旧现实档案：苏岚曾是免费学校的教师。那间开着窗的教室来自主角的见证，不是你的亲历记忆。') + current + upkeep,
        operatingStation && !station.open ? fees?.summary : null,
        roleHistory,
        relocation ? [relocation.summary, relocation.context, relocation.processNote].filter(Boolean).join('') : null,
        facts.forced
          ? '她在信里写道：“那份旧履历没有我的同意。学校多了一个岗位，也不能把迁任改称为我的选择。”'
          : actorId === 'protagonist'
            ? '“那是你记得的我。”她看着那页不属于自己记忆的履历，“它没有写下我今天愿意承担什么。你要先问我。”'
            : '“那是档案里的我。”她看着那页不属于自己记忆的履历，“你认识的是现在的我。这张纸没有写下我今天愿意承担什么，你要先问我。”',
        ...getActorRefusals(state, actorId, 'D4').map(r => facts.recruit && facts.departure.known ? r.reason : '这份档案缺少可核实的个人交接来源，不能替林澈补写当年的承诺。她不亲自执行未经本人同意的迁任。'),
        '远方的水位报告出现共同偏差。是否曾建成河港测站，不会替所有地方消除风险。现在仍能独立复核或争取地方停闸权，但你的介入名额有限。',
      ].filter(Boolean),
    };
  }
  const teaching = state.institutions.some(i => ['training', 'school'].includes(i.kind) && i.active && i.maintenance > 0);
  const relocation = getRelocationHistory(state);
  return {
    ...base,
    body: [
      operatingStation
        ? '四十年的报告还剩最后一册。河港测站仍在运转，下一次维护不会因为你写完报告就自动发生。' + (station.maintenance < 1 ? ' 站内仍有维护缺口，继续亮灯不等于已经修复。' : '')
        : station
          ? '四十年的报告还剩最后一册。河港曾有一座测站，如今已经停运。移交文件里，不能把关着的门写成仍在提供的服务。'
          : '四十年的报告还剩最后一册。河港测站一直没有建成。'+(warnings.length?(warnings.some(i=>i.active&&i.maintenance>0)?'居民传讯队正在原钟架旁轮值；这是实际服务，不是补建了一座测站，也没有恢复旧档案岗位。':'居民传讯队留下的钟架与旧轮值板还在，但当前服务已经停下；旧址不等于仍有人传话。'):'空白也是这段历史的一部分，不能在最后一页补写成成功。'),
      relocation ? [relocation.summary, relocation.context, relocation.processNote].filter(Boolean).join('') : null,
      crisisRecollection(state),
      teaching
        ? '沿岸仍有人教授读尺与记录。知识已有承接者，但能否独立纠错，还要看现存网络与居民的信任。'
        : '没有现存的培训点或学校替你承接教学。新的制度可以写下责任，却不能凭空创造已经受训的人手。',
      currentConsent(state),
      ...(usesHandoffRules(state) ? ['交班清单分开列着人手、校验与授权。' + handoffSummary(state, 'share_power')] : []),
      '监察顾问把印章推到你面前：“集中维护需要持续承担责任。共享纠错权，需要当地真正拥有纠错的能力。退出也不是把钥匙丢在桌上。”',
    ].filter(Boolean),
  };
}

function locationScene(state, cell, actorId = 'protagonist') {
  const chapter = Math.min(30, Math.floor(state.year / 10) * 10);
  const base = riverportScene(state, chapters[chapter], chapter, actorId);
  if (cell === 'D4') return base;
  if (cell === 'E4') {
    const localTeaching = state.institutions.filter(i => i.cellId === cell && ['training', 'school'].includes(i.kind));
    const knownActivity = i => typeof i.active === 'boolean' && Number.isFinite(i.maintenance) && i.maintenance >= 0 && i.maintenance <= 1;
    const teaching = localTeaching.some(i => knownActivity(i) && i.active && i.maintenance > 0);
    const uncertainTeaching = localTeaching.some(i => !knownActivity(i));
    const relocation = getRelocationDestination(state, cell);
    const authorization = getTrainingAuthorizationPlan(state,cell);
    return { ...base, title: '不是一座站，是一群会读水的人', speaker: '东岸 · 居民代表', body: [
      teaching ? '河堤上的学棚向两侧敞开，长凳可以挪到读尺架旁。学员把旧水尺与当天的记录放在一起练习。' : uncertainTeaching ? '河堤上留着教学载体的记录，但当前运转情况缺页。不能把旧课堂写成仍有人带教，也不能把缺页当作停课。' : localTeaching.length ? '河堤上的旧学棚和读尺架仍在，课已经停下。没有人值班的地方，不能在交班表里写成正在带教。' : '河堤上还没有持续运作的课堂。居民带来旧水尺，希望有人把读尺和记录的方法教给更多人。',
      ...(relocation?.paragraphs || []),
      teaching ? '“会读尺，不等于手里已经有另一套可靠的记录。”带教者指着轮值表。培训可以留下承接人手，谁授权他们接班、由谁提供异源校验，还要分别说清楚。' : '居民把还未排满的轮值表递过来。先让人学会、愿意接手，再谈谁来提供另一套校验记录；一纸移交不会让空位自动坐满。',
      ...(authorization.available?[
        '第7年留下的原学徒仍在工作，却还没有本地承接授权。这里可以继续新建一组轮值教学，也可以先听清现有学徒愿意承担什么，协商他们自己的签名。',
        '协商占一个介入名额，政治3、经济2用于会议、公开轮值与记录工作，还需1轮E4居民证词。第31年只核对这批原学徒；目标停运、缺失或已经获得授权，就取消，费用不退。新学校不能替他们履行这份合同。',
        '签名不是买来的。成功只增加这批原学徒的本地承接授权，不新建学校、不增加人手、产出、预警覆盖或异源校验，也不替河港同意交班。',
      ]:[]),
      ...(state.year >= 30 ? [crisisRecollection(state)] : []),
    ], question: authorization.available?'把名额用于新增教学，还是先与已有学徒协商承接责任？':'给学校一次机会，也意味着本窗口把有限的名额留在这里。' };
  }
  if(cell==='B4' && state.year>=30 && futureCheckRecollection(state)) {
    const recall=futureCheckRecollection(state);
    return {...base,title:'新工作与旧纸页分开记',speaker:'北岸 · 档案保管员',body:recall.paragraphs,sources:recall.sources,question:'完成过的工作要有来源，下一次维护仍要有人承担。'};
  }
  if(cell==='B4' && state.year===30 && getArchiveUpgradePlan(state).available) {
    const source=getArchiveUpgradePlan(state).source;
    return {...base,title:'让保留下来的刻度参与下一次判断',speaker:'北岸 · 档案保管员',sources:[source.sourceActionId,source.recordId],body:[
      '保管员没有抽走旧纸页：“当年留下不同的刻度，是为了不让一种声音成为全部。保住它们，不等于已经有人把它们接进每一份指令。”',
      '现在可以另付经济5、科学3，添置比对器具与工作席。异常记录占2轮，B4居民证词占1轮；这项工作用满执行者的取证轮次，也占一个介入名额。',
      '第33年才核对原保档和真实测量或教学人手是否都仍在运转，任一缺失就取消，费用不退。第31年培训可以赶上，但培训和升级占满两名额时，就不能另签交班方针。',
      '保档节省了从零起步的一部分成本，却不是免费得到校验。升级不增加交班地域，也不附送地方授权或信任；它让未来的集中指令多一道校验，原档和第23年的结算不改写。',
      crisisRecollection(state)],question:'要不要把已有的保档接成新工作，并承担它可能无法兑现的成本？'};
  }
  if(cell==='B4' && state.year===30 && getFutureCheckPlan(state).available) {
    const staff=getRecoveryWorkforce(state);
    return {...base,title:'为下一份指令留一席校验',speaker:'北岸 · 档案保管员',body:[
      '藏书院原来的屋檐还在。保管员清出一张工作台：“这里没有可直接沿用的有效校验或可用失败底稿。我们可以从新的水尺和抄本开始，却不能把准备中的桌子写成已经会纠错的机构。”',
      crisisRecollection(state),
      '新的刻度、连续记录和场地要另付经费；核对异常材料还须听取B4本地居民证词。第34年才检查是否有真实测量或教学人手开席，无人就取消，已经投入的材料与场地成本不会退回。',
      staff.length?'现有人手可以支持筹备，但这份合同不会替他们取得地方授权、增加河港信任或签署交班方针。':'目前没有可用人手。另一位介入员本轮安排的培训可在第31年先到位；若两个名额都用于筹备和培训，就没有另外签署方针的名额。',
      '保管员把新工单放在第23年的清点册旁，而不是压在上面：“未来的校验可以新建，过去不能重填。”',
    ],question:'愿不愿意为未来另起一项工作，也承担它到时可能无法开席的成本？'};
  }
  if(['B4','F6'].includes(cell) && state.year===30 && usesRecoveryRules(state) && getRecoverySource(state,cell)) {
    const staff=getRecoveryWorkforce(state), review=getReviewHistory(state,null,cell);
    const failed=review?.localReviews.some(item=>item.status==='failed');
    return {...base,title:'没赶上的那份校验',speaker:cell==='F6'?'远港 · 记录保管员':'北岸 · 档案保管员',body:[
      (failed?'没有及时完成的校验仍留在原来的纸页上。它没有被偷偷改成成功。':'遗留校验的来源仍需核对，不能把缺页补写成失败或成功。')+` ${review?.summary||'第23年的清点结果未知。'}`,
      '“迟到的核对，不能让那一年重来。”保管员把空白的轮值表放在旁边，“但下一份指令来到时，我们还可以让它经过另一双眼睛。”',
      staff.length?'已有测量或教学人手仍在运转。新的校验合同仍需支付经费、科学能力和一个名额；它不会替这些人取得交班授权，也不会替你签署方针。':'现在还没有可用的测量或教学人手。如果另一位介入员在本轮安排培训，第31年到位的人手可以参与第32年校验；两个名额用在这里，就不能同时签署交班方针。',
      ...(cell==='F6'&&usesPortAccessRules(state)&&getPortWarningTargets(state).length?['值班窗前仍有缴费名单。整理失败底稿与协商公开预警是不同的工作，同一角色在远港只能选其中一项；后来的开放也不会改写第23年。']:[]),
      review?.responses.filter(item=>item.actionId==='independent_review').map(item=>`第${item.year}年 · ${item.cellId}：${item.note}`).join(' ')||'本地复核与第23年全局清点分开核对；当前机构和后来恢复的产出不能填补旧档缺页。',
    ],question:'把未完成的工作接下去，也要承认它没有赶上过去。'};
  }
  if (cell === 'F6') {
    const hadBranch = state.institutions.some(i => i.kind === 'branch' && i.cellId === cell);
    const branch = state.institutions.some(i => i.kind === 'branch' && i.cellId === cell && i.active && i.maintenance > 0);
    const corrected = state.year >= 23 && state.flags.crisis?.status === 'averted' && state.flags.crisis.damage === 0;
    const incomplete = state.year >= 23 && state.flags.crisis?.status === 'averted' && !Number.isFinite(state.flags.crisis.damage);
    return { ...base, title: '远方的水声', speaker: branch ? '远港 · 分站值班人' : '远港 · 船工代表', body: [
      branch ? '柜子里保存着河港协议的抄本。它经过东岸的课堂，又被带到了这座远方港口。' : hadBranch ? '原来的远港分站已经停运。留下的柜子仍装着旧记录，但门口没有新的值班表。' : '河港的培训链没有在这里建成分站。船工仍用自己的记录辨认支流水位，也收到了一份来自外地的统一标准。',
      corrected ? '对方把改写前后的两条曲线并排留下：“那次复核让支流进入了记录。下一次，也要允许我们指出这里不一样。”' : incomplete ? '两条曲线旁缺了一页结算记录。对方没有把空白填成定论：“先把能够确认的经过留下，再继续核对。”' : '“他们说，照着上游的标准做就不会错。”对方指向两条并不吻合的曲线，“可我们的支流，从来不在那份表里。”',
      ...(state.year>=30&&branch?[state.institutions.some(i=>i.cellId==='F6'&&i.kind==='branch'&&i.active&&i.maintenance>0&&!i.open)?(usesPortAccessRules(state)?'测量与复核没有自动撤下缴费名单。未缴费家庭仍在门外，开放预警需要另行筹措本地经费与协商；它不是再做一次校验。':'测量与复核没有自动撤下缴费名单。未缴费家庭仍在门外，这份旧合同没有替远港重新协商准入。'):'当前有效分站已经向未缴费家庭开放基本预警，维护责任仍在。眼前的准入状态不会倒写成第23年时就已如此。']:[]),
      ...(state.year >= 30 ? [crisisRecollection(state)] : []),
    ], question: '真正可靠的网络，必须允许一个节点说：这里不一样。' };
  }
  if (cell === 'D5') {
    const teaching = state.institutions.some(i => i.cellId === cell && ['training', 'school'].includes(i.kind) && i.active && i.maintenance > 0);
    const hadTeaching = state.institutions.some(i => i.cellId === cell && ['training', 'school'].includes(i.kind));
    const aidGroups = state.institutions.filter(i => i.cellId === cell && i.kind === 'mutual' && i.active && i.maintenance > 0);
    const aid = aidGroups.length > 0;
    const hadAid = state.institutions.some(i=>i.cellId===cell&&i.kind==='mutual');
    return { ...base, title: '把第一声钟传到岸边', speaker: '南岸 · 居民代表', body: [
      teaching ? '南岸把长凳围在读尺架旁，没有高大的观测塔，也没有封闭校舍。轮值学员在河水边对照当天的刻度。' : hadTeaching ? '南岸的读尺围座还在，带教已经停下。留下长凳和旧水尺，不等于现在仍有人值班。' : '南岸居民正在商量，第一声险情钟报要怎样传到更远的岸边。说好一项计划，还不等于已经有人长期值班。',
      aid ? '互助仓的轮值表列着不按缴费名单分配物资的承诺。居民仍要核对经费、人手和下一次交班。' : hadAid ? '原来的互助物资棚还在，分配窗口已经封起，轮值也停下了。重新筹措一组人手与经费后才能恢复支持；空着的仓门不是正在运行的服务。' : '居民愿意商量互助，却不愿被要求承担无穷的免费劳动。培训和经费必须与责任一起到来。',
      ...(state.year >= 30 ? [crisisRecollection(state), aidGroups.some(i => i.startYear > 23) ? '后来的互助轮值正在支持眼前的生计；账册把这些新支出与第23年的损失分开，没有用新增物资改写过去的损失。' : '现在可以增设互助轮值来支持接下来的生计，但第23年的清点册不会重新结算。扩容人手也不是第二层洪水保护。'] : []),
    ], question: '这个地方的能力也会进入每一年的历史。' };
  }
  return { ...base, title: cell === 'D5' ? '把第一声钟传到岸边' : '不应消失的底稿', speaker: cell === 'D5' ? '南岸 · 居民代表' : '北岸 · 档案保管员', body: cell === 'D5' ? ['南岸没有高大的观测塔，只有一口大家轮流敲的钟。', '居民愿意组成互助队，却不愿再被要求承担无穷的免费劳动。培训和经费必须与责任一起到来。'] : ['有些纸页没有被抄进正式报告。它们不是正确答案，却记录着一种不同的判断。', '保存旧档不能让过去重新生效，但可以在所有人相信同一个数字时，提醒他们再看一眼。'], question: '这个地方的能力也会进入每一年的历史。' };
}


// A response to a verified choice, not a relationship score or automatic pardon.
export function lincheRelationship(state) {
  const known = ids => personalEvent(state, ids);
  if(state.year<30||!known(RECRUITMENT_ACTIONS))return null;
  const forced=known('relocate_teacher'),respect=known('present_archive');
  if(forced){const own=forced.sourceActionId.split(':')[2]==='linche';return {kind:'forced',title:'林澈 · 调令之后仍有分歧',text:own?'“那份迁任有我的责任。不论后来做了多少工作，我都不能拿它们替当年的决定辩解。那份调令没有苏岚的同意，同行的约定也不能替她宣布这件事已经过去。”':`${state.actors.find(a=>a.id===forced.sourceActionId.split(':')[2]).name}在第${forced.resolvedYear}年执行了迁任。林澈没有把同行的约定盖在它上面：“我同意同行，不等于认可这份替苏岚决定去向的调令。谁愿意承担什么，下一次仍要由本人说。”`,sources:[`resolved:${forced.id}`]};}
  if(respect)return {kind:'respected',title:'林澈 · 同意不是下一张通行证',text:'“那次，旧档没有替苏岚决定。”林澈把她的证词与轮值表分开放着，“我们记住的是她当时愿意，不是以后都可以替她签字。继续合作，也要继续问。”',sources:[`resolved:${respect.id}`]};
  return null;
}
export function sceneFor(state,cell,actorId='protagonist') {
  const scene=locationScene(state,cell,actorId);
  return cell==='E4'&&state.year>=30?{...scene,relationship:lincheRelationship(state)}:scene;
}

// Staying is a recorded choice, not proof of a lifetime job. Describe the
// institution separately, using its actual source and later contracts. In
// particular, the original engine's renewed merchant station can remain paid.
function unrecruitedAftermath(state, { renewal, warning }) {
  const origins = ['build_merchant', 'build_state', 'build_joint', 'restore_archive'];
  const candidates = state.institutions.filter(i => i.cellId === 'D4' && ['station', 'archive'].includes(i.kind));
  const roles = candidates.filter(i => verifiedRiverportRole(state, i));
  const originEvents = state.events.filter(e => e.cellId === 'D4' && origins.includes(e.actionId));
  const originChoices = state.history.filter(h => h.kind === 'action' && h.cellId === 'D4'
    && typeof h.id === 'string' && origins.some(id => h.id.endsWith(`:${id}`)));
  const paragraphs = [], sources = [];
  const hasChoice = actionId => state.events.some(e => e.actionId === actionId)
    || state.history.some(h => typeof h.id === 'string' && h.id.endsWith(`:D4:${actionId}`));
  if (!renewal && hasChoice('renew_charter')) paragraphs.push('留守约定的行动或兑现来源缺失或不一致，是否完成续约仍未知；不能以今天测站运转替林澈补上留守承诺。');
  if (!warning && hasChoice('free_warning')) paragraphs.push('免费预警协议的行动或兑现来源缺失或不一致；当前准入状态不能反过来证明当时已完成协商或恢复。');
  const known = roles.length === candidates.length
    && originEvents.every(e => roles.some(i => i.sourceEventId === e.id))
    && originChoices.every(h => roles.some(i => i.sourceActionId === h.id))
    && (!renewal || roles.some(i => i.kind === 'station' && i.startYear < renewal.year));
  if (!known) return {
    paragraphs: [...paragraphs, '河港机构的建成来源缺失或不一致，后来的制度去向仍有未知。不能从一份留守约定补写测站持续运转，也不能把今天的停运倒写成林澈离开所致。'], sources,
  };
  for (const role of roles) {
    const name = role.kind === 'station' ? '测站' : '档案站';
    sources.push(role.sourceActionId, `resolved:${role.sourceEventId}`);
    if (role.sourceActionId.endsWith(':restore_archive')) paragraphs.push(`第${role.startYear}年重建测站的记录写的是新的维护小组，没有给这组人署上林澈或苏岚的姓名。`);
    else if (role.kind === 'archive') paragraphs.push(`建站未成后，第${role.startYear}年留下的是小型档案站。保住记录不等于建成水文测站，也没有因此指定个人接班。`);
    const validCurrent = typeof role.active === 'boolean' && typeof role.open === 'boolean'
      && Number.isFinite(role.maintenance) && role.maintenance >= 0 && role.maintenance <= 1;
    paragraphs.push(!validCurrent ? `第40年，河港${name}的运行或准入记录不完整，当前服务状态未知。`
      : !role.active || role.maintenance <= 0 ? `第40年，河港${name}已没有有效运转；留下原址和旧记录，不等于仍在提供服务。`
      : role.kind === 'archive' ? '第40年，小型档案站仍在保管记录；它不是水文测站，也不能代替预警服务。'
      : `第40年，河港测站仍在运转，${role.open ? '基本预警向不缴费家庭开放' : '基本预警仍有收费门槛'}。${role.maintenance < 1 ? '维护仍有缺口。' : ''}这说明现存制度的状态，不证明林澈此刻仍在值班。`);
  }
  const fees = getFeeHistory(state);
  if (fees) {
    paragraphs.push(fees.summary + '经费记录中的“继任者”不能单独证明苏岚接任，也不能补写林澈离开的经过。');
    if (fees.status !== 'unknown') sources.push(fees.original.id, ...fees.sources.map(h => h.id));
  }
  const relocation = getRelocationHistory(state);
  if (relocation) {
    paragraphs.push(relocation.summary);
    if (relocation.status === 'recorded') {
      const actor = relocation.original.sourceActionId.split(':')[2] === 'linche' ? '林澈' : '主角';
      paragraphs.push(`停用属于第${relocation.original.year}年由${actor}执行的迁任合同的制度后果，不能改写成林澈入局离开造成的空岗，也不证明苏岚是唯一维护者。具体维护中断过程没有记载；不补写撤资、解散小组或调走其他人的决定。`);
      sources.push(relocation.original.id, ...relocation.sources.map(h => h.id));
    }
  } else if (roles.some(i => i.active === false || i.maintenance === 0)) {
    paragraphs.push('停运原因缺少可核实的后续合同记录；当前关着的门不能替任何人作出离开、失职或撤资的决定。');
  }
  if (warning) {
    const station = roles.find(i => i.kind === 'station');
    if (station) {
      paragraphs.push(`第${warning.resolvedYear}年的免费预警协议另行补足河港维护与基本服务安排。${fees && fees.status !== 'unknown' ? '第16年的经费缺口仍留在原页，后来补足维护、开放基本预警没有抹去过去。' : ''}这不是林澈个人重新上岗的证明。`);
      sources.push(`resolved:${warning.id}`);
    } else {
      const teams = state.institutions.filter(i => i.sourceEventId === warning.id && i.cellId === 'D4');
      const team = teams.length === 1 ? teams[0] : null;
      if (team?.id === `institution:${warning.id}:D4` && team.kind === 'warning'
        && team.sourceActionId === warning.sourceActionId && team.startYear === warning.resolvedYear
        && state.institutions.filter(i => i.id === team.id).length === 1) {
        paragraphs.push(`第${warning.resolvedYear}年另建的居民传讯队${team.active === true && team.maintenance > 0 ? '目前仍在服务' : '当前没有可确认的有效服务'}。它不是原档案岗位，也没有补回测站或旧培训链；不能把居民轮值署作林澈个人的工作。`);
        sources.push(`resolved:${warning.id}`);
      } else paragraphs.push(`第${warning.resolvedYear}年的免费预警协议仍在，但没有可核实的新传讯队来源。不能把旧协议写成新增测站，也不能为林澈补出一个岗位。`);
    }
  }
  if (renewal && roles.length) paragraphs.push(`第${renewal.resolvedYear}年留下带教的约定仍留在原页；后来的机构变化没有替她补写离开、重新任职或接受迁任的个人决定。`);
  return { paragraphs, sources };
}

// Read-only personal coda: it never edits ending scores, old contracts or history.
export function characterEpilogue(state) {
  if (state.year < 40 || state.phase !== 'ended') return [];
  const recordId = e => e ? `resolved:${e.id}` : null;
  const { recruit, departure, warning, renewal, respect, forced } = personalHistory(state);
  const roles = departure.roles;
  const linche = [], lincheSources = [];
  if (!recruit) {
    linche.push(renewal ? `第${renewal.resolvedYear}年的章程留下林澈愿意带教的记录，她没有在这份历史中完成入局。留下来的选择，也不等于一份没有期限的劳动承诺。` : '这份档案没有林澈完成入局的记录。最后一册报告没有替她补写一段未曾作出的承诺，也不把未同行当成背弃。');
    if (renewal) lincheSources.push(recordId(renewal));
    const aftermath = unrecruitedAftermath(state, { renewal, warning });
    linche.push(...aftermath.paragraphs);
    lincheSources.push(...aftermath.sources);
  } else {
    lincheSources.push(recordId(recruit));
    if (!departure.known) linche.push('入局记录仍在，但当时岗位的来源缺失或不一致。不能从今天的机构补写苏岚的任职，也不能把缺页当成当年没有岗位。');
    if (departure.known && !roles.length) linche.push(`第${recruit.resolvedYear}年，林澈自愿入局；当时没有运转中的河港测站或档案岗位需要交接。同行是真实的选择，却没有一个不存在的空岗可以归咎于她。`);
    if (departure.known && !roles.length && recruit.actionId === 'recruit_successor') linche.push('旧合同记录了继任安排，但那时没有运转中的岗位。承诺本身仍在，不能据此补写苏岚已经管理了一座测站。');
    if (departure.known && !roles.length && recruit.actionId === 'recruit_risk') linche.push('旧合同列过减产与停运的风险，却没有对应的在岗载体。没有实际停运记录，就不把空缺算成她造成的损失。');
    if (roles.length && recruit.actionId === 'recruit_successor') linche.push(`第${recruit.resolvedYear}年，林澈在苏岚同意接班后离开。那份签名解决了谁来值班，不是长期经费已经充足的证明。`);
    else if (roles.length) linche.push(`第${recruit.resolvedYear}年，林澈入局时留下了尚未安排继任的${roles.some(i=>i.kind==='station')?'测站':'档案站'}岗位。她带走了自己的选择，也留下了一项没有完成的交接。`);
    const stopped = state.history.filter(h => h.kind === 'maintenance' && /-unattended$/.test(h.id) && h.year >= recruit.resolvedYear && roles.some(i => i.sourceEventId === h.parentId));
    if (stopped.length) {
      linche.push(`第${stopped[0].year}年的停运告示仍在档案里。后来增加的产出或新的合作，没有把那段无人接班的时间删掉。`);
      lincheSources.push(...stopped.map(h=>h.id));
      if (warning) {
        const station = roles.find(i=>i.kind==='station');
        if (station) linche.push(`第${warning.resolvedYear}年，免费预警方案重新补足河港维护与接班安排。${station.active&&station.maintenance>0?'测站现在仍在运转，但恢复不等于从未停过。':'当前测站仍未有效运转，不能把那次修复承诺当作永久有效。'}`);
        else {
          const team = state.institutions.find(i=>i.kind==='warning'&&i.sourceEventId===warning.id);
          linche.push(`第${warning.resolvedYear}年另行建立了居民传讯队，${team?.active&&team.maintenance>0?'如今仍在服务':'当前没有可确认的有效服务'}。它没有重新打开原来的档案站，旧岗位的中断不能被新机构冒名顶替。`);
        }
        lincheSources.push(recordId(warning));
      }
    }
    const lapse = state.history.find(h=>h.id==='charter-lapsed' && roles.some(i=>i.sourceEventId===h.parentId));
    if (lapse) { linche.push(`第${lapse.year}年，维护经费的缺口又变成收费门槛。${warning?'后来的免费预警曾重新处理这项负担，却没有让旧缺口消失。':'接班有人，并不代表当地已经获得公开、长期的支持。'}`); lincheSources.push(lapse.id); if(warning)lincheSources.push(recordId(warning)); }
  }
  // Read the two actual deployment windows, rather than infer her work from
  // global flags or credit her with the protagonist's matching action.
  if (recruit) {
    for (const end of [30,40]) {
      const card = getDecadeReview({...state,year:end,phase:end===40?'ended':'planning'})?.cards.find(c=>c.actorId==='linche');
      if (!card) continue;
      linche.push(`同行以后，${card.choice}${card.outcome}${card.responsibility}`);
      lincheSources.push(...card.sourceIds);
    }
  }
  const relation=lincheRelationship(state);
  if(relation){linche.push(relation.text);lincheSources.push(...relation.sources);}
  const sulan = [], sulanSources = [];
  let title = '末页仍留着她的选择';
  if (forced) {
    title = '调令没有替她签名';
    sulan.push(`第${forced.resolvedYear}年，迁任命令把苏岚带到东岸，反对的证词也被留了下来。学校多了一个岗位，不证明她曾同意，也不能把强制改称为拯救。`);
    if (respect) sulan.push('这份档案也有尊重她选择的记录。两份记录必须同时面对，不能拿一份同意去抹掉另一项强制决定。');
    sulanSources.push(recordId(forced),recordId(respect));
  } else if (respect) {
    title = '她在这一版历史里的签名';
    sulan.push(`第${respect.resolvedYear}年，旧现实履历被放到桌上，苏岚保留了决定今天生活的权利。她的证词成为合作依据，不是一张保证所有问题都已解决的收据。`);
    sulanSources.push(recordId(respect));
  } else if (warning) {
    title = '河岸上的共同安排';
    sulan.push(`第${warning.resolvedYear}年，苏岚与居民参与了免费预警和值班安排。这是当前现实里作出的合作，不是旧现实教师身份替她选好的生活。`);
    sulanSources.push(recordId(warning));
  } else if (recruit?.actionId === 'recruit_successor' && roles.length) {
    sulan.push(`第${recruit.resolvedYear}年，她同意承担接班。档案没有继续记录她对旧现实履历或迁任的决定，末页不会替她签下一个未作出的选择。`);
    sulanSources.push(recordId(recruit));
  } else if (recruit?.actionId === 'recruit_successor' && !departure.known) {
    sulan.push(`第${recruit.resolvedYear}年的继任合同仍记录着苏岚的同意，但岗位来源缺失或不一致。承诺没有被删去，也不能被写成已核实的任职。`);
    sulanSources.push(recordId(recruit));
  } else if (recruit?.actionId === 'recruit_successor') {
    sulan.push(`第${recruit.resolvedYear}年的旧合同记录了苏岚的继任安排，但当时没有运转中的河港岗位可供交接。那份承诺不能被写成已经发生的任职，也没有替她决定此后的生活。`);
    sulanSources.push(recordId(recruit));
  } else sulan.push('档案没有可核实的继任、迁任或个人去向同意。没有选择记录，不等于她已经同意成为任何人的历史样本。');
  if ((forced || respect || warning) && recruit?.actionId === 'recruit_successor') {
    sulan.push(departure.known && roles.length
      ? `第${recruit.resolvedYear}年同意承担${roles.some(i => i.kind === 'station') ? '测站维护' : '档案保管'}的交接仍留在原页。后来的选择没有抹去这段经历，也不证明她此刻仍在原岗位工作。`
      : departure.known
        ? '旧合同中的继任承诺也仍在，但当时没有可交接的河港岗位。后来的合作没有把它改写成任职。'
        : '旧合同中的继任同意仍在，但对应岗位来源缺失或不一致。后来的选择不能替那一页补齐证据。');
    sulanSources.push(recordId(recruit));
  }
  return [
    { name:'林澈', title:recruit?'同行之后，仍要面对留下的事':'未曾同行，也不是空白', paragraphs:linche, sources:[...new Set(lincheSources.filter(Boolean))] },
    { name:'苏岚', title, paragraphs:sulan, sources:[...new Set(sulanSources.filter(Boolean))] },
  ];
}
