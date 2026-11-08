const labels = Object.freeze({politics:'政治', economy:'经济', science:'科学', religion:'宗教'});
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// A single public contract against this place's present channels. This is not
// a window affordability check: other drafts and annual evolution are excluded.
// The caller supplies the exact preview contract, including its legacy terms.
export function getLocalCostLedger(state, cellId, action) {
  if (!state || state.phase !== 'planning' || ![0,10,20,30].includes(state.year)
    || !Array.isArray(state.cells) || !object(action) || !object(action.cost)) return null;
  const cells = state.cells.filter(cell => cell?.id === cellId);
  if (cells.length !== 1 || !object(cells[0].channels)) return null;
  const entries = Object.entries(action.cost);
  if (entries.some(([key, cost]) => !Object.hasOwn(labels, key) || !Number.isFinite(cost) || cost < 0)) return null;
  const rows = [];
  for (const [key, cost] of entries) {
    if (cost === 0) continue;
    const before = cells[0].channels[key];
    if (!Number.isFinite(before) || before < 0 || before > 100) return null;
    const after = before - cost;
    rows.push({key, label:labels[key], before, cost, after, insufficient:after < 0});
  }
  return {cellId, readOnly:true, scope:'single-contract', rows};
}

// Two-decimal display never turns a real shortfall into a reassuring zero.
export function localCostNumber(value) {
  if (!Number.isFinite(value)) return '未知';
  if (value === 0) return '0';
  if (Math.abs(value) < .01) return value < 0 ? '负且少于 0.01' : '少于 0.01';
  return Number(value.toFixed(2)).toString();
}
