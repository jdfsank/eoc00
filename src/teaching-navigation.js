const TARGETS=new Set(['timing','coverage','handoff','role']);
// Pure reading navigation: no URL/history change, render, save, or game action.
export function navigateTeaching(root,target){
 const section=root.querySelector('[data-teaching-mode="contract"]');if(!section)return null;
 let element;
 if(TARGETS.has(target))element=section.querySelector(`[data-teaching-section="${target}"]`);
 else if(target?.startsWith('back:')&&TARGETS.has(target.slice(5)))element=section.querySelector(`[data-action="teaching-jump"][data-target="${target.slice(5)}"]`);
 if(!element)return null;element.focus({preventScroll:true});element.scrollIntoView({block:'start',behavior:'instant'});return element;
}
