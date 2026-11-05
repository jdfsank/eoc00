import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, getActions, getActors, lockTask, passTask, unlockTask, commitWindow, advanceYear, advanceToNextWindow, validateState, traceEvent, getEnding, randomFor } from '../src/simulation.js';
const evidence = ['independent_flood_records', 'unfunded_maintenance', 'successor_consent', 'anomaly_records', 'resident_testimony', 'old_reality_record'];
function choose(s, id, location = 'D4', actor = 'protagonist') { lockTask(s, actor, location, id, evidence); }
function submit(s) { for (const a of getActors(s)) if (!s.drafts[a.id]) passTask(s, a.id); commitWindow(s); }
function build(seed = 12) { const s = createRun(seed); choose(s, 'build_joint'); submit(s); advanceToNextWindow(s); return s; }
function successSeed() { for (let n = 0; n < 100; n++) if (randomFor(n, 'event:action:0:protagonist:D4:build_joint') < .7) return n; }
function failureSeed() { for (let n = 0; n < 100; n++) if (randomFor(n, 'event:action:0:protagonist:D4:build_joint') >= .7) return n; }
test('64 fixed cells, four independent bounded channels, initial single actor', () => { const s = createRun(); assert.equal(s.cells.length, 64); assert.equal(getActors(s).length, 1); assert.deepEqual(s.cells.find(c => c.id === 'D4').channels, { politics: 48, economy: 52, science: 30, religion: 44 }); assert.equal(validateState(s).valid, true); });
test('drafts are reversible and do not pay costs or create events', () => { const s = createRun(); const cells = structuredClone(s.cells); choose(s, 'build_joint'); assert.deepEqual(s.cells, cells); assert.equal(s.events.length, 0); unlockTask(s, 'protagonist'); assert.deepEqual(s.drafts, {}); assert.throws(() => lockTask(s, 'protagonist', 'D4', 'build_joint'), /证据/); });
test('atomic submission rejects missing actors and conflicting cell tasks without mutation', () => { const s = build(successSeed()); choose(s, 'recruit_successor'); submit(s); advanceToNextWindow(s); choose(s, 'free_warning'); let before = JSON.stringify(s); assert.throws(() => commitWindow(s), /全部棋子/); assert.equal(JSON.stringify(s), before); choose(s, 'present_archive', 'D4', 'linche'); before = JSON.stringify(s); assert.throws(() => commitWindow(s), /冲突/); assert.equal(JSON.stringify(s), before); });
test('atomic submission rejects unaffordable costs and duplicate submission', () => { const s = createRun(); choose(s, 'build_joint'); s.cells.find(c => c.id === 'D4').channels.economy = 0; const before = JSON.stringify(s); assert.throws(() => commitWindow(s), /不足/); assert.equal(JSON.stringify(s), before); s.cells.find(c => c.id === 'D4').channels.economy = 52; commitWindow(s); assert.equal(s.cells.find(c => c.id === 'D4').channels.economy, 46); const committed = JSON.stringify(s); assert.throws(() => commitWindow(s)); assert.equal(JSON.stringify(s), committed); });
test('one due-year roll; failure becomes persistent archive without training chain', () => { const s = createRun(failureSeed()); choose(s, 'build_joint'); submit(s); advanceYear(s); advanceYear(s); assert.equal(s.events[0].status, 'pending'); assert.equal(s.institutions.length, 0); advanceYear(s); assert.equal(s.events[0].status, 'failed'); const roll = s.events[0].roll; assert.equal(s.institutions[0].kind, 'archive'); while (s.phase === 'playback') advanceYear(s); assert.equal(s.events[0].roll, roll); assert.equal(s.events.length, 1); assert.ok(s.cells.find(c => c.id === 'D4').channels.science > 30); });
test('successful authored chain links D4 → E4 → F6 and provenance survives', () => { const s = build(successSeed()); assert.ok(s.institutions.some(i => i.cellId === 'E4')); choose(s, 'renew_charter'); submit(s); advanceToNextWindow(s); const branch = s.events.find(e => e.actionId === 'branch'); assert.equal(branch.year, 12); assert.equal(branch.status, 'success'); assert.deepEqual(traceEvent(s, branch.id).map(e => e.cellId), ['D4', 'D4', 'E4', 'F6']); assert.equal(s.flags.renewed, true); });
test('recruit has consent, next-window availability, and a maintenance tradeoff', () => { const s = build(successSeed()); choose(s, 'recruit_risk'); submit(s); advanceYear(s); assert.equal(s.actors.length, 2); assert.equal(getActors(s).length, 1); assert.equal(getActions(s, 'D4', 'linche').length, 0); const before = s.cells.find(c => c.id === 'D4').channels.science; advanceToNextWindow(s); assert.equal(getActors(s).length, 2); assert.equal(s.institutions.find(i => i.kind === 'station').active, false); assert.ok(s.cells.find(c => c.id === 'D4').channels.science > 30); assert.ok(before > 30); assert.ok(s.institutions.find(i => i.kind === 'branch').active); });
test('annual same-snapshot update is independent of cell traversal', () => { const a = createRun(successSeed()); choose(a, 'build_joint'); submit(a); const b = structuredClone(a); b.cells.reverse(); for (let y = 1; y <= 10; y++) { advanceYear(a); advanceYear(b, { reverse: true }); } const canonical = s => s.cells.map(c => [c.id, c.channels]).sort((a, b) => a[0].localeCompare(b[0])); assert.deepEqual(canonical(a), canonical(b)); assert.deepEqual(a.events, b.events); });
test('reloaded save and accelerated playback produce identical histories and outcomes', () => { const a = createRun(12); choose(a, 'build_joint'); submit(a); const b = JSON.parse(JSON.stringify(a)); advanceToNextWindow(a); for (let i = 0; i < 10; i++) advanceYear(b); assert.deepEqual(a, b); assert.equal(validateState(b).valid, true); });
test('crisis warns at14 and allows year20 intervention before irreversible23', () => { const s = build(successSeed()); submit(s); while (s.year < 14) advanceYear(s); assert.deepEqual([s.flags.crisis.warningYear, s.flags.crisis.irreversibleYear], [14, 23]); advanceToNextWindow(s); choose(s, 'independent_review', 'F6'); submit(s); while (s.year < 23) advanceYear(s); assert.equal(s.flags.crisis.status, 'averted'); assert.equal(s.flags.crisis.irreversibleYear, 23); });
test('crisis fallback is reachable even when no original station exists', () => { const s = createRun(); submit(s); advanceToNextWindow(s); submit(s); advanceToNextWindow(s); assert.ok(getActions(s, 'B4').some(a => a.id === 'independent_review')); choose(s, 'local_veto', 'B4'); submit(s); advanceToNextWindow(s); assert.equal(s.flags.crisis.status, 'contained'); });
test('cancelled prerequisite preserves event identity and already-paid source history', () => { const s = createRun(successSeed()); choose(s, 'build_joint'); submit(s); while (s.year < 3) advanceYear(s); s.institutions[0].active = false; while (s.year < 7) advanceYear(s); const event = s.events.find(e => e.actionId === 'training'); assert.equal(event.status, 'cancelled'); assert.ok(traceEvent(s, event.id).length >= 3); assert.equal(s.events.some(e => e.actionId === 'branch'), false); });
test('terminal policy depends on prior capacity, never claims extinction', () => { const s = createRun(); for (const year of [0, 10, 20, 30]) { assert.equal(s.year, year); if (year === 30) choose(s, 'share_power'); submit(s); advanceToNextWindow(s); } assert.equal(s.phase, 'ended'); assert.equal(getEnding(s).title, '纸上的共同作者'); assert.ok(getEnding(s).text.includes('不是物种灭绝')); assert.equal(validateState(s).valid, true); assert.throws(() => advanceYear(s)); });
test('save validation detects malformed coordinates, bounds and duplicate stable ids', () => { const s = createRun(); s.cells[0].id = 'D4'; s.cells[1].channels.science = NaN; s.actors.push(structuredClone(s.actors[0])); assert.equal(validateState(s).valid, false); });
test('all three governance variants have costs, single due time and failure branches', () => { for (const [id, cost, due, p] of [['build_merchant', 3, 2, .85], ['build_state', 4, 3, .8], ['build_joint', 6, 3, .7]]) { const s = createRun(); const a = getActions(s, 'D4').find(a => a.id === id); assert.equal(a.cost.economy, cost); assert.equal(a.dueIn, due); assert.equal(a.probability, p); } });

