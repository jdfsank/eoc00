import {EVIDENCE, PLANNING_RULES, PORTABLE_EVIDENCE, WINDOWS, evidenceCost, getActors, usesTradeoffs} from './simulation.js';
import {getInvestigationPlan} from './investigation-plan.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const rounds = value => Number.isInteger(value) && value >= 0 && value <= PLANNING_RULES.investigationBudget;
const unique = (rows, key) => new Set(rows.map(row => row[key])).size === rows.length;

// Inspect only this window's real inventory. No hypothetical evidence is ever
// written to a world, draft or investigation session, including a cloned one.
function budgetFor(state, actorId, cellIds) {
  const key = `${state.year}:${actorId}`;
  const entries = Object.hasOwn(state.investigations, key) ? state.investigations[key] : [];
  if (!Array.isArray(entries)) return null;
  const seen = new Set();
  let spent = 0;
  for (const entry of entries) {
    if (!object(entry) || !cellIds.has(entry.cellId) || !Object.hasOwn(EVIDENCE, entry.evidenceId)) return null;
    const key = `${PORTABLE_EVIDENCE.includes(entry.evidenceId) ? 'portable' : entry.cellId}:${entry.evidenceId}`;
    if (seen.has(key)) return null;
    seen.add(key);
    spent += evidenceCost(state, entry.evidenceId);
  }
  const budget = PLANNING_RULES.investigationBudget - spent;
  return rounds(budget) ? budget : null;
}

function unknown(state, cellId, actorId) {
  const named = (rows, id) => Array.isArray(rows) && rows.filter(row => object(row) && row.id === id).length === 1
    ? rows.find(row => row?.id === id) : null;
  const actor = named(state.actors, actorId), origin = named(state.cells, cellId);
  return {readOnly: true, actorId, actorName: text(actor?.name) ? actor.name : '当前角色', budget: null,
    origin: {cellId, name: text(origin?.name) ? origin.name : cellId}, otherActors: [], materials: [],
    issues: ['当前公开资料不完整，暂不能核对跨地取证代价。']};
}

function validPlan(plan, budget) {
  if (!plan || plan.budget !== budget || !Array.isArray(plan.actions) || !Array.isArray(plan.materials)
    || !unique(plan.actions, 'actionId') || !unique(plan.materials, 'id')) return false;
  return plan.materials.every(material => text(material.id) && text(material.name) && rounds(material.cost) && material.cost > 0
    && typeof material.acquired === 'boolean' && typeof material.portable === 'boolean'
    && material.canInvestigate === (!material.acquired && material.cost <= budget))
    && plan.actions.every(action => text(action.actionId) && text(action.title) && rounds(action.requiredRounds)
      && Array.isArray(action.requiredEvidence) && unique(action.requiredEvidence, 'id')
      && action.requiredEvidence.every(material => text(material.id) && rounds(material.cost) && material.cost > 0 && typeof material.acquired === 'boolean')
      && action.requiredEvidence.filter(material => !material.acquired).reduce((sum, material) => sum + material.cost, 0) === action.requiredRounds
      && action.reachable === (action.requiredRounds <= budget) && Array.isArray(action.optionalEnhancements));
}

// Destination-scoped required materials preserve the local testimony boundary.
// A portable purchase can satisfy the same material at another place; an equal
// nonportable evidence ID cannot. Existing inventories come from the public plan.
function afterRounds(requiredRounds, missing, material) {
  const fulfilled = material.portable ? missing.find(item => item.id === material.id) : null;
  return requiredRounds - (fulfilled?.cost || 0);
}

