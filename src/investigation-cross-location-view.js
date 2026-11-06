// A reading aid for public, current evidence requirements. This view cannot
// acquire evidence, move a character, reserve a task, or predict an outcome.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderCrossLocationInvestigation(plan, materialId) {
  if (!plan) return '';
  if (plan.issues?.length) return `<aside class="cross-location-cost cross-location-unknown" data-cross-location-unknown><h3>跨地取证代价暂未核清</h3><p>${plan.issues.map(esc).join('；')}</p><p>这不表示别处没有代价。请先核对当前公开方案。</p></aside>`;
  const material = plan.materials.find(item => item.id === materialId);
  if (!material || material.acquired || !material.canInvestigate) return '';
  const places = new Map();
  for (const [kind, rows] of [['required', material.blocksAfter], ['enhancement', material.enhancementsLostAfter]]) {
    for (const row of rows) {
      if (!places.has(row.cellId)) places.set(row.cellId, {cellId: row.cellId, name: row.cellName, losses: [], basicRemains: false});
      const place = places.get(row.cellId);
      place.losses.push({...row, kind});
      place.basicRemains ||= kind === 'enhancement' && row.basicRequiresNoEvidence === true;
    }
  }
  if (!places.size) return '';
  return `<aside class="cross-location-cost" data-cross-location-material="${esc(material.id)}"><h3>这轮调查，也占用别处的时间</h3><p class="cross-location-summary"><strong>${esc(plan.actorName)}调查后余 ${esc(material.budgetAfter)} 轮</strong>；本窗口将无法补齐以下异地方案的取证：</p>${[...places.values()].map(place => `<article class="cross-location-loss" data-cross-location-cell="${esc(place.cellId)}"><h4>${esc(place.cellId)} · ${esc(place.name)}</h4><ul>${place.losses.map(row => `<li data-cross-location-action="${esc(row.actionId)}" data-cross-location-kind="${esc(row.kind)}"><strong>${esc(row.kind === 'enhancement' ? row.enhancementTitle : row.title)}</strong><span>调查后仍需 ${esc(row.requiredRoundsAfter)} 轮，届时只余 ${esc(row.budgetAfter)} 轮。</span></li>`).join('')}</ul>${place.basicRemains ? '<p class="cross-location-retained">基本停闸仍无需取证；关闭的是追加强化所需的调查。</p>' : ''}</article>`).join('')}<p class="cross-location-boundary">只核对这位角色的取证轮数，不代表方案已经失败或别处不能工作。${plan.otherActors?.length ? `${plan.otherActors.map(actor => esc(actor.actorName)).join('、')}的调查轮数不受本次影响。` : ''}费用、名额与同格安排仍须分别核对；调查已花轮次不退。</p></aside>`;
}
