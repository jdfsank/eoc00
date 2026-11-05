import {getInstitutionStaffing} from './simulation.js';
import {farPortVisual} from './far-port-visuals.js';
import {southBankVisual} from './south-bank-visuals.js';
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
  const staffingGap = !halted && getInstitutionStaffing(state,institution).outputReducedNow;
  // Missing people and insufficient physical upkeep are independent facts.
  // Keep degraded as a compatibility alias for physical maintenance only.
  const maintenanceGap = !halted && institution.maintenance < 1;
  const degraded = maintenanceGap;
  const restricted = !halted && ['station', 'branch'].includes(institution.kind) && institution.open === false;
  const recordsOnly = ['archive', 'independent'].includes(institution.kind);
  const unverified = institution.kind === 'independent' && state.events.some(event => event.id === institution.sourceEventId && event.status === 'failed');
  const status = halted ? 'halted' : maintenanceGap ? 'degraded' : staffingGap ? 'understaffed' : 'operating';
  const parts = halted ? ['停运', '原址建筑保留'] : [];
  if (!halted) {
    if (staffingGap) parts.push('维护者缺席');
    if (maintenanceGap) parts.push('维护不足');
    if (!parts.length) parts.push(recordsOnly ? '记录维护中' : institution.kind === 'warning' ? '居民钟报运行中' : '制度运行中');
  }
  if (restricted) parts.push('收费门槛');
  if (unverified) parts.push('校验尚未成功');
  else if (recordsOnly && !halted) parts.push('档案不等于预警服务');
  const prop = ['school', 'training'].includes(institution.kind) && cellId === 'D5' ? 'bank_reading_circle' : PROP[institution.kind] || null;
  const result = { institutionId: institution.id, kind: institution.kind, prop, status, halted, degraded, maintenanceGap, staffingGap, restricted, recordsOnly, unverified, label: parts.join(' · ') };
  if (cellId === 'D5') {
    const south=southBankVisual(state);
    if (south.aid.exists) {
      // Each service's open/closed shape is baked from its own real state.
      // A generic tint or one duty board would wrongly merge those states.
      const halted=!south.aid.active&&!south.teaching.active,maintenanceGap=south.aid.maintenanceGap||south.teaching.maintenanceGap;
      return {...result,prop:south.prop,label:south.label,compound:south,
        halted,maintenanceGap,degraded:maintenanceGap,status:halted?'halted':maintenanceGap?'degraded':'operating'};
    }
  }
  if (cellId === 'F6') {
    const port=farPortVisual(state);
    if(port){
      const halted=!port.branch.active&&!port.failed.active&&!port.check.active;
      const maintenanceGap=port.branch.maintenanceGap||port.check.maintenanceGap;
      return {...result,prop:port.prop,label:port.label,farPort:port,halted,maintenanceGap,degraded:maintenanceGap,status:halted?'halted':maintenanceGap?'degraded':'operating',unverified:port.failed.exists&&!port.check.active};
    }
  }
  return result;
}

// Intent is a separate overlay, never a building or an outcome prediction.
// In particular, do not inspect seeds, rolls, preparation, or probabilities.
// Descendant events belong to a place, not to an actor currently standing there.
export function mapActivity(state, cellId = null) {
  const cells = new Set(state.cells.map(cell => cell.id));
  const visible = id => cells.has(id) && (cellId === null || id === cellId);
  const activities = [];
  if (state.phase === 'planning') {
    for (const actor of state.actors) {
      const draft = state.drafts?.[actor.id];
      if (!actor.alive || actor.availableFrom > state.year || !draft || draft.window !== state.year || draft.status !== 'locked' || !visible(draft.cellId)) continue;
      activities.push({ id: `draft:${actor.id}`, kind: 'draft', cellId: draft.cellId, actorId: actor.id, actorName: actor.name,
        shape: actor.id === 'linche' ? 'circle' : 'square', actionId: draft.actionId,
        label: `${actor.name} · 拟派遣（已锁定，未提交）` });
    }
  }
  for (const event of state.events) {
    if (event.status !== 'pending' || !visible(event.cellId)) continue;
    activities.push({ id: event.id, kind: 'pending', cellId: event.cellId, shape: 'hourglass', dueYear: event.year,
      label: `${event.title} · 第${event.year}年待兑现（尚非结果）` });
  }
  return activities;
}
