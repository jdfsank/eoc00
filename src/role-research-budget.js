const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Compare public, already-computed investigation facts. Never spend, reserve,
// share evidence, infer affordability, or describe a whole plan as executable.
export function getRoleResearchBudget(role) {
  if (!role || !Number.isInteger(role.budget) || role.budget < 0 || role.budget > 3
    || !Number.isInteger(role.requiredRounds) || role.requiredRounds < 0) return null;
  const used = 3 - role.budget, needed = role.requiredRounds;
  const shortfall = Math.max(0, needed - role.budget);
  return {
    used, needed, shortfall,
    status: needed === 0 ? 'gathered' : shortfall ? 'shortfall' : 'available',
    summary: needed === 0 ? '本项无需补取材料' : shortfall ? `本项取证仍缺 ${shortfall} 轮` : '剩余轮次够取本项材料',
    slots: Array.from({length:3}, (_, i) => i < used ? 'used' : i < used + needed ? 'needed' : 'free'),
  };
}

export function renderRoleResearchBudget(role) {
  const view = getRoleResearchBudget(role);
  if (!view) return '';
  const label = {used:'已用', needed:'仍需', free:'余轮'};
  return `<div class="role-research-budget" data-role-budget="${view.status}"><p class="role-research-summary">${esc(view.summary)}</p><div class="role-research-slots" aria-hidden="true">${view.slots.map(kind => `<span class="role-research-slot ${kind}">${label[kind]}</span>`).join('')}</div><p class="role-research-note">本窗口已用 ${view.used} 轮；换地点不重置。</p></div>`;
}