test('hostile or truncated save inputs fail validation without crashing', () => { for (const s of [null, {}, {version: 'afterwave.run.v1', cells: {}}, {...createRun(), baseline: {}}, {...createRun(), cells: [null]}]) assert.equal(validateState(s).valid, false); });

test('recruit without successor halves the failed-build archive output and shuts it at16', () => {
  const s = build(6);
  assert.equal(s.institutions[0].kind, 'archive');
  choose(s, 'recruit_risk'); submit(s); advanceYear(s);
  const staffed = structuredClone(s); staffed.flags.successor = true;
  advanceYear(s); advanceYear(staffed);
  const science = state => state.cells.find(c => c.id === 'D4').channels.science;
  assert.ok(Math.abs(science(staffed) - science(s) - .175) < .00001);
  while (s.year < 16) advanceYear(s);
  assert.equal(s.institutions[0].active, false);
  const record = s.history.find(event => event.id === 'archive-unattended');
  assert.equal(record.parentId, s.institutions[0].sourceEventId);
  assert.match(record.text, /档案站停运/);
  advanceToNextWindow(s);
  assert.equal(getActors(s).length, 2);
  assert.equal(validateState(s).valid, true);
});
test('arranging a successor preserves the failed-build archive after recruitment', () => {
  const s = build(6); choose(s, 'recruit_successor'); submit(s); advanceToNextWindow(s);
  assert.equal(s.institutions[0].active, true);
  assert.equal(s.history.some(event => event.id === 'archive-unattended'), false);
  assert.equal(getActors(s).length, 2);
});
