// Authored workload assumptions, not measured productivity or interchangeable
// money. Reassignment replaces teaching work; it never creates another person.
export const TRAINING_WORKLOAD_RULES = Object.freeze({
  version: 'training-workload-v1',
  before: Object.freeze({politics:.1, economy:.25, science:.7, religion:.1}),
  after: Object.freeze({politics:.5, economy:.45, science:.1, religion:.1}),
});
const KEYS = ['politics', 'economy', 'science', 'religion'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const usesTrainingWorkloadRules = state => state?.trainingWorkloadRulesVersion === TRAINING_WORKLOAD_RULES.version;
export const trainingWorkloadMarker = row => object(row) && ['trainingWorkload', 'trainingWorkloadVersion', 'trainingWorkloadRulesVersion'].some(key => key in row);
export const validAnnualSource = source => object(source) && KEYS.every(key => Number.isFinite(source[key]) && source[key] >= 0);
const sameSource = (a, b) => validAnnualSource(a) && validAnnualSource(b) && Object.keys(a).length === KEYS.length && Object.keys(b).length === KEYS.length && KEYS.every(key => a[key] === b[key]);
export const supportsTrainingWorkload = institution => sameSource(institution?.annualSource, TRAINING_WORKLOAD_RULES.before);

export function makeTrainingWorkload(institution) {
  if (!supportsTrainingWorkload(institution)) return null;
  return {version:TRAINING_WORKLOAD_RULES.version, targetId:institution.id,
    before:{...TRAINING_WORKLOAD_RULES.before}, after:{...TRAINING_WORKLOAD_RULES.after}};
}
export function validTrainingWorkload(workload, targetId) {
  return object(workload) && Object.keys(workload).length === 4
    && workload.version === TRAINING_WORKLOAD_RULES.version && workload.targetId === targetId
    && sameSource(workload.before, TRAINING_WORKLOAD_RULES.before)
    && sameSource(workload.after, TRAINING_WORKLOAD_RULES.after);
}

// The authorization verifier supplies only its already identified contract and
// target. No hidden investigation inventory, random draws or prose are read.
export function validTrainingWorkloadContract(state, event, action, outcome, target) {
  const rows = [event, action, ...(outcome ? [outcome] : [])];
  if (!usesTrainingWorkloadRules(state)) return rows.every(row => !trainingWorkloadMarker(row));
  if (!rows.every(row => row && validTrainingWorkload(row.trainingWorkload, event.trainingAuthorizationTarget?.id)
    && row.trainingWorkloadVersion === undefined && row.trainingWorkloadRulesVersion === undefined)) return false;
  // A custom source without a contract remains a legal world. Once this fixed
  // assignment is contracted, changing its retained base would falsify it.
  return !target || supportsTrainingWorkload(target);
}

export function getWorkloadComparison(before, after, maintenance, {version=null, mode='authorize-only', targetId=null}={}) {
  if (!validAnnualSource(before) || !validAnnualSource(after) || !Number.isFinite(maintenance) || maintenance < 0 || maintenance > 1) return null;
  const round = number => Math.round(number * 1e8) / 1e8;
  const delta = Object.fromEntries(KEYS.map(key => [key, round(after[key] - before[key])]));
  const scale = source => Object.fromEntries(KEYS.map(key => [key, round(source[key] * maintenance)]));
  return {version, mode, targetId, before:{...before}, after:{...after}, delta, maintenance,
    scaledBefore:scale(before), scaledAfter:scale(after), scaledDelta:scale(delta)};
}
