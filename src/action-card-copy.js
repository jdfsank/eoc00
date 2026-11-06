// A narrow pre-investigation comparison, supplied with an already available
// public contract. Do not create an action, infer consent, or rewrite an older
// contract. Missing terms stay unknown; valid terms are copied without edits.
export function getActionCardTradeoff(action) {
  if (!action || action.id !== 'relocate_teacher') return null;
  return [
    ['reward', '若合同兑现'],
    ['risk', '仍需承担'],
  ].map(([field, label]) => {
    const value = action[field];
    const known = typeof value === 'string' && value.trim().length > 0;
    return { field, label, text: known ? value : null, known };
  });
}
