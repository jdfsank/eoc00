// Read-only wayfinding for an existing actor refusal, not a new rule, action,
// consent record or proof of a past promise. Full reasons stay in the scene.
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderChoiceAgency(refusals) {
 if (!Array.isArray(refusals) || refusals.length !== 1) return '';
 const refusal = refusals[0];
 if (refusal?.actionId !== 'relocate_teacher' || typeof refusal.title !== 'string' || !refusal.title.trim()
   || typeof refusal.reason !== 'string' || !refusal.reason.trim()) return '';
 return `<aside class="choice-agency" data-choice-agency><span class="eyebrow">执行者的立场</span><h3 data-actor-agency-target="summary" tabindex="-1">${escape(refusal.title)}</h3><p>补充调查不会解除这项执行限制。它只约束她自己的执行，不替主角作决定。</p><button type="button" class="secondary" data-actor-agency-link="reason">回读完整理由</button></aside>`;
}

// No persisted navigation or world state. The caller handles repeated pointer
// activation. A link can only move between these two regions of the same scene.
export function navigateActorAgency(link) {
 const page = link?.closest?.('.scene-planning-page');
 const destination = link?.dataset?.actorAgencyLink;
 if (!page || !['reason', 'summary'].includes(destination)) return null;
 const origin = link.closest(destination === 'reason' ? '[data-choice-agency]' : '.actor-refusal');
 if (!origin || origin.closest('.scene-planning-page') !== page) return null;
 const targets = page.querySelectorAll(`[data-actor-agency-target="${destination}"]`);
 if (targets.length !== 1) return null;
 const target = targets[0];
 const region = target.closest(destination === 'reason' ? '.actor-refusal' : '[data-choice-agency]');
 if (!region || region.closest('.scene-planning-page') !== page) return null;
 target.focus({preventScroll:true});
 target.scrollIntoView({block:'start',behavior:'instant'});
 return target;
}
