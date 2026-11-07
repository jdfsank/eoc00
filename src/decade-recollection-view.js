const esc = value => (typeof value === 'string' ? value : '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const sourceButton = (id, label) => `<button class="text-button" data-action="trace" data-id="${esc(id)}">${label}</button>`;
const ROWS = [['choice', '上次的选择：'], ['outcome', '这些年：'], ['responsibility', '留下的责任：']];

// Render only the provenance-aware recap supplied by its owner. In particular,
// preserve unknown, pass and terminal wording; this view does not infer history.
export function renderDecadeRecollection(view) {
  if (!view || !Array.isArray(view.cards)) return '';
  const cards = view.cards.filter(card => card && hasText(card.actorId));
  return `<section class="decade-recollection"><h2>${esc(view.title)}</h2><p>${esc(view.summary)}</p>${cards.map(card => `<article class="notice recollection-document" data-decade-actor="${esc(card.actorId)}"><h3>${esc(card.name)}</h3><dl class="recollection-rows">${ROWS.map(([field, label]) => `<div class="recollection-row recollection-${field}" data-recollection-field="${field}"><dt>${label}</dt><dd>${esc(card[field])}</dd></div>`).join('')}</dl><div class="button-row recollection-sources">${(Array.isArray(card.sourceIds) ? card.sourceIds : []).filter(hasText).map((id, index) => sourceButton(id, `查看本段来源 ${index + 1}`)).join('')}</div></article>`).join('')}</section>`;
}

// A separate public settlement, not an actor's achievement. The journal already
// filters reached, unique historical records. Defend its render boundary too:
// absent/ambiguous or non-crisis rows do not become a synthetic zero-loss report.
export function renderDecadeSettlement(journal) {
  if (!journal?.isBoundary || ![30, 40].includes(journal.year) || !Array.isArray(journal.turns)) return '';
  const candidates = journal.turns.filter(turn => turn?.category === 'crisis');
  if (candidates.length !== 1) return '';
  const turn = candidates[0], record = turn.record;
  if (!hasText(turn.id) || journal.turns.filter(row => row?.id === turn.id).length !== 1
    || !Number.isInteger(journal.start) || !Number.isInteger(turn.year)
    || turn.year <= journal.start || turn.year > journal.year
    || !record || record.id !== turn.id || record.year !== turn.year || record.kind !== 'crisis'
    || (record.status !== undefined && record.status !== 'confirmed')
    || (record.reality !== undefined && record.reality !== 'R1') || !hasText(record.text)) return '';
  return `<section class="decade-settlement" data-decade-settlement><h2>同一段历史里的清点</h2><p class="decade-settlement-meta">第 ${turn.year} 年${hasText(turn.title) ? ` · ${esc(turn.title)}` : ''}</p><p class="decade-settlement-text">${esc(record.text)}</p><div class="button-row">${sourceButton(turn.id, '核对这份原始清点')}</div></section>`;
}
