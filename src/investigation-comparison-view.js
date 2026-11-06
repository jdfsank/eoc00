// Read-only presentation of public, hypothetical planning facts. This module
// has no game-state, evidence-body, random, lock or commit access.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const channels = {politics:'政治',economy:'经济',science:'科学',religion:'宗教'};
const number = value => Number(value).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
const costText = cost => Object.entries(cost || {}).filter(([,v]) => v).map(([key,value]) => `${channels[key] || key} −${Math.abs(value)}`).join(' · ') || '无通道即时成本';

function investigationText(option, budget) {
  if (!option.investigationCost) return '无需再调查 · 保留现有 ' + budget + ' 轮';
  if (!option.reachable) return `还需 ${option.investigationCost} 轮 · 现余 ${budget} 轮，不足`;
  return `还需 ${option.investigationCost} 轮 → 调查后余 ${option.budgetAfter} 轮`;
}
function contractAvailable(option) {return Number.isFinite(option.dueYear) && Number.isFinite(option.probability);}
function timingText(option) {
  if (!contractAvailable(option)) return '当前合同不可用，发生时间与概率未列';
  return option.actionId === 'independent_review' ? `复核 ${Math.round(option.probability * 100)}% · 第${option.dueYear}年判定一次` : `确定 · 第${option.dueYear}年生效`;
}
function consequence(option) {
  if (!contractAvailable(option)) return '当前没有可核实的公开合同，不补写成本、时点或后果。';
  if (option.id === 'review') return option.probability === 1
    ? '若采用本项，按现有准备可完成复核，纠正共同指令并留下独立校验载体。洪水仍会到来。'
    : '若本项复核成功，可纠正共同指令；若未及时完成，只留下待核实记录，已付费用不退。整轮后果还取决于其他人的实际安排。';
  return `本项提供 ${option.id === 'surveyed_veto' ? '0.20' : '0.30'} 的停闸损失基数，仍不修正共同标准；整轮取较强的一份，不将重复停闸相乘。`;
}
function outcome(view, option) {
  const risk = option.outlook;
  const localIssues = (option.issues || []).filter(issue => !(view.issues || []).includes(issue));
  if (!option.ready || !risk?.ready) return `<div class="comparison-no-outlook"><strong>整轮数值暂不展示</strong><p>${localIssues.length ? '先处理下列缺口，再比较这一组条件。' : '整轮条件待齐，见上方的实际安排与缺口。'}未知不当作零损失。</p>${localIssues.length ? `<ul class="comparison-issues">${localIssues.map(issue => `<li>${esc(issue)}</li>`).join('')}</ul>` : ''}</div>`;
  const actorName = actorId => actorId === view.actorId ? view.actorName : view.retained.find(actor => actor.actorId === actorId)?.actorName || actorId;
  const attempts = risk.attempts || [];
  const showAttempts = attempts.length > 1 || attempts.some(attempt => attempt.actorId !== view.actorId);
  const success = risk.success.available ? `<div class="comparison-outcome" data-branch="success"><span>${risk.guaranteedReview ? '按这组合同，复核确定完成' : '若任一复核及时完成'}</span><p>第23年四地平均损失系数 <strong>${number(risk.success.damage)}</strong></p><small>消除本次共同失效损失，不表示洪水消失。</small></div>` : '';
  const fallback = risk.fallback.possible ? `<div class="comparison-outcome" data-branch="fallback"><span>${attempts.length ? '若所有复核均未及时完成' : '共同标准未被修正时'}</span><p>第23年四地平均损失系数 <strong>${number(risk.fallback.damage)}</strong></p><small>${risk.vetoBase < 1 ? '停闸后备仍有效，再按各地保护分别结算。' : '仅按各地已有及本组确定服务的保护减轻损失。'}</small></div>` : '';
  return `<div class="comparison-branches">${success}${fallback}</div>${showAttempts ? `<ul class="comparison-attempts">${attempts.map(attempt => `<li>${esc(actorName(attempt.actorId))} · ${esc(attempt.cellId)}：各自 ${Math.round(attempt.probability * 100)}%，第${attempt.dueYear}年判定。</li>`).join('')}</ul>${attempts.length > 1 ? '<p class="comparison-caution">各次复核分别判定，不合并成一个整轮成功率。</p>' : '<p class="comparison-caution">这是另一角色已锁定的复核，保留其实际概率与期限。</p>'}` : ''}<details class="investigation-regions" data-comparison-detail="${esc(option.id)}"><summary>核对这组假设的四地条件</summary><p>平均值沿用逐地取整后再平均。损失系数不是伤亡比例。</p><div class="comparison-region-list">${(risk.regions || []).map(region => `<article data-comparison-region="${esc(region.cellId)}"><h4>${esc(region.cellId)}</h4><p>预警覆盖：当前 ${number(region.currentCoverage)} → 若合同兑现 ${number(region.coverage)}</p><p>来源保护 ${number(region.protection)} · ${region.aid ? '当地互助 ×0.70' : '无当地互助保护'}</p>${risk.fallback.possible ? `<p>共同标准未修正时损失 <strong>${number(risk.fallback.damageByCell[region.cellId])}</strong></p>` : ''}</article>`).join('')}</div></details>`;
}

