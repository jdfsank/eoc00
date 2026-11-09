const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderRoleReadingChoice(choice) {
  if (!choice) return '';
  return `<section class="opportunity-role-choice" data-role-choice aria-label="分别安排两位角色"><h3>两个人，两份职责</h3><p>${esc(choice.explanation)}</p><div class="opportunity-role-pair">${choice.roles.map((role,index)=>`<article class="opportunity-role-slot" data-role-slot="${esc(role.actorId)}"><span class="opportunity-role-seal" aria-hidden="true">${index+1}</span><h4>${esc(role.name)}</h4><p class="opportunity-role-duty">${esc(role.duty)}</p><p data-role-arrangement>${esc(role.arrangement)}</p><p data-role-research>剩余 ${esc(role.budget)} / 3 调查轮；E4本项仍需 ${esc(role.requiredRounds)} 轮。${role.requiredRounds>role.budget?'现有调查余额不足，查看不会补充。':''}</p></article>`).join('')}</div><p class="opportunity-role-boundary">${esc(choice.boundary)}</p><div class="opportunity-role-links">${choice.links.map(link=>`<button class="secondary" data-action="opportunity-route" data-id="${esc(link.id)}">${esc(link.label)}<span>免费查看 · 不锁定</span></button>`).join('')}</div></section>`;
}
