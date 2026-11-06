import { CHANNELS, EVIDENCE, WINDOWS, getActions, getActors, traceEvent, validateState, usesLegacyCrisisRules, usesTradeoffs, getInvestigation } from './simulation.js';

const SCREENS = ['world', 'list', 'avg', 'visit', 'choice', 'confirm', 'window', 'playback', 'review', 'archive', 'trace', 'ending', 'settings'];
const FILTERS = ['all', 'action', 'history', 'risk'];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function createUi() {
  return { screen: 'world', selected: 'D4', channel: 'science', actor: 'protagonist', focus: false, filter: 'all', query: '', sessions: {}, bigText: false, sound: false };
}

// UI data is optional and untrusted. Recover the run without letting stale or
// malformed navigation state reach rendering, evidence collection or autosave.
export function normalizeUi(state, saved) {
  const ui = createUi();
  if (!isRecord(saved)) return ui;
  const cellIds = new Set(state.cells.map(cell => cell.id));
  const actors = getActors(state);
  if (cellIds.has(saved.selected)) ui.selected = saved.selected;
  if (CHANNELS.includes(saved.channel)) ui.channel = saved.channel;
  ui.actor = actors.find(actor => actor.id === saved.actor)?.id || actors[0]?.id || 'protagonist';
  if (SCREENS.includes(saved.screen)) ui.screen = saved.screen;
  if (FILTERS.includes(saved.filter)) ui.filter = saved.filter;
  if (typeof saved.query === 'string') ui.query = saved.query;
  for (const key of ['focus', 'bigText', 'sound', 'cellHistory']) {
    if (typeof saved[key] === 'boolean') ui[key] = saved[key];
  }
  if (isRecord(saved.sessions)) {
    for (const [key, session] of Object.entries(saved.sessions)) {
      const [year, actorId, cellId, extra] = key.split(':');
      const actor = state.actors.find(candidate => candidate.id === actorId);
      if (extra !== undefined || !WINDOWS.some(window => String(window) === year) || Number(year) > state.year || !actor || actor.availableFrom > Number(year) || !cellIds.has(cellId) || !isRecord(session)) continue;
      const evidence = Array.isArray(session.evidence)
        ? [...new Set(session.evidence.filter(id => typeof id === 'string' && Object.hasOwn(EVIDENCE, id)))].slice(0, 3)
        : [];
      const budget = Number.isInteger(session.budget) && session.budget >= 0 && session.budget <= 3 ? session.budget : 3;
      ui.sessions[key] = { evidence, budget: Math.min(budget, 3 - evidence.length) };
    }
  }
  if (usesTradeoffs(state)) {
    // UI can be dropped or corrupted without restoring a spent investigation.
    ui.sessions = {};
    for (const [key, entries] of Object.entries(state.investigations)) {
      const [year, actorId] = key.split(':');
      const atWindow = { ...state, year: Number(year) };
      for (const cellId of new Set(entries.map(e => e.cellId))) ui.sessions[`${key}:${cellId}`] = getInvestigation(atWindow, actorId, cellId);
    }
  }
  if (getActions(state, ui.selected, ui.actor).some(action => action.id === saved.choice)) ui.choice = saved.choice;
  if (typeof saved.traceId === 'string' && [...state.history, ...state.events].some(event => event.id === saved.traceId)) {
    ui.traceId = saved.traceId;
    if (Array.isArray(saved.mapTrace)) ui.mapTrace = traceEvent(state, saved.traceId);
  }
  if (ui.screen === 'playback' && state.phase !== 'playback') ui.screen = state.phase === 'ended' ? 'ending' : 'review';
  if (['avg', 'choice', 'confirm'].includes(ui.screen) && state.phase !== 'planning') ui.screen = 'world';
  if (['choice', 'confirm'].includes(ui.screen) && !ui.choice) ui.screen = 'avg';
  if (ui.screen === 'visit' && !['B4', 'D4', 'E4', 'D5', 'F6'].includes(ui.selected)) ui.screen = 'world';
  if (ui.screen === 'ending' && state.phase !== 'ended') ui.screen = 'world';
  if (ui.screen === 'trace' && !ui.traceId) ui.screen = 'archive';
  return ui;
}

export function restoreSave(data, { imported = false } = {}) {
  const check = validateState(data?.state);
  if (!check.valid) throw new Error('不兼容或损坏的存档：' + check.errors.join('、'));
  let state = data.state;
  // The old free-warning outcome promised funded upkeep but did not restore its
  // staffing flag after risky recruitment. Repair that verified commitment only;
  // keep old crisis rules and every already-resolved impact record unchanged.
  if (usesLegacyCrisisRules(state) && state.flags.freeWarning && !state.flags.successor
    && state.institutions.some(i => i.kind === 'station' && i.cellId === 'D4' && i.active)
    && state.events.some(e => e.actionId === 'free_warning' && e.status === 'success' && e.year <= state.year)) {
    state = structuredClone(state); state.flags.successor = true;
  }
  const ui = normalizeUi(state, data.ui);
  if (imported) ui.screen = 'world';
  return { state, ui };
}
