const timings = {
  build_merchant: [0, 2], build_state: [0, 3], build_joint: [0, 3],
  restore_archive: [10, 2], renew_charter: [10, 1],
};
const origins = {
  build_merchant: { kind: 'merchant', label: '商会测站' },
  build_state: { kind: 'state', label: '官署测站' },
  build_joint: { kind: 'joint', label: '联合管理测站' },
  restore_archive: { kind: 'rebuilt', label: '重建测站' },
};
const unique = (items, id) => {
  const matches = items.filter(item => item?.id === id);
  return matches.length === 1 ? matches[0] : null;
};

// This is a presentation-only explanation of an existing milestone. Stable
// source links, not current open/maintenance flags, establish how service began.
// Keep the original record and all old engines' contracts exactly as saved.
export function getFeeHistory(state, recordId = 'charter-lapsed') {
  const history = Array.isArray(state?.history) ? state.history : [];
  const events = Array.isArray(state?.events) ? state.events : [];
  const institutions = Array.isArray(state?.institutions) ? state.institutions : [];
  const actors = Array.isArray(state?.actors) ? state.actors : [];
  if (recordId !== 'charter-lapsed' || !history.some(item => item?.id === recordId)) return null;
  const all = [...history, ...events];
  const year = state.year;

  const successfulAction = event => {
    const timing = Object.hasOwn(timings, event?.actionId) ? timings[event.actionId] : null;
    if (!timing || unique(events, event.id) !== event || unique(all, event.id) !== event) return null;
    const [actionYear, delay] = timing;
    const sourceId = `action:${actionYear}:protagonist:D4:${event.actionId}`;
    const action = unique(history, sourceId), outcome = unique(history, `resolved:${event.id}`);
    const actor = unique(actors, 'protagonist');
    const required = event.actionId === 'build_joint' ? ['independent_flood_records', 'unfunded_maintenance'] : [];
    if (event.kind !== 'event' || event.status !== 'success' || event.cellId !== 'D4'
      || event.id !== `event:${sourceId}` || event.sourceActionId !== sourceId || event.parentId !== sourceId
      || event.year !== actionYear + delay || event.resolvedYear !== event.year
      || !Number.isInteger(year) || event.year > year
      || !actor || !Number.isInteger(actor.availableFrom) || actor.availableFrom > actionYear
      || !action || unique(all, action.id) !== action || action.kind !== 'action' || action.status !== 'confirmed'
      || action.parentId !== null || action.sourceActionId !== sourceId || action.cellId !== 'D4' || action.year !== actionYear
      || !Array.isArray(action.evidence) || !required.every(id => action.evidence.includes(id))
      || (event.evidence !== undefined && (!Array.isArray(event.evidence) || !required.every(id => event.evidence.includes(id))))
      || !outcome || unique(all, outcome.id) !== outcome || outcome.kind !== 'outcome' || outcome.status !== 'success'
      || outcome.parentId !== event.id || outcome.sourceActionId !== sourceId || outcome.cellId !== 'D4' || outcome.year !== event.year
      || action.reality !== 'R1' || outcome.reality !== 'R1'
      || [action, event, outcome].some(item => (item.actorId !== undefined && item.actorId !== 'protagonist')
        || (item.actionId !== undefined && item.actionId !== event.actionId) || (item.reality !== undefined && item.reality !== 'R1'))
      || history.filter(item => item?.kind === 'action' && typeof item.id === 'string' && item.id.startsWith(`action:${actionYear}:protagonist:`)).length !== 1
      || history.some(item => item?.id === `pass:${actionYear}:protagonist`)) return null;
    return { action, event, outcome };
  };

  const item = unique(history, recordId);
  const original = item && unique(all, item.id) === item && item.kind === 'maintenance'
    && item.year === 16 && Number.isInteger(year) && year >= 16 && item.cellId === 'D4'
    && item.sourceActionId === null && item.status === 'confirmed' && item.reality === 'R1'
    && typeof item.parentId === 'string' ? item : null;
  const station = original && unique(institutions.filter(i => i?.kind === 'station' && i.cellId === 'D4'),
    `institution:${original.parentId}:D4`);
  const source = station && successfulAction(unique(events, original.parentId));
  const verified = source && Object.hasOwn(origins, source.event.actionId)
    && station.sourceEventId === source.event.id && station.sourceActionId === source.action.id
    && station.startYear === source.event.resolvedYear && station.startYear < 16
    && unique(institutions, station.id) === station
    && institutions.filter(i => i?.sourceEventId === source.event.id && i.cellId === 'D4').length === 1;
  const renewal = events.find(event => event?.actionId === 'renew_charter' && successfulAction(event));

  const title = '第16年：经费缺口与收费的来路';
  const explanation = '原始条目保留当时的通用措辞。以下按本局可核实的来源补充说明，不改写原文或历史结果。';
  const personNote = '原文的“继任者”不能单独证明发生过个人交接，也不能据此补出苏岚或另一位继任者。个人接班须另有本人同意、实际岗位与兑现记录。';
  const boundary = '这里解释第16年的历史，不以今天的开放或维护状态倒推过去；后来的免费预警、恢复或停运也不会删除这次记录。';
  if (!verified || renewal) {
    const summary = renewal
      ? '这份第16年记录与已兑现的公开续约来源不一致，维护变化的经过未知，不能据此宣称续约后仍发生了经费衰退。'
      : '这份第16年记录缺少一致的测站、建站行动或成功兑现来源。收费何时开始、当时服务如何变化均未知，不能由当前收费牌或制度标记补写。';
    return { title, explanation, status: 'unknown', summary, detail: [summary, personNote, boundary],
      original: original ? structuredClone(original) : null, sources: [], origin: null };
  }
  const definition = origins[source.event.actionId];
  const origin = { kind: definition.kind, year: station.startYear, recordId: source.outcome.id };
  const merchant = definition.kind === 'merchant';
  const summary = merchant
    ? `第${origin.year}年启用的商会测站原本就有收费门槛。第16年的记录反映长期经费缺口与维护下降，不是首次开始收费。`
    : `第${origin.year}年启用的${definition.label}原本公开服务。第16年的记录反映长期经费缺口：服务转为收费，维护也出现下降。`;
  return { title, explanation, status: merchant ? 'merchant-retained' : 'public-restricted', summary,
    detail: [summary, personNote, boundary], original: structuredClone(original),
    sources: structuredClone([source.action, source.outcome]), origin };
}
