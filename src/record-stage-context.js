// Presentation-only public provenance. No prose, RNG, snapshots, or simulation
// helpers are read. Accessors are not evaluated, even on malformed imports.
const read = (object, key) => object && typeof object === 'object'
  ? Object.getOwnPropertyDescriptor(object, key)?.value : undefined;
const year = value => Number.isInteger(value) && value >= 0 && value <= 40;
const keys = ['id', 'year', 'kind', 'status', 'parentId', 'sourceActionId', 'cellId', 'actionId', 'actorId', 'reality', 'resolvedYear'];
const same = (a, b) => keys.every(key => read(a, key) === read(b, key));

export function getRecordStageContext(state, record) {
  const now = read(state, 'year'), history = read(state, 'history'), events = read(state, 'events');
  if (!year(now) || !Array.isArray(history) || !Array.isArray(events)) return null;
  const all = [...history, ...events];
  const unique = id => {
    const rows = all.filter(row => read(row, 'id') === id);
    return rows.length === 1 ? rows[0] : null;
  };
  const item = unique(read(record, 'id'));
  if (!item || !same(item, record)) return null;
  const sourceId = read(item, 'sourceActionId');
  const match = typeof sourceId === 'string' && /^action:(0|10|20|30):([^:]+):([A-H][1-8]):([^:]+)$/.exec(sourceId);
  if (!match) return null;
  const [, date, actor, cell, actionId] = match, sourceYear = Number(date);
  const source = unique(sourceId);
  const optional = (row, key, expected) => read(row, key) === undefined || read(row, key) === expected;
  if (!source || !history.includes(source) || sourceYear > now || read(source, 'year') !== sourceYear
    || read(source, 'kind') !== 'action' || read(source, 'status') !== 'confirmed'
    || read(source, 'parentId') !== null || read(source, 'sourceActionId') !== sourceId
    || read(source, 'cellId') !== cell || !optional(source, 'actorId', actor)
    || !optional(source, 'actionId', actionId) || read(source, 'reality') !== 'R1'
    || history.some(row => read(row, 'id') === `pass:${sourceYear}:${actor}`)
    || history.filter(row => typeof read(row, 'id') === 'string'
      && read(row, 'id').startsWith(`action:${sourceYear}:${actor}:`)).length !== 1) return null;
  const rootId = `event:${sourceId}`;
  const checked = new Set();
  function verifyEvent(event) {
    if (!event || checked.has(event) || !events.includes(event) || unique(read(event, 'id')) !== event) return false;
    checked.add(event);
    const id = read(event, 'id'), due = read(event, 'year'), status = read(event, 'status');
    if (read(event, 'kind') !== 'event' || read(event, 'sourceActionId') !== sourceId
      || !year(due) || due <= sourceYear || !optional(event, 'reality', 'R1')) return false;
    if (id === rootId) {
      if (read(event, 'parentId') !== sourceId || read(event, 'cellId') !== cell
        || read(event, 'actionId') !== actionId || !optional(event, 'actorId', actor)) return false;
    } else {
      const training = id === `${rootId}:training`, branch = id === `${rootId}:training:branch`;
      if ((!training && !branch) || sourceYear !== 0 || cell !== 'D4'
        || !['build_joint', 'build_state', 'build_merchant'].includes(actionId)
        || read(event, 'actionId') !== (training ? 'training' : 'branch')
        || read(event, 'cellId') !== (training ? 'E4' : 'F6') || due !== (training ? 7 : 12)
        || read(event, 'parentId') !== (training ? rootId : `${rootId}:training`)) return false;
      const parent = unique(read(event, 'parentId'));
      if (!verifyEvent(parent) || read(parent, 'status') !== 'success' || read(parent, 'year') >= due) return false;
    }
    const outcome = unique(`resolved:${id}`);
    if (status === 'pending') return due > now && read(event, 'resolvedYear') === undefined && !outcome
      && !all.some(row => read(row, 'parentId') === id && history.includes(row));
    if (!['success', 'failed', 'cancelled'].includes(status) || due > now || read(event, 'resolvedYear') !== due
      || !outcome || !history.includes(outcome) || read(outcome, 'year') !== due) return false;
    return read(outcome, 'kind') === ({ success: 'outcome', failed: 'failure', cancelled: 'cancelled' })[status]
      && read(outcome, 'status') === status && read(outcome, 'parentId') === id
      && read(outcome, 'sourceActionId') === sourceId && read(outcome, 'cellId') === read(event, 'cellId')
      && read(outcome, 'reality') === 'R1' && optional(outcome, 'actionId', read(event, 'actionId'))
      && optional(outcome, 'actorId', actor)
      && history.filter(row => read(row, 'parentId') === id && ['outcome', 'failure', 'cancelled'].includes(read(row, 'kind'))).length === 1;
  }
  const kind = read(item, 'kind');
  const event = kind === 'action' ? unique(rootId) : kind === 'event' ? item : unique(read(item, 'parentId'));
  if (!verifyEvent(event)) return null;
  if (kind === 'action') return { kind: 'submitted', label: '已提交的行动', note: `第${sourceYear}年提交的安排；提交不等于已经兑现。` };
  if (kind === 'event') return { kind: 'scheduled', label: '合同约定的节点', note: `约定在第${read(event, 'year')}年核对或兑现；此卡是安排节点，实际结果以兑现记录为准。` };
  if (item !== unique(`resolved:${read(event, 'id')}`)) return null;
  const status = read(item, 'status');
  return { kind: status, label: { success: '实际结果：成功', failed: '实际结果：失败', cancelled: '实际结果：取消' }[status],
    note: `第${read(item, 'year')}年的实际结算记录，与前面的合同约定分开阅读。` };
}
