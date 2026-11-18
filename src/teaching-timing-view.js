const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={timing:'教学时点',coverage:'覆盖与假设',handoff:'交班缺口',role:'角色名额'};
const group=(id,body)=>`<div class="teaching-reading-group"><h3 tabindex="-1" data-teaching-section="${id}">${labels[id]}</h3>${body}<button type="button" class="text-button teaching-reading-back" data-action="teaching-jump" data-target="back:${id}">返回教学目录：${labels[id]}</button></div>`;
const number=value=>String(Number(value.toFixed(4)));
export function renderTeachingTiming(view, mode='contract') {
 if(!view||!['card','contract'].includes(mode))return '';
 const gap=view.handoffGap?`<span data-teaching-handoff-gap>${esc(view.handoffGap.summary)}${mode==='contract'?esc(view.handoffGap.detail):''}</span>`:'';
 const role=view.roleCost?`<span class="teaching-role-cost" data-teaching-role-cost><strong>本轮名额</strong>${esc(view.roleCost.summary)}${esc(view.roleCost.detail)}</span>`:'';
 const attrs=`data-teaching-timing data-teaching-mode="${mode}" data-teaching-action="${esc(view.actionId)}" data-teaching-year="${view.year}" data-teaching-model="${esc(view.model)}"`;
 if(mode==='card')return `<span class="teaching-timing-card" ${attrs}>${esc(view.timing)}${view.model==='legacy-overall'?'旧档仍按整体规则结算。':''}${gap}${role}</span>`;
 const coverage=view.model==='legacy-overall'
  ?'<p>本档沿用旧整体危机规则，不套用逐地覆盖的减损承诺。</p>'
  :`<div data-teaching-coverage>${view.year>view.crisisYear?'<p data-teaching-history-boundary>以下仅说明后续服务，不改第23年记录。</p>':''}<p data-teaching-current><strong>当前实际覆盖系数：</strong>${number(view.currentCoverage)}</p><p data-teaching-assumptions>假设其他载体保持现状、新学校按合同兑现并足额维护，学校覆盖系数为${number(view.schoolCoverage)}。</p><p data-teaching-conditional><strong>此假设下当地覆盖系数：</strong>${number(view.conditionalCoverage)}</p><p data-teaching-delta><strong>此假设下新增覆盖系数：</strong>${number(view.conditionalIncrease)}</p>${view.conditionalIncrease===0?'<p data-teaching-zero-increase>此假设下当地覆盖不增加；不代表没有其他合同收益。</p>':''}<p>当地取最高值，同地载体不叠加。系数不是人口比例、伤亡比例或成功概率。</p></div>`;
 const ids=['timing','coverage',...(view.handoffGap?['handoff']:[]),...(view.roleCost?['role']:[])];
 const nav=`<nav class="teaching-reading-nav" aria-label="教学阅读目录"><p>直接定位，或读完返回目录。只阅读，不取证、不锁定。</p>${ids.map(id=>`<button type="button" data-action="teaching-jump" data-target="${id}">${labels[id]}</button>`).join('')}</nav>`;
 const timing=`<ol class="teaching-timing-line">${view.events.map(event=>`<li><strong>第${event.year}年</strong><span>${esc(event.label)}</span></li>`).join('')}</ol><p>${esc(view.timing)}</p>`;
 return `<section class="teaching-timing" ${attrs}><h2>教学何时开始</h2>${nav}${group('timing',timing)}${group('coverage',coverage)}${gap?group('handoff',gap):''}${role?group('role',role):''}<p>教学不等于异源校验，不能纠正共同标准。同轮新建的人手不能反过来提高提交时已冻结的复核准备概率。危机按第23年实际运行情况结算。</p></section>`;
}
