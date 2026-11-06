// An additive explanation of an already-produced public comparison. It never
// reads the world, alters the comparison, or replaces any original issue.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const variants = ['review', 'surveyed_veto', 'basic_veto'];
const actions = ['independent_review', 'local_veto', 'local_veto'];
const identity = actor => object(actor) && text(actor.actorId) && text(actor.actorName);

export function getComparisonGuidance(view) {
  try {
    if (!object(view) || view.hypothetical !== true || !identity(view) || !['B4', 'F6'].includes(view.cellId)
      || !Number.isInteger(view.budget) || view.budget < 0 || view.budget > 3
      || !Array.isArray(view.issues) || view.issues.length || !Array.isArray(view.retained)
      || !Array.isArray(view.options) || view.options.length !== variants.length) return null;
    if (view.retained.some(actor => !identity(actor) || actor.actorId === view.actorId
      || !['missing', 'locked', 'passed'].includes(actor.status))
      || new Set(view.retained.map(actor => actor.actorId)).size !== view.retained.length) return null;
    // Missing other actors must still block every original candidate. Do not
    // interpret an inconsistent or future comparison shape as a known gap.
    if (view.options.some((option, index) => !object(option) || option.id !== variants[index] || option.actionId !== actions[index]
      || !Number.isInteger(option.dueYear) || option.dueYear <= 20 || option.dueYear > 40
      || !Number.isFinite(option.probability) || option.probability < 0 || option.probability > 1
      || option.ready !== false || option.outlook !== null || !Array.isArray(option.issues)
      || !option.issues.every(text))) return null;
    const missingActors = view.retained.filter(actor => actor.status === 'missing');
    if (!missingActors.length) return null;
    return {kind:'missing-other-actors', actorId:view.actorId, actorName:view.actorName,
      missingActors:missingActors.map(actor => ({actorId:actor.actorId, actorName:actor.actorName}))};
  } catch {
    return null;
  }
}

const esc = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));

export function renderComparisonGuidance(guidance) {
  try {
    if (!object(guidance) || guidance.kind !== 'missing-other-actors' || !identity(guidance)
      || !Array.isArray(guidance.missingActors) || !guidance.missingActors.length
      || guidance.missingActors.some(actor => !identity(actor) || actor.actorId === guidance.actorId)
      || new Set(guidance.missingActors.map(actor => actor.actorId)).size !== guidance.missingActors.length) return '';
    const others = guidance.missingActors.map(actor => esc(actor.actorName)).join('、');
    return `<aside class="comparison-guidance" data-comparison-guidance><h3>先补齐${others}的安排</h3><p>可先为${others}锁定任务或明确放弃；这里仅假设${esc(guidance.actorName)}的三种方案，${esc(guidance.actorName)}不必先取证或锁定。当前无整轮数值不等于零损失。</p><p class="muted">费用、同格安排及其他缺口仍以下方原提示为准。前往安排页不会自动锁定、放弃或提交。</p><button class="secondary" data-action="window">前往本轮安排</button></aside>`;
  } catch {
    return '';
  }
}
