// Three sketches name how responsibility is carried, not a promised ending.
// The original directory button remains the only interactive control.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const drawings = {
  share_power: '<path d="M7 8h10v12H7zM25 8h10v12H25zM16 26h10v11H16zM17 14h8M12 20v10h4m14-10v10h-4M10 12h4m14 0h4m-13 18h4"/>',
  central_review: '<path d="M16 4h10v12H16zM4 28h10v10H4zM28 28h10v10H28zM21 16v6M9 28v-6h24v6M19 8h4m-4 4h4M7 32h4m20 0h4"/>',
  withdraw: '<path d="M5 5h13v32H5M11 21h3M23 11h13v11H23zM23 27h13v10H23zM18 21h7m-4-4 4 4-4 4M26 15h7m-7 16h7"/>',
};
export function renderPolicyForkDetail(choice) {
  if (!choice || !Object.hasOwn(drawings, choice.actionId)
    || !choice.effect || !choice.responsibility || !choice.current) return '';
  return `<span class="policy-fork-detail" id="policy-fork-${esc(choice.actionId)}" data-policy-choice="${esc(choice.actionId)}"><span class="policy-fork-effect"><svg viewBox="0 0 42 42" aria-hidden="true" focusable="false">${drawings[choice.actionId]}</svg><span><b>方针所求</b><span data-policy-effect>${esc(choice.effect)}</span></span></span><span class="policy-fork-current"><b>此刻核对</b><span data-policy-current>${esc(choice.current)}</span></span><span class="policy-fork-responsibility"><b>仍需承担</b><span data-policy-responsibility>${esc(choice.responsibility)}</span></span></span>`;
}
export function renderPolicyForkTiming(fork) {
  if (!fork?.timing || !fork?.assessment) return '';
  return `<span class="policy-fork-timing" id="policy-fork-timing" data-policy-timing><b>三种方针的时点</b><span>${esc(fork.timing)}</span><span>${esc(fork.assessment)}</span></span>`;
}