export function renderInvestigationComparison(view) {
  if (!view?.hypothetical) return '';
  const retained = view.retained || [];
  if (!Number.isFinite(view.budget) || !view.options.length) return `<section class="investigation-comparison" data-investigation-comparison data-comparison-cell="${esc(view.cellId)}" data-comparison-actor="${esc(view.actorId)}" aria-labelledby="investigation-comparison-title"><p class="comparison-kicker">只读假设 · 不锁定、不取证</p><h2 id="investigation-comparison-title">${esc(view.title)}</h2><p>当前公开条件无法完整核对，暂不列调查余额或整轮数值。</p><ul class="comparison-issues">${(view.issues || []).map(issue => `<li>${esc(issue)}</li>`).join('')}</ul></section>`;
  return `<section class="investigation-comparison" data-investigation-comparison data-comparison-cell="${esc(view.cellId)}" data-comparison-actor="${esc(view.actorId)}" aria-labelledby="investigation-comparison-title">
    <header class="comparison-heading"><span class="comparison-mark" aria-hidden="true">?</span><div><p class="comparison-kicker">只读假设 · 不锁定、不取证</p><h2 id="investigation-comparison-title">${esc(view.title)}</h2></div></header>
    <p class="comparison-narrative">下一次水位上涨时，哪一份记录能及时送到，哪一道闸门能先停下，现在还没有答案。先把调查的时间和三种安排的条件摆在一起，再决定去查哪份材料。</p>
    <p class="comparison-budget"><strong>${esc(view.actorName)} · ${esc(view.cellId)}</strong><span>本窗口剩余调查 <b>${view.budget}</b> / 3 轮</span></p>
    <p class="comparison-boundary">条件推算，不代替取证。下列三项互为假设，不是三个已锁定任务。阅读不改变当前草案，也不补发证据或退还已花轮次。</p>
    <div class="comparison-retained"><h3>其他人的实际安排保持不变</h3>${retained.length ? `<ul>${retained.map(actor => `<li><strong>${esc(actor.actorName)}</strong> · ${actor.status === 'locked' ? `已锁定 ${esc(actor.cellId)} · ${esc(actor.title || actor.actionId)}` : actor.status === 'passed' ? '已明确放弃本窗口' : '尚未安排，不视为放弃'}</li>`).join('')}</ul>` : '<p>本窗口没有其他可执行角色，不虚构额外安排。</p>'}</div>
    ${view.issues?.length ? `<ul class="comparison-issues comparison-common-issues">${view.issues.map(issue => `<li>${esc(issue)}</li>`).join('')}</ul>` : ''}
    <div class="investigation-options">${view.options.map((option,index) => `<article class="investigation-option" data-comparison-option="${esc(option.id)}" data-reachable="${option.reachable}" data-available="${option.available !== false}" data-ready="${option.ready}">
      <div class="comparison-option-heading"><span class="comparison-option-number" aria-hidden="true">${index + 1}</span><h3>${esc(option.title)}</h3><span class="comparison-status">${!option.reachable ? '调查轮数不足' : option.available === false ? '本项当前不可采用' : !option.ready ? '整轮条件待齐' : '可比较条件'}</span></div>
      <dl class="comparison-facts"><div><dt>调查用时</dt><dd class="comparison-investigation">${esc(investigationText(option, view.budget))}</dd></div><div><dt>提交时的确定成本</dt><dd>${contractAvailable(option)?`${esc(costText(option.cost))} · ${esc(view.cellId)}支付<br>占用本角色本窗口1次介入`:'当前合同不可用，费用未列'}</dd></div><div><dt>本项生效或判定</dt><dd>${esc(timingText(option))}</dd></div></dl>
      <p class="comparison-materials">${option.evidence.length ? `涉及材料：${option.evidence.map(item => `${esc(item.name)}（${item.acquired ? '已取证' : `尚需${item.cost}轮`}）`).join('、')}` : '本项不要求调查材料。'}</p>
      <p class="comparison-consequence">${esc(consequence(option))}</p>${outcome(view,option)}
    </article>`).join('')}</div>
    <details class="comparison-notes"><summary>比较的边界与调查规则</summary>${(view.notes || []).map(note => `<p>${esc(note)}</p>`).join('')}<p>这里只对照本次危机条件，不能替你决定哪种方案对整个四十年更好。实际锁定仍须回到原合同并满足取证要求。</p></details>
  </section>`;
}