export function getCrossLocationInvestigation(state, cellId, actorId = 'protagonist') {
  if (!state || state.phase !== 'planning' || !WINDOWS.includes(state.year) || !usesTradeoffs(state)) return null;
  if (!Array.isArray(state.cells) || !Array.isArray(state.actors) || !Array.isArray(state.institutions)
    || !Array.isArray(state.events) || !Array.isArray(state.history) || !object(state.flags) || !object(state.investigations)) return unknown(state, cellId, actorId);
  if (state.cells.length !== 64 || !state.cells.every(cell => object(cell) && /^[A-H][1-8]$/.test(cell.id) && text(cell.name)) || !unique(state.cells, 'id')
    || !state.actors.every(actor => object(actor) && text(actor.id) && text(actor.name) && typeof actor.alive === 'boolean' && Number.isInteger(actor.availableFrom) && actor.availableFrom >= 0)
    || !unique(state.actors, 'id') || ![state.institutions, state.events, state.history].every(rows => rows.every(row => object(row) && text(row.id)) && unique(rows, 'id'))) return unknown(state, cellId, actorId);
  const origin = state.cells.find(cell => cell.id === cellId), actors = getActors(state), actor = actors.find(item => item.id === actorId);
  if (!origin || !actor) return null;
  const cellIds = new Set(state.cells.map(cell => cell.id)), budget = budgetFor(state, actorId, cellIds);
  if (budget === null) return unknown(state, cellId, actorId);
  // Existing public action providers own eligibility and old-rule differences.
  // Malformed public source chains must not produce confident route warnings.
  let originPlan, destinations;
  try {
    originPlan = getInvestigationPlan(state, cellId, actorId);
    if (!originPlan) return null;
    if (!validPlan(originPlan, budget)) return unknown(state, cellId, actorId);
    destinations = [];
    for (const cell of state.cells) {
      if (cell.id === cellId) continue;
      const plan = getInvestigationPlan(state, cell.id, actorId);
      if (!plan) continue;
      if (!validPlan(plan, budget)) return unknown(state, cellId, actorId);
      destinations.push({cellId: cell.id, cellName: cell.name, plan});
    }
  } catch {
    return unknown(state, cellId, actorId);
  }
  const materials = originPlan.materials.map(material => {
    const budgetAfter = material.acquired ? budget : material.canInvestigate ? budget - material.cost : null;
    const blocksAfter = [], enhancementsLostAfter = [];
    if (material.canInvestigate) for (const destination of destinations) for (const action of destination.plan.actions) {
      const missing = action.requiredEvidence.filter(item => !item.acquired);
      const requiredRoundsAfter = afterRounds(action.requiredRounds, missing, material);
      const base = {cellId: destination.cellId, cellName: destination.cellName, actionId: action.actionId, title: action.title};
      if (action.reachable && requiredRoundsAfter > budgetAfter) blocksAfter.push({...base,
        requiredRoundsBefore: action.requiredRounds, requiredRoundsAfter, budgetAfter});
      for (const extra of action.optionalEnhancements) {
        if (!extra.reachable || extra.acquired) continue;
        const extraMaterial = destination.plan.materials.find(item => item.id === extra.evidenceId);
        if (!extraMaterial || !rounds(extra.requiredRounds) || extra.requiredRounds > budget) continue;
        const extraMissing = [...missing];
        if (!extraMaterial.acquired && !extraMissing.some(item => item.id === extraMaterial.id)) extraMissing.push(extraMaterial);
        if (extraMissing.reduce((sum, item) => sum + item.cost, 0) !== extra.requiredRounds) continue;
        const remaining = afterRounds(extra.requiredRounds, extraMissing, material);
        if (remaining <= budgetAfter) continue;
        const basicRequiresNoEvidence = action.actionId === 'local_veto' && action.requiredEvidence.length === 0;
        enhancementsLostAfter.push({...base, enhancementId: extra.id, enhancementTitle: extra.title,
          requiredRoundsBefore: extra.requiredRounds, requiredRoundsAfter: remaining, budgetAfter, basicRequiresNoEvidence,
          ...(basicRequiresNoEvidence ? {notice: '基本停闸仍无需取证'} : {})});
      }
    }
    return {id: material.id, name: material.name, cost: material.cost, portable: material.portable,
      acquired: material.acquired, canInvestigate: material.canInvestigate, budgetAfter, blocksAfter, enhancementsLostAfter};
  });
  return {readOnly: true, actorId: actor.id, actorName: actor.name, budget, origin: {cellId: origin.id, name: origin.name},
    otherActors: actors.filter(other => other.id !== actor.id).map(other => ({actorId: other.id, actorName: other.name,
      budget: budgetFor(state, other.id, cellIds)})), materials};
}
