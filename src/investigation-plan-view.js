// Public planning facts only. Rendering never reads a material body or changes
// evidence, drafts, costs, random results, or the world.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const actionTitle = (plan, id) => plan.actions.find(action => action.actionId === id)?.title || id;

export function renderInvestigationBudget(plan) {
  if (!plan) return '';
  return `<div class="research-budget" data-investigation-plan data-plan-cell="${esc(plan.cellId)}" data-plan-actor="${esc(plan.actorId)}"><div class="research-tokens" aria-hidden="true">${Array.from({length:plan.maxBudget},(_,i)=>`<i class="research-token ${i < plan.spent ? 'spent' : 'remaining'}">${i < plan.spent ? '×' : '·'}</i>`).join('')}</div><p><strong>剩余 ${plan.budget} / ${plan.maxBudget} 轮</strong><span>本角色本窗口共用 · 换地点不补充</span></p></div>`;
}

export function renderActionResearch(action, budget) {
  if (!action) return '';
  const missing = action.requiredEvidence.filter(material => !material.acquired);
  const status = !action.reachable ? `本窗口取证不足 · 还需 ${action.requiredRounds} 轮，现余 ${budget} 轮` : action.requiredRounds ? `取证还需 ${action.requiredRounds} 轮 · 之后余 ${action.budgetAfter} 轮` : action.requiredEvidence.length ? '所需材料已取得 · 无需再调查' : '无需取证 · 保留现有轮数';
  return `<span class="choice-research ${action.reachable ? 'reachable' : 'unreachable'}" data-action-research="${esc(action.actionId)}" data-research-reachable="${action.reachable}"><strong>${esc(status)}</strong>${missing.length ? `<small>${missing.map(material=>`${esc(material.name)} · ${material.cost}轮`).join('；')}</small>` : ''}${action.optionalEnhancements.map(extra=>`<small class="research-enhancement">可选：${esc(extra.title)} · ${extra.acquired ? '材料已取得' : extra.reachable ? `另需 ${extra.requiredRounds} 轮` : `还需 ${extra.requiredRounds} 轮，现余不足`}；${extra.acquired ? '重新锁定才采用，原草案不自动增强' : '不是基本停闸的前置'}</small>`).join('')}</span>`;
}

function materialObject(acquired) {
  // Original small dossier objects: a closed, banded packet stays unread;
  // an opened sheet only represents evidence actually held by this actor.
  return acquired
    ? '<svg class="material-object acquired" viewBox="0 0 28 32" aria-hidden="true" focusable="false"><path d="M3 9h8l3-4h11v23H3z" fill="currentColor" opacity=".28"/><path d="M7 3h12l5 5v19H7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19 3v6h5M10 18l4 4 7-9" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
    : '<svg class="material-object unread" viewBox="0 0 28 32" aria-hidden="true" focusable="false"><path d="M5 3h15l4 5v21H5z" fill="currentColor" opacity=".13"/><path d="M5 3h15l4 5v21H5zM20 3v6h4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 14h21v6H4z" fill="currentColor"/><path d="M13 14v6" stroke="#18383e" stroke-width="2"/></svg>';
}

export function renderMaterialSummary(material, plan, intent = null) {
  if (!material) return '';
  const uses = material.requiredBy.map(id=>actionTitle(plan,id));
  uses.push(...material.enhances.map(extra=>plan.actions.find(action=>action.actionId===extra.actionId)?.optionalEnhancements.find(item=>item.id===extra.enhancementId)?.title || '可选强化'));
  const purpose = uses.length ? `用于：${uses.join('、')}` : intent?.usage === 'background' ? '本窗口无对应方案 · 了解背景' : intent?.destinations?.length ? `本地当前方案不需要 · 可携往 ${intent.destinations.map(place=>place.cellId).join('、')}` : material.portable ? '本地当前方案不需要 · 可随本人携带' : '本地当前方案不需要 · 了解背景';
  return `${materialObject(material.acquired)}<span class="material-summary-copy"><span class="material-name">${esc(material.name)}</span><small>${esc(purpose)}</small></span><span class="material-cost">${material.acquired ? '已取得' : `${material.cost}轮`}</span>`;
}

export function renderMaterialDecision(material, plan, intent = null) {
  if (!material || material.acquired) return '';
  const losses = material.blocksAfter.map(id=>actionTitle(plan,id));
  const enhanced = material.enhancementsLostAfter.map(extra=>plan.actions.find(action=>action.actionId===extra.actionId)?.optionalEnhancements.find(item=>item.id===extra.enhancementId)?.title || '可选强化');
  const warnings = [losses.length ? `调查后，本窗口无法补齐：${losses.join('、')}。` : '', enhanced.length ? `调查后无法再取得：${enhanced.join('、')}所需材料；基本停闸仍不要求材料。` : ''].filter(Boolean);
  return `<div class="material-decision" data-material-decision="${esc(material.id)}">${intent?.prompt ? `<p class="material-question">${esc(intent.prompt)}</p>` : ''}<p class="material-rounds">${material.canInvestigate ? `本次用 ${material.cost} 轮 → 调查后剩余 ${material.budgetAfter} 轮` : `本次需 ${material.cost} 轮，现余 ${plan.budget} 轮，不足`}</p>${warnings.length ? `<p class="research-warning" data-investigation-warning="${esc(material.id)}">${warnings.map(esc).join('<br>')}</p>` : ''}<p class="material-scope">${material.portable ? '材料随本人携带；不与另一角色共用。' : '材料只用于此地，不在别处自动生效。'}${intent?.destinations?.length ? ` 可用于${intent.destinations.map(place=>`${esc(place.cellId)}的${place.actions.map(action=>esc(action.title)).join('、')}`).join('；')}；仍须分别核对当地合同。` : ''}</p></div>`;
}

export function renderContractResearch(action, plan) {
  if (!action || !plan) return '';
  const missing = action.requiredEvidence.filter(material=>!material.acquired);
  return `<section class="contract-research ${missing.length ? 'missing-evidence' : ''} ${action.reachable ? '' : 'unreachable'}" data-contract-research data-research-reachable="${action.reachable}"><h2>${action.reachable ? '这份合同的取证安排' : '本窗口已无法补齐取证'}</h2>${renderActionResearch(action,plan.budget)}${missing.length ? `<div class="research-material-links">${missing.map(material=>`<button class="text-button" data-action="preview-evidence" data-id="${esc(material.id)}">查看材料：${esc(material.name)} · ${material.cost}轮</button>`).join('')}</div>` : ''}<p>只核对调查轮数；费用、名额及同格安排仍须在提交前核对。查看材料入口不会调查。</p></section>`;
}
