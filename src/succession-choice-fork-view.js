// The small figures represent contractual roles, never saved people or events.
// The original directory still owns the only navigation action and name.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const person='<svg viewBox="0 0 30 34" aria-hidden="true" focusable="false"><circle cx="15" cy="8" r="4"/><path d="M8 29V20c0-5 14-5 14 0v9M12 29v-7m6 7v-7"/></svg>';
const desk='<svg viewBox="0 0 36 34" aria-hidden="true" focusable="false"><path d="M5 18h26M8 18v12m20-12v12M12 18V7h13v11M16 11h5m-5 3h5M3 30h30"/></svg>';
export function renderSuccessionForkDetail(choice){
 if(!choice||typeof choice.actionId!=='string'||!choice.travelling||!choice.local||!choice.responsibility)return '';
 return `<span class="succession-fork-detail" id="succession-fork-${esc(choice.actionId)}" data-succession-choice="${esc(choice.actionId)}"><span class="succession-fork-people"><span class="succession-fork-person" data-succession-person="travelling">${person}<span><b>同行</b><span>${esc(choice.travelling)}</span></span></span><span class="succession-fork-person" data-succession-person="local">${desk}<span><b>地方</b><span>${esc(choice.local)}</span></span></span></span><span class="succession-fork-responsibility" data-succession-responsibility><b>仍需面对</b><span>${esc(choice.responsibility)}</span></span></span>`;
}
