const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>String(Number(value.toFixed(4)));
export function renderTeachingTiming(view, mode='contract') {
 if(!view||!['card','contract'].includes(mode))return '';
 const attrs=`data-teaching-timing data-teaching-mode="${mode}" data-teaching-action="${esc(view.actionId)}" data-teaching-year="${view.year}" data-teaching-model="${esc(view.model)}"`;
 if(mode==='card')return `<span class="teaching-timing-card" ${attrs}>${esc(view.timing)}${view.model==='legacy-overall'?'旧档仍按整体规则结算。':''}</span>`;
 const coverage=view.model==='legacy-overall'
  ?'本档沿用旧整体危机规则，不套用逐地覆盖的减损承诺。'
  :`E4当前覆盖系数为${number(view.currentCoverage)}。假设其他载体保持现状、新学校按合同兑现并足额维护，学校覆盖系数为${number(view.schoolCoverage)}，当地取最高值后为${number(view.conditionalCoverage)}，同地载体不叠加。系数不是人口比例、伤亡比例或成功概率。`;
 return `<section class="teaching-timing" ${attrs}><h2>教学何时开始</h2><ol class="teaching-timing-line">${view.events.map(event=>`<li><strong>第${event.year}年</strong><span>${esc(event.label)}</span></li>`).join('')}</ol><p>${esc(view.timing)}</p><p>${esc(coverage)}</p><p>教学不等于异源校验，不能纠正共同标准。同轮新建的人手不能反过来提高提交时已冻结的复核准备概率。危机按第23年实际运行情况结算。</p></section>`;
}
