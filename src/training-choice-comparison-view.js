// Rendering has no state, investigation, locking or settlement access.
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const labels = {politics:'政治',economy:'经济',science:'科学',religion:'宗教'};
const number = value => Number(value).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
const amounts = (source, prefix = '') => Object.entries(source).filter(([,value]) => value !== 0).map(([key,value]) => `${labels[key] || key}${prefix}${number(value)}`).join(' · ') || '无';

export function renderTrainingChoiceComparison(view) {
  if (!view?.readOnly || view.options?.length !== 2) return '';
  const after = view.conditional;
  const readiness = after.shareMissing.length
    ? `即使本项兑现，共享仍缺：${after.shareMissing.join('；')}。`
    : '若本项兑现且当前其他条件保留，人手、跨地校验与信任可满足共享条件；方针仍须另行安排。';
  const [authorization, training] = view.options;
  const shortCosts = `原学徒：${amounts(authorization.cost)}，承接原有职责；新培训：${amounts(training.cost)}，增加教学产出。`;
  return `<details class="training-choice-comparison" data-training-choice-comparison data-training-choice-cell="${esc(view.cellId)}" data-training-choice-actor="${esc(view.actorId)}" aria-labelledby="training-choice-title"><summary class="training-choice-summary"><span class="training-choice-kicker">最后一次介入 · 只读比较</span><strong id="training-choice-title">${esc(view.title)}</strong><span class="training-choice-compact">${esc(shortCosts)}</span><span class="training-choice-disclosure">展开成本、承接与产出对照</span></summary><div class="training-choice-body"><p class="training-choice-intro">两项都可补上E4地方承接授权，承接者不同；同地新增学校不多算一个人手地域。</p><div class="training-choice-options">${view.options.map(option => `<article class="training-choice-option" data-training-choice="${esc(option.actionId)}"><h4>${esc(option.title)}</h4><p class="training-choice-cost"><strong>${esc(amounts(option.cost))}</strong> · ${option.investigationRounds ? `本地证词${esc(option.investigationRounds)}轮` : '无需取证'}${option.affordable ? '' : '<span class="training-choice-shortfall">当前本地余额不足</span>'}</p><p class="training-choice-recipient">${option.newInstitutions ? '新增1处学校，由新维护者承接；原点不补签。' : '原第7年E4学徒取得本地承接权，不新建机构。'}</p><p class="training-choice-source">新增年度来源：<strong>${esc(amounts(option.annualSourceAdded, '+'))}</strong></p><p class="training-choice-coverage">若第${esc(option.dueYear)}年兑现：覆盖 ${number(option.coverage.current)} → ${number(option.coverage.ifFulfilled)}<span>同地取最高，不相加</span></p></article>`).join('')}</div><p class="training-choice-readiness">${esc(readiness)}两项都不改变第23年损失。</p><details class="training-choice-detail" data-training-choice-detail><summary>核对兑现条件与比较边界</summary><p>${esc(after.assumption)}</p>${view.options.map(option=>`<div data-training-choice-conditions="${esc(option.actionId)}"><h4>${esc(option.title)} · 第${esc(option.dueYear)}年</h4>${option.requiredEvidence.length?`<p>材料：${option.requiredEvidence.map(item=>`${esc(item.title)}（${item.local?'E4本地，':''}${esc(item.rounds)}轮）`).join('、')}。</p>`:''}${option.conditions.map(condition=>`<p>${esc(condition)}</p>`).join('')}</div>`).join('')}${view.notes.map(note=>`<p>${esc(note)}</p>`).join('')}</details></div></details>`;
}
