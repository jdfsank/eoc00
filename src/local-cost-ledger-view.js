import {localCostNumber} from './local-cost-ledger.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// A fixed 0–100 local-channel scale, never a probability or affordability gate.
// The original numbers remain the accessible, authoritative representation.
export function renderLocalCostTrack(row) {
  if (![row.before, row.cost, row.after].every(Number.isFinite)
    || row.before < 0 || row.before > 100 || row.cost < 0
    || row.after !== row.before - row.cost) return '';
  const spent = Math.min(row.before, row.cost);
  const left = Math.max(0, row.after);
  return `<span class="local-cost-track" aria-hidden="true"><span class="local-cost-spent" style="width:${spent}%"></span><span class="local-cost-left" style="width:${left}%"></span></span>`;
}

export function renderLocalCostLedger(view) {
  if (!view) return '';
  const mark = '<svg class="local-cost-mark" viewBox="0 0 40 32" aria-hidden="true" focusable="false"><path d="M3 3h14l3 3 3-3h14v26H23l-3 2-3-2H3Z M20 6v25 M7 10h6m-6 5h6m-6 5h6m14-10h6m-6 5h6m-6 5h6"/></svg>';
  return `<section class="local-cost-ledger" data-local-cost-ledger="${esc(view.cellId)}"><h2>${mark}<span>${esc(view.cellId)} · 这笔投入由当地承担</span></h2>${view.rows.length ? `<ul class="local-cost-rows">${view.rows.map(row => `<li data-local-cost-channel="${esc(row.key)}" data-local-cost-shortfall="${row.insufficient}"><strong class="local-cost-channel ${esc(row.key)}">${esc(row.label)}</strong><div class="local-cost-figures"><span>当前约 <b>${esc(localCostNumber(row.before))}</b></span><span>本项需 <b>${esc(localCostNumber(row.cost))}</b></span><span class="local-cost-result">${row.insufficient ? '单项仍缺约' : '单项后约'} <b>${esc(localCostNumber(Math.abs(row.after)))}</b></span></div>${renderLocalCostTrack(row)}</li>`).join('')}</ul><p class="local-cost-key"><span class="local-cost-key-token"><span aria-hidden="true" class="local-cost-key-spent"></span>斜线</span>：本项占用现有通道。<span class="local-cost-key-token"><span aria-hidden="true" class="local-cost-key-left"></span>实色</span>：单项余量。满格为 100；不足仍看上方差额。</p>` : '<p>本项不扣当地通道，仍占用本窗口一次介入。</p>'}<p class="local-cost-boundary">账页记录投入，收益仍须等待合同兑现。其他地点的通道不能代付。这里仅扣本项，尚未支付；未合并同地其他草稿，也未计算年度演化。最终在本轮安排核对。</p></section>`;
}
