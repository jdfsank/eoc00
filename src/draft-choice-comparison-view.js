const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Presentation only: terms are supplied by the same contract readers as the
// full preview. Native details adds no second selection or save state.
export function renderDraftChoiceComparison(view){
 if(!view)return '';
 const tabs={cost:'成本',time:'时间',reward:'收益',risk:'风险',responsibility:'责任'};
 const link=(id,text,extra='')=>`<a href="#draft-comparison-${id==='close'?'index':esc(id)}" data-draft-comparison-link="${esc(id)}" ${extra}>${text}</a>`;
 const index=`<nav class="draft-comparison-index" aria-label="原案与备选账页目录"><h2 id="draft-comparison-index" tabindex="-1">账页目录 <span>只定位，不改安排</span></h2><div class="draft-comparison-tabs">${view.rows.filter(row=>Object.hasOwn(tabs,row.id)).map((row,i)=>link(row.id,`<span aria-hidden="true">${String(i+1).padStart(2,'0')}</span>${tabs[row.id]}`,`aria-label="定位：${esc(row.label)}"`)).join('')}</div></nav>`;
 const label=kind=>kind==='original'?'保留原安排':'若改为此方案';
 return `<details class="draft-choice-comparison" data-draft-choice-comparison><summary>对照原安排与备选 · 免费</summary>${index}<div class="draft-comparison-intro"><span class="eyebrow">同一角色 · 两种安排</span><h2>逐项看，再决定是否替换</h2><p>${esc(view.actorName)}的两列安排互为替代，不是叠加支付。成本来自各自地点，不是全图通用的钱；整轮余额、名额和冲突仍须返回本轮核对。</p><p data-draft-comparison-evidence>${esc(view.evidenceNote)}</p></div><div class="draft-comparison-choices">${['original','candidate'].map(kind=>`<div data-draft-comparison-choice="${kind}"><span>${label(kind)}</span><strong>${esc(view[kind].title)}</strong><p>${esc(view[kind].location)}</p></div>`).join('')}</div><div class="draft-comparison-rows">${view.rows.map(row=>`<section class="draft-comparison-row" data-draft-comparison-row="${esc(row.id)}"><h3 id="draft-comparison-${esc(row.id)}" tabindex="-1">${esc(row.label)}</h3><div class="draft-comparison-pair">${['original','candidate'].map(kind=>`<div data-draft-comparison-value="${kind}"><span>${label(kind)}</span><p>${esc(row[kind])}</p></div>`).join('')}</div><div class="draft-comparison-row-return">${link('index','↑ 回到账页目录')}</div></section>`).join('')}</div><p class="draft-comparison-boundary">这里是尚未提交的合同对照，不是已发生的结果，也不预测随机结局。阅读或收起不改安排；实际调查已用轮次不退回，明确重新锁定才替换。</p><div class="draft-comparison-close">${link('close','收起对照，继续核对备选')}</div></details>`;
}
