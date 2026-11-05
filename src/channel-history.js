// Read-only history, not a simulation or a reconstruction. Only the saved
// snapshot pages and the reached year are consulted; current cells, baseline,
// contracts, institutions and random inputs cannot fill a historical gap.
const CHANNELS = [
  ['politics', '政治'], ['economy', '经济'], ['science', '科学'], ['religion', '宗教'],
];
const CHECKPOINTS = [0, 10, 20, 30, 40];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const validValue = value => Number.isFinite(value) && value >= 0 && value <= 100;
const statusFor = rows => rows.every(row => row.status === 'recorded') ? 'recorded'
  : rows.some(row => row.status === 'recorded') ? 'partial' : 'unknown';

// Subtract the stored decimal representations, rather than rounding the values
// or exposing binary floating-point noise such as -1.4095999999999975. Values
// stay numeric; deltaText preserves the exact decimal difference, even for a
// legitimately stored value with more than the engine's usual four decimals.
function decimalParts(value) {
  const [mantissa, exponent = '0'] = String(value).split('e');
  const [integer, fraction = ''] = mantissa.split('.');
  const scale = fraction.length - Number(exponent);
  return scale < 0 ? { digits: BigInt(integer + fraction) * 10n ** BigInt(-scale), scale: 0 }
    : { digits: BigInt(integer + fraction), scale };
}
function difference(from, to) {
  const a = decimalParts(from), b = decimalParts(to), scale = Math.max(a.scale, b.scale);
  const delta = b.digits * 10n ** BigInt(scale - b.scale) - a.digits * 10n ** BigInt(scale - a.scale);
  if (delta === 0n) return { delta: 0, deltaText: '0' };
  const negative = delta < 0n;
  let digits = String(negative ? -delta : delta).padStart(scale + 1, '0');
  if (scale) digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/0+$/, '').replace(/\.$/, '');
  return { delta: Number(`${negative ? '-' : ''}${digits}`), deltaText: `${negative ? '−' : '+'}${digits}` };
}

function page(year, cellId, raw, reason = null) {
  let values = null;
  if (!reason) {
    if (!Array.isArray(raw)) reason = 'invalid-page';
    else {
      const matches = raw.filter(cell => object(cell) && cell.id === cellId);
      if (matches.length !== 1) reason = matches.length ? 'duplicate-cell' : 'missing-cell';
      else if (!object(matches[0].channels)) reason = 'invalid-channels';
      else values = matches[0].channels;
    }
  }
  const channels = CHANNELS.map(([key, label]) => {
    const value = values && own(values, key) && validValue(values[key]) ? values[key] : null;
    return { key, label, value, valueText: value === null ? '未知' : String(value), status: value === null ? 'unknown' : 'recorded' };
  });
  const status = statusFor(channels);
  if (!reason && status !== 'recorded') reason = 'invalid-channels';
  return {
    year, status, reason, channels,
    summary: status === 'recorded' ? `第${year}年已存四通道记录。`
      : status === 'partial' ? `第${year}年部分通道缺失或非法；缺项保持未知。`
        : `第${year}年记录缺失或不一致；四通道保持未知。`,
  };
}

function compare(from, to) {
  const channels = CHANNELS.map(([key, label], index) => {
    const start = from.channels[index], end = to.channels[index];
    const recorded = start.status === 'recorded' && end.status === 'recorded';
    return {
      key, label, from: start.value, to: end.value,
      fromText: start.valueText, toText: end.valueText,
      status: recorded ? 'recorded' : 'unknown',
      ...(recorded ? difference(start.value, end.value) : { delta: null, deltaText: '未知' }),
    };
  });
  const status = statusFor(channels);
  return {
    fromYear: from.year, toYear: to.year, status, channels,
    summary: status === 'recorded' ? `第${from.year}→${to.year}年：两张已存记录之间的地域净变化。`
      : `第${from.year}→${to.year}年：${status === 'partial' ? '部分' : '全部'}通道因记录缺失或不一致，净变化未知。`,
  };
}

/**
 * Return a detached view of one region's already saved four-channel history.
 * `snapshots` includes every present, reached year, sorted numerically; corrupt
 * pages remain explicit unknowns. `checkpoints` additionally includes missing
 * reached 0/10/20/30/40 pages. `comparisons` pairs adjacent checkpoints only,
 * never substitutes an intermediate page or bridges a missing decade.
 * `latestComparison` is the latest completed ten-year window, even if unknown.
 * No snapshot is created, migrated, repaired, rounded or read from the future.
 */
export function getChannelHistory(state, cellId) {
  const currentYear = state?.year;
  if (!Number.isInteger(currentYear) || currentYear < 0 || currentYear > 40
    || typeof cellId !== 'string' || !/^[A-H][1-8]$/.test(cellId)) return null;
  const saved = object(state.snapshots) ? state.snapshots : {};
  const keysByYear = new Map();
  for (const key of Object.keys(saved)) {
    // Canonical persisted keys are decimal integer strings. An alternate key
    // for the same year makes that page ambiguous, not a second usable record.
    if (!key.trim()) continue;
    const year = Number(key);
    if (!Number.isInteger(year) || year < 0 || year > currentYear) continue;
    if (!keysByYear.has(year)) keysByYear.set(year, []);
    keysByYear.get(year).push(key);
  }
  const snapshots = [...keysByYear].sort(([a], [b]) => a - b).map(([year, keys]) => {
    if (keys.length !== 1) return page(year, cellId, null, 'duplicate-year');
    if (keys[0] !== String(year)) return page(year, cellId, null, 'invalid-year');
    return page(year, cellId, saved[keys[0]]);
  });
  const checkpoints = CHECKPOINTS.filter(year => year <= currentYear)
    .map(year => snapshots.find(snapshot => snapshot.year === year) || page(year, cellId, null, 'missing-page'));
  const comparisons = checkpoints.slice(1).map((to, index) => compare(checkpoints[index], to));
  const latestComparison = comparisons.at(-1) || null;
  const status = latestComparison?.status || (checkpoints[0].status === 'recorded' ? 'pending' : 'unknown');
  return {
    cellId, currentYear, status, title: `${cellId} · 四通道历史`,
    summary: latestComparison ? `最近完成窗口 · ${latestComparison.summary}`
      : '尚未完成首个十年窗口；已有记录如下，缺页保持未知。',
    snapshots, checkpoints, comparisons, latestComparison,
    notes: [
      '只读已存记录，不是未来预测，也不是某项行动单独带来的增减。',
      '第0年保存开局、提交成本前的状态；此后各年保存当年事件、维护、危机与年度产出结算后的状态。',
      '窗口年记录在该年新任务提交前保存；随后提交的费用不会回写这一页，会影响后续年度记录。锁定草案尚未付费。',
      '净变化只比较两张原始记录，包含这段时间实际结算的共同影响；缺页不拿当前值、基线或相邻年份补算。',
      '政治、经济、科学、宗教是分别记录的0—100能力，不相加成份额；通道回升不抵销已记录的历史损失。',
    ],
  };
}
