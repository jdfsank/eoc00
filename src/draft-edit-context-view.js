const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Prospective reading copy, never a quotation, historical event or extra rule.
export function renderDraftEditContext(view){
 if(!view)return '';
 return `<section class="draft-edit-context" data-draft-edit-context data-draft-edit-actor="${esc(view.actorId)}" aria-label="重选中的原安排"><span class="eyebrow">重选中 · 原安排仍保留</span><h2>重读之后，再决定</h2><p class="draft-edit-original">${esc(view.actorName)}${view.cellId?` · ${esc(view.cellId)}`:''} · ${esc(view.title)}</p><p class="draft-edit-boundary">眼前是备选，不是新的承诺。明确重新锁定，才会替换原安排。</p><p class="draft-edit-investigation">阅读免费；实际调查仍消耗轮次，已用轮次不退回。</p><button class="secondary" data-action="draft-edit-return">保留原安排，返回本轮</button></section>`;
}
