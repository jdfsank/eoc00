const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderPlanningOpportunity(view) {
  if (!view) return '';
  return `<section class="planning-opportunity" data-planning-opportunity data-opportunity-context="${esc(view.context)}" data-policy-status="${esc(view.policyActor.status)}"><h2>${esc(view.heading)}</h2><p class="opportunity-role">${esc(view.roleText)}</p><p class="opportunity-status" role="status">${esc(view.statusText)}</p><p class="opportunity-context">${esc(view.contextText)}</p><details class="opportunity-boundary"><summary>取证、锁定与提交的区别</summary><p>${esc(view.notice)}</p></details></section>`;
}
