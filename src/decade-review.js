import { getFutureCheckContracts, getArchiveUpgradeContracts, getTrainingAuthorizationContracts } from './simulation.js';

// Read-only recollections. A card joins an issued choice to its own recorded
// outcome; matching a date or a convenience flag is never enough provenance.
const WINDOWS = [0, 10, 20, 30];
const RECRUITMENT = ['recruit_successor', 'recruit_risk', 'recruit_volunteer'];
const LABELS = {
  recruit_successor: '邀请林澈同行，并约定继任安排',
  recruit_risk: '邀请林澈同行，未另行安排继任',
  recruit_volunteer: '邀请林澈自愿同行',
};
const OUTCOMES = {
  open_port_warning: '既有远港分站向未缴费家庭开放基本预警，没有新增机构',
  renew_charter: '公开章程落实了维护基金与继任条款',
  restore_archive: '新的维护小组重建测站，没有补回错过的旧培训链',
  preserve_records: '不同来源的洪水刻度进入校验档案',
  fund_school: '夜校开始培养新的维护者',
  train_network: '新的轮值维护网络开始工作',
  authorize_training: '原东岸学徒按已协商的条件留下本地承接签名，没有新建学校或增加人手',
  mutual_aid: '南岸互助轮值开始分配物资、支持生计',
  free_warning: '河港基本预警方案兑现',
  present_archive: '苏岚留下当前的证词，拒绝让旧现实替她作决定',
  relocate_teacher: '强制迁任执行，苏岚没有因此补上同意',
  independent_review: '异源复核确认了共同标准偏差',
  complete_review: '遗留校验在实际人手支持下完成，只新增面向未来的核查能力',
  upgrade_archive_check: '地方保档接成了面向未来的指令校验席，原档原页保留',
  establish_future_check: '未来校验席在实际测量或教学人手支持下完成，只新增面向未来的独立校验能力',
  local_veto: '地方停闸与先行撤离权生效，统一标准仍未被这项行动纠正',
  share_power: '共享纠错权的方针已经签署',
  central_review: '集中协调的方针已经签署',
  withdraw: '结束独占控制的方针已经签署',
};
const RESPONSIBILITIES = {
  open_port_warning: '开放准入仍依赖原分站的维护，不替代教学、授权或异源校验，也不重算第23年的损失。',
  renew_charter: '基金与签名仍要持续兑现，培训人手不等于已经有异源校验。',
  restore_archive: '重建之后仍需经费与接班人手，错过的教学积累要另外建立。',
  preserve_records: '底稿需要有人继续比对，留档本身不能替代预警与撤离。',
  fund_school: '学会读尺不是替地方作出同意，异源校验也仍需真实来源。',
  train_network: '维护人手不能替代异源记录，下一次交班仍要分别核对。',
  authorize_training: '协商经费用于会议、公开轮值与记录工作，不是购买或代签同意；授权只属于这批原学徒，不增加产出、预警覆盖、异源校验、河港信任或交班方针。',
  mutual_aid: '互助仍需经费与人手，也不能替代教学或异源校验。',
  free_warning: '这份服务不自动覆盖其他地方，公开承诺仍需维护与值班。',
  present_archive: '今天的合作仍需她同意，旧履历不是她欠下的人生。',
  relocate_teacher: '新增岗位不能抵销被替代的选择，后续交班仍需面对她的意愿。',
  independent_review: '本次结论不是永久安全，下一次记录仍需独立比对。',
  local_veto: '停闸是后备，撤离与下一次纠错仍需有人承担。',
  share_power: '宣言没有替地方长出人手，维护、校验与同意仍需分别落实。',
  central_review: '集中协调不等于永远正确，独立纠错与持续维护仍需保留。',
  withdraw: '结束独占控制并未结束服务责任，接班能力仍需实际承接。',
  complete_review: '第23年的损失与原来的复核失败保留；未来交班仍需授权人手、跨地校验与实际方针。',
  upgrade_archive_check: '原保档已提供异源方法，升级不增加交班地域；新增指令校验不附送人手、授权、信任或方针，第23年的结算不改写。',
  establish_future_check: '校验完成不等于完成交班或共享，也不附送地方授权、信任或交班方针；跨地承接仍需另行核对。',
};
const integer = n => Number.isInteger(n) && n >= 0;
const same = (record, key, value) => record[key] === undefined || record[key] === value;
const unique = (items, id) => {
  const matches = items.filter(item => item?.id === id);
  return matches.length === 1 ? matches[0] : null;
};

