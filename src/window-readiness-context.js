import {getActors, getLockedPlanningFacts, getPublicPlanningChecks, getPublicPlanningStateIssues} from './simulation.js';

// A reading directory for an existing review, never a second submission gate.
// Error prose stays authoritative and unparsed. Routes come from public facts,
// only when those facts reproduce the complete current review's issue list.
export function getWindowReadinessContext(state, review) {
  if (state?.phase !== 'planning' || ![0,10,20,30].includes(state.year)
    || !review || review.ready !== false || !Array.isArray(review.issues) || !review.issues.length) return null;
  const view = {issues:[...review.issues], routes:[]};
  try {
    if (getPublicPlanningStateIssues(state).length) return view;
    const actors = getActors(state), facts = getLockedPlanningFacts(state);
    const checks = getPublicPlanningChecks(state, facts.tasks.map(({d,a}) => ({actorId:d.actorId,cellId:d.cellId,cost:a.cost})), facts.assignedActorIds);
    if (JSON.stringify([...facts.issues,...checks.issues]) !== JSON.stringify(review.issues)) return view;
    const actorRoute = actor => ({target:`actor:${actor.id}`, label:`核对${actor.name}的安排`});
    for (const actor of actors) if (!facts.assignedActorIds.includes(actor.id)) {
      view.routes.push({kind:'unassigned', label:`${actor.name}尚未安排`, links:[actorRoute(actor)]});
    }
    const cells = new Map();
    for (const {d} of facts.tasks) {
      const list = cells.get(d.cellId) || [];
      list.push(actors.find(actor => actor.id === d.actorId));
      cells.set(d.cellId,list);
    }
    for (const [id, people] of cells) if (people.length > 1) {
      view.routes.push({kind:'conflict', label:`${id} · 同地安排需要重排`, links:people.map(actorRoute)});
    }
    for (const [id,cost] of Object.entries(checks.costs)) {
      const local = state.cells.find(cell => cell.id === id);
      if (Object.entries(cost).some(([key,value]) => local.channels[key] < value)) {
        view.routes.push({kind:'cost', label:`${id} · 当地能力不足`, links:[{target:`cost:${id}`,label:`核对${id}本轮成本`},...(cells.get(id)||[]).map(actorRoute)]});
      }
    }
    return view;
  } catch {
    // Unknown or damaged facts do not nominate a person to change their plans.
    return {...view,routes:[]};
  }
}
