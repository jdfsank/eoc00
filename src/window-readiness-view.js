const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderWindowReadiness(view) {
  if (!view) return '';
  const mark = '<svg viewBox="0 0 40 36" aria-hidden="true" focusable="false"><path d="M4 4h13v27H4zM23 4h13v27H23zM8 10h5m-5 6h5m-5 6h5m19-12h-5m5 6h-5m5 6h-5M17 34h6"/><path d="M18 17h4" stroke-dasharray="1 2"/></svg>';
  return `<section class="notice commit-issues review-readiness" role="status" data-window-readiness><h2 data-review-target="blockers" tabindex="-1">${mark}<span>提交前需要处理</span></h2><p class="readiness-status">整轮尚不能提交，成本还未支付。</p><ul>${view.issues.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>${view.routes.length?`<nav aria-label="定位需要核对的安排" class="readiness-routes">${view.routes.map(route=>`<div data-readiness-kind="${esc(route.kind)}"><h3>${esc(route.label)}</h3><div>${route.links.map(link=>`<button class="secondary" data-action="review-jump" data-target="${esc(link.target)}">${esc(link.label)}</button>`).join('')}</div></div>`).join('')}</nav>`:''}<p class="readiness-boundary">定位只供核对，不撤下任何人的草稿，也不取证或扣费。保留哪份安排，仍由你决定。</p></section>`;
}

export function navigateWindowReadiness(root, target) {
  // Restrict navigation to rendered review headings, not arbitrary selectors.
  const element = [...root.querySelectorAll('[data-review-target]')].find(node => node.dataset.reviewTarget === target);
  if (!element) return null;
  element.focus({preventScroll:true});
  element.scrollIntoView({block:'start',behavior:'instant'});
  return element;
}
