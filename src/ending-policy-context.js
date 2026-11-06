// Add a present-tense checkpoint to an already-verified ending recollection.
// The established reader owns policy, provenance and old-rule assessment.
// Do not recalculate scores or turn the signing date into lasting readiness.
export function getEndingPolicyContext(clock, recollection) {
  if (clock?.year !== 40 || clock?.phase !== 'ended'
    || !recollection || typeof recollection.opening !== 'string' || !recollection.opening.trim()
    || !Array.isArray(recollection.lastInterventions)) return null;
  const cards = recollection.lastInterventions;
  if (cards.some(card => !card || typeof card.actorId !== 'string')
    || new Set(cards.map(card => card.actorId)).size !== cards.length) return null;
  const card = cards.find(card => card.actorId === 'protagonist');
  if (!card || card.status !== 'success'
    || !['share_power', 'withdraw', 'central_review'].includes(card.actionId)) return null;
  return {actorId: card.actorId, label: '第40年的核对', summary: recollection.opening,
    responsibilityLabel: '持续的责任'};
}
