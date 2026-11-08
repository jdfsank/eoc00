// Original scale and gate line drawings are explanatory, not saved outcomes.
// The surrounding original button remains the only action and accessible name.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scale = '<svg viewBox="0 0 42 42" aria-hidden="true" focusable="false"><path d="M8 5h10v30H8zM24 9h10v26H24zM9 12h5m-5 6h3m-3 6h5m11-8h5m-5 6h3m-3 6h5M5 38h32M18 8l6 4m-6 17 6-4"/></svg>';
const gate = '<svg viewBox="0 0 42 42" aria-hidden="true" focusable="false"><path d="M8 33V9h26v24M13 9v19h16V9M13 17h16M21 5v8M16 5h10M4 34c4-4 7 4 11 0s7 4 11 0 7 4 12 0M4 39c4-4 7 4 11 0s7 4 11 0 7 4 12 0"/></svg>';
export function renderCrisisForkDetail(choice) {
  if (!choice || !['independent_review', 'local_veto'].includes(choice.actionId)
    || !choice.timing || !choice.effect || !choice.responsibility) return '';
  return `<span class="crisis-fork-detail" id="crisis-fork-${esc(choice.actionId)}" data-crisis-choice="${esc(choice.actionId)}"><span class="crisis-fork-time" data-crisis-timing>${choice.actionId === 'independent_review' ? scale : gate}<span>${esc(choice.timing)}</span></span><span class="crisis-fork-effect" data-crisis-effect>${esc(choice.effect)}</span><span class="crisis-fork-responsibility" data-crisis-responsibility><b>仍需面对</b><span>${esc(choice.responsibility)}</span></span></span>`;
}
