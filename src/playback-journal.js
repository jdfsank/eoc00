// Presentation-only journal. Only already-published history is read here.
// In particular, do not inspect events, seed/roll, flags, institutions or
// snapshots to predict a result or fill an absent historical record.
const BOUNDARIES = [10, 20, 30];
const STATUSES = new Set(['confirmed', 'success', 'failed', 'cancelled']);
const NON_TURNS = new Set(['arrival', 'action', 'pass', 'simulation']);
const COPY = Object.freeze({
  warning: {
    label: '风险预警',
    summary: '预警提出了待处理的风险，还不是已经发生的损失；实际回应与清点要分别查看。',
  },
  crisis: {
    label: '实际清点',
    summary: '清点已经入档。哪些影响实际发生、哪些被避免，以这份记录为准，不从后来的恢复补写过去。',
  },
  failure: {
    label: '未完成',
    summary: '这份安排留下了未完成的记录。计划不是成果，后续工作仍需另作安排。',
  },
  cancelled: {
    label: '安排取消',
    summary: '原定安排留下了取消记录，不能当作已经兑现；具体原因与留下的责任仍在原页。',
  },
  maintenance: {
    label: '维护变化',
    summary: '已经启用过的服务又有了维护记录。曾经建成，不等于此后一直有人和经费接续。',
  },
  outcome: {
    label: '兑现记载',
    summary: '这项安排已有兑现记载。它留下了什么、谁实际承担了工作，仍以原始记录为准。',
  },
  reality: {
    label: '人物与旧档',
    summary: '旧现实与当前意愿须分开阅读，不能用旧履历替今天的人作出选择。',
  },
  choice: {
    label: '新窗口的问题',
    summary: '新的介入问题已经写入记录。它提出需要面对的工作，不替任何人作出本轮选择。',
  },
  ending: {
    label: '阶段已归档',
    summary: '这一阶段已经留下结局记录。已发生的选择与代价仍在，不因最后的题名而改写。',
  },
  unknown: {
    label: '记录待核',
    summary: '这条已存记载的类别或状态不足，按原文保留，不补成成功、失败或人物同意。',
  },
});

const validYear = year => Number.isInteger(year) && year >= 0 && year <= 40;
const text = value => typeof value === 'string' && value.trim() ? value : null;
const clone = value => structuredClone(value);
const PUBLIC_FIELDS = ['id', 'year', 'cellId', 'title', 'text', 'description', 'reason',
  'kind', 'status', 'parentId', 'sourceActionId', 'reality', 'dueYear', 'type'];
// Original history stays untouched. Event cards need only these public scalar
// fields; copying an arbitrary row could inspect a private RNG getter.
function publicRecord(record) {
  const result = {};
  for (const key of PUBLIC_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) continue;
    const value = descriptor.value;
    if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) result[key] = value;
  }
  return result;
}

function position(state) {
  if (!state || !validYear(state.year)) return null;
  const year = state.year;
  const isBoundary = (state.phase === 'planning' && BOUNDARIES.includes(year))
    || (state.phase === 'ended' && year === 40);
  if (!isBoundary && !(state.phase === 'playback' && year < 40)) return null;
  const start = isBoundary ? year - 10 : Math.floor(year / 10) * 10;
  return { year, start, end: year, isBoundary, nextWindow: year === 40 ? null : isBoundary ? year : start + 10 };
}

// Filter by the public clock before reading any other field. An unpublished
// future row, even one reusing today's ID, must not change today's journal.
// Within the reached current reality, duplicate identity is rejected as a group.
function visibleHistory(state) {
  if (!state || !validYear(state.year)) return { records: [], incomplete: false };
  if (!Array.isArray(state.history)) return { records: [], incomplete: true };
  let incomplete = false;
  const candidates = [], counts = new Map();
  for (const raw of state.history) {
    if (!raw || typeof raw !== 'object') { incomplete = true; continue; }
    const year = raw.year;
    if (Number.isFinite(year) && year > state.year) continue;
    if (!validYear(year)) { incomplete = true; continue; }
    if (raw.reality !== undefined && raw.reality !== 'R1') continue;
    if (raw.status === 'pending') continue;
    const record = publicRecord(raw);
    if (!text(record.id) || (record.status !== undefined && !STATUSES.has(record.status))) {
      incomplete = true; continue;
    }
    candidates.push(record);
    counts.set(record.id, (counts.get(record.id) || 0) + 1);
  }
  const records = candidates.filter(record => {
    if (counts.get(record.id) === 1) return true;
    incomplete = true; return false;
  });
  return { records: records.sort((a, b) => a.year - b.year), incomplete };
}

function category(record) {
  if (NON_TURNS.has(record.kind)) return null;
  const resultStatus = { outcome: 'success', failure: 'failed', cancelled: 'cancelled' }[record.kind];
  if (resultStatus) return record.status === resultStatus ? record.kind : 'unknown';
  if (['warning', 'crisis', 'maintenance', 'reality', 'choice', 'ending'].includes(record.kind)) {
    return record.status === undefined || record.status === 'confirmed' ? record.kind : 'unknown';
  }
  return 'unknown';
}

function turn(record) {
  const kind = category(record);
  if (!kind) return null;
  return {
    id: record.id,
    year: record.year,
    cellId: text(record.cellId),
    category: kind,
    title: text(record.title) || text(record.type) || '已存记录',
    ...COPY[kind],
    // This is a historical source, not a synthetic event or a causal claim.
    sourceIds: [record.id],
    record: clone(record),
  };
}

export function getPlaybackJournal(state) {
  const at = position(state);
  if (!at) return null;
  const visible = visibleHistory(state);
  const turns = visible.records.filter(record => record.year > at.start && record.year <= at.end)
    .map(turn).filter(Boolean);
  return {
    ...at,
    currentRecords: visible.records.filter(record => record.year === at.year).map(clone),
    turns,
    pastTurns: turns.filter(item => item.year < at.year).map(clone),
    latestTurn: turns.length ? clone(turns[turns.length - 1]) : null,
    notes: visible.incomplete ? ['部分历史记录缺失或不一致，未据此补写结果；请以可核实的原始记录为准。'] : [],
  };
}

// Capture before the actual annual simulation, then compare afterwards.
// Identity alone is sufficient for this presentation pause: unchanged records,
// future rows, a convenient flag or a changed title cannot trigger a new turn.
export function getPlaybackRecordIds(state) {
  return visibleHistory(state).records.map(record => record.id);
}

export function hasNewPlaybackRecord(beforeIds, state) {
  if (!Array.isArray(beforeIds) || !position(state)) return false;
  const before = new Set(beforeIds.filter(id => typeof id === 'string'));
  return visibleHistory(state).records.some(record => record.year === state.year
    && !before.has(record.id) && category(record) !== null);
}