export function getDecadeReview(state) {
  const end = state?.year;
  if (!([10, 20, 30].includes(end) && state.phase === 'planning')
    && !(end === 40 && state?.phase === 'ended')) return null;
  const start = end - 10;
  const history = Array.isArray(state.history) ? state.history : [];
  const events = Array.isArray(state.events) ? state.events : [];
  const institutions = Array.isArray(state.institutions) ? state.institutions : [];
  const actors = Array.isArray(state.actors) ? state.actors : [];
  const cells = Array.isArray(state.cells) ? state.cells : [];
  const sourceFor = record => {
    if (!record || typeof record.id !== 'string' || unique(history, record.id) !== record) return null;
    const [prefix, yearText, actorId, cellId, actionId, extra] = record.id.split(':');
    const year = Number(yearText), actor = unique(actors, actorId);
    if (prefix !== 'action' || extra !== undefined || !actionId || !WINDOWS.includes(year) || String(year) !== yearText
      || !actor || !integer(actor.availableFrom) || actor.availableFrom > year || year >= end
      || !unique(cells, cellId) || record.kind !== 'action' || record.year !== year || record.cellId !== cellId
      || record.sourceActionId !== record.id || record.parentId !== null || record.status !== 'confirmed'
      || !same(record, 'actorId', actorId) || !same(record, 'actionId', actionId)) return null;
    return { record, actorId, actionId, year };
  };
  const resultFor = event => {
    if (!event || unique(events, event.id) !== event || event.kind !== 'event' || typeof event.sourceActionId !== 'string'
      || !same(event, 'actorId', event.sourceActionId.split(':')[2])) return null;
    const result = unique(history, `resolved:${event.id}`);
    if (event.status === 'pending') return integer(event.year) && event.year > end && event.year <= 40
      && event.resolvedYear === undefined && !history.some(record => record.id === `resolved:${event.id}`)
      ? { event, record: null } : null;
    const kind = { success: 'outcome', failed: 'failure', cancelled: 'cancelled' }[event.status];
    return kind && integer(event.year) && event.year <= end && event.resolvedYear === event.year
      && result?.kind === kind && result.parentId === event.id && result.sourceActionId === event.sourceActionId
      && result.year === event.year && result.cellId === event.cellId && result.status === event.status
      && same(result, 'actionId', event.actionId) && same(result, 'actorId', event.sourceActionId.split(':')[2])
      ? { event, record: result } : null;
  };
  const rootFor = source => {
    const event = source && unique(events, `event:${source.record.id}`);
    if (!event || event.parentId !== source.record.id || event.sourceActionId !== source.record.id
      || event.actionId !== source.actionId || event.cellId !== source.record.cellId || event.year <= source.year
      || !same(event, 'actorId', source.actorId)) return null;
    const result = resultFor(event);
    if(source.actionId==='authorize_training'&&!getTrainingAuthorizationContracts(state).some(contract=>contract.eventId===event.id
      &&contract.sourceActionId===source.record.id))return null;
    if (['establish_future_check','upgrade_archive_check'].includes(source.actionId)) {
      // Only this newer contract needs its own paid-materials and workforce
      // proof. A partial export stays unknown here, without rejecting its
      // other cards or changing the save's acceptance rules.
      let contracts;
      try { contracts = (source.actionId === 'upgrade_archive_check' ? getArchiveUpgradeContracts : getFutureCheckContracts)({ ...state, history, events, institutions, actors }); }
      catch { return null; }
      if (!contracts.some(contract => contract.eventId === event.id
        && contract.sourceActionId === source.record.id)) return null;
    }
    return result;
  };
  const provenInstitution = institution => {
    if (!institution || unique(institutions, institution.id) !== institution || institution.cellId !== 'D4'
      || !['station', 'archive'].includes(institution.kind) || !integer(institution.startYear)) return null;
    const source = sourceFor(unique(history, institution.sourceActionId)), root = rootFor(source);
    const expectedKind = root?.event.actionId?.startsWith('build_')
      ? root.event.status === 'success' ? 'station' : root.event.status === 'failed' ? 'archive' : null
      : root?.event.actionId === 'restore_archive' && root.event.status === 'success' ? 'station' : null;
    return root?.record && expectedKind === institution.kind && institution.sourceEventId === root.event.id
      && institution.startYear === root.event.resolvedYear && institution.id === `institution:${root.event.id}:D4`
      ? { institution, source, root } : null;
  };
  const impact = unique(history, 'crisis-impact');
  const impactKnown = end >= 30 && impact?.kind === 'crisis' && impact.year === 23
    && impact.cellId === 'D4' && impact.parentId === 'crisis-warning';
  const damage = state.flags?.crisis?.damage;
  const aftermath = !impactKnown ? '' : Number.isFinite(damage) && damage > 0 && damage <= 1
    ? '第23年已记录的损失仍在，后来的支持不能改写那一页。'
    : damage === 0 ? '第23年已存结算没有共同失效损失，下一次安全仍需维护。'
      : '第23年的结算细节不完整，不从今天的机构补写过去。';
  const cards = actors.filter(actor => unique(actors, actor.id) === actor && integer(actor.availableFrom) && actor.availableFrom <= start)
    .sort((a, b) => (a.id === 'protagonist' ? -1 : b.id === 'protagonist' ? 1 : a.id.localeCompare(b.id)))
    .slice(0, 2).map(actor => {
      const name = typeof actor.name === 'string' && actor.name ? actor.name : actor.id;
      const matches = history.filter(record => typeof record.id === 'string'
        && record.id.startsWith(`action:${start}:${actor.id}:`));
      const source = matches.length === 1 ? sourceFor(matches[0]) : null;
      const passed = unique(history, `pass:${start}:${actor.id}`);
      const validPass = passed?.kind === 'pass' && passed.year === start && passed.parentId === null
        && passed.sourceActionId === null && passed.status === 'confirmed' && !!unique(cells, passed.cellId)
        && same(passed, 'actorId', actor.id);
      const sourceIds = [];
      const card = { actorId: actor.id, name, choice: '', outcome: '', responsibility: '', sourceIds };
      if ((!source && !validPass) || (matches.length && validPass)) {
        card.choice = `第${start}年，${name}的选择记录缺失或不一致。`;
        card.outcome = '无法确认是介入还是明确放弃，也不从当前机构反推结果。';
        card.responsibility = '保留这处缺页，等待原始记录，而不是替过去作出选择。';
      } else if (validPass) {
        sourceIds.push(passed.id);
        card.choice = `第${start}年，${name}明确放弃了本窗口的介入名额。`;
        card.outcome = '这次明确放弃没有提交新行动，历史仍照常推进。';
        card.responsibility = '放弃一个名额没有替地方解除责任，下一次介入仍需面对留下的问题。';
      } else {
        sourceIds.push(source.record.id);
        const { actionId } = source, result = rootFor(source);
        const label = LABELS[actionId] || source.record.title || actionId;
        card.choice = `第${start}年，${name}在${source.record.cellId}选择「${label}」。`;
        if (!result) {
          card.outcome = '兑现记录缺失或不一致，结果未知。';
          card.responsibility = '提交过的选择仍在，不能把缺失的结果写成成功、失败或取消。';
        } else {
          const { event, record } = result;
          if (record) sourceIds.push(record.id);
          if (actionId === 'upgrade_archive_check') sourceIds.push(event.archiveSourceRecordId);
          if (event.status === 'pending') {
            card.outcome = `约定第${event.year}年兑现，目前仍待结果。`;
            card.responsibility = '承诺还不是已经得到的服务，接下来的兑现仍需核对。';
          } else if (event.status === 'cancelled') {
            if (actionId === 'authorize_training') {
              const contract=getTrainingAuthorizationContracts(state).find(c=>c.eventId===event.id);
              card.outcome=`第${event.year}年，${contract.cancellationReason==='already-authorized'?'已有实际承接授权，无需重复签署':'原学徒目标缺失、替换或不再有效运转'}，本次承接协商取消，没有新增授权。`;
              card.responsibility=contract.workload?'已付会议、公开轮值与记录工作成本不退；拟议的职责改排没有执行，新学校不能替原学徒履约，也不能补写他们的同意。':'已付会议、公开轮值与记录工作成本不退；新学校不能替原学徒履约，也不能补写他们的同意。';
            } else if (actionId === 'upgrade_archive_check') {
              const reason = {'archive-unavailable':'原保档未能继续运转','workforce-unavailable':'没有实际测量或教学人手','archive-and-workforce-unavailable':'原保档未能继续运转，也没有实际测量或教学人手'}[event.archiveUpgradeCancellationReason];
              card.outcome = `第${event.year}年，${reason}，保档升级取消，没有完成新校验席。`;
              card.responsibility = '已付器具与工作席成本不退，原保档记录仍在；没有新增校验能力或交班授权。';
            } else if (actionId === 'establish_future_check') {
              card.outcome = `第${event.year}年，没有实际测量或教学人手，未来校验席取消，未完成连续比对。`;
              card.responsibility = '已付材料与场地成本不退；没有因此取得校验能力、地方授权、信任或交班方针。';
            } else {
              card.outcome = `第${event.year}年，行动取消，未兑现原定安排。`;
              card.responsibility = '取消记录与已付成本保留，后续责任没有随计划一起消失。';
            }
          } else if (event.status === 'failed') {
            card.outcome = event.actionId.startsWith('build_')
              ? `第${event.year}年，建站未成，小型档案站保留记录，原培训链没有启动。`
              : event.actionId === 'independent_review'
                ? `第${event.year}年，复核未形成可靠结论，没有修正本次共同指令。`
                : `第${event.year}年，行动未完成，不能记作已兑现。`;
            card.responsibility = '失败与已付成本仍留在档案里，下一步建设或校验要另作安排。';
          } else if (actionId.startsWith('build_')) {
            card.outcome = `第${event.year}年，河港水文站启用。`;
            const training = unique(events, `${event.id}:training`);
            const trainingResult = training?.actionId === 'training' && training.cellId === 'E4'
              && training.year === 7 && training.year > event.year && training.parentId === event.id
              && training.sourceActionId === source.record.id ? resultFor(training) : null;
            if (trainingResult?.record) {
              sourceIds.push(trainingResult.record.id);
              card.outcome = `第${event.year}年，河港水文站启用；第7年，${training.status === 'success' ? '培训抵达东岸与南岸' : training.status === 'cancelled' ? '后续培训取消' : '后续培训未完成'}。`;
            }
            card.responsibility = '启用不等于长期有人值班，维护与继任仍要继续安排。';
            const branch = trainingResult?.event.status === 'success' && unique(events, `${training.id}:branch`);
            const branchResult = branch?.actionId === 'branch' && branch.cellId === 'F6' && branch.year === 12
              && branch.parentId === training.id && branch.sourceActionId === source.record.id ? resultFor(branch) : null;
            if (branchResult?.event.status === 'pending') card.outcome += '远港分站约定第12年兑现，仍待结果。';
          } else if (RECRUITMENT.includes(actionId)) {
            const candidates = institutions.filter(item => item.cellId === 'D4' && ['station', 'archive'].includes(item.kind) && item.startYear < event.year);
            const listed = event.departureRoleIds;
            const roles = candidates.map(provenInstitution).filter(Boolean).filter(item => !history.some(h => h.kind === 'maintenance'
              && /-unattended$/.test(h.id) && h.parentId === item.root.event.id && h.year < event.year));
            const listKnown = Array.isArray(listed) && Array.isArray(source.record.departureRoleIds)
              && JSON.stringify(listed) === JSON.stringify(source.record.departureRoleIds)
              && new Set(listed).size === listed.length && listed.every(id => roles.some(role => role.institution.id === id));
            const selected = Array.isArray(listed) ? listKnown ? roles.filter(role => listed.includes(role.institution.id)) : [] : roles;
            card.outcome = `第${event.year}年，林澈自愿入局；${selected.length
              ? actionId === 'recruit_successor' ? '苏岚同意接下已有岗位' : '已有岗位没有安排继任'
              : listKnown && listed.length === 0 && candidates.length === 0 ? '当时没有运转中的测站或档案岗位需要交接'
                : '岗位交接缺少可靠记录，不把旧合同里的空缺写成事实'}。`;
            card.responsibility = selected.length ? '入局不是长期经费已经充足的证明，留下的工作仍需有人接住。'
              : '同行不等于补建测站，也不替苏岚作出新的接班承诺。';
            for (const role of selected) {
              sourceIds.push(role.source.record.id, role.root.record.id);
              const stopped = unique(history, `${role.institution.kind}-unattended`);
              if (actionId === 'recruit_risk' && stopped?.kind === 'maintenance' && stopped.year === 16
                && stopped.cellId === 'D4' && stopped.parentId === role.root.event.id) {
                sourceIds.push(stopped.id);
                card.responsibility = `第16年的${role.institution.kind === 'station' ? '测站' : '档案站'}停运告示仍在，后来恢复的产出不能抹去这段空缺。`;
              }
            }
          } else if (actionId === 'authorize_training' && getTrainingAuthorizationContracts(state).find(c=>c.eventId===event.id)?.workload) {
            const contract=getTrainingAuthorizationContracts(state).find(c=>c.eventId===event.id);
            const target=institutions.find(i=>i.id===contract.target.id);
            const known=target&&typeof target.active==='boolean'&&Number.isFinite(target.maintenance)&&target.maintenance>=0&&target.maintenance<=1;
            card.outcome=`第${event.year}年，原东岸学徒按已协商的条件留下本地承接签名，并重排原点职责：保留基本读尺与预警，减少深入带教，承担公开议事和生计协调，没有新建学校或增加人手。`;
            card.responsibility='协商经费不是购买或代签同意；政治、经济来源提高，科学来源降低，是这份具体排班的取舍，不是给权利打分。不新建学校或增加人手、预警覆盖、异源校验、河港信任或交班方针。'+(!known?'当前运转情况未知，不能从签署推定今天仍有来源。':!target.active||target.maintenance===0?'原点当前停运，改排记录仍在，当前不再提供年度来源。':`当前排班的实际来源仍乘原点维护系数${target.maintenance}，不保证今后一直运转。`);
          } else {
            card.outcome = `第${event.year}年，${OUTCOMES[actionId] || '这项安排已有成功兑现记录'}。`;
            card.responsibility = RESPONSIBILITIES[actionId] || '兑现过的安排仍需持续承担，不等于未来的工作已经完成。';
          }
        }
      }
      if (aftermath) { card.responsibility += aftermath; sourceIds.push(impact.id); }
      card.sourceIds = [...new Set(sourceIds)];
      return card;
    });
  return { start, end, title: `第${start}至${end}年 · 留下的选择`,
    summary: '把上一窗口作出的选择，与真正留下的结果和仍需承担的责任放在一起。', cards };
}
