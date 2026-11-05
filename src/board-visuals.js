// One absolute scale for the world layer and its legend. Values are capacities,
// not percentages of four mutually exclusive factions.
export const HEAT_BANDS = Object.freeze([
  { min: 0, max: 20, label: '0–<20' },
  { min: 20, max: 40, label: '20–<40' },
  { min: 40, max: 60, label: '40–<60' },
  { min: 60, max: 80, label: '60–<80' },
  { min: 80, max: 100, label: '80–100' },
]);
export const HEAT_PALETTES = Object.freeze({
  politics: ['#3c4440', '#65584b', '#8a6759', '#b67967', '#e18c76'],
  economy: ['#3b463d', '#616449', '#89835a', '#b0a367', '#dfc36b'],
  science: ['#304b49', '#406a61', '#51877b', '#60a493', '#72c1b5'],
  religion: ['#41484d', '#5d5e70', '#7b7695', '#9990b7', '#b7a4da'],
});
export function heatBandIndex(value) {
  const bounded = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return Math.min(HEAT_BANDS.length - 1, Math.floor(bounded / 20));
}
export function heatColor(channel, value) {
  return (HEAT_PALETTES[channel] || HEAT_PALETTES.science)[heatBandIndex(value)];
}

const PROP = { station: 'water_station', branch: 'water_station', training: 'riverside_school', school: 'riverside_school', mutual: 'warehouse', archive: 'archive', independent: 'archive' };
const PRIORITY = ['station', 'branch', 'school', 'training', 'warning', 'mutual', 'archive', 'independent'];

// This is a view of existing simulation facts. It must not award warning
// coverage, repair a station, or treat a failed review's records as success.
export function institutionVisual(state, cellId) {
  const all = state.institutions.filter(item => item.cellId === cellId);
  if (!all.length) return null;
  const working = all.filter(item => item.active !== false && item.maintenance > 0);
  const candidates = working.length ? working : all;
  const institution = [...candidates].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind) || b.startYear - a.startYear)[0];
  const halted = institution.active === false || institution.maintenance <= 0;
  const staffingGap = !halted && cellId === 'D4' && ['station', 'archive'].includes(institution.kind) && !!state.flags.recruited && !state.flags.successor;
  const degraded = !halted && (institution.maintenance < 1 || staffingGap);
  const restricted = !halted && ['station', 'branch'].includes(institution.kind) && institution.open === false;
  const recordsOnly = ['archive', 'independent'].includes(institution.kind);
  const unverified = institution.kind === 'independent' && state.events.some(event => event.id === institution.sourceEventId && event.status === 'failed');
  const status = halted ? 'halted' : degraded ? 'degraded' : 'operating';
  const parts = halted ? ['停运', '原址建筑保留']
    : [staffingGap ? '维护者缺席' : degraded ? '维护不足' : recordsOnly ? '记录维护中' : institution.kind === 'warning' ? '居民钟报运行中' : '制度运行中'];
  if (restricted) parts.push('收费门槛');
  if (unverified) parts.push('校验尚未成功');
  else if (recordsOnly && !halted) parts.push('档案不等于预警服务');
  const prop = ['school', 'training'].includes(institution.kind) && cellId === 'D5' ? 'bank_reading_circle' : PROP[institution.kind] || null;
  return { institutionId: institution.id, kind: institution.kind, prop, status, halted, degraded, staffingGap, restricted, recordsOnly, unverified, label: parts.join(' · ') };
}
