import test from 'node:test';
import assert from 'node:assert/strict';
import { HEAT_BANDS, HEAT_PALETTES, heatBandIndex, heatColor, institutionVisual } from '../src/board-visuals.js';
import { createRun, passTask, commitWindow, advanceToNextWindow, advanceYear, randomFor } from '../src/simulation.js';
import { investigateAndLock } from './helpers/play.js';

function built(success = true) {
  let seed = 0;
  while ((randomFor(seed, 'event:action:0:protagonist:D4:build_joint') < .7) !== success) seed++;
  const state = createRun(seed);
  investigateAndLock(state, 'protagonist', 'D4', 'build_joint');
  commitWindow(state); advanceToNextWindow(state);
  return state;
}

test('all four layers use the same five absolute bands including both endpoints', () => {
  assert.equal(HEAT_BANDS.length, 5);
  for (const [value, band] of [[-1, 0], [0, 0], [19.999, 0], [20, 1], [40, 2], [60, 3], [80, 4], [100, 4], [101, 4]]) {
    assert.equal(heatBandIndex(value), band);
    for (const channel of Object.keys(HEAT_PALETTES)) assert.equal(heatColor(channel, value), HEAT_PALETTES[channel][band]);
  }
  const luminance = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  for (const palette of Object.values(HEAT_PALETTES)) {
    for (let n = 1; n < palette.length; n++) assert.ok(luminance(palette[n]) > luminance(palette[n - 1]), 'higher influence is visibly brighter');
  }
});

test('fresh terrain and failed construction do not invent an operating station', () => {
  assert.equal(institutionVisual(createRun(), 'D4'), null);
  const visual = institutionVisual(built(false), 'D4');
  assert.equal(visual.prop, 'archive');
  assert.equal(visual.recordsOnly, true);
  assert.match(visual.label, /档案不等于预警服务/);
});

test('numeric maintenance .7 gives a repair trace and a separate access barrier', () => {
  const state = built(); passTask(state, 'protagonist'); commitWindow(state); advanceToNextWindow(state);
  assert.equal(state.institutions.find(i => i.kind === 'station').maintenance, .7);
  const visual = institutionVisual(state, 'D4');
  assert.equal(visual.status, 'degraded'); assert.equal(visual.restricted, true);
  assert.match(visual.label, /维护不足.*收费门槛/);
});

test('missing successor has an empty duty slot, then a retained closed station', () => {
  const state = built(); investigateAndLock(state, 'protagonist', 'D4', 'recruit_risk'); commitWindow(state); advanceYear(state);
  assert.equal(institutionVisual(state, 'D4').staffingGap, true);
  assert.equal(institutionVisual(state, 'D4').maintenanceGap, false);
  assert.equal(institutionVisual(state, 'D4').degraded, false);
  assert.equal(institutionVisual(state, 'D4').status, 'understaffed');
  advanceToNextWindow(state);
  const before = structuredClone(state), visual = institutionVisual(state, 'D4');
  assert.equal(visual.status, 'halted'); assert.equal(visual.prop, 'water_station');
  assert.match(visual.label, /停运/); assert.deepEqual(state, before);
  assert.equal(institutionVisual(state, 'F6').status, 'operating', 'independent branch survives the source station');
});

test('staffing, upkeep, both causes, halt and restoration stay independently visible', () => {
  const state = built(), station = state.institutions.find(i => i.kind === 'station');
  const initial = structuredClone(state);
  state.flags.recruited = true; state.flags.successor = false;
  let visual = institutionVisual(state, 'D4');
  assert.equal(visual.staffingGap, true); assert.equal(visual.maintenanceGap, false); assert.equal(visual.degraded, false);
  assert.equal(visual.label, '维护者缺席');
  station.maintenance = .7;
  visual = institutionVisual(state, 'D4');
  assert.equal(visual.staffingGap, true); assert.equal(visual.maintenanceGap, true);
  assert.equal(visual.label, '维护者缺席 · 维护不足', 'one cause must not hide the other');
  state.flags.successor = true;
  visual = institutionVisual(state, 'D4');
  assert.equal(visual.staffingGap, false); assert.equal(visual.maintenanceGap, true); assert.equal(visual.label, '维护不足');
  station.active = false; state.flags.successor = false;
  visual = institutionVisual(state, 'D4');
  assert.equal(visual.halted, true); assert.equal(visual.staffingGap, false); assert.equal(visual.maintenanceGap, false);
  assert.equal(visual.label, '停运 · 原址建筑保留');
  station.active = true; station.maintenance = 1; state.flags.successor = true;
  visual = institutionVisual(state, 'D4');
  assert.equal(visual.staffingGap, false); assert.equal(visual.maintenanceGap, false); assert.equal(visual.degraded, false);
  assert.equal(visual.label, institutionVisual(initial, 'D4').label);
});

test('staffing-only failed-build archive has empty record duty without invented roof damage', () => {
  const state = built(false);
  state.flags.recruited = true; state.flags.successor = false;
  const before = structuredClone(state), visual = institutionVisual(state, 'D4');
  assert.equal(visual.recordsOnly, true); assert.equal(visual.staffingGap, true); assert.equal(visual.maintenanceGap, false);
  assert.match(visual.label, /维护者缺席.*档案不等于预警服务/); assert.deepEqual(state, before);
});

test('zero maintenance is halted even when an institution retains its active flag', () => {
  const state = built(); state.institutions.find(i => i.kind === 'station').maintenance = 0;
  assert.equal(institutionVisual(state, 'D4').status, 'halted');
});

test('failed review records are not drawn or labelled as successful warning service', () => {
  const state = createRun();
  state.institutions.push({ id: 'records', kind: 'independent', cellId: 'F6', active: true, maintenance: 1, open: true, startYear: 21, sourceEventId: 'review' });
  state.events.push({ id: 'review', status: 'failed' });
  const visual = institutionVisual(state, 'F6');
  assert.equal(visual.unverified, true); assert.equal(visual.recordsOnly, true); assert.equal(visual.prop, 'archive');
  assert.match(visual.label, /校验尚未成功/);
});

test('resident warning uses a bell, not a fictional station', () => {
  const state = createRun();
  state.institutions.push({ id: 'residents', kind: 'warning', cellId: 'D4', active: true, maintenance: 1, open: true, startYear: 21 });
  const visual = institutionVisual(state, 'D4');
  assert.equal(visual.prop, null); assert.equal(visual.kind, 'warning'); assert.match(visual.label, /居民钟报/);
});

test('education uses low local learning places, never the observatory silhouette', () => {
  for (const kind of ['training', 'school']) {
    for (const [cellId, prop] of [['E4', 'riverside_school'], ['D5', 'bank_reading_circle']]) {
      const state = createRun();
      state.institutions.push({ id: 'learning', kind, cellId, active: true, maintenance: 1, open: true, startYear: 7 });
      assert.equal(institutionVisual(state, cellId).prop, prop);
      state.institutions[0].active = false;
      assert.equal(institutionVisual(state, cellId).prop, prop, 'stopped learning keeps its own physical place');
      assert.equal(institutionVisual(state, cellId).halted, true);
    }
  }
});
